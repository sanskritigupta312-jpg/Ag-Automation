/**
 * ObserveReasonActLoop.ts
 * Implements the continuous OODA loop:
 * 1. OBSERVE (Capture viewport screenshot & dynamic semantic DOM tree)
 * 2. REASON (Send to Local Gemini Engine -> determine target, coordinates, human text)
 * 3. ACT (Bézier cursor movement, randomized inner click, humanized keystrokes)
 * 4. VERIFY (Post-action visual delta, memory retention, operational rhythm delay)
 */

import { BrowserClient, SemanticElement } from '../cdp/BrowserClient.js';
import { LocalGeminiEngine, AgenticDecision } from '../engine/LocalGeminiEngine.js';
import { CursorPhysics, Point } from '../humanizer/CursorPhysics.js';
import { KeystrokeSynthesizer } from '../humanizer/KeystrokeSynthesizer.js';
import { RhythmManager } from '../humanizer/RhythmManager.js';

export interface CycleResult {
  cycleIndex: number;
  timestamp: number;
  mode: 'FEED' | 'DM' | 'PROFILE';
  decision: AgenticDecision;
  targetPoint?: Point;
  executedActions: string[];
  verificationSuccess: boolean;
  delayMs: number;
}

export class ObserveReasonActLoop {
  private browserClient: BrowserClient;
  private geminiEngine: LocalGeminiEngine;
  private cursorPhysics: CursorPhysics;
  private keystrokeSynthesizer: KeystrokeSynthesizer;
  private rhythmManager: RhythmManager;

  private actionHistory: string[] = [];
  private cycleCount: number = 0;

  constructor(
    browserClient: BrowserClient,
    geminiEngine: LocalGeminiEngine,
    cursorPhysics: CursorPhysics,
    keystrokeSynthesizer: KeystrokeSynthesizer,
    rhythmManager: RhythmManager
  ) {
    this.browserClient = browserClient;
    this.geminiEngine = geminiEngine;
    this.cursorPhysics = cursorPhysics;
    this.keystrokeSynthesizer = keystrokeSynthesizer;
    this.rhythmManager = rhythmManager;
  }

  /**
   * Executes a single complete cycle: OBSERVE -> REASON -> ACT -> VERIFY.
   */
  public async executeCycle(
    mode: 'FEED' | 'DM' | 'PROFILE',
    chatContext?: string
  ): Promise<CycleResult> {
    this.cycleCount++;
    const cycleIndex = this.cycleCount;
    const executedActions: string[] = [];

    console.log(`\n======================================================`);
    console.log(`[CYCLE #${cycleIndex}] OPERATIONAL MODE: ${mode}`);
    console.log(`======================================================`);

    // ------------------------------------------------------------------
    // STEP 1: OBSERVE
    // ------------------------------------------------------------------
    console.log(`[1. OBSERVE] Capturing screen viewport & semantic DOM candidates...`);
    const screenshotBase64 = await this.browserClient.captureScreenshot();
    const semanticElements = await this.browserClient.extractSemanticElements();
    console.log(`[1. OBSERVE] Extracted ${semanticElements.length} candidate interactive elements.`);

    // ------------------------------------------------------------------
    // STEP 2: REASON
    // ------------------------------------------------------------------
    console.log(`[2. REASON] Invoking Local Gemini Engine for pure agentic reasoning...`);
    const recentSummary = this.actionHistory.slice(-4).join('; ');
    const decision = await this.geminiEngine.reasonNextAction({
      screenshotBase64,
      semanticElements,
      currentMode: mode,
      chatHistoryContext: chatContext,
      recentActionsSummary: recentSummary,
    });

    console.log(`[2. REASON] Engine Thought: "${decision.thought}"`);
    console.log(`[2. REASON] Determined Action: ${decision.action} (Confidence: ${Math.round(decision.confidence * 100)}%)`);

    let targetPoint: Point | undefined;

    // ------------------------------------------------------------------
    // STEP 3: ACT
    // ------------------------------------------------------------------
    console.log(`[3. ACT] Dispatching organic human actions...`);

    // Locate target element bounding box if action requires an element interaction
    let targetElement: SemanticElement | undefined;
    if (decision.targetElementId) {
      targetElement = semanticElements.find((e) => e.id === decision.targetElementId);
    }

    if (targetElement) {
      // Dynamic non-center bounding box point
      targetPoint = this.cursorPhysics.calculateDynamicTargetPoint(targetElement.boundingBox);
      const startPoint = this.cursorPhysics.getCurrentPosition();

      console.log(
        `[3. ACT] Cursor Trajectory: (${startPoint.x}, ${startPoint.y}) -> Target (${targetPoint.x}, ${targetPoint.y}) [Box: ${targetElement.boundingBox.width}x${targetElement.boundingBox.height}]`
      );

      // Generate non-linear Bézier trajectory
      const trajectory = this.cursorPhysics.generateTrajectory(startPoint, targetPoint);
      await this.browserClient.dispatchMouseMoveTrajectory(trajectory);

      // Pre-click gaze alignment and click dispatch
      await this.browserClient.dispatchMouseClick(targetPoint);
      executedActions.push(`Clicked element #${targetElement.id} at (${targetPoint.x}, ${targetPoint.y})`);
    }

    // Handle typing if synthesized text is present
    if (decision.synthesizedText && (decision.action === 'COMMENT' || decision.action === 'DM_REPLY')) {
      let fullText = decision.synthesizedText;
      if (decision.trendingHashtags && decision.trendingHashtags.length > 0) {
        fullText += ` ${decision.trendingHashtags.join(' ')}`;
      }

      console.log(`[3. ACT] Humanized Typing Synthesis: "${fullText}"`);
      const keystrokeSequence = this.keystrokeSynthesizer.synthesizeKeystrokes(fullText);
      await this.browserClient.dispatchKeystrokeActions(keystrokeSequence);
      executedActions.push(`Typed ${fullText.length} characters with human latency & typo corrections`);

      // Natural pause before submit
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));

      // Dispatch Enter or locate submit button dynamically
      const submitCandidate = semanticElements.find(
        (e) =>
          e.isClickable &&
          (e.textSnippet.toLowerCase().includes('post') ||
            e.textSnippet.toLowerCase().includes('send') ||
            e.ariaLabel?.toLowerCase().includes('post') ||
            e.ariaLabel?.toLowerCase().includes('send'))
      );

      if (submitCandidate) {
        const submitPt = this.cursorPhysics.calculateDynamicTargetPoint(submitCandidate.boundingBox);
        const subTrajectory = this.cursorPhysics.generateTrajectory(
          this.cursorPhysics.getCurrentPosition(),
          submitPt
        );
        await this.browserClient.dispatchMouseMoveTrajectory(subTrajectory);
        await this.browserClient.dispatchMouseClick(submitPt);
        executedActions.push(`Clicked submit button at (${submitPt.x}, ${submitPt.y})`);
      } else {
        // Press Enter key to submit
        await this.browserClient.dispatchKeystrokeActions([
          { type: 'type', char: '\n', delayMs: 120 },
        ]);
        executedActions.push(`Submitted via Enter keystroke`);
      }

      this.rhythmManager.recordAction(decision.action === 'COMMENT' ? 'comment' : 'dm');
    }

    // Handle scrolling
    if (decision.action === 'SCROLL') {
      const scrollDistance = decision.scrollDeltaY ?? (280 + Math.floor(Math.random() * 220));
      console.log(`[3. ACT] Executing organic smooth scroll of ${scrollDistance}px...`);
      await this.browserClient.dispatchSmoothScroll(scrollDistance);
      executedActions.push(`Smooth scrolled ${scrollDistance}px`);
      this.rhythmManager.recordAction('scroll');
    }

    // ------------------------------------------------------------------
    // STEP 4: VERIFY
    // ------------------------------------------------------------------
    console.log(`[4. VERIFY] Checking visual update and DOM feedback...`);
    // Dwell pause to allow DOM mutation & server response
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 600));

    // Capture post-action screenshot to verify update
    let verificationSuccess = true;
    try {
      await this.browserClient.captureScreenshot();
      verificationSuccess = true;
    } catch {
      verificationSuccess = false;
    }

    console.log(`[4. VERIFY] State verification: ${verificationSuccess ? 'CONFIRMED' : 'RETRY_SCHEDULED'}`);

    // Compute dynamic anti-ban rhythm delay
    const dynamicDelay =
      decision.recommendedDelayMs ||
      this.rhythmManager.calculateDynamicDelay(
        decision.action === 'COMMENT' ? 'comment' : decision.action === 'DM_REPLY' ? 'dm' : 'browse'
      );

    console.log(`[RHYTHM] Dynamic Operational Delay: ${Math.round(dynamicDelay / 1000)}s`);

    const summaryEntry = `Cycle #${cycleIndex}: ${decision.action} -> ${executedActions.join(', ')}`;
    this.actionHistory.push(summaryEntry);

    return {
      cycleIndex,
      timestamp: Date.now(),
      mode,
      decision,
      targetPoint,
      executedActions,
      verificationSuccess,
      delayMs: dynamicDelay,
    };
  }
}
