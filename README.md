# Autonomous Agentic Social Media Operator (`threads.net`)

An Autonomous Agentic Social Media Operator running exclusively inside the **Google Antigravity Framework**, powered by its native local host Gemini model. It visually inspects, reasons over, and operates Meta's Threads (`threads.net`) in real time via Puppeteer and Chrome DevTools Protocol (CDP port 9222).

---

## Architectural Principles & Advanced Anti-Ban Protocols

### 1. Pure Agentic Reasoning (Zero Hardcoding & Zero Regex)
- **Visual & Semantic DOM Reasoning**: Elements (comment inputs, reply buttons, send actions, scroll areas) are located dynamically on every cycle by sending the viewport screenshot and semantic DOM candidates directly to the Local Gemini Engine.
- **Zero Regex & Fixed Selectors**: No hardcoded CSS selectors, XPaths, or static string matching rules.
- **Zero Reject Policy for DMs**: In multi-turn conversations and incoming DMs, ambiguous, controversial, or complex messages are analyzed for underlying intent and answered with helpful, polite, and tactfully neutral human responses.

### 2. Visual Fallback & Shadow DOM Resilience
- **No Reliance on Dynamic Hashed Classes**: Avoids brittle, obfuscated CSS classes (e.g. `_a9--`).
- **Recursive Shadow DOM Traversal**: Transparently traverses open Shadow DOM roots and light DOM trees, inspecting visual bounding contours, ARIA semantics, SVG contours, and text boundaries.

### 3. Checkpoint, CAPTCHA & Zero-Bypass Session Protocol
- **Zero Automated Bypass**: Continuous visual and DOM scanning for CAPTCHAs, bot challenges, account verification dialogues, or suspicious activity checkpoints.
- **Emergency Pause & Notification**: On detection of any security challenge, all active CDP actions are immediately paused, cookies and localStorage are preserved to disk, and a high-priority alert (terminal bell + console guidance) requests human manual intervention.
- **State Persistence**: Maintains active cookies, localStorage, and persistent session profiles in `.chrome-session-profile` to eliminate unnecessary login triggers.

### 4. Memory Optimization & 2-Hour Runtime Reload Lifecycle
- **Sliding Context Window**: Prompts strictly pass the last 3–5 DM exchanges and clamp DOM candidates strictly to the active viewport post to maintain low latency and conserve local memory.
- **2-Hour Graceful Browser Reload**: Tracks runtime health. Every 2 hours of infinite scrolling, safely exports cookies/storage, restarts the browser instance, and re-attaches CDP to avoid memory exhaustion.

### 5. Real-Time Trend Injection
- Dynamically identifies post niches (Tech, AI, UI Design, Startups, Finance, Lifestyle) and injects 2–3 active, high-converting trending hashtags into synthesized comments.

### 6. Human Mimicry & Click/Sight Alignment Dynamics
- **Safe 20%–80% Inner Pad Targeting**: Analyzes target bounding boxes and picks dynamic inner coordinates strictly inside a 20%–80% pad. Never clicks static coordinates or element centers.
- **Sight-Alignment Pauses**: Introduces natural eye-gaze contemplation pauses (350ms to 1400ms) prior to dispatching clicks.
- **Organic Bézier Trajectories**: Cursor movements follow non-linear Cubic Bézier curves with natural wrist arcs, velocity easing, subpixel tremors, and micro-overshoots.
- **Human Keystroke Variation & AI Marker Suppression**:
  - Typing speed: 45ms to 180ms per character with log-normal distribution.
  - Thinking pauses: 250ms to 650ms after punctuation and phrase boundaries.
  - Typo simulation: strikes adjacent keys on QWERTY layout, pauses, triggers backspace, and types the intended character.
  - AI Stylistic Marker Suppression: Completely strips em-dashes (`—`), hyphens in regular prose (` - `), robotic bullet lists, and canned robotic openings (e.g., "Indeed", "Furthermore").

### 7. Conservative Rate Limits & Operational Breaks
- **Hourly Execution Caps**: Maximum 8–12 comments/hour, 4–6 DMs/hour.
- **Operational Breaks**: Automatic 20–45 minute cool-down rest periods after every 4–6 productive actions.
- **Passive Browsing Lingers**: 5–12 seconds dwell contemplation on posts to emulate authentic human reading behavior.

---

## Directory Structure

```
Ag-Automation/
├── src/
│   ├── cdp/
│   │   └── BrowserClient.ts         # CDP connection, Shadow DOM traversal, sight pause & inputs
│   ├── engine/
│   │   └── LocalGeminiEngine.ts     # Localhost Gemini cognitive engine with sliding context window
│   ├── humanizer/
│   │   ├── CursorPhysics.ts         # Bézier curves, 20%-80% inner pad, sight alignment pause
│   │   ├── KeystrokeSynthesizer.ts  # Humanized typing latency, typo corrections, marker suppression
│   │   └── RhythmManager.ts         # Rate limits (8-12 comments, 4-6 DMs), 20-45m breaks, lingers
│   ├── security/
│   │   └── CheckpointDetector.ts    # CAPTCHA / checkpoint detection & zero-bypass alert
│   ├── session/
│   │   └── SessionManager.ts        # Persistent cookies/storage & 2-hour reload lifecycle
│   ├── trend/
│   │   └── TrendInjector.ts         # Dynamic niche deduction & real-time trending hashtag generation
│   ├── agent/
│   │   ├── ObserveReasonActLoop.ts  # OODA workflow loop (Observe -> Reason -> Act -> Verify)
│   │   └── ThreadsOperator.ts       # High-level coordinator (Feed, DMs, Profiles, Memory)
│   ├── dashboard/
│   │   └── OperatorConsole.ts       # Interactive CLI console for real-time operator control
│   ├── launcher/
│   │   └── ChromeLauncher.ts        # Windows Chrome auto-detector and CDP launcher
│   └── index.ts                     # Main entrypoint
├── test/
│   ├── humanizer.test.ts            # Humanizer test suite (49 assertions)
│   └── advanced_protocols.test.ts   # Advanced safety & anti-ban test suite (96 assertions)
├── package.json
└── tsconfig.json
```

---

## Quickstart

### 1. Launch Chrome with CDP
Run the auto-launcher to launch Chrome with remote debugging on port 9222:
```bash
npm run launch-chrome
```
*(Or launch manually: `chrome.exe --remote-debugging-port=9222 --user-data-dir=.chrome-session-profile https://www.threads.net`)*

### 2. Run Comprehensive Test Suites (145 tests)
```bash
npm test
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
| `pause` | Temporarily suspends automated actions and preserves state |
| `resume` | Resumes automated actions after manual review |
| `mode feed` | Switches to feed discovery & contextual commenting |
| `mode dm` | Switches to inbox inspection and zero-reject replies |
| `target @username` | Navigates directly to a target user profile |
| `status` | Displays live telemetry (interactions, rate limits, cool-down, uptime) |
| `exit` | Gracefully halts the operator, preserves state, and releases CDP |
