/**
 * RhythmManager.ts
 * Manages human operational rhythm, fatigue modeling, circadian time-of-day multipliers,
 * and passive browsing/reading dwell times to prevent behavioral detection.
 */

export interface SessionStats {
  sessionStartTime: number;
  totalInteractions: number;
  totalComments: number;
  totalDMs: number;
  totalScrolls: number;
  lastActionTimestamp: number;
}

export class RhythmManager {
  private stats: SessionStats = {
    sessionStartTime: Date.now(),
    totalInteractions: 0,
    totalComments: 0,
    totalDMs: 0,
    totalScrolls: 0,
    lastActionTimestamp: Date.now(),
  };

  public getStats(): Readonly<SessionStats> {
    return { ...this.stats };
  }

  public recordAction(type: 'comment' | 'dm' | 'scroll' | 'passive'): void {
    this.stats.totalInteractions++;
    this.stats.lastActionTimestamp = Date.now();
    if (type === 'comment') this.stats.totalComments++;
    if (type === 'dm') this.stats.totalDMs++;
    if (type === 'scroll') this.stats.totalScrolls++;
  }

  /**
   * Computes circadian multiplier based on hour of day (0-23).
   * Late night (02:00-06:00): very slow rhythm or rest.
   * Morning/Afternoon (09:00-18:00): active, standard rhythm.
   * Evening (18:00-23:00): relaxed social media consumption.
   */
  public getCircadianFactor(date: Date = new Date()): number {
    const hour = date.getHours();
    if (hour >= 2 && hour < 6) return 2.2; // Late night drowsiness
    if (hour >= 6 && hour < 9) return 1.4; // Morning wake-up
    if (hour >= 9 && hour < 14) return 1.0; // Daytime peak
    if (hour >= 14 && hour < 17) return 1.1; // Midday slump
    if (hour >= 17 && hour < 22) return 0.9; // Prime evening engagement
    return 1.6; // Winding down
  }

  /**
   * Calculates dynamic delay before next operational cycle.
   * Factors in:
   * - Fatigue: engagement speed naturally decelerates as session lengthens.
   * - Action type: commenting takes longer cognitive time than scrolling.
   * - Circadian factor.
   */
  public calculateDynamicDelay(actionType: 'comment' | 'dm' | 'browse' | 'scroll'): number {
    const circadian = this.getCircadianFactor();
    const sessionDurationMinutes = (Date.now() - this.stats.sessionStartTime) / (1000 * 60);
    const fatigue = 1.0 + Math.min(0.8, sessionDurationMinutes / 120);

    let baseDelayMs = 3000;

    switch (actionType) {
      case 'comment':
        // Cognitive reading + drafting reflection: 8s - 18s
        baseDelayMs = 8000 + Math.random() * 10000;
        break;
      case 'dm':
        // Thoughtful reply reflection: 6s - 14s
        baseDelayMs = 6000 + Math.random() * 8000;
        break;
      case 'browse':
        // Looking at feed, reading headlines: 4s - 9s
        baseDelayMs = 4000 + Math.random() * 5000;
        break;
      case 'scroll':
        // Quick visual flick: 1.5s - 3.5s
        baseDelayMs = 1500 + Math.random() * 2000;
        break;
    }

    const totalDelay = Math.round(baseDelayMs * circadian * fatigue);
    return Math.max(1200, totalDelay);
  }

  /**
   * Generates a natural passive reading/dwell profile for a post.
   * Simulates a human eye scanning text, viewing media, and scrolling down.
   */
  public generateReadingDwellTime(textLength: number, hasMedia: boolean): number {
    // Average human reading speed: ~200-250 WPM -> ~4 words per second -> ~250ms per word
    const estimatedWords = Math.max(5, textLength / 5);
    const readingTimeMs = estimatedWords * (200 + Math.random() * 100);
    const mediaInspectionMs = hasMedia ? 2000 + Math.random() * 3500 : 0;
    const contemplationMs = 1000 + Math.random() * 2000;

    return Math.round(readingTimeMs + mediaInspectionMs + contemplationMs);
  }
}
