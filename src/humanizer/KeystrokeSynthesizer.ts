/**
 * KeystrokeSynthesizer.ts
 * Simulates human typing mechanics:
 * - Dynamic keystroke latency (45ms - 180ms)
 * - Mid-sentence thinking pauses
 * - Organic backspace typos and corrections (QWERTY neighbor matrix)
 * - Strict AI stylistic marker suppression (em-dash, hyphens in prose, bullets, robotic phrases)
 * - Natural social media syntax formatting
 */

export interface KeystrokeAction {
  type: 'type' | 'backspace' | 'pause';
  char?: string;
  delayMs: number;
}

export class KeystrokeSynthesizer {
  // QWERTY keyboard adjacent keys for realistic typo simulation
  private static readonly QWERTY_NEIGHBORS: Record<string, string[]> = {
    a: ['q', 'w', 's', 'z'],
    b: ['v', 'g', 'h', 'n'],
    c: ['x', 'd', 'f', 'v'],
    d: ['s', 'e', 'r', 'f', 'c', 'x'],
    e: ['w', 's', 'd', 'r'],
    f: ['d', 'r', 't', 'g', 'v', 'c'],
    g: ['f', 't', 'y', 'h', 'b', 'v'],
    h: ['g', 'y', 'u', 'j', 'n', 'b'],
    i: ['u', 'j', 'k', 'o'],
    j: ['h', 'u', 'i', 'k', 'm', 'n'],
    k: ['j', 'i', 'o', 'l', 'm'],
    l: ['k', 'o', 'p'],
    m: ['n', 'j', 'k'],
    n: ['b', 'h', 'j', 'm'],
    o: ['i', 'k', 'l', 'p'],
    p: ['o', 'l'],
    q: ['w', 'a'],
    r: ['e', 'd', 'f', 't'],
    s: ['a', 'w', 'e', 'd', 'x', 'z'],
    t: ['r', 'f', 'g', 'y'],
    u: ['y', 'h', 'j', 'i'],
    v: ['c', 'f', 'g', 'b'],
    w: ['q', 'a', 's', 'e'],
    x: ['z', 's', 'd', 'c'],
    y: ['t', 'g', 'h', 'u'],
    z: ['a', 's', 'x'],
  };

  /**
   * Sanitizes and adapts text to real-world casual social media syntax.
   * Suppresses robotic AI stylistic markers: em-dashes (—), hyphens in prose (-),
   * structural bullet points (*, -), rigid quotes, and canned robotic openings.
   */
  public sanitizeHumanSyntax(input: string): string {
    if (!input) return '';

    let text = input;

    // Suppress em-dashes and en-dashes without regex
    text = text.split('\u2014').join(', ');
    text = text.split('\u2013').join(', ');
    text = text.split('--').join(', ');
    text = text.split(' - ').join(', ');

    // Suppress structural bullet lists or numbering at line starts without regex
    const lines = text.split('\n');
    const cleanedLines = lines.map((line) => {
      let trimmed = line.trimStart();
      while (
        trimmed.startsWith('* ') ||
        trimmed.startsWith('- ') ||
        trimmed.startsWith('• ') ||
        trimmed.startsWith('– ') ||
        trimmed.startsWith('— ')
      ) {
        trimmed = trimmed.slice(2).trimStart();
      }
      if (trimmed.length >= 3) {
        const first = trimmed.charAt(0);
        const second = trimmed.charAt(1);
        const third = trimmed.charAt(2);
        if (first >= '0' && first <= '9' && (second === '.' || second === ')') && third === ' ') {
          trimmed = trimmed.slice(3).trimStart();
        }
      }
      return trimmed;
    });
    text = cleanedLines.join('\n');

    // Strip canned robotic openings and filler phrases without regex
    const roboticOpeners = [
      'as an ai',
      'in conclusion',
      'great post',
      'thanks for sharing',
      'this is a great point',
      'indeed',
      'furthermore',
      'moreover',
      'certainly',
      'absolutely',
    ];

    const lower = text.toLowerCase();
    for (const opener of roboticOpeners) {
      if (lower.startsWith(opener)) {
        text = text.slice(opener.length).trimStart();
        if (text.startsWith(',') || text.startsWith(':') || text.startsWith('.')) {
          text = text.slice(1).trimStart();
        }
        break;
      }
    }

    // Collapse multiple blank lines and redundant spaces without regex
    while (text.includes('  ')) {
      text = text.split('  ').join(' ');
    }
    while (text.includes('\t')) {
      text = text.split('\t').join(' ');
    }
    while (text.includes('\n\n\n')) {
      text = text.split('\n\n\n').join('\n\n');
    }
    text = text.trim();

    // Natural social media casing: relax rigid first-letter capitalization without regex
    if (text.length >= 2) {
      const first = text.charAt(0);
      const second = text.charAt(1);
      if (first >= 'A' && first <= 'Z' && second >= 'a' && second <= 'z' && Math.random() < 0.35) {
        text = first.toLowerCase() + text.slice(1);
      }
    }

    // Trim trailing formal period if single casual sentence without regex
    if (
      text.endsWith('.') &&
      !text.endsWith('..') &&
      !text.includes('\n') &&
      text.length < 120 &&
      Math.random() < 0.5
    ) {
      text = text.slice(0, -1);
    }

    return text;
  }

  /**
   * Deconstructs text into a humanized keystroke sequence:
   * - Variable typing speed (45ms to 180ms)
   * - Occasional natural typos and backspace corrections
   * - Mid-sentence thinking pauses
   */
  public synthesizeKeystrokes(rawText: string, typoRate: number = 0.035): KeystrokeAction[] {
    const text = this.sanitizeHumanSyntax(rawText);
    const actions: KeystrokeAction[] = [];

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const lower = char.toLowerCase();

      // Check if typo should occur on standard alphabetic characters
      const canMakeTypo =
        typoRate > 0 &&
        Math.random() < typoRate &&
        KeystrokeSynthesizer.QWERTY_NEIGHBORS[lower] !== undefined &&
        i > 2 &&
        i < text.length - 2;

      if (canMakeTypo) {
        const neighbors = KeystrokeSynthesizer.QWERTY_NEIGHBORS[lower];
        const typoChar = neighbors[Math.floor(Math.random() * neighbors.length)];
        const isUpper = char !== lower;
        const actualTypo = isUpper ? typoChar.toUpperCase() : typoChar;

        // 1. Type incorrect character
        actions.push({
          type: 'type',
          char: actualTypo,
          delayMs: this.randomDelay(45, 160),
        });

        // 2. Realization pause (120ms - 280ms)
        actions.push({
          type: 'pause',
          delayMs: this.randomDelay(120, 280),
        });

        // 3. Hit backspace
        actions.push({
          type: 'backspace',
          delayMs: this.randomDelay(60, 140),
        });

        // 4. Brief corrective pause
        actions.push({
          type: 'pause',
          delayMs: this.randomDelay(80, 160),
        });
      }

      // Normal keystroke within 45ms - 180ms range
      actions.push({
        type: 'type',
        char: char,
        delayMs: this.randomDelay(45, 180),
      });

      // Mid-sentence thinking pauses (at spaces after punctuation or clause breaks)
      if ((char === ',' || char === '.' || char === '!' || char === '?') && i < text.length - 1) {
        actions.push({
          type: 'pause',
          delayMs: this.randomDelay(280, 650),
        });
      } else if (char === ' ' && Math.random() < 0.08) {
        // Subtle micro-thinking pause between random words
        actions.push({
          type: 'pause',
          delayMs: this.randomDelay(200, 480),
        });
      }
    }

    return actions;
  }

  /**
   * Generates a random delay with a log-normal skew towards the lower-middle range.
   */
  private randomDelay(min: number, max: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const normal = Math.sqrt(-2.0 * Math.log(u1 || 0.0001)) * Math.cos(2.0 * Math.PI * u2);
    const normalized = Math.min(1, Math.max(0, (normal + 2.5) / 5));
    return Math.round(min + normalized * (max - min));
  }
}
