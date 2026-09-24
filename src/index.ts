/**
 * index.ts
 * Main entry point for the Autonomous Agentic Social Media Operator.
 * Initializes CDP connection on threads.net, connects to local host Gemini engine,
 * and executes the Observe-Reason-Act-Verify cycle with interactive operator controls.
 */

import dotenv from 'dotenv';
import { ChromeLauncher } from './launcher/ChromeLauncher.js';
import { BrowserClient } from './cdp/BrowserClient.js';
import { LocalGeminiEngine } from './engine/LocalGeminiEngine.js';
import { ThreadsOperator } from './agent/ThreadsOperator.js';
import { OperatorConsole } from './dashboard/OperatorConsole.js';

dotenv.config();

// Global crash resilience: prevent process termination on async blips
process.on('uncaughtException', (err) => {
  console.error('[Resilience] Uncaught Exception caught, continuing operation:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Resilience] Unhandled Promise Rejection caught, continuing operation:', reason);
});

async function bootstrap() {
  console.log('================================================================');
  console.log('   AUTONOMOUS AGENTIC SOCIAL MEDIA OPERATOR (THREADS.NET)       ');
  console.log('   Google Antigravity Framework | Native Local Gemini Engine    ');
  console.log('================================================================\n');

  const cdpPort = parseInt(process.env.CDP_PORT || '9222', 10);
  const geminiHost = process.env.GEMINI_LOCAL_HOST || 'http://localhost:11434';
  const initialMode = (process.env.INITIAL_MODE || 'FEED') as 'FEED' | 'DM' | 'PROFILE';

  console.log(`[Config] Target CDP Port: ${cdpPort}`);
  console.log(`[Config] Local Gemini Host: ${geminiHost}`);
  console.log(`[Config] Initial Operational Mode: ${initialMode}\n`);

  // Step 1: Ensure Chrome with CDP is running
  console.log('[Bootstrap] Initializing Chrome DevTools Protocol session...');
  const chromeReady = await ChromeLauncher.ensureChromeWithCdp(cdpPort);
  if (!chromeReady) {
    console.warn(
      `[Bootstrap] Warning: Chrome CDP was not verified on port ${cdpPort}. ` +
      `Proceeding with connection attempt in case an external instance is running.`
    );
  }

  // Step 2: Connect BrowserClient to CDP
  const browserClient = new BrowserClient(`http://127.0.0.1:${cdpPort}`);
  const connected = await browserClient.connect();

  if (!connected) {
    console.error(
      `[Bootstrap] Unable to attach to Chrome on port ${cdpPort}.\n` +
      `Please ensure Chrome is running with:\n` +
      `  chrome.exe --remote-debugging-port=${cdpPort} https://www.threads.net\n`
    );
    console.log('[Bootstrap] Exiting bootstrap.');
    process.exit(1);
  }

  console.log('[Bootstrap] CDP Session established successfully on threads.net.');

  // Step 3: Initialize Local Gemini Engine
  const geminiEngine = new LocalGeminiEngine({
    hostUrl: geminiHost,
  });

  // Step 4: Initialize Operator and Console
  const operator = new ThreadsOperator(browserClient, geminiEngine, {
    initialMode,
  });

  const consoleUi = new OperatorConsole(operator);
  consoleUi.startInteractiveCli();

  // Handle graceful exit
  process.on('SIGINT', async () => {
    console.log('\n[Bootstrap] Received SIGINT. Shutting down operator...');
    operator.stop();
    consoleUi.stop();
    await browserClient.disconnect();
    process.exit(0);
  });

  // Step 5: Start Autonomous Operational Loop
  await operator.start();
}

bootstrap().catch((err) => {
  console.error('[Bootstrap] Fatal startup error:', err);
  process.exit(1);
});
