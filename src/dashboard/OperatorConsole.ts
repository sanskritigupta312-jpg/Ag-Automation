/**
 * OperatorConsole.ts
 * Provides an interactive terminal command interface for the human operator
 * to monitor live telemetry, toggle modes, pause/resume, and direct targets.
 */

import readline from 'readline';
import { ThreadsOperator } from '../agent/ThreadsOperator.js';

export class OperatorConsole {
  private operator: ThreadsOperator;
  private rl: readline.Interface | null = null;

  constructor(operator: ThreadsOperator) {
    this.operator = operator;
  }

  public startInteractiveCli(): void {
    // Only attach interactive readline if stdin is readable and not closed
    if (process.stdin.isTTY || process.stdin.readable) {
      try {
        this.rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
          terminal: false,
        });

        this.rl.on('error', () => {
          // Gracefully ignore stdin pipe errors in headless / daemon mode
        });
      } catch {
        this.rl = null;
      }
    }

    console.log('\n======================================================');
    console.log('       ANTIGRAVITY AUTONOMOUS OPERATOR CONSOLE        ');
    console.log(' Commands:                                            ');
    console.log('   pause               - Pause automated actions      ');
    console.log('   resume              - Resume operations            ');
    console.log('   mode feed           - Switch to Feed Discovery     ');
    console.log('   mode dm             - Switch to DM / Inbox Reply   ');
    console.log('   target @username    - Focus on specific profile    ');
    console.log('   status              - Display session telemetry    ');
    console.log('   exit                - Safely stop operator         ');
    console.log('======================================================\n');

    this.rl.on('line', async (line: string) => {
      const trimmed = line.trim();
      const parts = trimmed.split(/\s+/);
      const cmd = parts[0]?.toLowerCase();

      switch (cmd) {
        case 'pause':
          this.operator.pause();
          console.log('[Console] Operator paused.');
          break;

        case 'resume':
          this.operator.resume();
          console.log('[Console] Operator resumed.');
          break;

        case 'mode':
          const modeArg = parts[1]?.toUpperCase();
          if (modeArg === 'FEED' || modeArg === 'DM' || modeArg === 'PROFILE') {
            this.operator.setMode(modeArg);
            console.log(`[Console] Switched mode to: ${modeArg}`);
          } else {
            console.log('[Console] Invalid mode. Choose from: FEED, DM, PROFILE');
          }
          break;

        case 'target':
          const handle = parts[1];
          if (handle) {
            await this.operator.targetProfile(handle);
            console.log(`[Console] Now targeting profile: ${handle}`);
          } else {
            console.log('[Console] Usage: target @username');
          }
          break;

        case 'status':
          const status = this.operator.getStatus();
          console.log('\n--- OPERATOR TELEMETRY ---');
          console.log(`Status: ${status.isPaused ? 'PAUSED' : status.isRunning ? 'RUNNING' : 'STOPPED'}`);
          console.log(`Current Mode: ${status.currentMode}`);
          console.log(`Target Handle: ${status.targetUsername || 'None'}`);
          console.log(`Total Interactions: ${status.stats.totalInteractions}`);
          console.log(`Comments Posted: ${status.stats.totalComments}`);
          console.log(`DMs Replied: ${status.stats.totalDMs}`);
          console.log(`Scrolls Performed: ${status.stats.totalScrolls}`);
          console.log(`Circadian Multiplier: ${status.circadianFactor}x`);
          console.log('--------------------------\n');
          break;

        case 'exit':
        case 'quit':
          console.log('[Console] Shutting down operator gracefully...');
          this.operator.stop();
          this.rl?.close();
          process.exit(0);
          break;

        default:
          if (trimmed.length > 0) {
            console.log(`[Console] Unknown command: "${trimmed}". Type "status" or "help".`);
          }
          break;
      }
    });
  }

  public stop(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }
}
