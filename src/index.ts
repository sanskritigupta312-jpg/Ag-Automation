/**
 * index.ts  (upgraded)
 * Main entry point for the Antigravity Autonomous Threads Automation System.
 *
 * Boot sequence:
 * 1. Start the Dashboard Web Server (http://localhost:3000)
 * 2. Launch Chrome CDP
 * 3. Connect BrowserClient
 * 4. Initialize LocalGeminiEngine (Antigravity local host)
 * 5. Initialize ThreadsOperator
 * 6. Load saved customer profile (if exists) or wait for dashboard setup
 * 7. Wait for customer intent approval via dashboard
 * 8. Start the autonomous operational loop
 * 9. Keep the CLI console fallback for terminal operators
 */

import dotenv from 'dotenv';
import { ChromeLauncher } from './launcher/ChromeLauncher.js';
import { BrowserClient } from './cdp/BrowserClient.js';
import { LocalGeminiEngine } from './engine/LocalGeminiEngine.js';
import { ThreadsOperator } from './agent/ThreadsOperator.js';
import { DashboardServer } from './dashboard/DashboardServer.js';
import { OperatorConsole } from './dashboard/OperatorConsole.js';
import fs from 'fs';
import path from 'path';
import { CustomerProfile } from './types/CustomerProfile.js';

dotenv.config();

// Global crash resilience
process.on('uncaughtException', (err) => {
  console.error('[Resilience] Uncaught Exception — continuing operation:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Resilience] Unhandled Rejection — continuing operation:', reason);
});

async function bootstrap() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   ANTIGRAVITY — AUTONOMOUS THREADS SOCIAL MEDIA OPERATOR      ║');
  console.log('║   Powered by: Google Antigravity · Local Gemini Engine        ║');
  console.log('║   Browser Control: Puppeteer CDP · Full Visual Automation     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  const cdpPort      = parseInt(process.env.CDP_PORT || '9222', 10);
  const geminiHost   = process.env.GEMINI_LOCAL_HOST || 'http://localhost:11434';
  const dashPort     = parseInt(process.env.DASHBOARD_PORT || '3000', 10);
  const initialMode  = (process.env.INITIAL_MODE || 'FEED') as 'FEED' | 'DM' | 'PROFILE';

  console.log(`[Config] CDP Port:           ${cdpPort}`);
  console.log(`[Config] Gemini Host:         ${geminiHost}`);
  console.log(`[Config] Dashboard Port:      ${dashPort}`);
  console.log(`[Config] Initial Mode:        ${initialMode}`);
  console.log('');

  // ── Step 1: Init Chrome CDP ──
  console.log('[Bootstrap] Ensuring Chrome CDP is running...');
  const chromeReady = await ChromeLauncher.ensureChromeWithCdp(cdpPort);
  if (!chromeReady) {
    console.warn(`[Bootstrap] Chrome CDP not verified on port ${cdpPort}. Attempting connection anyway...`);
  }

  // ── Step 2: Connect BrowserClient ──
  const browserClient = new BrowserClient(`http://127.0.0.1:${cdpPort}`);
  const connected = await browserClient.connect();

  if (!connected) {
    console.error(
      `[Bootstrap] ✗ Cannot connect to Chrome CDP on port ${cdpPort}.\n` +
      `  Make sure Chrome is running:\n` +
      `  chrome.exe --remote-debugging-port=${cdpPort} https://www.threads.net\n`
    );
    process.exit(1);
  }
  console.log('[Bootstrap] ✓ Chrome CDP connected.');

  // ── Step 3: Init Gemini Engine ──
  const geminiEngine = new LocalGeminiEngine({ hostUrl: geminiHost });
  console.log('[Bootstrap] ✓ Local Gemini Engine initialized.');

  // ── Step 4: Init Operator ──
  const operator = new ThreadsOperator(browserClient, geminiEngine, {
    initialMode,
    cdpPort,
  });
  console.log('[Bootstrap] ✓ Threads Operator initialized.');

  // ── Step 5: Start Dashboard Server ──
  const dashboard = new DashboardServer(operator, dashPort);
  await dashboard.start();
  console.log('[Bootstrap] ✓ Dashboard server started at http://localhost:' + dashPort);
  try {
    const { exec } = await import('child_process');
    if (process.platform === 'win32') {
      exec(`start http://localhost:${dashPort}`);
    }
  } catch {}

  // ── Step 6: Load saved customer profile (if any) ──
  const profilePath = path.resolve(process.cwd(), '.customer-profile.json');
  if (fs.existsSync(profilePath)) {
    try {
      const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8')) as CustomerProfile;
      operator.loadCustomerProfile(profile);
      operator.approveIntent('Auto-approved saved profile');
      console.log(`[Bootstrap] ✓ Saved profile loaded & approved: ${profile.name} (${profile.profession})`);
    } catch (err) {
      console.warn('[Bootstrap] Could not load saved profile:', (err as Error).message);
    }
  } else {
    console.log('[Bootstrap] No saved profile found. Please set up your profile on the dashboard.');
    console.log(`[Bootstrap] → Open: http://localhost:${dashPort}`);
  }

  // ── Step 7: Start CLI Console (terminal fallback) ──
  const consoleUi = new OperatorConsole(operator as any);
  consoleUi.startInteractiveCli();

  // ── Step 8: Handle graceful exit ──
  process.on('SIGINT', async () => {
    console.log('\n[Bootstrap] SIGINT received — shutting down gracefully...');
    operator.stop();
    consoleUi.stop();
    dashboard.stop();
    await browserClient.disconnect();
    process.exit(0);
  });

  // ── Step 9: Start autonomous loop ──
  console.log('[Bootstrap] ✓ Starting autonomous operational loop...\n');
  await operator.start();
}

bootstrap().catch((err) => {
  console.error('[Bootstrap] Fatal startup error:', err);
  process.exit(1);
});
