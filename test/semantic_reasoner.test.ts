import { SemanticPostReasoner } from '../src/engine/SemanticPostReasoner.js';
import { CustomerProfile } from '../src/types/CustomerProfile.js';

const profile: CustomerProfile = {
  id: 'prof_sanskriti',
  platform: 'THREADS',
  name: 'Sanskriti Kumari',
  profession: 'Frontend & React Developer',
  bio: 'BTech CSE graduate and React Developer with production internship experience at CodeWebx Technologies.',
  goals: ['FIND_JOB_HIRING_POSTS', 'FIND_RELEVANT_POSTS_AND_COMMENT', 'REPLY_TO_DMS'],
  contextKeywords: ['remote', 'react', 'frontend', 'developer', 'javascript', 'tailwind'],
  toneStyle: 'professional',
  sampleComments: [],
  activeHoursStart: 9,
  activeHoursEnd: 23,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

console.log('Testing SemanticPostReasoner...');

// Case 1: The Graphic Flyer Post (Must be REJECTED!)
const flyerPost = 'I need help designing some graphics/ graphic design flyers/posters for my small education business. No ai please, the ai fatigue is real … lmk if anyone is budget friendly & can help, ty!!';
const flyerResult = SemanticPostReasoner.evaluatePost(flyerPost, 'dashiellonearth', profile);
console.log('\nCase 1 (Flyer Post):', flyerResult);
if (!flyerResult.isRelevant) {
  console.log('✓ PASS: Graphic flyer post correctly rejected!');
} else {
  console.error('✗ FAIL: Graphic flyer post was not rejected!');
  process.exit(1);
}

// Case 2: Fellow Dev Commit / #30daysofcode
const devPost = "took a break from coding, but i'm back. commit #1 is live. 🚀 #30daysofcode";
const devResult = SemanticPostReasoner.evaluatePost(devPost, 'simplyhalimat', profile);
console.log('\nCase 2 (Dev Commit Post):', devResult);
if (devResult.isRelevant && devResult.intent === 'DEV_BUILD_AND_COMMUNITY') {
  console.log('✓ PASS: Dev community post correctly accepted!');
  console.log('Generated comment:', devResult.synthesizedComment);
} else {
  console.error('✗ FAIL: Dev community post was not accepted!');
  process.exit(1);
}

// Case 3: Remote React Hiring Post
const hiringPost = 'Looking for a remote React frontend developer to build our dashboard and landing page with Tailwind CSS, DM portfolio';
const hiringResult = SemanticPostReasoner.evaluatePost(hiringPost, 'techfounder', profile);
console.log('\nCase 3 (Hiring Post):', hiringResult);
if (hiringResult.isRelevant && hiringResult.intent === 'DEV_HIRING_OR_PROJECT') {
  console.log('✓ PASS: Hiring post correctly accepted!');
  console.log('Generated pitch:', hiringResult.synthesizedComment);
} else {
  console.error('✗ FAIL: Hiring post was not accepted!');
  process.exit(1);
}

console.log('\nALL SEMANTIC REASONER TESTS PASSED 100%!');
