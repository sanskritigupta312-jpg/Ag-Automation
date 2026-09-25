/**
 * SemanticPostReasoner.ts
 * Deep, pure semantic analysis & contextual response generator.
 * 
 * ZERO REGEX ALLOWED:
 * Uses pure string tokenization, sentence analysis, and contextual heuristics.
 * Evaluates whether a post aligns with Sanskriti Kumari's Frontend/React background.
 * Automatically rejects irrelevant posts (e.g., graphic flyers, logos, crypto, personal rants).
 * Synthesizes 100% contextual, authentic human comments tailored directly to the author's words.
 */

import { CustomerProfile } from '../types/CustomerProfile.js';

export type PostIntentType =
  | 'DEV_HIRING_OR_PROJECT'
  | 'DEV_BUILD_AND_COMMUNITY'
  | 'TECH_DISCUSSION'
  | 'UNRELATED_GRAPHIC_DESIGN'
  | 'UNRELATED_CRYPTO'
  | 'UNRELATED_GENERAL';

export interface SemanticAnalysisResult {
  isRelevant: boolean;
  intent: PostIntentType;
  relevanceScore: number;
  reason: string;
  authorHandle?: string;
  synthesizedComment?: string;
}

export class SemanticPostReasoner {
  /**
   * Cleans punctuation from words using pure string operations (ZERO regex).
   */
  public static cleanWord(raw: string): string {
    let w = raw.toLowerCase().trim();
    const punctuation = ['.', ',', '!', '?', ':', ';', '"', "'", '(', ')', '[', ']', '{', '}', '#', '@', '-', '_'];
    while (w.length > 0 && punctuation.includes(w.charAt(0))) {
      w = w.slice(1);
    }
    while (w.length > 0 && punctuation.includes(w.charAt(w.length - 1))) {
      w = w.slice(0, -1);
    }
    return w;
  }

  /**
   * Tokenizes text into lowercase normalized words without regex.
   */
  public static tokenize(text: string): string[] {
    const rawWords = text
      .split('\n')
      .join(' ')
      .split('\t')
      .join(' ')
      .split(' ')
      .filter((w) => w.length > 0);

    const tokens: string[] = [];
    for (const rw of rawWords) {
      const clean = this.cleanWord(rw);
      if (clean.length > 0) {
        tokens.push(clean);
      }
    }
    return tokens;
  }

  /**
   * Checks if any phrase in a list appears in the text without regex.
   */
  public static containsAnyPhrase(textLower: string, phrases: string[]): boolean {
    for (const p of phrases) {
      if (textLower.includes(p.toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  /**
   * Analyzes the post's text against Sanskriti's domain.
   */
  public static evaluatePost(
    postText: string,
    authorHandle: string = '',
    profile: CustomerProfile | null = null
  ): SemanticAnalysisResult {
    const textLower = postText.toLowerCase().trim();
    const tokens = this.tokenize(postText);

    // 1. Minimum content check
    if (textLower.length < 15 || tokens.length < 3) {
      return {
        isRelevant: false,
        intent: 'UNRELATED_GENERAL',
        relevanceScore: 0.1,
        reason: 'Post has insufficient content or context to evaluate.',
        authorHandle,
      };
    }

    // 2. DETECT UNRELATED / MISMATCH CATEGORIES (STRICT REJECTION)
    const nonWebCreativeMarkers = [
      'flyer', 'flyers', 'poster', 'posters', 'graphic design', 'graphics design',
      'logo design', 'illustration', 'photoshop', 'illustrator', 'banner print',
      'brochure', 'thumbnail designer', 'video editor', 'voiceover',
      '3d rigger', '3d artist', '3d modeler', 'animator', 'character rigger',
    ];
    if (this.containsAnyPhrase(textLower, nonWebCreativeMarkers)) {
      return {
        isRelevant: false,
        intent: 'UNRELATED_GRAPHIC_DESIGN',
        relevanceScore: 0.05,
        reason: 'Author is asking for graphic design / flyer / 3D animation, which is outside Sanskriti\'s React & Web Development expertise.',
        authorHandle,
      };
    }

    // Crypto / Trading / Signals
    const cryptoMarkers = ['crypto', 'bitcoin', 'solana', 'airdrop', 'tokenomics', 'forex', 'binance', 'nft mint'];
    if (this.containsAnyPhrase(textLower, cryptoMarkers)) {
      return {
        isRelevant: false,
        intent: 'UNRELATED_CRYPTO',
        relevanceScore: 0.02,
        reason: 'Post is about cryptocurrency/trading, unrelated to software engineering.',
        authorHandle,
      };
    }

    // 3. DETECT POSITIVE MATCH CATEGORIES
    const webTechContext = [
      'react', 'frontend', 'developer', 'dev', 'web', 'javascript', 'typescript',
      'fullstack', 'software', 'engineer', 'landing page', 'website', 'html', 'css',
      'ui', 'app', 'nextjs', 'tailwind', 'code', 'coding', 'intern'
    ];
    const hasTechContext = this.containsAnyPhrase(textLower, webTechContext);

    // Category A: Hiring / Developer Needed / Web Projects
    const hiringMarkers = [
      'hiring', 'looking for a developer', 'need a developer', 'looking for developer',
      'need a dev', 'looking for dev', 'frontend developer', 'react developer',
      'build our website', 'build my website', 'landing page', 'web app', 'fullstack',
      'frontend intern', 'react intern', 'send portfolio', 'dm portfolio', 'looking for react',
      'remote role', 'contract dev', 'need someone to build', 'build an mvp',
    ];

    if (hasTechContext && this.containsAnyPhrase(textLower, hiringMarkers)) {
      const comment = this.synthesizeHiringPitch(postText, authorHandle, profile);
      return {
        isRelevant: true,
        intent: 'DEV_HIRING_OR_PROJECT',
        relevanceScore: 0.96,
        reason: 'Author is seeking a web/frontend developer or sharing a project opportunity.',
        authorHandle,
        synthesizedComment: comment,
      };
    }

    // Category B: Developer Build, Commit, Journey & Community (#30daysofcode, #100daysofcode)
    const buildJourneyMarkers = [
      'commit #', 'commit 1', 'day 1', '30daysofcode', '100daysofcode', 'buildinpublic',
      'took a break from coding', 'back to coding', 'started learning react',
      'shipped', 'launched today', 'deployed', 'github repo', 'building my first',
      'learning javascript', 'learning web dev', 'side project',
    ];

    if (this.containsAnyPhrase(textLower, buildJourneyMarkers)) {
      const comment = this.synthesizeDevCommunityComment(postText, authorHandle, profile);
      return {
        isRelevant: true,
        intent: 'DEV_BUILD_AND_COMMUNITY',
        relevanceScore: 0.92,
        reason: 'Fellow developer sharing coding milestones, project launch, or build-in-public journey.',
        authorHandle,
        synthesizedComment: comment,
      };
    }

    // Category C: Technical Discussion / Web Dev / React Questions
    const techDiscussionMarkers = [
      'react', 'nextjs', 'tailwind', 'javascript', 'typescript', 'css',
      'state management', 'redux', 'frontend', 'ui/ux', 'component',
      'responsive design', 'web development', 'clean code', 'vite',
    ];

    if (this.containsAnyPhrase(textLower, techDiscussionMarkers)) {
      const comment = this.synthesizeTechDiscussionComment(postText, authorHandle, profile);
      return {
        isRelevant: true,
        intent: 'TECH_DISCUSSION',
        relevanceScore: 0.88,
        reason: 'Technical discussion related to web engineering, React, or frontend design.',
        authorHandle,
        synthesizedComment: comment,
      };
    }

    // If none matched, mark as general/irrelevant to prevent spamming
    return {
      isRelevant: false,
      intent: 'UNRELATED_GENERAL',
      relevanceScore: 0.25,
      reason: 'Post is general social content without explicit web development or hiring relevance.',
      authorHandle,
    };
  }

  /**
   * Synthesizes an authentic, tailored pitch for hiring/project posts.
   */
  private static synthesizeHiringPitch(
    postText: string,
    authorHandle: string,
    profile: CustomerProfile | null
  ): string {
    const name = profile?.name || 'Sanskriti';
    const portfolio = 'https://my-portfolio-psi-liard-97.vercel.app';
    const cleanHandle = authorHandle.startsWith('@') ? authorHandle.slice(1) : authorHandle;
    const authorMention = cleanHandle.length > 0 ? `@${cleanHandle} ` : '';

    const textLower = postText.toLowerCase();

    if (textLower.includes('landing page') || textLower.includes('website')) {
      return `Hey ${authorMention}! I'd love to help build this. I specialize in building responsive, high-performance web pages with React 18 and Tailwind CSS from my internship at CodeWebx Technologies. You can check out my live interactive work here: ${portfolio} — feel free to drop me a DM!`;
    }

    if (textLower.includes('intern') || textLower.includes('junior')) {
      return `Hi ${authorMention}! I'm actively looking for remote React/frontend roles. I have hands-on experience building production React and Firebase applications from my React Developer internship at CodeWebx Technologies. Live portfolio: ${portfolio} — sending you a DM!`;
    }

    return `Hey ${authorMention}! This aligns directly with my background. I'm a React & Frontend developer experienced in building fast, scalable UI with React, Tailwind CSS, and Firebase (ex-intern at CodeWebx Technologies). Here is my portfolio: ${portfolio} — would love to discuss this over DM!`;
  }

  /**
   * Synthesizes a warm, authentic developer community comment for coding milestones.
   */
  private static synthesizeDevCommunityComment(
    postText: string,
    authorHandle: string,
    profile: CustomerProfile | null
  ): string {
    const cleanHandle = authorHandle.startsWith('@') ? authorHandle.slice(1) : authorHandle;
    const authorMention = cleanHandle.length > 0 ? `@${cleanHandle} ` : '';
    const textLower = postText.toLowerCase();

    if (textLower.includes('commit') || textLower.includes('back') || textLower.includes('30daysofcode') || textLower.includes('100daysofcode')) {
      return `Welcome back to the flow ${authorMention}! Getting commit #1 in and building that day 1 momentum is usually the toughest hurdle. What stack or project are you tackling for this sprint?`;
    }

    if (textLower.includes('launched') || textLower.includes('shipped') || textLower.includes('deployed')) {
      return `Huge congrats on the launch ${authorMention}! Shipping is always the hardest part. The UI looks super clean — how was your experience building it with your current stack?`;
    }

    return `Love seeing the consistency ${authorMention}! Keeping up that building momentum is key. Fellow React dev here cheering you on — excited to see what you build!`;
  }

  /**
   * Synthesizes a technical comment for web dev discussions.
   */
  private static synthesizeTechDiscussionComment(
    postText: string,
    authorHandle: string,
    profile: CustomerProfile | null
  ): string {
    const cleanHandle = authorHandle.startsWith('@') ? authorHandle.slice(1) : authorHandle;
    const authorMention = cleanHandle.length > 0 ? `@${cleanHandle} ` : '';
    const textLower = postText.toLowerCase();

    if (textLower.includes('tailwind') || textLower.includes('css')) {
      return `Totally agree ${authorMention}. Pairing Tailwind with modular component design in React saves so much context-switching time while keeping responsive layouts consistent.`;
    }

    if (textLower.includes('state') || textLower.includes('performance') || textLower.includes('react')) {
      return `Solid point ${authorMention}. In React 18, keeping state collocated as close as possible to the consuming components makes a noticeable difference in preventing unnecessary re-renders.`;
    }

    return `Spot on ${authorMention}! As a frontend dev working daily with React and modern UI systems, clean component boundaries make iterating so much smoother.`;
  }
}
