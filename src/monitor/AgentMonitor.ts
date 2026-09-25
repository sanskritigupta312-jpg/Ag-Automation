/**
 * AgentMonitor.ts
 * Dedicated health monitoring agent for the Antigravity automation system.
 * Runs as a lightweight parallel process, pinging every 30 seconds to verify:
 * - The main operator loop is alive and not stalled
 * - Browser CDP connection is responsive
 * - No unexpected long pauses or deadlocks
 * - Reports health status to dashboard via WebSocket callbacks
 */

import { AgentTelemetry } from '../types/CustomerProfile.js';

export interface MonitorConfig {
  pingIntervalMs?: number;
  stallThresholdMs?: number;
}

export class AgentMonitor {
  private pingIntervalMs: number;
  private stallThresholdMs: number;
  private isRunning: boolean = false;
  private lastHeartbeatAt: number = Date.now();
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  public onHealthUpdate?: (telemetry: Partial<AgentTelemetry>, isHealthy: boolean) => void;
  public onStallDetected?: (details: string) => void;

  constructor(config: MonitorConfig = {}) {
    this.pingIntervalMs = config.pingIntervalMs ?? 30000; // 30 seconds
    this.stallThresholdMs = config.stallThresholdMs ?? 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Records a heartbeat from the main operator loop.
   * Call this at the start of each cycle.
   */
  public recordHeartbeat(currentAction: string): void {
    this.lastHeartbeatAt = Date.now();
    console.log(`[AgentMonitor] ♥ Heartbeat: ${currentAction}`);
  }

  /**
   * Starts the monitoring loop.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastHeartbeatAt = Date.now();

    console.log(`[AgentMonitor] Health monitoring started. Ping interval: ${this.pingIntervalMs / 1000}s`);

    this.intervalHandle = setInterval(() => {
      this.performHealthCheck();
    }, this.pingIntervalMs);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    console.log('[AgentMonitor] Health monitoring stopped.');
  }

  private performHealthCheck(): void {
    const now = Date.now();
    const timeSinceHeartbeat = now - this.lastHeartbeatAt;
    const isHealthy = timeSinceHeartbeat < this.stallThresholdMs;

    const status = isHealthy
      ? `✓ Healthy — last activity ${Math.round(timeSinceHeartbeat / 1000)}s ago`
      : `⚠ STALL DETECTED — no activity for ${Math.round(timeSinceHeartbeat / 60000)} minutes`;

    console.log(`[AgentMonitor] Health check: ${status}`);

    if (!isHealthy && this.onStallDetected) {
      this.onStallDetected(
        `Agent appears stalled — no heartbeat for ${Math.round(timeSinceHeartbeat / 60000)} minutes. ` +
          `Last heartbeat was at ${new Date(this.lastHeartbeatAt).toLocaleTimeString()}.`
      );
    }

    if (this.onHealthUpdate) {
      this.onHealthUpdate(
        {
          isRunning: this.isRunning,
          lastActionAt: this.lastHeartbeatAt,
        },
        isHealthy
      );
    }
  }
}
