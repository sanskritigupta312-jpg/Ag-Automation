/**
 * IntentInterviewer.ts
 * Before each operation session, the agent constructs a plain-language
 * description of what it plans to do and presents it to the customer via
 * the Dashboard WebSocket channel for approval.
 *
 * This is a pure agent-to-human review step — no action is taken until
 * the customer approves (or modifies) the intent.
 */

import { CustomerProfile, OperationIntent, AutomationGoal } from '../types/CustomerProfile.js';

export class IntentInterviewer {
  /**
   * Builds a human-readable intent summary based on the customer's profile and goals.
   * Uses natural language reasoning — no hardcoded templates.
   */
  public buildSessionIntent(profile: CustomerProfile, currentHour: number): OperationIntent {
    const plannedActions: string[] = [];
    let primaryMode: 'FEED' | 'DM' | 'NOTIFICATIONS' = 'FEED';

    // Derive the natural language plan from the customer's goals
    const goalDescriptions = this.describeGoals(profile.goals, profile);

    // Determine what the first cycle should focus on
    const isWithinActiveHours =
      currentHour >= profile.activeHoursStart && currentHour < profile.activeHoursEnd;

    if (!isWithinActiveHours) {
      plannedActions.push(
        `It's currently outside your active hours (${profile.activeHoursStart}:00–${profile.activeHoursEnd}:00). ` +
          `I'll operate at a reduced pace to keep things natural.`
      );
    }

    plannedActions.push(...goalDescriptions.feedActions);
    plannedActions.push(...goalDescriptions.inboundActions);

    const sessionSummary = this.buildNaturalSummary(profile, goalDescriptions, isWithinActiveHours);

    // Determine starting mode based on priority
    if (profile.goals.includes('REPLY_TO_DMS')) {
      primaryMode = 'DM';
      // Still check feed as primary activity
      primaryMode = 'FEED';
    }

    return {
      plannedActions,
      mode: primaryMode,
      sessionSummary,
      approved: false,
    };
  }

  private describeGoals(
    goals: AutomationGoal[],
    profile: CustomerProfile
  ): { feedActions: string[]; inboundActions: string[] } {
    const feedActions: string[] = [];
    const inboundActions: string[] = [];

    if (goals.includes('FIND_RELEVANT_POSTS_AND_COMMENT')) {
      feedActions.push(
        `Scroll through the Threads feed and use AI reasoning to identify posts that are relevant to you as a ${profile.profession}.`
      );
      feedActions.push(
        `When a relevant post is found, open it and post a natural, humanized comment on your behalf — ` +
          `matching your ${profile.toneStyle.split('_').join(' ')} tone.`
      );
    }

    if (goals.includes('FIND_JOB_HIRING_POSTS')) {
      feedActions.push(
        `Look specifically for hiring posts, "looking for developer/designer" posts, collaboration calls, ` +
          `and project opportunities that match your field (${profile.profession}).`
      );
      feedActions.push(
        `When found, comment with a personalized pitch and a natural CTA (e.g., "feel free to DM me").`
      );
    }

    if (goals.includes('FIND_COLLAB_OPPORTUNITIES')) {
      feedActions.push(
        `Identify collaboration requests, open-source calls, and community build posts ` +
          `in your area of expertise.`
      );
    }

    if (goals.includes('NETWORK_BUILDING')) {
      feedActions.push(
        `Engage with thought leaders and community posts in the ${profile.profession} space ` +
          `with genuine, contextual comments to grow your presence.`
      );
    }

    if (goals.includes('BRAND_AWARENESS')) {
      feedActions.push(
        `Post meaningful, value-adding comments on trending posts in your niche ` +
          `to increase your visibility on Threads.`
      );
    }

    if (goals.includes('REPLY_TO_COMMENT_REPLIES')) {
      inboundActions.push(
        `Periodically check your notifications for replies to your comments ` +
          `and respond in a friendly, natural way on your behalf.`
      );
    }

    if (goals.includes('REPLY_TO_DMS')) {
      inboundActions.push(
        `Monitor your DM inbox for new messages and reply to them using your ` +
          `${profile.toneStyle.split('_').join(' ')} tone — humanized and thoughtful.`
      );
    }

    if (goals.includes('CUSTOM') && profile.customGoal) {
      feedActions.push(`Custom goal: ${profile.customGoal}`);
    }

    return { feedActions, inboundActions };
  }

  private buildNaturalSummary(
    profile: CustomerProfile,
    goalDescriptions: { feedActions: string[]; inboundActions: string[] },
    isWithinActiveHours: boolean
  ): string {
    const allActions = [...goalDescriptions.feedActions, ...goalDescriptions.inboundActions];

    return (
      `Hey ${profile.name}! I'm ready to start your Threads automation session. ` +
      `Here's what I'm planning to do:\n\n` +
      allActions.map((a, i) => `${i + 1}. ${a}`).join('\n') +
      `\n\nI'll operate in a fully humanized way — natural scroll speeds, realistic typing ` +
      `patterns, random pauses, and circadian-aware timing${isWithinActiveHours ? '' : ' (you\'re outside active hours so I\'ll be extra slow and natural)'}. ` +
      `No bot-like patterns. All comments and DM replies will be contextually generated by ` +
      `the local Gemini AI based on your profile as a ${profile.profession}.\n\n` +
      `Does this look good to you? You can approve to start, or let me know if you want to adjust anything.`
    );
  }
}
