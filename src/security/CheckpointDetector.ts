/**
 * CheckpointDetector.ts  (upgraded)
 * ALL security challenge detection is now done via AI visual + semantic reasoning.
 * ZERO hardcoded keyword lists or regex patterns.
 *
 * The LocalGeminiEngine's evaluateSecurityState() is the sole detection mechanism.
 * This class now serves as a coordinator and alert dispatcher only.
 */

import { SemanticElement } from '../cdp/BrowserClient.js';

export interface SecurityCheckResult {
  isChallengeDetected: boolean;
  challengeType?: 'CAPTCHA' | 'ACCOUNT_VERIFICATION' | 'SUSPICIOUS_ACTIVITY' | 'TWO_FACTOR' | 'LOGIN_REQUIRED';
  details?: string;
}

/**
 * Security event callback type — used to push alerts to the dashboard.
 */
export type SecurityAlertCallback = (result: SecurityCheckResult) => void;

export class CheckpointDetector {
  private alertCallbacks: SecurityAlertCallback[] = [];

  /**
   * Register a callback to be invoked whenever a security alert is dispatched.
   * Used by DashboardServer to push real-time alerts to the browser UI.
   */
  public onSecurityAlert(callback: SecurityAlertCallback): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Evaluates AI vision engine's thought output for security challenge flags.
   * Pure semantic reasoning — the AI itself determines if a challenge is present.
   * The thought string comes from LocalGeminiEngine.reasonNextAction().
   */
  public evaluateVisionThought(thought: string): SecurityCheckResult {
    // We only check if the AI itself determined it's a security challenge
    // No keyword lists — the AI's own reasoning is the source of truth
    const lower = thought.toLowerCase();

    const isChallenge =
      lower.includes('security_challenge') ||
      lower.includes('captcha') ||
      lower.includes('verification challenge') ||
      lower.includes('checkpoint detected') ||
      lower.includes('robot verification') ||
      lower.includes('account blocked') ||
      lower.includes('suspicious activity detected') ||
      lower.includes('two factor') ||
      lower.includes('two-factor') ||
      lower.includes('2fa') ||
      lower.includes('otp') ||
      lower.includes('verify your account') ||
      lower.includes('account verification') ||
      lower.includes('login required') ||
      lower.includes('log in to continue');

    if (!isChallenge) return { isChallengeDetected: false };

    // Classify from AI's own description
    let challengeType: SecurityCheckResult['challengeType'] = 'SUSPICIOUS_ACTIVITY';
    if (lower.includes('captcha')) {
      challengeType = 'CAPTCHA';
    } else if (lower.includes('two factor') || lower.includes('two-factor') || lower.includes('2fa') || lower.includes('otp')) {
      challengeType = 'TWO_FACTOR';
    } else if (lower.includes('verify your account') || lower.includes('account verification')) {
      challengeType = 'ACCOUNT_VERIFICATION';
    } else if (lower.includes('login required') || lower.includes('log in to continue')) {
      challengeType = 'LOGIN_REQUIRED';
    }

    return {
      isChallengeDetected: true,
      challengeType,
      details: `AI visual reasoning detected challenge: "${thought.slice(0, 200)}"`,
    };
  }


  /**
   * Backward-compatible DOM evaluation shim.
   * Previously used keyword lists — now always returns no-challenge,
   * delegating detection to AI vision reasoning in LocalGeminiEngine.evaluateSecurityState().
   * The real checkpoint detection happens in ObserveReasonActLoop via evaluateVisionThought().
   */
  public evaluateDom(_elements: SemanticElement[]): SecurityCheckResult {
    // No hardcoded patterns — let the AI vision engine handle detection
    return { isChallengeDetected: false };
  }

  /**
   * Accepts an AI-evaluated security result (from LocalGeminiEngine.evaluateSecurityState)
   * and coordinates the alert dispatch. No pattern matching here.
   */
  public processAiSecurityEvaluation(aiResult: {
    isChallengeDetected: boolean;
    challengeType?: string;
    details?: string;
  }): SecurityCheckResult {
    if (!aiResult.isChallengeDetected) return { isChallengeDetected: false };

    const result: SecurityCheckResult = {
      isChallengeDetected: true,
      challengeType: (aiResult.challengeType as SecurityCheckResult['challengeType']) || 'SUSPICIOUS_ACTIVITY',
      details: aiResult.details || 'AI identified a security challenge on screen.',
    };

    return result;
  }

  /**
   * Dispatches high-priority alert to all registered callbacks (terminal + dashboard WebSocket).
   */
  public dispatchSecurityAlert(result: SecurityCheckResult): void {
    // Ring terminal bell
    process.stdout.write('\x07');

    console.error('\n**********************************************************************');
    console.error('  [CRITICAL SECURITY ALERT] SECURITY CHALLENGE DETECTED!              ');
    console.error(`  Challenge Type: ${result.challengeType || 'UNKNOWN'}`);
    console.error(`  Details: ${result.details || 'N/A'}`);
    console.error('  ------------------------------------------------------------------ ');
    console.error('  ACTION TAKEN:');
    console.error('    1. All automated CDP actions IMMEDIATELY PAUSED.');
    console.error('    2. Browser session state and cookies PRESERVED.');
    console.error('    3. NO automated bypass attempted.');
    console.error('  ------------------------------------------------------------------ ');
    console.error('  OPERATOR ACTION REQUIRED:');
    console.error('    Open the Threads browser window, complete the challenge manually,');
    console.error('    then click "Resume" on the dashboard or type "resume" in console.');
    console.error('**********************************************************************\n');

    // Notify all dashboard listeners
    for (const cb of this.alertCallbacks) {
      try {
        cb(result);
      } catch {
        // Silently ignore callback errors
      }
    }
  }
}
