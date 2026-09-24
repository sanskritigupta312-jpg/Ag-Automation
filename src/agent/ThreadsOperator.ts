/**
 * ThreadsOperator.ts
 * High-level Autonomous Operator coordinating:
 * - Post discovery & contextual commenting with trending hashtags
 * - Agentic DM & comment replies with zero-reject policy
 * - Multi-turn conversational memory retention
 * - Real-time operator interaction (pause, resume, target profile, mode switch)
 */

import { BrowserClient } from '../cdp/BrowserClient.js';
import { LocalGeminiEngine } from '../engine/LocalGeminiEngine.js';
import { CursorPhysics } from '../humanizer/CursorPhysics.js';
import { KeystrokeSynthesizer } from '../humanizer/KeystrokeSynthesizer.js';
import { RhythmManager } from '../humanizer/RhythmManager.js';
import { ObserveReasonActLoop, CycleResult } from './ObserveReasonActLoop.js';

export interface OperatorConfig {
  initialMode?: 'FEED' | 'DM' | 'PROFILE';
  targetUsername?: string;
  maxCycles?: number;
}

export class ThreadsOperator {
  private browserClient: BrowserClient;
  private loop: ObserveReasonActLoop;
  private rhythmManager: RhythmManager;

  private currentMode: 'FEED' | 'DM' | 'PROFILE';
  private targetUsername?: string;
  private isPaused: boolean = false;
  private isRunning: boolean = false;
  private maxCycles: number;

  // Conversational memory for multi-turn DMs
  private dmConversationHistory: Map<string, string[]> = new Map();

  constructor(
    browserClient: BrowserClient,
    engine: LocalGeminiEngine,
    config: OperatorConfig = {}
  ) {
    this.browserClient = browserClient;
    this.rhythmManager = new RhythmManager();
    const cursor = new CursorPhysics();
    const keystroke = new KeystrokeSynthesizer();

    this.loop = new ObserveReasonActLoop(
      this.browserClient,
      engine,
      cursor,
      keystroke,
      this.rhythmManager
    );

    this.currentMode = config.initialMode || 'FEED';
    this.targetUsername = config.targetUsername;
    this.maxCycles = config.maxCycles || Infinity;
  }

  /**
   * Starts the autonomous operational cycle.
   */
  public async start(): Promise<void> {
    this.isRunning = true;
    console.log(`[ThreadsOperator] Initializing operations in mode: ${this.currentMode}`);

    let cycle = 0;
    while (this.isRunning && cycle < this.maxCycles) {
      if (this.isPaused) {
        console.log(`[ThreadsOperator] Paused by operator. Awaiting resume instruction...`);
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      cycle++;
      try {
        const chatContext = this.getRecentChatContext();
        const result: CycleResult = await this.loop.executeCycle(this.currentMode, chatContext);

        // Record DM thread history if a DM interaction occurred
        if (result.mode === 'DM' && result.decision.synthesizedText) {
          this.recordDmMessage('active_thread', `Agent: ${result.decision.synthesizedText}`);
        }

        // Wait calculated anti-ban rhythm delay before next cycle
        console.log(`[ThreadsOperator] Sleeping for natural dwell time: ${result.delayMs}ms...`);
        await new Promise((r) => setTimeout(r, result.delayMs));
      } catch (err) {
        console.error(`[ThreadsOperator] Error during cycle #${cycle}: ${(err as Error).message}`);
        console.log(`[ThreadsOperator] Initiating dynamic recovery pause (5s)...`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    console.log(`[ThreadsOperator] Operations concluded.`);
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
    };
  }

  private recordDmMessage(threadId: string, message: string): void {
    const list = this.dmConversationHistory.get(threadId) || [];
    list.push(message);
    if (list.length > 20) list.shift();
    this.dmConversationHistory.set(threadId, list);
  }

  private getRecentChatContext(threadId: string = 'active_thread'): string {
    const history = this.dmConversationHistory.get(threadId);
    return history && history.length > 0 ? history.join('\n') : 'No previous messages in current session.';
  }
}
