/**
 * advanced_protocols.test.ts
 * Rigorous test suite validating advanced anti-ban protocols:
 * - Checkpoint / CAPTCHA detection and zero-bypass alert
 * - Rate limiting (8-12 comments/hr, 4-6 DMs/hr) & 20-45m operational breaks
 * - Strict 20%-80% inner pad targeting & 350ms-1400ms sight alignment pause
 * - Real-time trend hashtag injection (2-3 tags per niche)
 * - Session runtime health & 2-hour reload threshold
 */

import { CursorPhysics, BoundingBox } from '../src/humanizer/CursorPhysics.js';
import { KeystrokeSynthesizer } from '../src/humanizer/KeystrokeSynthesizer.js';
import { RhythmManager } from '../src/humanizer/RhythmManager.js';
import { CheckpointDetector } from '../src/security/CheckpointDetector.js';
import { TrendInjector } from '../src/trend/TrendInjector.js';
import { SessionManager } from '../src/session/SessionManager.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    failed++;
  }
}

async function runAdvancedTests() {
  console.log('================================================================');
  console.log('   RUNNING ADVANCED PROTOCOLS & ANTI-BAN TEST SUITE             ');
  console.log('================================================================\n');

  // TEST 1: Strict 20%-80% Safe Inner Pad Targeting
  console.log('1. Testing CursorPhysics: Strict 20%-80% Inner Pad & Sight Alignment Pause...');
  const physics = new CursorPhysics();
  const box: BoundingBox = { x: 100, y: 200, width: 200, height: 100 };

  const expectedMinX = 100 + 200 * 0.2; // 140
  const expectedMaxX = 100 + 200 * 0.8; // 260
  const expectedMinY = 200 + 100 * 0.2; // 220
  const expectedMaxY = 200 + 100 * 0.8; // 280

  for (let i = 0; i < 50; i++) {
    const pt = physics.calculateDynamicTargetPoint(box);
    assert(
      pt.x >= expectedMinX && pt.x <= expectedMaxX && pt.y >= expectedMinY && pt.y <= expectedMaxY,
      `Point #${i + 1} (${pt.x}, ${pt.y}) must stay strictly within 20%-80% inner pad`
    );
  }

  // Sight alignment pause test (350ms to 1400ms)
  for (let i = 0; i < 20; i++) {
    const pause = physics.getSightAlignmentPause();
    assert(pause >= 350 && pause <= 1400, `Sight pause ${pause}ms must be between 350ms and 1400ms`);
  }

  // TEST 2: Checkpoint & CAPTCHA Detector
  console.log('\n2. Testing CheckpointDetector: Zero-Bypass Detection...');
  const detector = new CheckpointDetector();

  const mockSafeElements = [
    {
      id: 1,
      tagName: 'button',
      role: 'button',
      ariaLabel: 'Reply to post',
      placeholder: null,
      textSnippet: 'Reply',
      isEditable: false,
      isClickable: true,
      boundingBox: { x: 50, y: 50, width: 100, height: 40 },
    },
  ];

  const safeCheck = detector.evaluateDom(mockSafeElements);
  assert(!safeCheck.isChallengeDetected, 'Standard elements must not trigger challenge');

  const mockChallengeElements = [
    {
      id: 2,
      tagName: 'div',
      role: 'dialog',
      ariaLabel: 'Help us confirm that you own this account',
      placeholder: null,
      textSnippet: 'Confirm its you to continue',
      isEditable: false,
      isClickable: false,
      boundingBox: { x: 0, y: 0, width: 500, height: 600 },
    },
  ];

  const challengeCheck = detector.evaluateDom(mockChallengeElements);
  assert(challengeCheck.isChallengeDetected, 'Account verification overlay must be detected');
  assert(challengeCheck.challengeType === 'ACCOUNT_VERIFICATION', 'Challenge type must match ACCOUNT_VERIFICATION');

  const visionCheck = detector.evaluateVisionThought('I notice a reCAPTCHA challenge overlay on the screen.');
  assert(visionCheck.isChallengeDetected, 'reCAPTCHA in visual engine thought must be detected');

  // TEST 3: Rate Limiting & Operational Breaks
  console.log('\n3. Testing RhythmManager: Rate Limiting (8-12 comments, 4-6 DMs) & Breaks...');
  const rhythm = new RhythmManager({
    maxCommentsPerHour: 8,
    maxDmsPerHour: 4,
    actionsBeforeBreakMin: 4,
    actionsBeforeBreakMax: 4, // Fixed at 4 for test predictability
    breakDurationMinMs: 20 * 60 * 1000,
    breakDurationMaxMs: 45 * 60 * 1000,
  });

  // Execute 3 comments
  for (let i = 0; i < 3; i++) {
    const canComment = rhythm.canExecuteAction('comment');
    assert(canComment.allowed, `Comment #${i + 1} must be allowed under rate limit`);
    rhythm.recordAction('comment');
  }

  assert(!rhythm.isInOperationalBreak().active, 'Should not be in break after 3 actions');

  // Execute 4th comment -> should trigger operational break
  rhythm.recordAction('comment');
  const breakStatus = rhythm.isInOperationalBreak();
  assert(breakStatus.active, 'Must trigger operational cool-down break after 4 actions');
  assert(breakStatus.remainingMs >= 19 * 60 * 1000, 'Break duration must be at least 20 minutes');

  // Action during cooldown must be blocked
  const blockedCheck = rhythm.canExecuteAction('comment');
  assert(!blockedCheck.allowed, 'Actions must be blocked during operational cool-down break');

  // Linger duration test (5s - 12s)
  for (let i = 0; i < 10; i++) {
    const linger = rhythm.getPostLingerDuration();
    assert(linger >= 5000 && linger <= 12000, `Post linger ${linger}ms must be between 5s and 12s`);
  }

  // TEST 4: Real-Time Trend Hashtag Injection
  console.log('\n4. Testing TrendInjector: Dynamic Niche Deduction & Hashtag Selection...');
  const trendInjector = new TrendInjector();

  const aiPost = 'Exploring local autonomous agents operating with vision models and tool use';
  const aiTags = trendInjector.deduceTrendingHashtags(aiPost);
  assert(aiTags.length >= 2 && aiTags.length <= 3, 'Must return 2-3 trending hashtags');
  assert(aiTags.some((t) => t.includes('ai') || t.includes('tech') || t.includes('llm')), 'AI post must get AI/tech hashtags');

  const designPost = 'Redesigning the mobile navigation with cleaner micro interactions in figma';
  const designTags = trendInjector.deduceTrendingHashtags(designPost);
  assert(designTags.some((t) => t.includes('design') || t.includes('ui') || t.includes('ux')), 'Design post must get UI/design hashtags');

  // TEST 5: Keystroke Synthesizer Prose Hyphen Suppression
  console.log('\n5. Testing KeystrokeSynthesizer: Hyphens in Regular Prose Suppression...');
  const synth = new KeystrokeSynthesizer();
  const inputWithProseHyphen = 'this is a great release - love the clean aesthetic';
  const sanitizedProse = synth.sanitizeHumanSyntax(inputWithProseHyphen);
  assert(!sanitizedProse.includes(' - '), 'Isolated hyphens in regular prose must be sanitized');

  // TEST 6: SessionManager Runtime Health & 2-Hour Reload
  console.log('\n6. Testing SessionManager: 2-Hour Runtime Health Monitor...');
  const sessionManager = new SessionManager('.chrome-session-profile', 2);
  assert(!sessionManager.isGracefulReloadDue(), 'New session should not be due for reload immediately');

  console.log('\n================================================================');
  console.log(`ADVANCED PROTOCOL TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAdvancedTests().catch((e) => {
  console.error('Advanced test error:', e);
  process.exit(1);
});
