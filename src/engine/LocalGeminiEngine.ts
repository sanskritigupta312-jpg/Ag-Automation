/**
 * LocalGeminiEngine.ts
 * Integrates with native local host Gemini model running on Antigravity / localhost:11434.
 * Implements sliding context window (last 3-5 DM exchanges, active viewport post),
 * checkpoint/CAPTCHA detection, zero AI markers, and zero-reject conversational replies.
 */

import { SemanticElement } from '../cdp/BrowserClient.js';

export interface AgenticDecision {
  thought: string;
  action: 'COMMENT' | 'DM_REPLY' | 'SCROLL' | 'CLICK' | 'NAVIGATE' | 'IDLE' | 'SECURITY_CHALLENGE';
  targetElementId?: number;
  targetDescription?: string;
  synthesizedText?: string;
  trendingHashtags?: string[];
  scrollDeltaY?: number;
  recommendedDelayMs: number;
  confidence: number;
}

export interface EngineConfig {
  hostUrl?: string;
  modelName?: string;
  temperature?: number;
}

export class LocalGeminiEngine {
  private hostUrl: string;
  private modelName: string;
  private temperature: number;

  constructor(config: EngineConfig = {}) {
    this.hostUrl = config.hostUrl || process.env.GEMINI_LOCAL_HOST || 'http://localhost:11434';
    this.modelName = config.modelName || process.env.GEMINI_LOCAL_MODEL || 'gemini-flash';
    this.temperature = config.temperature ?? 0.7;
  }

  /**
   * Main cognitive entrypoint: sends visual viewport screenshot and sliding-window
   * context to the local Gemini engine for agentic reasoning.
   */
  public async reasonNextAction(params: {
    screenshotBase64: string;
    semanticElements: SemanticElement[];
    currentMode: 'FEED' | 'DM' | 'PROFILE';
    chatHistoryContext?: string[];
    recentActionsSummary?: string;
  }): Promise<AgenticDecision> {
    // Apply sliding context window: strictly last 3 to 5 DM exchanges
    const slidingDms = (params.chatHistoryContext || []).slice(-5).join('\n');

    // Focus candidate elements strictly on the most prominent viewport items (up to 35)
    const boundedCandidates = params.semanticElements.slice(0, 35);

    const systemPrompt = `You are an Autonomous Agentic Social Media Operator running exclusively inside the Google Antigravity Framework, operating Meta's Threads (threads.net) in real time.

CRITICAL OPERATIONAL RULES:
1. SECURITY & CAPTCHA: If you visually detect a CAPTCHA, robot verification challenge, security checkpoint, or account block, IMMEDIATELY set action to "SECURITY_CHALLENGE". Never attempt to bypass it.
2. NO AI STYLISTIC MARKERS: Strictly suppress em-dashes (—), hyphens in prose (-), structural bullet points, formal punctuation, or canned robotic phrases (e.g., "Indeed", "Furthermore", "Great post!").
3. HUMAN CASUAL SYNTAX: Synthesize responses using natural, conversational human social media syntax (relaxed casing, organic tone, human phrasing).
4. ZERO REJECT POLICY FOR DMS: If an incoming message is ambiguous, complex, controversial, or unusual, reason through the sender's intent and formulate a helpful, polite, or tactfully neutral human response.
5. CONTEXTUAL COMMENTING & TRENDING HASHTAGS: Draft hyper-realistic, thoughtful, human-style comments tailored directly to the post's context, with 2-3 trending, high-performing hashtags.

OUTPUT FORMAT:
Respond with ONLY a valid JSON object matching this schema:
{
  "thought": "<your agentic reasoning about the screen, post context, intent, or security challenges>",
  "action": "COMMENT" | "DM_REPLY" | "SCROLL" | "CLICK" | "NAVIGATE" | "IDLE" | "SECURITY_CHALLENGE",
  "targetElementId": <number matching candidate id, or null>,
  "targetDescription": "<description of target UI element>",
  "synthesizedText": "<casual human text without AI markers or null>",
  "trendingHashtags": ["#tag1", "#tag2"],
  "scrollDeltaY": <number for scrolling, or null>,
  "recommendedDelayMs": <integer delay in ms, between 2500 and 14000>,
  "confidence": <float 0.0 - 1.0>
}`;

    const userPrompt = `CURRENT OPERATIONAL MODE: ${params.currentMode}
RECENT ACTIONS: ${params.recentActionsSummary || 'None.'}
SLIDING CHAT CONTEXT (LAST 3-5 EXCHANGES):
${slidingDms || 'N/A'}

CANDIDATE VISIBLE DOM ELEMENTS:
${JSON.stringify(
  boundedCandidates.map((e) => ({
    id: e.id,
    tag: e.tagName,
    role: e.role,
    aria: e.ariaLabel,
    placeholder: e.placeholder,
    text: e.textSnippet,
    editable: e.isEditable,
    clickable: e.isClickable,
    rect: e.boundingBox,
  })),
  null,
  2
)}

Inspect visual viewport screenshot and semantic candidate elements. Reason about the next natural action or security check. Output raw JSON.`;

    try {
      const decision = await this.queryLocalHostModel(systemPrompt, userPrompt, params.screenshotBase64);
      return decision;
    } catch (err) {
      console.warn(`[LocalGeminiEngine] Local host query to ${this.hostUrl} failed: ${(err as Error).message}. Falling back to internal cognitive simulation.`);
      return this.fallbackCognitiveReasoning(boundedCandidates, params.currentMode, slidingDms);
    }
  }

  private async queryLocalHostModel(
    systemPrompt: string,
    userPrompt: string,
    screenshotBase64: string
  ): Promise<AgenticDecision> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 18000);

    try {
      // 1. Ollama-style API (/api/generate)
      const res = await fetch(`${this.hostUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          system: systemPrompt,
          prompt: userPrompt,
          images: [screenshotBase64],
          stream: false,
          format: 'json',
          options: { temperature: this.temperature },
        }),
        signal: controller.signal,
      });

      if (res.ok) {
        const data = (await res.json()) as { response: string };
        return JSON.parse(data.response) as AgenticDecision;
      }

      // 2. OpenAI / LocalAI format (/v1/chat/completions)
      const resChat = await fetch(`${this.hostUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: userPrompt },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${screenshotBase64}` } },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          temperature: this.temperature,
        }),
        signal: controller.signal,
      });

      if (resChat.ok) {
        const data = (await resChat.json()) as {
          choices: Array<{ message: { content: string } }>;
        };
        const content = data.choices[0]?.message?.content || '{}';
        return JSON.parse(content) as AgenticDecision;
      }

      throw new Error(`Endpoint returned status ${res.status}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Resilient cognitive fallback if the local host endpoint is loading or temporarily offline.
   */
  private fallbackCognitiveReasoning(
    elements: SemanticElement[],
    mode: 'FEED' | 'DM' | 'PROFILE',
    chatContext: string
  ): AgenticDecision {
    if (mode === 'FEED') {
      const editableTarget = elements.find(
        (e) =>
          e.isEditable &&
          (e.placeholder?.toLowerCase().includes('reply') ||
            e.placeholder?.toLowerCase().includes('say') ||
            e.ariaLabel?.toLowerCase().includes('reply'))
      );

      if (editableTarget) {
        return {
          thought: 'Found active reply input on viewport feed post. Formulating contextual thought and human comment.',
          action: 'COMMENT',
          targetElementId: editableTarget.id,
          targetDescription: editableTarget.placeholder || editableTarget.ariaLabel || 'Comment input field',
          synthesizedText: 'honestly this is such a clean approach, feels super organic to use',
          trendingHashtags: ['#threads', '#buildinpublic', '#tech'],
          recommendedDelayMs: 4800,
          confidence: 0.88,
        };
      }

      const replyBtn = elements.find(
        (e) => e.isClickable && (e.ariaLabel?.toLowerCase().includes('reply') || e.textSnippet?.toLowerCase().includes('reply'))
      );
      if (replyBtn) {
        return {
          thought: 'Discovered high-engagement post with reply action. Triggering reply overlay.',
          action: 'CLICK',
          targetElementId: replyBtn.id,
          targetDescription: replyBtn.ariaLabel || 'Post reply button',
          recommendedDelayMs: 3400,
          confidence: 0.85,
        };
      }

      return {
        thought: 'Scanning feed posts for high-relevance topic discussion. Performing smooth human dwell scroll.',
        action: 'SCROLL',
        scrollDeltaY: 340 + Math.floor(Math.random() * 260),
        recommendedDelayMs: 3000,
        confidence: 0.92,
      };
    }

    if (mode === 'DM') {
      const dmInput = elements.find((e) => e.isEditable);
      if (dmInput) {
        return {
          thought: 'Observing direct message thread. Applying zero-reject policy to formulate constructive, friendly reply.',
          action: 'DM_REPLY',
          targetElementId: dmInput.id,
          targetDescription: 'Direct message text input',
          synthesizedText: 'hey thanks for reaching out! completely agree with your point, let me know what you think of the new updates',
          recommendedDelayMs: 5400,
          confidence: 0.89,
        };
      }
    }

    return {
      thought: 'Observing UI viewport state. Pausing naturally to mimic human reading and contemplation.',
      action: 'IDLE',
      recommendedDelayMs: 3800,
      confidence: 0.8,
    };
  }
}
