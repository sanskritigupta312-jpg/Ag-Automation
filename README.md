# Autonomous Agentic Social Media Operator (`threads.net`)

An Autonomous Agentic Social Media Operator running exclusively inside the **Google Antigravity Framework**, powered by its native local host Gemini model. It visually inspects, reasons over, and operates Meta's Threads (`threads.net`) in real time via Puppeteer and Chrome DevTools Protocol (CDP port 9222).

---

## Architectural Principles

### 1. Pure Agentic Reasoning (Zero Hardcoding / Zero Regex)
- **Visual & Semantic DOM Reasoning**: Elements (comment inputs, reply buttons, send actions, scroll areas) are located dynamically on every cycle by sending the viewport screenshot and semantic DOM candidates directly to the Local Gemini Engine.
- **Zero Regex & Fixed Selectors**: No hardcoded CSS selectors, XPaths, or static string matching rules.
- **Zero Reject Policy for DMs**: In multi-turn conversations and incoming DMs, ambiguous, controversial, or complex messages are analyzed for underlying intent and answered with helpful, polite, and tactfully neutral human responses.

### 2. Human Mimicry & Anti-Ban Physics
- **Dynamic Element Bounding & Non-Center Clicks**: Bounding boxes are analyzed to pick a randomized inner coordinate using a bounded distribution. Never clicks element centers or fixed coordinates.
- **Organic Bézier Trajectories**: Cursor movements follow non-linear Cubic Bézier curves with natural wrist arcs, velocity easing (acceleration, cruise, deceleration), subpixel tremors, and micro-overshoots with corrective drifts.
- **Keystroke Variation & Typo Simulation**:
  - Typing speed: 45ms to 180ms per character with log-normal distribution.
  - Thinking pauses: 250ms to 650ms after punctuation and phrase boundaries.
  - Typo simulation: strikes adjacent keys on QWERTY layout, pauses, triggers backspace, and types the intended character.
  - AI Stylistic Marker Suppression: Completely strips em-dashes (`—`), hyphens, robotic bullet lists, and canned robotic openings (e.g., "Indeed", "Furthermore").
- **Dynamic Operational Rhythm**: Incorporates circadian time-of-day multipliers and fatigue factors, dynamically spacing actions with passive reading dwell times.

---

## Directory Structure

```
Ag-Automation/
├── src/
│   ├── cdp/
│   │   └── BrowserClient.ts         # CDP connection, viewport screenshot & semantic DOM parser
│   ├── engine/
│   │   └── LocalGeminiEngine.ts     # Localhost Gemini cognitive engine (localhost:11434)
│   ├── humanizer/
│   │   ├── CursorPhysics.ts         # Bézier curves, dynamic non-center bounds, micro-overshoots
│   │   ├── KeystrokeSynthesizer.ts  # Humanized typing latency, typo corrections, marker suppression
│   │   └── RhythmManager.ts         # Circadian factors, fatigue modeling, reading dwell times
│   ├── agent/
│   │   ├── ObserveReasonActLoop.ts  # Core OODA workflow loop (Observe -> Reason -> Act -> Verify)
│   │   └── ThreadsOperator.ts       # High-level coordinator (Feed, DMs, Profiles, Memory)
│   ├── dashboard/
│   │   └── OperatorConsole.ts       # Interactive CLI console for real-time operator control
│   ├── launcher/
│   │   └── ChromeLauncher.ts        # Auto-detects Chrome & enables remote debugging port 9222
│   └── index.ts                     # Main entrypoint
├── test/
│   └── humanizer.test.ts            # Verification suite (49 automated tests)
├── package.json
└── tsconfig.json
```

---

## Quickstart

### 1. Launch Chrome with CDP
Run the auto-launcher or launch Google Chrome with remote debugging on port 9222:
```bash
npm run launch-chrome
```
Or manually via terminal:
```bash
chrome.exe --remote-debugging-port=9222 --user-data-dir=.chrome-session-profile https://www.threads.net
```

### 2. Verify / Run Test Suite
Verify cursor dynamics, keystroke synthesis, and decision fallbacks:
```bash
npm run test:humanizer
```

### 3. Start the Autonomous Operator
```bash
npm start
```

---

## Interactive Operator Console Commands

While running, the operator responds in real time to the following commands in the terminal:

| Command | Action |
| :--- | :--- |
| `pause` | Temporarily suspends automated actions |
| `resume` | Resumes automated actions |
| `mode feed` | Switches to feed discovery & contextual commenting |
| `mode dm` | Switches to inbox inspection and zero-reject replies |
| `target @username` | Navigates directly to a target user profile |
| `status` | Displays live telemetry (interactions, comments, DMs, scrolls, rhythm) |
| `exit` | Gracefully halts the operator and releases CDP |
