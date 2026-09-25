/**
 * InboundMonitor.ts
 * Parallel monitoring agent that continuously checks:
 * 1. DM Inbox — for new inbound messages
 * 2. Notifications Tab — for replies to comments
 *
 * Uses LocalGeminiEngine for reasoning about what is new/unread
 * and generates humanized replies via the same engine.
 * No hardcoded detection patterns — pure AI visual + semantic reasoning.
 */

import { BrowserClient } from '../cdp/BrowserClient.js';
import { LocalGeminiEngine } from '../engine/LocalGeminiEngine.js';
import { KeystrokeSynthesizer } from '../humanizer/KeystrokeSynthesizer.js';
import { CursorPhysics } from '../humanizer/CursorPhysics.js';
import { RhythmManager } from '../humanizer/RhythmManager.js';

export interface InboundItem {
  type: 'DM' | 'COMMENT_REPLY';
  text: string;
  sender?: string;
  timestamp: number;
  replied: boolean;
}

export class InboundMonitor {
  private browserClient: BrowserClient;
  private geminiEngine: LocalGeminiEngine;
  private keystrokeSynthesizer: KeystrokeSynthesizer;
  private cursorPhysics: CursorPhysics;
  private rhythmManager: RhythmManager;

  private isRunning: boolean = false;
  private checkIntervalMs: number = 5 * 60 * 1000; // Check every 5 minutes
  private conversationHistory: Map<string, string[]> = new Map();
  private processedItems: Set<string> = new Set();

  public onLogEntry?: (entry: string) => void;

  constructor(
    browserClient: BrowserClient,
    geminiEngine: LocalGeminiEngine,
    keystrokeSynthesizer: KeystrokeSynthesizer,
    cursorPhysics: CursorPhysics,
    rhythmManager: RhythmManager
  ) {
    this.browserClient = browserClient;
    this.geminiEngine = geminiEngine;
    this.keystrokeSynthesizer = keystrokeSynthesizer;
    this.cursorPhysics = cursorPhysics;
    this.rhythmManager = rhythmManager;
  }

  private isChecking: boolean = false;

  private log(msg: string): void {
    console.log(msg);
    if (this.onLogEntry) this.onLogEntry(msg);
  }

  /**
   * Marks the inbound monitor as active.
   */
  public async start(): Promise<void> {
    this.isRunning = true;
    this.log('[InboundMonitor] Inbound monitoring service ready.');
  }

  public stop(): void {
    this.isRunning = false;
    this.log('[InboundMonitor] Inbound monitoring loop stopped.');
  }

  /**
   * Runs a single, coordinated inbound check cycle (Notifications + DMs).
   * Safe to call between feed cycles without clashing or racing.
   */
  public async runSingleCheckCycle(): Promise<void> {
    if (this.isChecking) return;
    this.isChecking = true;
    try {
      await this.checkNotifications();
      await this.sleep(1500, 2500);
      await this.checkDmInbox();
    } catch (err) {
      this.log(`[InboundMonitor] Error in inbound check: ${(err as Error).message}`);
    } finally {
      try {
        await this.browserClient.navigateTo('https://www.threads.com/');
        await this.sleep(2000, 3000);
      } catch {}
      this.isChecking = false;
    }
  }

  /**
   * Navigates to the Notifications tab and uses AI to find new replies.
   */
  private async checkNotifications(): Promise<void> {
    const dmCheck = this.rhythmManager.canExecuteAction('dm');
    if (!dmCheck.allowed) {
      this.log(`[InboundMonitor] DM rate limit active — skipping notifications check.`);
      return;
    }

    this.log('[InboundMonitor] Checking Notifications tab for new replies...');
    await this.browserClient.navigateTo('https://www.threads.com/notifications/');
    await this.sleep(3000, 5000);

    const screenshot = await this.browserClient.captureScreenshot();
    const elements = await this.browserClient.extractSemanticElements();

    // Ask AI to reason about what notifications are visible and which need replies
    const result = await this.geminiEngine.reasonNextAction({
      screenshotBase64: screenshot,
      semanticElements: elements,
      currentMode: 'NOTIFICATIONS',
      recentActionsSummary: 'Checking notifications for replies that need a response.',
    });

    this.log(`[InboundMonitor] Notification AI thought: "${result.thought}"`);

    // If AI identified a reply to handle
    if (result.action === 'DM_REPLY' || result.action === 'COMMENT') {
      const inboundText = this.extractInboundText(elements, result.targetElementId);
      if (inboundText && !this.isAlreadyProcessed(inboundText)) {
        await this.handleInboundItem({
          type: 'COMMENT_REPLY',
          text: inboundText,
          timestamp: Date.now(),
          replied: false,
        });
      }
    }

    // Go back to feed
    await this.browserClient.navigateTo('https://www.threads.com/');
    await this.sleep(2000, 3000);
  }

  /**
   * Navigates to the DM inbox and processes new messages using AI reasoning.
   */
  private async checkDmInbox(): Promise<void> {
    const dmCheck = this.rhythmManager.canExecuteAction('dm');
    if (!dmCheck.allowed) {
      this.log(`[InboundMonitor] DM rate limit active — skipping DM inbox check.`);
      return;
    }

    this.log('[InboundMonitor] Checking DM inbox for new messages...');
    await this.browserClient.navigateTo('https://www.threads.com/direct/inbox/');
    await this.sleep(3000, 5000);

    const screenshot = await this.browserClient.captureScreenshot();
    const elements = await this.browserClient.extractSemanticElements();

    const result = await this.geminiEngine.reasonNextAction({
      screenshotBase64: screenshot,
      semanticElements: elements,
      currentMode: 'DM',
      recentActionsSummary: 'Checking DM inbox for unread messages that need replies.',
    });

    this.log(`[InboundMonitor] DM AI thought: "${result.thought}"`);

    if (result.action === 'DM_REPLY' || result.action === 'CLICK') {
      // AI identified a conversation — click to open it
      if (result.targetElementId) {
        const target = elements.find((e) => e.id === result.targetElementId);
        if (target) {
          const pt = this.cursorPhysics.calculateDynamicTargetPoint(target.boundingBox);
          await this.browserClient.dispatchMouseMoveTrajectory(
            this.cursorPhysics.generateTrajectory(this.cursorPhysics.getCurrentPosition(), pt)
          );
          await this.browserClient.dispatchMouseClick(pt);
          await this.sleep(2500, 4000);

          // Now read the conversation
          const convScreenshot = await this.browserClient.captureScreenshot();
          const convElements = await this.browserClient.extractSemanticElements();

          const inboundText = this.extractInboundText(convElements, undefined);
          if (inboundText && !this.isAlreadyProcessed(inboundText)) {
            await this.handleInboundItem({
              type: 'DM',
              text: inboundText,
              timestamp: Date.now(),
              replied: false,
            });
          }
        }
      }
    }

    // Return to main feed
    await this.browserClient.navigateTo('https://www.threads.com/');
    await this.sleep(2000, 3000);
  }

  /**
   * Processes an inbound item: generates a humanized reply via AI and sends it.
   */
  private async handleInboundItem(item: InboundItem): Promise<void> {
    this.log(
      `[InboundMonitor] Processing inbound ${item.type}: "${item.text.slice(0, 80)}..."`
    );

    const threadKey = this.hashText(item.text);
    const history = this.conversationHistory.get(threadKey) || [];

    // Generate humanized reply via the AI
    const replyResult = await this.geminiEngine.generateInboundReply({
      inboundText: item.text,
      conversationHistory: history,
      replyType: item.type,
    });

    this.log(
      `[InboundMonitor] Generated reply (confidence ${Math.round(replyResult.confidence * 100)}%): "${replyResult.reply}"`
    );

    // Type and send the reply
    const elements = await this.browserClient.extractSemanticElements();
    const inputEl = elements.find((e) => e.isEditable);

    if (inputEl) {
      const pt = this.cursorPhysics.calculateDynamicTargetPoint(inputEl.boundingBox);
      await this.browserClient.dispatchMouseMoveTrajectory(
        this.cursorPhysics.generateTrajectory(this.cursorPhysics.getCurrentPosition(), pt)
      );
      await this.browserClient.dispatchMouseClick(pt);
      await this.sleep(400, 800);

      const keystrokes = this.keystrokeSynthesizer.synthesizeKeystrokes(replyResult.reply);
      await this.browserClient.dispatchKeystrokeActions(keystrokes);
      await this.sleep(700, 1400);

      // Submit
      await this.browserClient.dispatchKeystrokeActions([
        { type: 'type', char: '\n', delayMs: 100 },
      ]);

      // Update history
      history.push(`Them: ${item.text}`);
      history.push(`Me: ${replyResult.reply}`);
      if (history.length > 20) history.splice(0, 2);
      this.conversationHistory.set(threadKey, history);

      this.processedItems.add(threadKey);
      this.rhythmManager.recordAction('dm');

      this.log(`[InboundMonitor] ✓ Reply sent successfully.`);
    } else {
      this.log(`[InboundMonitor] Could not find text input to reply.`);
    }
  }

  private extractInboundText(
    elements: ReturnType<BrowserClient['extractSemanticElements']> extends Promise<infer T>
      ? T
      : never,
    preferredElementId?: number
  ): string {
    if (preferredElementId) {
      const el = elements.find((e: any) => e.id === preferredElementId);
      if (el?.textSnippet) return el.textSnippet;
    }

    // Find the most prominent text block (longest non-UI text)
    const textBlocks = elements
      .filter((e: any) => !e.isClickable && !e.isEditable && e.textSnippet.length > 15)
      .sort((a: any, b: any) => b.textSnippet.length - a.textSnippet.length);

    return textBlocks[0]?.textSnippet || '';
  }

  private isAlreadyProcessed(text: string): boolean {
    return this.processedItems.has(this.hashText(text));
  }

  private hashText(text: string): string {
    // Simple deterministic hash for deduplication
    let hash = 0;
    for (let i = 0; i < Math.min(text.length, 60); i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    return String(hash);
  }

  private sleep(minMs: number, maxMs?: number): Promise<void> {
    const duration = maxMs ? minMs + Math.floor(Math.random() * (maxMs - minMs)) : minMs;
    return new Promise((r) => setTimeout(r, duration));
  }
}
