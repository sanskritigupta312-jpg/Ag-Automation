# 🤖 Antigravity — Autonomous Threads Social Media Automation

> **100% Agent-to-Agent · No External APIs · Powered by Local Gemini (Antigravity)**
> 
> A fully humanized, AI-driven automation system for **Threads.net** — controlled via a premium web dashboard, operated by a local Gemini model running through Antigravity, with real browser control via Puppeteer CDP.

---

## ✨ What This Does

The automation works **on your behalf** based on your profile:

| Action | Description |
|---|---|
| 🔍 **Feed Scroll** | Smoothly scrolls the Threads feed with human timing |
| 🎯 **Post Discovery** | AI visually identifies posts relevant to YOUR goals (no keyword matching) |
| 📖 **Post Opening** | Clicks into relevant posts to read and engage |
| 💬 **Comment Posting** | Posts natural, personalized comments in YOUR voice |
| ✅ **Comment Verification** | Verifies the comment was posted successfully |
| ↩️ **Reply to Replies** | Monitors notifications and replies to comment replies on your behalf |
| ✉️ **DM Replies** | Reads and replies to your DMs in a humanized, conversational way |
| 🛡️ **Security Detection** | Detects CAPTCHAs and verification challenges via AI vision — immediately pauses |
| 🔄 **Continuous Loop** | Back to feed → scroll → repeat, continuously |

**100% humanized** — Bézier cursor paths, variable typing speed, realistic scroll physics, circadian-aware timing.

---

## 🏗️ Architecture

```
src/
├── agent/
│   ├── ObserveReasonActLoop.ts     ← Full OODA cycle (Observe→Reason→Act→Verify)
│   ├── ThreadsOperator.ts           ← Main coordinator + profile-driven logic
│   └── InboundMonitor.ts            ← Parallel DM + notification scanner
├── cdp/
│   └── BrowserClient.ts             ← Puppeteer CDP (real browser control)
├── dashboard/
│   ├── DashboardServer.ts           ← Express + WebSocket server
│   ├── OperatorConsole.ts           ← Terminal CLI fallback
│   └── web/
│       ├── index.html               ← Customer dashboard UI
│       ├── style.css                ← Premium dark glassmorphism design
│       └── dashboard.js             ← Live WebSocket client
├── engine/
│   └── LocalGeminiEngine.ts         ← AI reasoning (local Gemini via Antigravity)
├── humanizer/
│   ├── CursorPhysics.ts             ← Bézier mouse trajectories
│   ├── KeystrokeSynthesizer.ts      ← Human-like typing with typos
│   └── RhythmManager.ts             ← Rate limits + circadian timing
├── intent/
│   └── IntentInterviewer.ts         ← Pre-op intent builder for customer approval
├── monitor/
│   └── AgentMonitor.ts              ← 30s health ping + stall detection
├── security/
│   └── CheckpointDetector.ts        ← AI-only CAPTCHA/challenge detection
├── session/
│   └── SessionManager.ts            ← Cookie/localStorage persistence
├── types/
│   └── CustomerProfile.ts           ← All customer profile + telemetry types
└── index.ts                         ← Boot entry point
```

---

## ⚙️ Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | v18+ | Runtime environment |
| Google Chrome | Any recent version | Visual browser automation target |
| Antigravity Engine | Integrated | Built-in Gemini cognitive reasoning |

---

## 🚀 Setup & Running

### Step 1 — Install Dependencies

```bash
npm install
```

### Step 2 — Start the Automation & Dashboard

```bash
npm start
```

That's it! `npm start` automatically:
1. Detects and launches Google Chrome with CDP enabled (`port 9222`)
2. Connects the Puppeteer CDP visual automation pipeline
3. Activates the Antigravity Gemini cognitive engine
4. Launches the real-time Glassmorphism Web Dashboard at:

👉 **http://localhost:3000**

---

### Step 3 — Open Dashboard in Browser

1. Navigate to `http://localhost:3000`
2. **Setup Profile**: Fill in your customer identity, profession, tone, and goals
3. **Review Intent**: Inspect and approve the AI-generated session action plan
4. **Live Monitor**: Watch the agent execute humanized feed scrolls, post discovery, and contextual comments in real time!

---

## 🖥️ Dashboard Usage

### 1. Setup Profile (First Time)

Fill in your profile on the **Setup Profile** tab:

- **Your Name** — How the AI refers to you
- **Profession** — e.g., "Frontend Developer", "UI Designer", "Copywriter"
- **Bio** — 1-3 sentences about yourself and what you do
- **Platform** — Threads (LinkedIn, X coming soon)
- **Goals** — Select what you want automated:
  - Find & Comment on Relevant Posts
  - Find Job/Hiring Posts
  - Reply to Comment Replies
  - Reply to DMs
  - Network Building
  - Find Collaboration Opportunities
  - Brand Awareness
- **Communication Tone** — Casual, Professional, Technical, Creative, Empathetic, Confident
- **Context Keywords** — Topics relevant to you (helps AI's reasoning, NOT regex)
- **Sample Comments** — Write 2-3 comments in your own voice (AI learns your style)
- **Active Hours** — When the automation should be most active
- **Rate Limits** — Max comments and DMs per hour

Click **Save Profile & Generate Plan** → moves to Intent Review.

### 2. Intent Review (Before Each Session)

The AI builds a human-readable plan of exactly what it's going to do and asks for your approval.

Example:
> *"Hey Sanskriti! I'm ready to start. Here's what I'm planning to do:*
> *1. Scroll through the Threads feed and use AI reasoning to identify hiring/collab posts relevant to you as a Frontend Developer.*
> *2. Comment on relevant posts in your friendly-technical tone...*
> *3. Check DMs every 5 minutes and reply..."*

Review → optionally add notes → click **Approve & Start**.

### 3. Live Monitor

Real-time view while automation runs:

- **Status indicator** — Running (green pulse) / Paused (amber) / Alert (red)
- **Mode switcher** — Switch between Feed / DM / Notifications
- **Stats** — Cycles, Comments, DMs, Scrolls, Uptime
- **Live log** — Real-time stream of everything the agent is doing
- **Controls** — Pause / Resume / Stop

### 4. Analytics

Session statistics and rate limit capacity bars.

---

## 🛡️ Anti-Detection & Safety

| Feature | Implementation |
|---|---|
| **Mouse Movement** | Cubic Bézier curves with natural wrist arc + micro-tremors |
| **Click Targeting** | Randomized point within 20%-80% safe inner pad (never dead center) |
| **Typing Speed** | Variable 40-220ms delays + occasional backspace corrections |
| **Scroll** | Smooth micro-scroll wheel steps with jitter |
| **Rate Limits** | 8-12 comments/hr, 4-6 DMs/hr (configurable) |
| **Cool-down Breaks** | 20-45 min breaks after every 4-6 actions |
| **Circadian Timing** | Slower at night, faster during active hours |
| **Session Health** | Graceful Chrome reload every 2 hours |
| **CAPTCHA Detection** | AI visual reasoning only — immediately pauses, never bypasses |
| **No hardcoded patterns** | Zero regex matching anywhere in the codebase |

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run individual test suites
npm run test:humanizer        # CursorPhysics, KeystrokeSynthesizer, RhythmManager, LocalGeminiEngine
npm run test:advanced         # Checkpoint detection, Rate limits, TrendInjector, SessionManager
```

Current test results:
- **Humanizer suite**: 49/49 PASS ✅
- **Advanced protocols suite**: 102/102 PASS ✅

---

## 🎛️ Terminal CLI (Advanced)

The terminal also accepts commands (fallback for headless/daemon mode):

```
pause               → Pause automation
resume              → Resume automation
mode feed           → Switch to Feed Discovery
mode dm             → Switch to DM Inbox
mode notifications  → Switch to Notifications
target @username    → Focus on specific profile
status              → Show live telemetry
exit                → Stop and exit
```

---

## 📡 WebSocket API

The dashboard server exposes a WebSocket at `ws://localhost:3000/ws`.

**Server → Client messages:**

| Type | Payload | Description |
|---|---|---|
| `TELEMETRY` | `AgentTelemetry` | Full telemetry update |
| `PROFILE` | `CustomerProfile` | Current customer profile |
| `INTENT` | `OperationIntent` | Session intent for review |
| `INTENT_APPROVED` | — | Intent was approved |
| `SECURITY_ALERT` | `{message}` | Security challenge detected |
| `LOG` | `{entry}` | Real-time log entry |

**REST API:**

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/profile` | Save customer profile |
| `GET` | `/api/profile` | Get current profile |
| `GET` | `/api/profile/saved` | Load saved profile from disk |
| `GET` | `/api/intent` | Get current intent |
| `POST` | `/api/approve` | Approve the intent |
| `POST` | `/api/control` | Send control command |
| `GET` | `/api/status` | Current telemetry snapshot |

---

## ⚠️ Important Notes

1. **Manual Login Required** — Log into Threads in the Chrome window **before** starting. The automation does not handle login.
2. **CAPTCHA = Immediate Pause** — If a security challenge is detected, automation pauses and waits for your manual intervention. Resume via the dashboard.
3. **Local Only** — All AI reasoning happens on your local machine via Antigravity. No cloud APIs are used.
4. **Profile Saved Locally** — Your profile is saved to `.customer-profile.json` in the project root. It's auto-loaded on next startup.

---

## 📁 Files to Git Ignore

```gitignore
.chrome-session-profile/
.customer-profile.json
.env
node_modules/
```

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---|---|
| "Cannot connect to Chrome CDP" | Make sure Chrome is running with `--remote-debugging-port=9222` |
| "Local host query failed" | Check that Antigravity / local Gemini is running on the configured port |
| Dashboard not loading | Check that port 3000 is not in use by another app |
| Security alert triggered | Complete the challenge manually in Chrome, then click Resume |
| Automation running but nothing happening | Check the Live Log on the dashboard for error details |

---

## 📜 License

MIT — Use responsibly and in accordance with Threads' Terms of Service.
