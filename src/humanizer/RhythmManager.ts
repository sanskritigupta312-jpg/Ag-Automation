/**
 * RhythmManager.ts
 * Manages human operational rhythm, conservative rate limits (8-12 comments/hr, 4-6 DMs/hr),
 * operational cooldown breaks (20-45 mins after 4-6 actions), and passive browsing lingers (5-12s).
 */

export interface RhythmConfig {
  maxCommentsPerHour?: number;
  maxDmsPerHour?: number;
  actionsBeforeBreakMin?: number;
  actionsBeforeBreakMax?: number;
  breakDurationMinMs?: number;
  breakDurationMaxMs?: number;
}

export interface SessionStats {
  sessionStartTime: number;
  totalInteractions: number;
  totalComments: number;
  totalDMs: number;
  totalScrolls: number;
  lastActionTimestamp: number;
  commentsPastHour: number;
  dmsPastHour: number;
  consecutiveActions: number;
  isCoolingDown: boolean;
  cooldownEndsAt: number;
}

export class RhythmManager {
  private config: Required<RhythmConfig>;

  private commentTimestamps: number[] = [];
  private dmTimestamps: number[] = [];

  private consecutiveActionCount: number = 0;
  private nextBreakThreshold: number;
  private cooldownUntil: number = 0;

  private stats: {
    sessionStartTime: number;
    totalInteractions: number;
    totalComments: number;
    totalDMs: number;
    totalScrolls: number;
    lastActionTimestamp: number;
  };

  constructor(config: RhythmConfig = {}) {
    this.config = {
      maxCommentsPerHour: config.maxCommentsPerHour ?? 10, // 8-12 range
      maxDmsPerHour: config.maxDmsPerHour ?? 5,             // 4-6 range
      actionsBeforeBreakMin: config.actionsBeforeBreakMin ?? 4,
      actionsBeforeBreakMax: config.actionsBeforeBreakMax ?? 6,
      breakDurationMinMs: config.breakDurationMinMs ?? 20 * 60 * 1000, // 20 mins
      breakDurationMaxMs: config.breakDurationMaxMs ?? 45 * 60 * 1000, // 45 mins
    };

    this.stats = {
      sessionStartTime: Date.now(),
      totalInteractions: 0,
      totalComments: 0,
      totalDMs: 0,
      totalScrolls: 0,
      lastActionTimestamp: Date.now(),
    };

    this.nextBreakThreshold = this.randomBetween(
      this.config.actionsBeforeBreakMin,
      this.config.actionsBeforeBreakMax
    );
  }

  /**
   * Cleans timestamps older than 1 hour (sliding window).
   */
  private pruneOldTimestamps(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.commentTimestamps = this.commentTimestamps.filter((t) => t > oneHourAgo);
    this.dmTimestamps = this.dmTimestamps.filter((t) => t > oneHourAgo);
  }

  /**
   * Checks if an action is permitted under the conservative rate limits and cooldowns.
   */
  public canExecuteAction(type: 'comment' | 'dm'): { allowed: boolean; reason?: string; waitTimeMs?: number } {
    this.pruneOldTimestamps();

    // Check if in operational cooldown break
    if (Date.now() < this.cooldownUntil) {
      const remaining = this.cooldownUntil - Date.now();
      return {
        allowed: false,
        reason: `In operational cool-down break (${Math.round(remaining / 60000)} mins remaining)`,
        waitTimeMs: remaining,
      };
    }

    if (type === 'comment' && this.commentTimestamps.length >= this.config.maxCommentsPerHour) {
      const oldest = this.commentTimestamps[0];
      const waitTime = oldest + 60 * 60 * 1000 - Date.now();
      return {
        allowed: false,
        reason: `Hourly comment limit reached (${this.commentTimestamps.length}/${this.config.maxCommentsPerHour})`,
        waitTimeMs: Math.max(1000, waitTime),
      };
    }

    if (type === 'dm' && this.dmTimestamps.length >= this.config.maxDmsPerHour) {
      const oldest = this.dmTimestamps[0];
      const waitTime = oldest + 60 * 60 * 1000 - Date.now();
      return {
        allowed: false,
        reason: `Hourly DM limit reached (${this.dmTimestamps.length}/${this.config.maxDmsPerHour})`,
        waitTimeMs: Math.max(1000, waitTime),
      };
    }

    return { allowed: true };
  }

  /**
   * Records execution of an action and checks for operational cooldown threshold.
   */
  public recordAction(type: 'comment' | 'dm' | 'scroll' | 'passive'): void {
    const now = Date.now();
    this.stats.totalInteractions++;
    this.stats.lastActionTimestamp = now;

    if (type === 'comment') {
      this.stats.totalComments++;
      this.commentTimestamps.push(now);
      this.consecutiveActionCount++;
    } else if (type === 'dm') {
      this.stats.totalDMs++;
      this.dmTimestamps.push(now);
      this.consecutiveActionCount++;
    } else if (type === 'scroll') {
      this.stats.totalScrolls++;
    }

    // Check if consecutive productive actions hit cooldown threshold (4-6 actions)
    if (this.consecutiveActionCount >= this.nextBreakThreshold) {
      const breakMs = this.randomBetween(
        this.config.breakDurationMinMs,
        this.config.breakDurationMaxMs
      );
      this.cooldownUntil = now + breakMs;
      console.log(
        `[RhythmManager] Triggering operational cool-down break: ${Math.round(
          breakMs / 60000
        )} minutes after ${this.consecutiveActionCount} actions.`
      );
      this.consecutiveActionCount = 0;
      this.nextBreakThreshold = this.randomBetween(
        this.config.actionsBeforeBreakMin,
        this.config.actionsBeforeBreakMax
      );
    }
  }

  /**
   * Checks if operational break is currently active.
   */
  public isInOperationalBreak(): { active: boolean; remainingMs: number } {
    if (Date.now() < this.cooldownUntil) {
      return { active: true, remainingMs: this.cooldownUntil - Date.now() };
    }
    return { active: false, remainingMs: 0 };
  }

  /**
   * Generates a realistic passive browsing linger duration (5 to 12 seconds)
   * while viewing a post or comments.
   */
  public getPostLingerDuration(): number {
    return Math.floor(5000 + Math.random() * 7000);
  }

  /**
   * Generates natural reading dwell time based on text length and media content.
   */
  public generateReadingDwellTime(textLength: number = 100, hasMedia: boolean = false): number {
    const estimatedWords = Math.max(5, textLength / 5);
    const readingTimeMs = estimatedWords * (200 + Math.random() * 100);
    const mediaInspectionMs = hasMedia ? 2000 + Math.random() * 3500 : 0;
    const contemplationMs = 1000 + Math.random() * 2000;
    return Math.round(readingTimeMs + mediaInspectionMs + contemplationMs);
  }

  /**
   * Computes circadian multiplier based on hour of day (0-23).
   */
  public getCircadianFactor(date: Date = new Date()): number {
    const hour = date.getHours();
    if (hour >= 2 && hour < 6) return 2.2;
    if (hour >= 6 && hour < 9) return 1.4;
    if (hour >= 9 && hour < 14) return 1.0;
    if (hour >= 14 && hour < 17) return 1.1;
    if (hour >= 17 && hour < 22) return 0.9;
    return 1.6;
  }

  /**
   * Calculates dynamic delay before next operational cycle.
   */
  public calculateDynamicDelay(actionType: 'comment' | 'dm' | 'browse' | 'scroll'): number {
    const circadian = this.getCircadianFactor();
    const sessionDurationMinutes = (Date.now() - this.stats.sessionStartTime) / (1000 * 60);
    const fatigue = 1.0 + Math.min(0.8, sessionDurationMinutes / 120);

    let baseDelayMs = 3000;

    switch (actionType) {
      case 'comment':
        baseDelayMs = 9000 + Math.random() * 11000;
        break;
      case 'dm':
        baseDelayMs = 7000 + Math.random() * 9000;
        break;
      case 'browse':
        baseDelayMs = this.getPostLingerDuration();
        break;
      case 'scroll':
        baseDelayMs = 2000 + Math.random() * 2500;
        break;
    }

    const totalDelay = Math.round(baseDelayMs * circadian * fatigue);
    return Math.max(1500, totalDelay);
  }

  public getStats(): SessionStats {
    this.pruneOldTimestamps();
    return {
      ...this.stats,
      commentsPastHour: this.commentTimestamps.length,
      dmsPastHour: this.dmTimestamps.length,
      consecutiveActions: this.consecutiveActionCount,
      isCoolingDown: Date.now() < this.cooldownUntil,
      cooldownEndsAt: this.cooldownUntil,
    };
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(min + Math.random() * (max - min + 1));
  }
}
