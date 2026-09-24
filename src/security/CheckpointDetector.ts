/**
 * CheckpointDetector.ts
 * Inspects viewport and DOM state for security challenges, CAPTCHAs, or checkpoint overlays.
 * Triggers immediate CDP pause, preservation of session state, and dispatch of local
 * notifications for manual human intervention. Never attempts automated bypass.
 */

import { SemanticElement } from '../cdp/BrowserClient.js';

export interface SecurityCheckResult {
  isChallengeDetected: boolean;
  challengeType?: 'CAPTCHA' | 'ACCOUNT_VERIFICATION' | 'SUSPICIOUS_ACTIVITY' | 'TWO_FACTOR' | 'LOGIN_REQUIRED';
  details?: string;
}

export class CheckpointDetector {
  private static readonly CHALLENGE_KEYWORDS = [
    { type: 'CAPTCHA' as const, terms: ['recaptcha', 'hcaptcha', 'arkose', 'confirm you are not a robot', 'press & hold', 'select all images'] },
    { type: 'ACCOUNT_VERIFICATION' as const, terms: ['help us confirm that you own this account', 'confirm it’s you', 'confirm its you', 'verify your account', 'security check', 'we noticed unusual activity'] },
    { type: 'SUSPICIOUS_ACTIVITY' as const, terms: ['action blocked', 'try again later', 'we restrict certain activity', 'compromised account'] },
    { type: 'TWO_FACTOR' as const, terms: ['enter the 6-digit code', 'two-factor authentication', 'authentication code'] },
    { type: 'LOGIN_REQUIRED' as const, terms: ['log in to continue', 'log in with instagram', 'switch accounts'] },
  ];

  /**
   * Scans semantic elements and DOM hierarchy for security challenges.
   */
  public evaluateDom(elements: SemanticElement[]): SecurityCheckResult {
    const combinedText = elements
      .map((e) => `${e.textSnippet} ${e.ariaLabel || ''} ${e.placeholder || ''}`)
      .join(' ')
      .toLowerCase();

    for (const group of CheckpointDetector.CHALLENGE_KEYWORDS) {
      for (const term of group.terms) {
        if (combinedText.includes(term)) {
          return {
            isChallengeDetected: true,
            challengeType: group.type,
            details: `Found security indicator term: "${term}" in DOM`,
          };
        }
      }
    }

    return { isChallengeDetected: false };
  }

  /**
   * Scans vision reasoning thought output from the Gemini engine for visual flags.
   */
  public evaluateVisionThought(thought: string): SecurityCheckResult {
    const lower = thought.toLowerCase();
    for (const group of CheckpointDetector.CHALLENGE_KEYWORDS) {
      for (const term of group.terms) {
        if (lower.includes(term)) {
          return {
            isChallengeDetected: true,
            challengeType: group.type,
            details: `Visual engine identified security challenge: "${term}"`,
          };
        }
      }
    }
    return { isChallengeDetected: false };
  }

  /**
   * Dispatches high-priority alert to the terminal and operator screen.
   */
  public dispatchSecurityAlert(result: SecurityCheckResult): void {
    // Ring terminal bell
    process.stdout.write('\x07');

    console.error('\n**************************************************************');
    console.error(' [CRITICAL SECURITY ALERT] SECURITY CHALLENGE DETECTED!       ');
    console.error(` Challenge Type: ${result.challengeType}`);
    console.error(` Details: ${result.details}`);
    console.error(' ------------------------------------------------------------ ');
    console.error(' ACTION TAKEN:                                                ');
    console.error('  1. All automated CDP input actions have been IMMEDIATELY PAUSED.');
    console.error('  2. Active browser session state and cookies are PRESERVED.  ');
    console.error('  3. NO automated bypass will be attempted.                   ');
    console.error('                                                              ');
    console.error(' OPERATOR ACTION REQUIRED:                                    ');
    console.error('  Please open the Threads browser window, complete the check   ');
    console.error('  manually, and type "resume" in the console when completed.  ');
    console.error('**************************************************************\n');
  }
}
