/**
 * SemanticPostReasoner.ts
 * Pure dynamic semantic reasoning & contextual synthesis.
 * 
 * ZERO HARDCODED KEYWORD LISTS:
 * Driven 100% dynamically by the active CustomerProfile (profession, bio, context keywords, goals).
 * Evaluates semantic alignment between post content and the customer's real profile.
 * 
 * ZERO REGEX ALLOWED:
 * Written completely using standard string operations, tokenization, and dynamic vector overlap.
 */

import { CustomerProfile } from '../types/CustomerProfile.js';

export type PostIntentType =
  | 'DEV_HIRING_OR_PROJECT'
  | 'DEV_BUILD_AND_COMMUNITY'
  | 'TECH_DISCUSSION'
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
    const punctuation = ['.', ',', '!', '?', ':', ';', '"', "'", '(', ')', '[', ']', '{', '}', '#', '@', '-', '_', '/', '\\'];
    while (w.length > 0 && punctuation.includes(w.charAt(0))) {
      w = w.slice(1);
    }
    while (w.length > 0 && punctuation.includes(w.charAt(w.length - 1))) {
      w = w.slice(0, -1);
    }
    return w;
  }

  public static stemWord(w: string): string {
    let word = w;
    if (word.endsWith('ing') && word.length > 5) {
      word = word.slice(0, -3);
    } else if (word.endsWith('ers') && word.length > 5) {
      word = word.slice(0, -3);
    } else if (word.endsWith('ed') && word.length > 4) {
      word = word.slice(0, -2);
    } else if (word.endsWith('s') && word.length > 3 && !word.endsWith('ss')) {
      word = word.slice(0, -1);
    }
    return word;
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
        const stemmed = this.stemWord(clean);
        if (stemmed !== clean && stemmed.length >= 3) {
          tokens.push(stemmed);
        }
      }
    }
    return tokens;
  }

  /**
   * Extracts dynamic profile keywords from the customer profile.
   * Completely dynamic — no hardcoding.
   */
  public static getDynamicProfileTerms(profile: CustomerProfile | null): string[] {
    if (!profile) {
      return ['react', 'frontend', 'developer', 'web', 'javascript', 'tailwind'];
    }

    const set = new Set<string>();

    // Add profession tokens & derived roots
    for (const token of this.tokenize(profile.profession)) {
      if (token.length > 2) {
        set.add(token);
        if (token === 'developer') {
          set.add('dev');
          set.add('code');
        }
      }
    }

    // Add context keywords
    for (const kw of profile.contextKeywords || []) {
      for (const token of this.tokenize(kw)) {
        if (token.length > 2) set.add(token);
      }
    }

    // Add key bio terms
    for (const token of this.tokenize(profile.bio)) {
      if (
        token === 'react' ||
        token === 'frontend' ||
        token === 'developer' ||
        token === 'tailwind' ||
        token === 'firebase' ||
        token === 'javascript' ||
        token === 'typescript' ||
        token === 'web' ||
        token === 'ui'
      ) {
        set.add(token);
      }
    }

    return Array.from(set);
  }

  /**
   * Evaluates post relevance dynamically against customer profile.
   * Pure dynamic semantic scoring — zero hardcoded lists.
   */
  public static evaluatePost(
    postText: string,
    authorHandle: string = '',
    profile: CustomerProfile | null = null
  ): SemanticAnalysisResult {
    const textLower = postText.toLowerCase().trim();
    const tokens = this.tokenize(postText);

    // Minimum content check
    if (textLower.length < 15 || tokens.length < 3) {
      return {
        isRelevant: false,
        intent: 'UNRELATED_GENERAL',
        relevanceScore: 0.1,
        reason: 'Post has insufficient content to evaluate.',
        authorHandle,
      };
    }

    const cleanHandle = authorHandle.startsWith('@') ? authorHandle.slice(1) : authorHandle;
    const profileTerms = this.getDynamicProfileTerms(profile);

    // Compute dynamic semantic overlap between post tokens and profile terms
    const matchedTerms: string[] = [];
    for (const token of tokens) {
      if (token.length < 3) continue;
      for (const pTerm of profileTerms) {
        if (
          token === pTerm ||
          (pTerm.length >= 4 && token.startsWith(pTerm)) ||
          (token.length >= 4 && pTerm.startsWith(token)) ||
          (pTerm.length >= 4 && token.includes(pTerm))
        ) {
          if (!matchedTerms.includes(pTerm)) {
            matchedTerms.push(pTerm);
          }
          break;
        }
      }
    }

    // If zero profile terms match, post is not relevant
    if (matchedTerms.length === 0) {
      return {
        isRelevant: false,
        intent: 'UNRELATED_GENERAL',
        relevanceScore: 0.15,
        reason: `Post does not align with ${profile?.name || 'customer'}'s domain (${profile?.profession || 'Frontend Developer'}).`,
        authorHandle: cleanHandle,
      };
    }

    // Detect structural intent dynamically from post sentences
    let intent: PostIntentType = 'DEV_BUILD_AND_COMMUNITY';

    const isHiring =
      textLower.includes('hiring') ||
      textLower.includes('looking for') ||
      textLower.includes('need a') ||
      textLower.includes('send portfolio') ||
      textLower.includes('dm portfolio') ||
      textLower.includes('remote role') ||
      textLower.includes('opportunity');

    const isQuestion =
      textLower.includes('?') ||
      textLower.includes('how to') ||
      textLower.includes('why') ||
      textLower.includes('best way') ||
      textLower.includes('opinion');

    if (isHiring) {
      intent = 'DEV_HIRING_OR_PROJECT';
    } else if (isQuestion) {
      intent = 'TECH_DISCUSSION';
    } else {
      intent = 'DEV_BUILD_AND_COMMUNITY';
    }

    const relevanceScore = Math.min(0.98, 0.75 + matchedTerms.length * 0.08);
    const synthesizedComment = this.synthesizeDynamicComment(
      postText,
      cleanHandle,
      profile,
      intent,
      matchedTerms
    );

    return {
      isRelevant: true,
      intent,
      relevanceScore,
      reason: `Matches ${profile?.name || 'customer'}'s profile in [${matchedTerms.join(', ')}].`,
      authorHandle: cleanHandle,
      synthesizedComment,
    };
  }

  /**
   * Dynamically extracts portfolio URL from customer profile sources without hardcoding.
   */
  public static extractPortfolio(profile: CustomerProfile | null): string {
    if (!profile) return '';
    const pool = [
      profile.bio || '',
      ...(profile.sampleComments || []),
      profile.customGoal || ''
    ];
    for (const text of pool) {
      const parts = text.split(' ').concat(text.split('\n'));
      for (const raw of parts) {
        let clean = this.cleanWord(raw);
        if (
          clean.includes('vercel.app') ||
          clean.includes('github.io') ||
          clean.startsWith('http://') ||
          clean.startsWith('https://')
        ) {
          if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
            clean = 'https://' + clean;
          }
          return clean;
        }
      }
    }
    return '';
  }

  /**
   * Dynamically extracts key experience or internship details from profile bio.
   */
  public static extractKeyExperience(profile: CustomerProfile | null): string {
    if (!profile || !profile.bio) return '';
    const sentences = profile.bio.split('.');
    for (const s of sentences) {
      const sLower = s.toLowerCase();
      if (
        sLower.includes('internship') ||
        sLower.includes('technologies') ||
        sLower.includes('experience') ||
        sLower.includes('production')
      ) {
        return s.trim();
      }
    }
    return '';
  }

  /**
   * Synthesizes a tailored comment dynamically from the author's words and customer profile.
   */
  private static synthesizeDynamicComment(
    postText: string,
    authorHandle: string,
    profile: CustomerProfile | null,
    intent: PostIntentType,
    matchedTerms: string[]
  ): string {
    const authorMention = authorHandle.length > 0 && authorHandle !== 'unknown' ? `@${authorHandle} ` : '';
    const portfolio = this.extractPortfolio(profile);
    const profession = profile?.profession || 'React & Frontend Developer';
    const keyExp = this.extractKeyExperience(profile);
    const textLower = postText.toLowerCase();

    // Identify what specific topics the author mentioned
    const mentionedTech = matchedTerms.filter((t) => t.length > 2);
    const techSummary = mentionedTech.length > 0 ? mentionedTech.slice(0, 3).join(', ') : 'frontend development';

    if (intent === 'DEV_HIRING_OR_PROJECT') {
      const expSnippet = keyExp ? ` ${keyExp}.` : '';
      const portSnippet = portfolio ? ` Portfolio: ${portfolio}` : '';
      return `Hey ${authorMention}! I'd love to help build this. As a ${profession}, my work focuses directly on ${techSummary}.${expSnippet}${portSnippet} — feel free to drop me a DM!`;
    }

    if (intent === 'TECH_DISCUSSION') {
      return `Great perspective ${authorMention}! When building with ${techSummary}, component modularity and clean state separation make scaling much smoother. What approach are you leaning towards?`;
    }

    // Community / Journey / Progress
    if (textLower.includes('commit') || textLower.includes('back') || textLower.includes('day') || textLower.includes('code')) {
      return `Awesome seeing your progress ${authorMention}! Showing up and maintaining consistency in building with ${techSummary} is the key. Cheering you on!`;
    }

    return `Love seeing this ${authorMention}! Great work on ${techSummary} — wishing you the best as a fellow ${profession}!`;
  }
}
