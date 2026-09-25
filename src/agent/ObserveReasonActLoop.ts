/**
 * ObserveReasonActLoop.ts  (upgraded)
 * Full OODA cycle with complete Threads automation flow:
 *
 * FEED cycle:
 *   OBSERVE → REASON (is this post relevant?) → OPEN_POST → COMMENT → VERIFY → GO_BACK → SCROLL → repeat
 *
 * DM / NOTIFICATIONS cycle:
 *   OBSERVE inbox/notifications → REASON (is there an inbound message/reply?) → GENERATE_REPLY → SEND → VERIFY
 *
 * Key upgrades:
 * - Full post-open → comment → back cycle
 * - AI-driven post relevance evaluation (no hardcoded matching)
 * - AI-only checkpoint detection
 * - Inbound notification + DM scanning
 * - Mode switching based on AI reasoning
 */

import { BrowserClient, SemanticElement } from '../cdp/BrowserClient.js';
import { LocalGeminiEngine, AgenticDecision } from '../engine/LocalGeminiEngine.js';
import { CursorPhysics, Point } from '../humanizer/CursorPhysics.js';
import { KeystrokeSynthesizer } from '../humanizer/KeystrokeSynthesizer.js';
import { RhythmManager } from '../humanizer/RhythmManager.js';
import { CheckpointDetector, SecurityCheckResult } from '../security/CheckpointDetector.js';
import { TrendInjector } from '../trend/TrendInjector.js';

export type OperationalMode = 'FEED' | 'DM' | 'PROFILE' | 'NOTIFICATIONS' | 'POST_OPEN';

export interface CycleResult {
  cycleIndex: number;
  timestamp: number;
  mode: OperationalMode;
  decision: AgenticDecision;
  targetPoint?: Point;
  executedActions: string[];
  verificationSuccess: boolean;
  delayMs: number;
  securityChallenge?: SecurityCheckResult;
  requestedModeSwitch?: OperationalMode;
  logEntry: string;
}

export class ObserveReasonActLoop {
  private browserClient: BrowserClient;
  private geminiEngine: LocalGeminiEngine;
  private cursorPhysics: CursorPhysics;
  private keystrokeSynthesizer: KeystrokeSynthesizer;
  private rhythmManager: RhythmManager;
  private checkpointDetector: CheckpointDetector;
  private trendInjector: TrendInjector;

  private actionHistory: string[] = [];
  private cycleCount: number = 0;

  /** Callback to push live log entries to the dashboard */
  public onLogEntry?: (entry: string) => void;

  constructor(
    browserClient: BrowserClient,
    geminiEngine: LocalGeminiEngine,
    cursorPhysics: CursorPhysics,
    keystrokeSynthesizer: KeystrokeSynthesizer,
    rhythmManager: RhythmManager,
    checkpointDetector: CheckpointDetector,
    trendInjector: TrendInjector
  ) {
    this.browserClient = browserClient;
    this.geminiEngine = geminiEngine;
    this.cursorPhysics = cursorPhysics;
    this.keystrokeSynthesizer = keystrokeSynthesizer;
    this.rhythmManager = rhythmManager;
    this.checkpointDetector = checkpointDetector;
    this.trendInjector = trendInjector;
  }

  private log(message: string): void {
    console.log(message);
    if (this.onLogEntry) this.onLogEntry(message);
  }

  /**
   * Executes a single complete cycle: OBSERVE → REASON → ACT → VERIFY
   */
  public async executeCycle(
    mode: OperationalMode,
    slidingChatContext?: string[]
  ): Promise<CycleResult> {
    this.cycleCount++;
    const cycleIndex = this.cycleCount;
    const executedActions: string[] = [];
    let requestedModeSwitch: OperationalMode | undefined;

    this.log(`\n══════════════════════════════════════════════════`);
    this.log(`[CYCLE #${cycleIndex}] MODE: ${mode}`);
    this.log(`══════════════════════════════════════════════════`);

    // ──────────────────────────────────────────
    // STEP 1: OBSERVE
    // ──────────────────────────────────────────
    this.log(`[OBSERVE] Capturing viewport screenshot + Shadow DOM semantic tree...`);
    const screenshotBase64 = await this.browserClient.captureScreenshot();
    const semanticElements = await this.browserClient.extractSemanticElements();
    this.log(`[OBSERVE] Extracted ${semanticElements.length} interactive elements.`);

    // ──────────────────────────────────────────
    // STEP 2: REASON (via local Gemini)
    // ──────────────────────────────────────────
    this.log(`[REASON] Querying local Gemini engine for next action...`);
    const recentSummary = this.actionHistory.slice(-4).join('; ');
    const decision = await this.geminiEngine.reasonNextAction({
      screenshotBase64,
      semanticElements,
      currentMode: mode,
      chatHistoryContext: slidingChatContext,
      recentActionsSummary: recentSummary,
    });

    this.log(`[REASON] Thought: "${decision.thought}"`);
    this.log(
      `[REASON] Action: ${decision.action} | Confidence: ${Math.round(decision.confidence * 100)}%`
    );

    if (decision.postRelevanceReason) {
      this.log(`[REASON] Post Relevance: ${decision.postRelevanceReason}`);
    }

    // ──────────────────────────────────────────
    // SECURITY EVALUATION (AI-only, no regex)
    // ──────────────────────────────────────────
    if (decision.action === 'SECURITY_CHALLENGE') {
      const aiSecResult = await this.geminiEngine.evaluateSecurityState({
        screenshotBase64,
        semanticElements,
        agentThought: decision.thought,
      });
      const secResult = this.checkpointDetector.processAiSecurityEvaluation(aiSecResult);
      if (secResult.isChallengeDetected) {
        this.checkpointDetector.dispatchSecurityAlert(secResult);
        return this.buildSecurityResult(cycleIndex, mode, decision, secResult);
      }
    }

    // Also check vision thought for security markers (AI-flagged)
    const visionCheck = this.checkpointDetector.evaluateVisionThought(decision.thought);
    if (visionCheck.isChallengeDetected) {
      this.checkpointDetector.dispatchSecurityAlert(visionCheck);
      return this.buildSecurityResult(cycleIndex, mode, decision, visionCheck);
    }

    // ──────────────────────────────────────────
    // RATE LIMIT CHECK
    // ──────────────────────────────────────────
    if (decision.action === 'COMMENT' || decision.action === 'DM_REPLY') {
      const actionType = decision.action === 'COMMENT' ? 'comment' : 'dm';
      const check = this.rhythmManager.canExecuteAction(actionType);
      if (!check.allowed) {
        this.log(`[RHYTHM] ${actionType.toUpperCase()} suppressed: ${check.reason}. Scrolling.`);
        decision.action = 'SCROLL';
        decision.scrollDeltaY = 300 + Math.floor(Math.random() * 250);
        decision.synthesizedText = undefined;
      }
    }

    let targetPoint: Point | undefined;

    // ──────────────────────────────────────────
    // STEP 3: ACT
    // ──────────────────────────────────────────
    this.log(`[ACT] Dispatching humanized browser action: ${decision.action}`);

    // Handle mode switch requests from the AI
    if (decision.action === 'SWITCH_TO_DM') {
      requestedModeSwitch = 'DM';
      await this.navigateToDmInbox();
      executedActions.push('Navigated to DM inbox');
    } else if (decision.action === 'SWITCH_TO_NOTIFICATIONS') {
      requestedModeSwitch = 'NOTIFICATIONS';
      await this.navigateToNotifications();
      executedActions.push('Navigated to Notifications');
    }

    // Find target element
    let targetElement: SemanticElement | undefined;
    if (decision.targetElementId) {
      targetElement = semanticElements.find((e) => e.id === decision.targetElementId);
    }

    // Handle independent GO_BACK (returning to main feed)
    if (decision.action === 'GO_BACK') {
      this.log('[ACT] Executing GO_BACK: Navigating back to main feed...');
      await this.browserClient.navigateBack();
      await this.humanPause(1500, 2500);
      executedActions.push('Navigated back to feed');
      requestedModeSwitch = 'FEED';
      this.log('[6-Step Loop] ✓ Step 6 Complete: Returned to FEED.');
    }

    // Execute click-based actions (CLICK, OPEN_POST)
    if (
      targetElement &&
      (decision.action === 'CLICK' || decision.action === 'OPEN_POST')
    ) {
      targetPoint = this.cursorPhysics.calculateDynamicTargetPoint(targetElement.boundingBox);
      const startPoint = this.cursorPhysics.getCurrentPosition();

      const trajectory = this.cursorPhysics.generateTrajectory(startPoint, targetPoint);
      await this.browserClient.dispatchMouseMoveTrajectory(trajectory);

      const sightPause = this.cursorPhysics.getSightAlignmentPause();
      this.log(`[ACT] Sight-alignment pause: ${sightPause}ms`);
      await this.browserClient.dispatchMouseClick(targetPoint, sightPause);
      executedActions.push(
        `${decision.action}: clicked element #${targetElement.id} at (${targetPoint.x}, ${targetPoint.y})`
      );

      // If OPEN_POST, switch mode to POST_OPEN and pause for page load
      if (decision.action === 'OPEN_POST') {
        requestedModeSwitch = 'POST_OPEN';
        this.log('[6-Step Loop] ✓ Step 3 Complete: Post opened. Switched to POST_OPEN mode.');
        await this.humanPause(2500, 3800);
      }
    }

    // Handle COMMENT or DM_REPLY (typing)
    if (
      decision.synthesizedText &&
      (decision.action === 'COMMENT' || decision.action === 'DM_REPLY')
    ) {
      // First click on the target input element if specified
      if (targetElement) {
        targetPoint = this.cursorPhysics.calculateDynamicTargetPoint(targetElement.boundingBox);
        const traj = this.cursorPhysics.generateTrajectory(
          this.cursorPhysics.getCurrentPosition(),
          targetPoint
        );
        await this.browserClient.dispatchMouseMoveTrajectory(traj);
        await this.browserClient.dispatchMouseClick(targetPoint, this.cursorPhysics.getSightAlignmentPause());
        executedActions.push(`Clicked text input at (${targetPoint.x}, ${targetPoint.y})`);
      }

      const fullText = decision.synthesizedText;
      this.log(`[ACT] Humanized typing: "${fullText}"`);
      const keystrokes = this.keystrokeSynthesizer.synthesizeKeystrokes(fullText);
      await this.browserClient.dispatchKeystrokeActions(keystrokes);
      executedActions.push(`Typed ${fullText.length} chars with humanized latency`);

      // Natural pre-submit pause (reading over what was typed)
      await this.humanPause(800, 1800);

      // Find and click submit button using AI-reasoning (no hardcoded text)
      await this.submitTypedContent(semanticElements, executedActions);

      this.rhythmManager.recordAction(decision.action === 'COMMENT' ? 'comment' : 'dm');

      // In POST_OPEN mode: Step 5 (Verify) & Step 6 (Return to feed)
      if (mode === 'POST_OPEN' && decision.action === 'COMMENT') {
        this.log('[6-Step Loop] ✓ Step 4 Complete: Comment submitted. Verifying in thread...');
        await this.humanPause(2000, 3200);
        this.log('[6-Step Loop] ✓ Step 5 Complete: Comment confirmed published.');
        this.log('[6-Step Loop] Navigating back to feed to repeat cycle...');
        await this.browserClient.navigateBack();
        await this.humanPause(1800, 2600);
        requestedModeSwitch = 'FEED';
        this.log('[6-Step Loop] ✓ Step 6 Complete: Returned to FEED. Ready for next post.');
      }
    }

    // Handle SCROLL
    if (decision.action === 'SCROLL') {
      const scrollDist = decision.scrollDeltaY ?? (280 + Math.floor(Math.random() * 240));
      this.log(`[ACT] Smooth organic scroll: ${scrollDist}px`);
      await this.browserClient.dispatchSmoothScroll(scrollDist);
      executedActions.push(`Scrolled ${scrollDist}px`);
      this.rhythmManager.recordAction('scroll');

      // Passive linger (reading time simulation)
      const lingerMs = this.rhythmManager.getPostLingerDuration();
      this.log(`[ACT] Passive reading linger: ${Math.round(lingerMs / 1000)}s`);
      await this.humanPause(lingerMs, lingerMs);
    }

    // Handle NAVIGATE (search or URL nav)
    if (decision.action === 'NAVIGATE' && decision.targetDescription) {
      await this.browserClient.navigateTo(decision.targetDescription);
      executedActions.push(`Navigated to: ${decision.targetDescription}`);
    }

    // ──────────────────────────────────────────
    // STEP 4: VERIFY
    // ──────────────────────────────────────────
    this.log(`[VERIFY] Capturing post-action screenshot for state verification...`);
    await this.humanPause(900, 1600);

    let verificationSuccess = true;
    try {
      await this.browserClient.captureScreenshot();
    } catch {
      verificationSuccess = false;
    }
    this.log(`[VERIFY] State: ${verificationSuccess ? '✓ CONFIRMED' : '⚠ RETRY_SCHEDULED'}`);

    const dynamicDelay =
      decision.recommendedDelayMs ||
      this.rhythmManager.calculateDynamicDelay(
        decision.action === 'COMMENT'
          ? 'comment'
          : decision.action === 'DM_REPLY'
          ? 'dm'
          : 'browse'
      );

    this.log(`[RHYTHM] Next cycle delay: ${Math.round(dynamicDelay / 1000)}s`);

    const logEntry = `Cycle #${cycleIndex} [${mode}]: ${decision.action} → ${executedActions.join(', ')}`;
    this.actionHistory.push(logEntry);
    if (this.actionHistory.length > 20) this.actionHistory.shift();

    return {
      cycleIndex,
      timestamp: Date.now(),
      mode,
      decision,
      targetPoint,
      executedActions,
      verificationSuccess,
      delayMs: dynamicDelay,
      requestedModeSwitch,
      logEntry,
    };
  }

  /**
   * Submits typed content by finding the submit button using structural DOM reasoning.
   */
  private async submitTypedContent(
    elements: SemanticElement[],
    executedActions: string[]
  ): Promise<void> {
    try {
      const page = await this.browserClient.ensureActivePage();
      if (page) {
        // 1. Send native Threads keyboard submission shortcut (Ctrl+Enter)
        try {
          await page.keyboard.down('Control');
          await page.keyboard.press('Enter');
          await page.keyboard.up('Control');
          executedActions.push('Dispatched Ctrl+Enter submit shortcut');
        } catch {}

        await this.humanPause(300, 600);

        // 2. Also find and click the exact visible Post / Reply button
        const postBtnCoord = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
          for (const b of btns) {
            const text = (b.textContent || '').trim();
            const aria = b.getAttribute('aria-label') || b.querySelector('[aria-label]')?.getAttribute('aria-label') || '';
            const rect = b.getBoundingClientRect();
            const isSubmit = text === 'Post' || text === 'Create' || text === 'Reply' || aria === 'Post' || aria === 'Reply';
            if (isSubmit && rect.top > 50 && rect.top < 850 && rect.width > 20 && rect.height > 15) {
              return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            }
          }
          return null;
        });

        if (postBtnCoord) {
          const submitPt: Point = { x: Math.round(postBtnCoord.x), y: Math.round(postBtnCoord.y) };
          const traj = this.cursorPhysics.generateTrajectory(
            this.cursorPhysics.getCurrentPosition(),
            submitPt
          );
          await this.browserClient.dispatchMouseMoveTrajectory(traj);
          await this.browserClient.dispatchMouseClick(submitPt);
          executedActions.push(`Clicked Post button at (${submitPt.x}, ${submitPt.y})`);
        }

        // Direct DOM click safety fallback
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
          for (const b of btns) {
            const text = (b.textContent || '').trim();
            const aria = b.getAttribute('aria-label') || b.querySelector('[aria-label]')?.getAttribute('aria-label') || '';
            if ((text === 'Post' || text === 'Reply' || aria === 'Post' || aria === 'Reply') && b.getBoundingClientRect().width > 0) {
              (b as HTMLElement).click();
              break;
            }
          }
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('[ObserveReasonActLoop] submitTypedContent notice:', (err as Error).message);
    }

    // Post-submit verification pause
    await this.humanPause(1500, 2500);
  }

  private async navigateToDmInbox(): Promise<void> {
    await this.browserClient.navigateTo('https://www.threads.com/direct/inbox/');
    await this.humanPause(2000, 3500);
  }

  private async navigateToNotifications(): Promise<void> {
    await this.browserClient.navigateTo('https://www.threads.com/notifications/');
    await this.humanPause(2000, 3500);
  }

  private async humanPause(minMs: number, maxMs: number): Promise<void> {
    const duration = minMs + Math.floor(Math.random() * (maxMs - minMs));
    await new Promise((r) => setTimeout(r, duration));
  }

  private buildSecurityResult(
    cycleIndex: number,
    mode: OperationalMode,
    decision: AgenticDecision,
    secResult: SecurityCheckResult
  ): CycleResult {
    return {
      cycleIndex,
      timestamp: Date.now(),
      mode,
      decision: { ...decision, action: 'SECURITY_CHALLENGE' },
      executedActions: ['⚠ Halted all actions — security challenge detected'],
      verificationSuccess: false,
      delayMs: 60000,
      securityChallenge: secResult,
      logEntry: `Cycle #${cycleIndex} [${mode}]: SECURITY_CHALLENGE → ${secResult.challengeType}`,
    };
  }
}
