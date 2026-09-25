/**
 * CustomerProfile.ts
 * Central type definitions for customer profile and automation goals.
 * All AI prompting, action selection, and response generation is driven by these types.
 * No hardcoded logic — the AI reasons purely from the customer's stated context.
 */

export type SocialPlatform = 'THREADS';

export type AutomationGoal =
  | 'FIND_RELEVANT_POSTS_AND_COMMENT'
  | 'REPLY_TO_COMMENT_REPLIES'
  | 'REPLY_TO_DMS'
  | 'FIND_JOB_HIRING_POSTS'
  | 'NETWORK_BUILDING'
  | 'BRAND_AWARENESS'
  | 'FIND_COLLAB_OPPORTUNITIES'
  | 'CUSTOM';

export type ToneStyle =
  | 'casual_friendly'
  | 'professional'
  | 'friendly_technical'
  | 'witty_creative'
  | 'empathetic_supportive'
  | 'confident_assertive';

export interface CustomerProfile {
  /** Unique profile identifier */
  id: string;
  /** Customer's display name */
  name: string;
  /** Their professional field or role, described naturally */
  profession: string;
  /** Natural language description of who they are and what they do */
  bio: string;
  /** Target social media platform */
  platform: SocialPlatform;
  /** List of automation goals the customer wants enabled */
  goals: AutomationGoal[];
  /** Custom goal description if 'CUSTOM' is selected */
  customGoal?: string;
  /** Communication tone preference */
  toneStyle: ToneStyle;
  /**
   * Keywords / topics relevant to the customer — these are descriptive context
   * phrases for the AI to use in reasoning, NOT regex patterns.
   * Example: ["frontend development", "remote work", "React", "UI design"]
   */
  contextKeywords: string[];
  /**
   * Sample comment examples written by the customer in their own voice.
   * The AI uses these to learn and match their style.
   */
  sampleComments: string[];
  /** Active operating hours (24h format) */
  activeHoursStart: number;
  activeHoursEnd: number;
  /** Max comments per hour (overrides default rhythm) */
  maxCommentsPerHour?: number;
  /** Max DM replies per hour */
  maxDmsPerHour?: number;
  /** Profile creation timestamp */
  createdAt: number;
  /** Last updated timestamp */
  updatedAt: number;
}

export interface OperationIntent {
  /** What the agent plans to do in the next cycle — presented to customer for approval */
  plannedActions: string[];
  /** Current mode the agent will operate in */
  mode: 'FEED' | 'DM' | 'NOTIFICATIONS';
  /** Customer-readable summary of the session plan */
  sessionSummary: string;
  /** Whether customer has approved this intent */
  approved: boolean;
  /** Customer modification notes (if any) */
  customerNotes?: string;
}

export interface AgentTelemetry {
  isRunning: boolean;
  isPaused: boolean;
  currentMode: 'FEED' | 'DM' | 'PROFILE' | 'NOTIFICATIONS' | 'IDLE' | 'POST_OPEN';
  currentAction: string;
  lastActionAt: number;
  cycleCount: number;
  uptimeMinutes: number;
  stats: {
    totalInteractions: number;
    totalComments: number;
    totalDMs: number;
    totalScrolls: number;
    totalReplies: number;
    commentsPastHour: number;
    dmsPastHour: number;
    isCoolingDown: boolean;
  };
  securityAlert?: {
    active: boolean;
    type: string;
    details: string;
  };
  recentLog: string[];
}
