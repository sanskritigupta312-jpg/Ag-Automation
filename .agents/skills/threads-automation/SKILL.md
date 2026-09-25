---
name: threads-automation
description: Runs the autonomous Threads automation workflow directly via Antigravity Browser Agent on behalf of Sanskriti.
---

# Threads Automation Skill

When the user asks you to "run threads automation", "automate threads", or invokes this skill, you MUST execute the Threads automation using your **browser_subagent** tool. Do NOT instruct the user to run `npm run dev` or use the Node.js script. YOU are the automation agent now.

## Execution Instructions:
Execute the following sequence in order:

1. **Dashboard Initialization**:
   - Run a command to open the dashboard in the user's default browser: `Start-Process "c:\Users\SANSKRITI\OneDrive\Desktop\React\Ag-Automation\src\dashboard\web\index.html"`

2. **Execute Automation via Subagent**:
   Spawn a `browser_subagent` with the following comprehensive task prompt:
   ```text
   You are automating Threads on behalf of Sanskriti, a Frontend React Developer.
   Navigate to https://www.threads.net/ and ensure you are logged in.
   1. DM INBOX SCAN: Go to the Messages tab (Requests section). Open and reply to any unread messages naturally, representing Sanskriti (Friendly, professional Frontend React Developer).
   2. FEED SCROLLING: Return to the main Feed (Home). Scroll through the feed and evaluate posts. 
   3. ENGAGE: When you find a post relevant to Frontend Development, React, UI/UX, or Tech Hiring, write a thoughtful, contextual comment on it. 
   After completing these steps, finish your task and report exactly who you replied to, what you said, and what you commented on.
   ```

3. **Dynamic Dashboard Injection**:
   - Once the subagent returns its summary of actions, you MUST dynamically update `c:\Users\SANSKRITI\OneDrive\Desktop\React\Ag-Automation\src\dashboard\web\dashboard.js` or `index.html` to inject the EXACT actions performed (the comments posted, the DMs sent) into the activity stream, so the user sees the real data in the dashboard.
   - You MUST ensure the data is strictly accurate based on what the subagent actually did.

## Constraints
- **Zero API Keys**: Never ask the user for a Gemini API key. You are powering this using your own internal capabilities.
- **Full Automation**: Do not ask for user permission before clicking or typing in the browser. You are authorized to act on her behalf.
