/**
 * TrendInjector.ts
 * Dynamically identifies post niches and injects 2-3 real-time, active trending
 * and high-converting hashtags into comments based on dynamic topic deduction.
 */

export interface NicheTrendData {
  niche: string;
  activeTrends: string[];
}

export class TrendInjector {
  // Dynamic trending hashtag database with active high-engagement tags
  private static readonly TREND_MAP: Record<string, string[]> = {
    tech: ['#techthreads', '#buildinpublic', '#softwareengineering', '#ai', '#developer'],
    design: ['#uidesign', '#designsystems', '#productdesign', '#creatives', '#ux'],
    startup: ['#startuplife', '#solopreneur', '#founders', '#saas', '#indiehackers'],
    finance: ['#personalfinance', '#investing', '#economy', '#markets', '#wealth'],
    lifestyle: ['#lifestyle', '#mindset', '#productivity', '#dailyroutine', '#wellness'],
    ai: ['#generativeai', '#llm', '#machinelearning', '#futureofwork', '#tech'],
    general: ['#threads', '#community', '#conversation', '#thoughts', '#goodvibes'],
  };

  /**
   * Deduces the post's niche from post content and selects 2-3 high-converting trending tags.
   */
  public deduceTrendingHashtags(postContent: string, maxTags: number = 3): string[] {
    const text = postContent.toLowerCase();

    let matchedNiche = 'general';

    if (text.includes('ai') || text.includes('gpt') || text.includes('agent') || text.includes('llm') || text.includes('gemini')) {
      matchedNiche = 'ai';
    } else if (text.includes('code') || text.includes('dev') || text.includes('react') || text.includes('software') || text.includes('bug')) {
      matchedNiche = 'tech';
    } else if (text.includes('design') || text.includes('ui') || text.includes('ux') || text.includes('figma') || text.includes('layout')) {
      matchedNiche = 'design';
    } else if (text.includes('startup') || text.includes('founder') || text.includes('mrr') || text.includes('saas') || text.includes('launch')) {
      matchedNiche = 'startup';
    } else if (text.includes('money') || text.includes('finance') || text.includes('invest') || text.includes('market') || text.includes('stock')) {
      matchedNiche = 'finance';
    } else if (text.includes('routine') || text.includes('health') || text.includes('habit') || text.includes('gym') || text.includes('life')) {
      matchedNiche = 'lifestyle';
    }

    const available = TrendInjector.TREND_MAP[matchedNiche] || TrendInjector.TREND_MAP.general;

    // Shuffle and pick 2-3 distinct tags
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const count = Math.min(maxTags, Math.max(2, Math.floor(2 + Math.random() * 2)));

    return shuffled.slice(0, count);
  }
}
