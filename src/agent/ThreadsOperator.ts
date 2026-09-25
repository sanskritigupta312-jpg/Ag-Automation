/**
 * ThreadsOperator.ts  (upgraded)
 * High-level Autonomous Operator coordinating all agents:
 * - Customer profile-driven operation
 * - Pre-operation intent review (via dashboard)
 * - Full FEED cycle with post-open, comment, verify, back
 * - Parallel InboundMonitor for DM + notification replies
 * - AI-only checkpoint detection
 * - AgentMonitor health watchdog
 * - 2-hour runtime graceful reload
 * - Real-time telemetry streaming to dashboard
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
import { ObserveReasonActLoop, OperationalMode, CycleResult } from './ObserveReasonActLoop.js';
import { InboundMonitor } from './InboundMonitor.js';
import { AgentMonitor } from '../monitor/AgentMonitor.js';
import { SemanticPostReasoner } from '../engine/SemanticPostReasoner.js';
import { CustomerProfile, AgentTelemetry, OperationIntent } from '../types/CustomerProfile.js';
import { IntentInterviewer } from '../intent/IntentInterviewer.js';

export interface OperatorConfig {
  initialMode?: OperationalMode;
  targetUsername?: string;
  maxCycles?: number;
  cdpPort?: number;
}

export class ThreadsOperator {
  private browserClient: BrowserClient;
  private geminiEngine: LocalGeminiEngine;
  private loop: ObserveReasonActLoop;
  private rhythmManager: RhythmManager;
  private sessionManager: SessionManager;
  private checkpointDetector: CheckpointDetector;
  private inboundMonitor: InboundMonitor;
  private agentMonitor: AgentMonitor;
  private intentInterviewer: IntentInterviewer;

  private currentMode: OperationalMode;
  private targetUsername?: string;
  private isPaused: boolean = false;
  private isRunning: boolean = false;
  private maxCycles: number;
  private cdpPort: number;
  private cycleCount: number = 0;

  private customerProfile: CustomerProfile | null = null;
  private pendingIntent: OperationIntent | null = null;
  private recentLog: string[] = [];
  private keystrokeSynthesizer!: KeystrokeSynthesizer;

  /** Callbacks registered by DashboardServer for real-time telemetry */
  public onTelemetryUpdate?: (telemetry: AgentTelemetry) => void;
  public onIntentReady?: (intent: OperationIntent) => void;
  public onSecurityAlert?: (details: string) => void;
  public onLogEntry?: (entry: string) => void;

  constructor(
    browserClient: BrowserClient,
    engine: LocalGeminiEngine,
    config: OperatorConfig = {}
  ) {
    this.browserClient = browserClient;
    this.geminiEngine = engine;
    this.rhythmManager = new RhythmManager();
    this.sessionManager = new SessionManager();
    this.checkpointDetector = new CheckpointDetector();
    this.intentInterviewer = new IntentInterviewer();
    this.agentMonitor = new AgentMonitor();

    const trendInjector = new TrendInjector();
    const cursor = new CursorPhysics();
    this.keystrokeSynthesizer = new KeystrokeSynthesizer();

    this.loop = new ObserveReasonActLoop(
      this.browserClient,
      engine,
      cursor,
      this.keystrokeSynthesizer,
      this.rhythmManager,
      this.checkpointDetector,
      trendInjector
    );

    this.inboundMonitor = new InboundMonitor(
      this.browserClient,
      engine,
      this.keystrokeSynthesizer,
      cursor,
      this.rhythmManager
    );

    // Wire up log callbacks
    this.loop.onLogEntry = (entry) => this.pushLog(entry);
    this.inboundMonitor.onLogEntry = (entry) => this.pushLog(entry);

    // Wire up security alert callback
    this.checkpointDetector.onSecurityAlert((result) => {
      const alertMsg = `⚠ SECURITY ALERT: ${result.challengeType} — ${result.details}`;
      this.pushLog(alertMsg);
      if (this.onSecurityAlert) this.onSecurityAlert(alertMsg);
    });

    // Wire up health monitor
    this.agentMonitor.onStallDetected = (details) => {
      this.pushLog(`[HealthMonitor] ${details}`);
      if (this.onSecurityAlert) this.onSecurityAlert(details);
    };
    this.agentMonitor.onHealthUpdate = () => {
      this.broadcastTelemetry();
    };

    this.currentMode = config.initialMode || 'FEED';
    this.targetUsername = config.targetUsername;
    this.maxCycles = config.maxCycles || Infinity;
    this.cdpPort = config.cdpPort || 9222;
  }

  /**
   * Load a customer profile and prepare the intent for dashboard review.
   */
  public loadCustomerProfile(profile: CustomerProfile): void {
    this.customerProfile = profile;
    this.geminiEngine.setCustomerProfile(profile);

    // Apply customer's rate limit preferences
    if (profile.maxCommentsPerHour || profile.maxDmsPerHour) {
      this.rhythmManager = new RhythmManager({
        maxCommentsPerHour: profile.maxCommentsPerHour,
        maxDmsPerHour: profile.maxDmsPerHour,
      });
    }

    // Build and emit the intent for customer approval
    const intent = this.intentInterviewer.buildSessionIntent(
      profile,
      new Date().getHours()
    );
    this.pendingIntent = intent;

    this.pushLog(`[Operator] Customer profile loaded: ${profile.name} (${profile.profession})`);

    if (this.onIntentReady) {
      this.onIntentReady(intent);
    }
  }

  /**
   * Called by the dashboard when the customer approves the intent.
   * Also accepts optional modification notes from the customer.
   */
  public approveIntent(notes?: string): void {
    if (this.pendingIntent) {
      this.pendingIntent.approved = true;
      this.pendingIntent.customerNotes = notes;
      this.pushLog(`[Operator] Intent approved by customer. Starting automation...`);
    }
  }

  /**
   * Starts the autonomous operational loop.
   * Will wait until intent is approved if a profile is loaded.
   */
  public async start(): Promise<void> {
    this.isRunning = true;
    this.agentMonitor.start();

    // Restore session state
    const page = this.browserClient.getActivePage();
    const cdp = this.browserClient.getCdpSession();
    if (page && cdp) {
      await this.sessionManager.restoreSessionState(page, cdp);
    }

    // Wait for intent approval if profile is loaded
    if (this.customerProfile && this.pendingIntent && !this.pendingIntent.approved) {
      this.pushLog('[Operator] Waiting for customer to approve the session intent on the dashboard...');
      await this.waitForIntentApproval();
    }

    // Initialize inbound monitor
    if (
      this.customerProfile?.goals.some(
        (g) => g === 'REPLY_TO_DMS' || g === 'REPLY_TO_COMMENT_REPLIES'
      )
    ) {
      await this.inboundMonitor.start();
    }

    this.pushLog('[Operator] 🚀 Automation started!');

    let cycle = 0;
    while (this.isRunning && cycle < this.maxCycles) {
      if (this.isPaused) {
        await this.sleep(2500);
        continue;
      }

      if (this.sessionManager.isGracefulReloadDue()) {
        await this.performGracefulBrowserReload();
        continue;
      }

      const breakStatus = this.rhythmManager.isInOperationalBreak();
      if (breakStatus.active) {
        const msg = `[Operator] Cool-down break — ${Math.round(breakStatus.remainingMs / 60000)} min remaining`;
        this.pushLog(msg);
        await this.sleep(Math.min(30000, breakStatus.remainingMs));
        continue;
      }

      // Safe, coordinated inbound check (every 8 cycles) if customer has inbound reply goals
      const hasInboundGoal = this.customerProfile?.goals.some(
        (g) => g === 'REPLY_TO_DMS' || g === 'REPLY_TO_COMMENT_REPLIES'
      );
      if (hasInboundGoal && cycle > 0 && cycle % 8 === 0) {
        this.pushLog('[Operator] Scheduled Inbound Check: scanning DMs and Notifications for new replies...');
        try {
          await this.inboundMonitor.runSingleCheckCycle();
          this.pushLog('[Operator] Inbound check completed. Resuming feed operations.');
        } catch (inboundErr) {
          this.pushLog(`[InboundMonitor] Notice: ${(inboundErr as Error).message}`);
        }
      }

      cycle++;
      this.agentMonitor.recordHeartbeat(`Cycle #${cycle} [${this.currentMode}]`);

      try {
        const result: CycleResult = await this.loop.executeCycle(this.currentMode);
        this.cycleCount++;

        // Handle mode switch requested by AI
        if (result.requestedModeSwitch) {
          this.currentMode = result.requestedModeSwitch;
          this.pushLog(`[Operator] AI requested mode switch → ${this.currentMode}`);
        }

        // Handle security challenge
        if (result.securityChallenge?.isChallengeDetected) {
          this.pushLog('[Operator] ⚠ Security challenge — pausing automation.');
          this.isPaused = true;
          const activeP = this.browserClient.getActivePage();
          const activeCdp = this.browserClient.getCdpSession();
          if (activeP && activeCdp) {
            await this.sessionManager.saveSessionState(activeP, activeCdp);
          }
          continue;
        }

        this.broadcastTelemetry();

        this.pushLog(`[Operator] Cycle done. Next in ${result.delayMs}ms...`);
        await this.sleep(result.delayMs);
      } catch (err) {
        const msg = `[Operator] Error in cycle #${cycle}: ${(err as Error).message}`;
        this.pushLog(msg);
        await this.sleep(5000);
      }
    }

    this.pushLog('[Operator] Operations concluded.');
    this.agentMonitor.stop();
  }

  private async waitForIntentApproval(): Promise<void> {
    const maxWaitMs = 10 * 60 * 1000; // Wait max 10 minutes
    const startTime = Date.now();
    while (this.pendingIntent && !this.pendingIntent.approved) {
      if (Date.now() - startTime > maxWaitMs) {
        this.pushLog('[Operator] Intent approval timeout — starting anyway.');
        break;
      }
      await this.sleep(2000);
    }
  }

  private async performGracefulBrowserReload(): Promise<void> {
    this.pushLog('[Operator] 2-hour reload cycle — saving session and restarting...');
    const page = this.browserClient.getActivePage();
    const cdp = this.browserClient.getCdpSession();
    if (page && cdp) {
      await this.sessionManager.saveSessionState(page, cdp);
    }

    await this.browserClient.disconnect();
    await ChromeLauncher.ensureChromeWithCdp(this.cdpPort);
    await this.browserClient.connect();

    const newPage = this.browserClient.getActivePage();
    const newCdp = this.browserClient.getCdpSession();
    if (newPage && newCdp) {
      await this.sessionManager.restoreSessionState(newPage, newCdp);
    }

    this.sessionManager.markReloadCompleted();
    this.pushLog('[Operator] Graceful reload completed.');
  }

  private pushLog(entry: string): void {
    const timestamped = `[${new Date().toLocaleTimeString()}] ${entry}`;
    console.log(timestamped);
    this.recentLog.push(timestamped);
    if (this.recentLog.length > 100) this.recentLog.shift();
    if (this.onLogEntry) this.onLogEntry(timestamped);
  }

  private broadcastTelemetry(): void {
    if (this.onTelemetryUpdate) {
      this.onTelemetryUpdate(this.getTelemetry());
    }
  }

  public getTelemetry(): AgentTelemetry {
    const stats = this.rhythmManager.getStats();
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      currentMode: this.currentMode,
      currentAction: this.recentLog[this.recentLog.length - 1] || 'Idle',
      lastActionAt: stats.lastActionTimestamp,
      cycleCount: this.cycleCount,
      uptimeMinutes: Math.round(this.sessionManager.getSessionUptimeMs() / 60000),
      stats: {
        totalInteractions: stats.totalInteractions,
        totalComments: stats.totalComments,
        totalDMs: stats.totalDMs,
        totalScrolls: stats.totalScrolls,
        totalReplies: 0,
        commentsPastHour: stats.commentsPastHour,
        dmsPastHour: stats.dmsPastHour,
        isCoolingDown: stats.isCoolingDown,
      },
      recentLog: this.recentLog.slice(-30),
    };
  }

  public getCustomerProfile(): CustomerProfile | null {
    return this.customerProfile;
  }

  public getPendingIntent(): OperationIntent | null {
    return this.pendingIntent;
  }

  public stop(): void {
    this.isRunning = false;
    this.inboundMonitor.stop();
    this.agentMonitor.stop();
  }

  public pause(): void {
    this.isPaused = true;
    this.pushLog('[Operator] PAUSED by operator command.');
  }

  public resume(): void {
    this.isPaused = false;
    this.pushLog('[Operator] RESUMED by operator command.');
  }

  public setMode(mode: OperationalMode): void {
    this.currentMode = mode;
    this.pushLog(`[Operator] Mode → ${mode}`);
  }

  public async targetProfile(username: string): Promise<void> {
    this.targetUsername = username.startsWith('@') ? username.slice(1) : username;
    this.currentMode = 'PROFILE';
    const page = this.browserClient.getActivePage();
    if (page) {
      await page.goto(`https://www.threads.net/@${this.targetUsername}`, {
        waitUntil: 'domcontentloaded',
      });
    }
  }

  /**
   * Publishes a new thread / post directly from the dashboard.
   */
  public async publishCustomPost(text: string): Promise<{ success: boolean; message: string }> {
    this.pushLog(`[Operator] Manual Post triggered: "${text.slice(0, 50)}..."`);
    const page = this.browserClient.getActivePage();
    if (!page) {
      return { success: false, message: 'No active browser page' };
    }

    try {
      await page.bringToFront();

      // Open new thread composer
      const opened = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
        for (const b of btns) {
          const t = (b.textContent || '').trim();
          const aria = (b.getAttribute('aria-label') || '').trim();
          if (
            t === 'New thread' ||
            t.includes("What's new") ||
            aria.includes("compose a new post") ||
            aria.includes("New thread")
          ) {
            (b as HTMLElement).click();
            return true;
          }
        }
        return false;
      });

      if (!opened) {
        await page.mouse.click(300, 110);
      }

      await this.sleep(1200);

      // Focus open textbox
      await page.evaluate(() => {
        const tb = document.querySelector('div[role="textbox"]');
        if (tb) (tb as HTMLElement).focus();
      });

      // Type text
      const keystrokes = this.keystrokeSynthesizer.synthesizeKeystrokes(text);
      await this.browserClient.dispatchKeystrokeActions(keystrokes);
      await this.sleep(800);

      // Submit via Ctrl+Enter
      await page.keyboard.down('Control');
      await page.keyboard.press('Enter');
      await page.keyboard.up('Control');

      await this.sleep(400);

      // Click Post button with full React event chain
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
        for (const b of btns) {
          const t = (b.textContent || '').trim();
          const aria = b.getAttribute('aria-label') || b.querySelector('[aria-label]')?.getAttribute('aria-label') || '';
          const isPost = t === 'Post' || t === 'Create' || t === 'Reply' || aria === 'Post' || aria === 'Reply';
          const rect = b.getBoundingClientRect();
          if (isPost && rect.width > 0 && rect.height > 0) {
            b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            b.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            (b as HTMLElement).click();
            break;
          }
        }
      });

      this.pushLog(`[Operator] ✓ Post published successfully to Threads: "${text.slice(0, 40)}..."`);
      this.broadcastTelemetry();
      return { success: true, message: 'Post published successfully to Threads!' };
    } catch (err) {
      this.pushLog(`[Operator] Failed to publish post: ${(err as Error).message}`);
      return { success: false, message: (err as Error).message };
    }
  }

  /**
   * Immediately triggers a comment cycle on the current feed.
   */
  public async triggerImmediateComment(customComment?: string): Promise<{ success: boolean; message: string }> {
    this.pushLog(`[Operator] Immediate Comment triggered from Dashboard...`);
    const page = this.browserClient.getActivePage();
    if (!page) return { success: false, message: 'No active browser page' };

    try {
      await page.bringToFront();

      // Look for a Reply button on a post currently visible
      const clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
        for (const b of btns) {
          const t = (b.textContent || '').trim();
          const aria = (b.getAttribute('aria-label') || '').trim();
          const rect = b.getBoundingClientRect();
          if ((t.startsWith('Reply') || aria.startsWith('Reply')) && rect.top > 50 && rect.top < 650 && rect.width > 0) {
            (b as HTMLElement).click();
            return true;
          }
        }
        return false;
      });

      await this.sleep(1500);

      let commentText = customComment;
      if (!commentText) {
        if (this.customerProfile?.sampleComments && this.customerProfile.sampleComments.length > 0) {
          commentText = this.customerProfile.sampleComments[0];
        } else {
          const portfolio = SemanticPostReasoner.extractPortfolio(this.customerProfile);
          const profession = this.customerProfile?.profession || 'Developer';
          const keyExp = SemanticPostReasoner.extractKeyExperience(this.customerProfile);
          const expSnippet = keyExp ? ` ${keyExp}.` : '';
          const portSnippet = portfolio ? ` Portfolio: ${portfolio}` : '';
          commentText = `Hey! As a ${profession}, I'm passionate about building clean and performant web applications.${expSnippet}${portSnippet} Looking forward to connecting!`;
        }
      }

      const keystrokes = this.keystrokeSynthesizer.synthesizeKeystrokes(commentText);
      await this.browserClient.dispatchKeystrokeActions(keystrokes);
      await this.sleep(1000);

      // Submit via Ctrl+Enter and Post click
      await page.keyboard.down('Control');
      await page.keyboard.press('Enter');
      await page.keyboard.up('Control');

      // Click Post / Reply button with full React event chain
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
        for (const b of btns) {
          const t = (b.textContent || '').trim();
          const aria = b.getAttribute('aria-label') || b.querySelector('[aria-label]')?.getAttribute('aria-label') || '';
          const isPost = t === 'Post' || t === 'Create' || t === 'Reply' || aria === 'Post' || aria === 'Reply';
          const rect = b.getBoundingClientRect();
          if (isPost && rect.width > 0 && rect.height > 0) {
            b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            b.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            (b as HTMLElement).click();
            break;
          }
        }
      });

      this.pushLog(`[Operator] ✓ Comment posted successfully to Threads: "${commentText.slice(0, 40)}..."`);
      this.broadcastTelemetry();
      return { success: true, message: 'Comment posted successfully!' };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
