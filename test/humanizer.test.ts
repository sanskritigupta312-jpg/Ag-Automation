/**
 * humanizer.test.ts
 * Rigorous test suite validating all anti-ban, human mimicry, and reasoning components.
 */

import { CursorPhysics, BoundingBox, Point } from '../src/humanizer/CursorPhysics.js';
import { KeystrokeSynthesizer } from '../src/humanizer/KeystrokeSynthesizer.js';
import { RhythmManager } from '../src/humanizer/RhythmManager.js';
import { LocalGeminiEngine } from '../src/engine/LocalGeminiEngine.js';

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

async function runTests() {
  console.log('======================================================');
  console.log('      RUNNING AGENTIC & HUMANIZER TEST SUITE          ');
  console.log('======================================================\n');

  // TEST 1: CursorPhysics - Dynamic Non-Center Bounding Box Point
  console.log('1. Testing CursorPhysics: Dynamic Bounding Box Targeting...');
  const physics = new CursorPhysics();
  const box: BoundingBox = { x: 200, y: 300, width: 120, height: 40 };

  const samplePoints: Point[] = [];
  for (let i = 0; i < 30; i++) {
    const pt = physics.calculateDynamicTargetPoint(box);
    samplePoints.push(pt);
    assert(
      pt.x >= box.x && pt.x <= box.x + box.width && pt.y >= box.y && pt.y <= box.y + box.height,
      `Point #${i + 1} (${pt.x}, ${pt.y}) must stay inside bounding box`
    );
  }

  // Ensure points are not all identical (no static coordinates)
  const uniqueX = new Set(samplePoints.map((p) => p.x));
  const uniqueY = new Set(samplePoints.map((p) => p.y));
  assert(uniqueX.size > 15, `Target X coordinates must vary dynamically (got ${uniqueX.size} distinct values)`);
  assert(uniqueY.size > 10, `Target Y coordinates must vary dynamically (got ${uniqueY.size} distinct values)`);

  // Ensure points are not the exact dead center
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const hitCenter = samplePoints.some((p) => Math.abs(p.x - centerX) < 0.5 && Math.abs(p.y - centerY) < 0.5);
  assert(!hitCenter, 'Points must never click exact dead center of target element');

  // TEST 2: CursorPhysics - Cubic Bézier Curve Trajectory
  console.log('\n2. Testing CursorPhysics: Cubic Bézier Curve Generation...');
  const start: Point = { x: 50, y: 80 };
  const target: Point = { x: 450, y: 380 };
  const trajectory = physics.generateTrajectory(start, target, { steps: 30 });

  assert(trajectory.length >= 30, `Trajectory must contain at least 30 smooth points (got ${trajectory.length})`);
  assert(
    Math.hypot(trajectory[0].x - start.x, trajectory[0].y - start.y) < 2,
    'Trajectory must originate at start coordinates'
  );
  const endPoint = trajectory[trajectory.length - 1];
  assert(
    Math.hypot(endPoint.x - target.x, endPoint.y - target.y) < 2,
    'Trajectory must conclude at target coordinates'
  );

  // Check for curvature (non-linear path)
  let isNonLinear = false;
  for (const pt of trajectory) {
    const expectedLinearY = start.y + ((target.y - start.y) * (pt.x - start.x)) / (target.x - start.x);
    if (Math.abs(pt.y - expectedLinearY) > 5) {
      isNonLinear = true;
      break;
    }
  }
  assert(isNonLinear, 'Trajectory must follow an organic non-linear curved path');

  // TEST 3: KeystrokeSynthesizer - AI Stylistic Marker Suppression
  console.log('\n3. Testing KeystrokeSynthesizer: AI Marker Suppression & Casual Syntax...');
  const synth = new KeystrokeSynthesizer();

  const roboticInput = 'Indeed, this is phenomenal — let us examine the core tenets: \n* First insight\n* Second insight.';
  const sanitized = synth.sanitizeHumanSyntax(roboticInput);

  assert(!sanitized.includes('—'), 'Em-dash (—) must be completely stripped');
  assert(!sanitized.includes('Indeed'), 'Robotic openers like "Indeed" must be stripped');
  assert(!sanitized.includes('* First'), 'Structural bullet points must be stripped');

  // TEST 4: KeystrokeSynthesizer - Typing Latency & Typos
  console.log('\n4. Testing KeystrokeSynthesizer: Keystroke Latency & Typos...');
  const actions = synth.synthesizeKeystrokes('super clean design approach', 0.2);
  const typeActions = actions.filter((a) => a.type === 'type');

  assert(typeActions.length >= 25, `Should synthesize individual character actions (got ${typeActions.length})`);
  const allDelaysValid = typeActions.every((a) => a.delayMs >= 40 && a.delayMs <= 220);
  assert(allDelaysValid, 'All keystroke delays must fall within human typing threshold (40ms-220ms)');

  const hasBackspaces = actions.some((a) => a.type === 'backspace');
  assert(hasBackspaces, 'Should naturally synthesize occasional backspace typo corrections');

  // TEST 5: RhythmManager - Operational Delays & Circadian Factor
  console.log('\n5. Testing RhythmManager: Fatigue & Delay Calculations...');
  const rhythm = new RhythmManager();
  const delayComment = rhythm.calculateDynamicDelay('comment');
  const delayScroll = rhythm.calculateDynamicDelay('scroll');

  assert(delayComment > delayScroll, `Comment delay (${delayComment}ms) must be higher than scroll delay (${delayScroll}ms)`);
  assert(delayComment >= 3000, 'Comment delay must respect safe anti-ban intervals');

  const dwellTime = rhythm.generateReadingDwellTime(250, true);
  assert(dwellTime >= 4000, `Reading dwell time for media post must reflect contemplation (${dwellTime}ms)`);

  // TEST 6: LocalGeminiEngine - Fallback & Decision Schema
  console.log('\n6. Testing LocalGeminiEngine: Agentic Reasoning Decision Engine...');
  const engine = new LocalGeminiEngine({ hostUrl: 'http://localhost:11434' });

  const mockSemanticElements = [
    {
      id: 1,
      tagName: 'div',
      role: 'button',
      ariaLabel: 'Reply to post by @alex_codes',
      placeholder: null,
      textSnippet: 'Reply',
      isEditable: false,
      isClickable: true,
      boundingBox: { x: 300, y: 400, width: 80, height: 32 },
    },
  ];

  const decision = await engine.reasonNextAction({
    screenshotBase64: 'mock_base64_data',
    semanticElements: mockSemanticElements,
    currentMode: 'FEED',
  });

  assert(decision !== null && typeof decision.thought === 'string', 'Decision must include agentic reasoning thought');
  assert(decision.action === 'CLICK' || decision.action === 'COMMENT' || decision.action === 'SCROLL', 'Decision action must be valid');
  assert(decision.recommendedDelayMs > 0, 'Decision must specify dynamic delay');

  console.log('\n======================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
