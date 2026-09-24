/**
 * ThreadsOperator.ts
 * High-level Autonomous Operator coordinating:
 * - Post discovery & contextual commenting with real-time trend injection
 * - Agentic DM & comment replies with zero-reject policy and sliding window memory
 * - Checkpoint detection & zero-bypass emergency pause protocol
 * - 2-hour runtime health reload lifecycle
 * - Real-time operator interaction (pause, resume, target profile, mode switch)
 */

import { BrowserClient } from '../cdp/BrowserClient.js';
import { LocalGeminiEngine } from '../engine/LocalGeminiEngine.js';
import { CursorPhysics } from '../humanizer/CursorPhysics.js';
import { KeystrokeSynthesizer } from '../humanizer/KeystrokeSynthesizer.js';
import { RhythmManager } from '../humanizer/RhythmManager.js';
import { CheckpointDetector } from '../security/CheckpointDetector.js';
import { TrendInjector } from '../trend/TrendInjector.js';
import { SessionManager } from '../session/SessionManager.js';
import { ChromeLauncher } from '../launcher/ChromeLauncher.js';
import { ObserveReasonActLoop, CycleResult } from './ObserveReasonActLoop.js';

export interface OperatorConfig {
  initialMode?: 'FEED' | 'DM' | 'PROFILE';
  targetUsername?: string;
  maxCycles?: number;
  cdpPort?: number;
}

export class ThreadsOperator {
  private browserClient: BrowserClient;
  private loop: ObserveReasonActLoop;
  private rhythmManager: RhythmManager;
  private sessionManager: SessionManager;
  private checkpointDetector: CheckpointDetector;

  private currentMode: 'FEED' | 'DM' | 'PROFILE';
  private targetUsername?: string;
  private isPaused: boolean = false;
  private isRunning: boolean = false;
  private maxCycles: number;
  private cdpPort: number;

  // Conversational memory for multi-turn DMs
  private dmConversationHistory: Map<string, string[]> = new Map();

  constructor(
    browserClient: BrowserClient,
    engine: LocalGeminiEngine,
    config: OperatorConfig = {}
  ) {
    this.browserClient = browserClient;
    this.rhythmManager = new RhythmManager();
    this.sessionManager = new SessionManager();
    this.checkpointDetector = new CheckpointDetector();
    const trendInjector = new TrendInjector();
    const cursor = new CursorPhysics();
    const keystroke = new KeystrokeSynthesizer();

    this.loop = new ObserveReasonActLoop(
      this.browserClient,
      engine,
      cursor,
      keystroke,
      this.rhythmManager,
      this.checkpointDetector,
      trendInjector
    );

    this.currentMode = config.initialMode || 'FEED';
    this.targetUsername = config.targetUsername;
    this.maxCycles = config.maxCycles || Infinity;
    this.cdpPort = config.cdpPort || 9222;
  }

  /**
   * Starts the autonomous operational cycle.
   */
  public async start(): Promise<void> {
    this.isRunning = true;
    console.log(`[ThreadsOperator] Initializing operations in mode: ${this.currentMode}`);

    // Restore persistent session state if available
    const page = this.browserClient.getActivePage();
    const cdp = this.browserClient.getCdpSession();
    if (page && cdp) {
      await this.sessionManager.restoreSessionState(page, cdp);
    }

    let cycle = 0;
    while (this.isRunning && cycle < this.maxCycles) {
      // 1. Check for Operator Pause
      if (this.isPaused) {
        console.log(`[ThreadsOperator] Paused. Awaiting manual intervention or operator 'resume'...`);
        await new Promise((r) => setTimeout(r, 2500));
        continue;
      }

      // 2. Check for 2-Hour Runtime Health Reload
      if (this.sessionManager.isGracefulReloadDue()) {
        await this.performGracefulBrowserReload();
        continue;
      }

      // 3. Check for Operational Cooldown Break
      const breakStatus = this.rhythmManager.isInOperationalBreak();
      if (breakStatus.active) {
        console.log(
          `[ThreadsOperator] Operational cool-down break in progress. Sleeping for ${Math.round(
            breakStatus.remainingMs / 60000
          )} minutes to simulate natural human rest.`
        );
        const sleepChunk = Math.min(30000, breakStatus.remainingMs);
        await new Promise((r) => setTimeout(r, sleepChunk));
        continue;
      }

      cycle++;
      try {
        // Sliding context window: pass last 3-5 DM exchanges
        const slidingChat = this.getSlidingChatContext();
        const result: CycleResult = await this.loop.executeCycle(this.currentMode, slidingChat);

        // Security checkpoint handling: immediately pause and preserve state
        if (result.securityChallenge?.isChallengeDetected) {
          console.warn(`[ThreadsOperator] Security challenge triggered emergency pause.`);
          this.isPaused = true;
          const activeP = this.browserClient.getActivePage();
          const activeCdp = this.browserClient.getCdpSession();
          if (activeP && activeCdp) {
            await this.sessionManager.saveSessionState(activeP, activeCdp);
          }
          continue;
        }

        // Record DM thread history
        if (result.mode === 'DM' && result.decision.synthesizedText) {
          this.recordDmMessage('active_thread', `Operator: ${result.decision.synthesizedText}`);
        }

        console.log(`[ThreadsOperator] Dwell pause before next cycle: ${result.delayMs}ms...`);
        await new Promise((r) => setTimeout(r, result.delayMs));
      } catch (err) {
        console.error(`[ThreadsOperator] Error during cycle #${cycle}: ${(err as Error).message}`);
        console.log(`[ThreadsOperator] Initiating dynamic recovery pause (5s)...`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    console.log(`[ThreadsOperator] Operations concluded.`);
  }

  /**
   * Performs graceful session reload every 2 hours:
   * Saves cookies/storage, disconnects, re-launches Chrome CDP, and resumes.
   */
  private async performGracefulBrowserReload(): Promise<void> {
    console.log(`[ThreadsOperator] 2-Hour runtime health threshold reached. Executing graceful session reload...`);
    const page = this.browserClient.getActivePage();
    const cdp = this.browserClient.getCdpSession();
    if (page && cdp) {
      await this.sessionManager.saveSessionState(page, cdp);
    }

    await this.browserClient.disconnect();
    console.log(`[ThreadsOperator] Disconnected existing session. Re-launching Chrome CDP...`);

    await ChromeLauncher.ensureChromeWithCdp(this.cdpPort);
    await this.browserClient.connect();

    const newPage = this.browserClient.getActivePage();
    const newCdp = this.browserClient.getCdpSession();
    if (newPage && newCdp) {
      await this.sessionManager.restoreSessionState(newPage, newCdp);
    }

    this.sessionManager.markReloadCompleted();
    console.log(`[ThreadsOperator] Graceful session reload completed successfully.`);
  }

  public stop(): void {
    this.isRunning = false;
  }

  public pause(): void {
    this.isPaused = true;
    console.log(`[ThreadsOperator] Operator command received: PAUSE`);
  }

  public resume(): void {
    this.isPaused = false;
    console.log(`[ThreadsOperator] Operator command received: RESUME`);
  }

  public setMode(mode: 'FEED' | 'DM' | 'PROFILE'): void {
    this.currentMode = mode;
    console.log(`[ThreadsOperator] Mode updated to: ${mode}`);
  }

  public async targetProfile(username: string): Promise<void> {
    this.targetUsername = username.replace(/^@/, '');
    this.currentMode = 'PROFILE';
    console.log(`[ThreadsOperator] Targeting profile: @${this.targetUsername}`);

    const page = this.browserClient.getActivePage();
    if (page) {
      await page.goto(`https://www.threads.net/@${this.targetUsername}`, {
        waitUntil: 'domcontentloaded',
      });
    }
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      currentMode: this.currentMode,
      targetUsername: this.targetUsername,
      stats: this.rhythmManager.getStats(),
      circadianFactor: this.rhythmManager.getCircadianFactor(),
      uptimeMinutes: Math.round(this.sessionManager.getSessionUptimeMs() / 60000),
    };
  }

  private recordDmMessage(threadId: string, message: string): void {
    const list = this.dmConversationHistory.get(threadId) || [];
    list.push(message);
    if (list.length > 20) list.shift();
    this.dmConversationHistory.set(threadId, list);
  }

  /**
   * Returns sliding context window strictly containing the last 3-5 messages.
   */
  private getSlidingChatContext(threadId: string = 'active_thread'): string[] {
    const history = this.dmConversationHistory.get(threadId) || [];
    return history.slice(-5);
  }
}
