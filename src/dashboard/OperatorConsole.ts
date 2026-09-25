/**
 * OperatorConsole.ts
 * Terminal CLI fallback for operators who prefer console control.
 * The primary UI is now the web dashboard at http://localhost:3000.
 * This console remains for advanced/headless use.
 */

import readline from 'readline';

// Accept any object with the needed methods (flexible interface)
interface OperatorLike {
  pause(): void;
  resume(): void;
  stop(): void;
  setMode(mode: any): void;
  targetProfile(username: string): Promise<void>;
  getTelemetry(): any;
}

export class OperatorConsole {
  private operator: OperatorLike;
  private rl: readline.Interface | null = null;

  constructor(operator: OperatorLike) {
    this.operator = operator;
  }

  public startInteractiveCli(): void {
    if (process.stdin.isTTY || process.stdin.readable) {
      try {
        this.rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
          terminal: false,
        });
        this.rl.on('error', () => { /* Ignore pipe errors in daemon mode */ });
      } catch {
        this.rl = null;
      }
    }

    if (!this.rl) return;

    console.log('\n══════════════════════════════════════════════════');
    console.log('   ANTIGRAVITY TERMINAL CONSOLE (CLI Fallback)    ');
    console.log('   Primary UI: http://localhost:3000              ');
    console.log(' Commands:                                        ');
    console.log('   pause               - Pause automation        ');
    console.log('   resume              - Resume automation       ');
    console.log('   mode feed/dm/notify - Switch mode             ');
    console.log('   target @username    - Focus on profile        ');
    console.log('   status              - Show telemetry          ');
    console.log('   exit                - Stop and exit           ');
    console.log('══════════════════════════════════════════════════\n');

    this.rl.on('line', async (line: string) => {
      const parts = line.trim().split(/\s+/);
      const cmd = parts[0]?.toLowerCase();

      switch (cmd) {
        case 'pause':
          this.operator.pause();
          console.log('[Console] Paused.');
          break;
        case 'resume':
          this.operator.resume();
          console.log('[Console] Resumed.');
          break;
        case 'mode': {
          const m = parts[1]?.toUpperCase();
          if (m === 'FEED' || m === 'DM' || m === 'PROFILE' || m === 'NOTIFICATIONS') {
            this.operator.setMode(m);
            console.log(`[Console] Mode → ${m}`);
          } else {
            console.log('[Console] Usage: mode feed | dm | notifications | profile');
          }
          break;
        }
        case 'target': {
          const handle = parts[1];
          if (handle) {
            await this.operator.targetProfile(handle);
            console.log(`[Console] Targeting: ${handle}`);
          }
          break;
        }
        case 'status': {
          const t = this.operator.getTelemetry();
          console.log('\n── TELEMETRY ─────────────────────────');
          console.log(`  Status:         ${t.isPaused ? 'PAUSED' : t.isRunning ? 'RUNNING' : 'STOPPED'}`);
          console.log(`  Mode:           ${t.currentMode}`);
          console.log(`  Cycle Count:    ${t.cycleCount}`);
          console.log(`  Comments:       ${t.stats?.totalComments}`);
          console.log(`  DMs:            ${t.stats?.totalDMs}`);
          console.log(`  Scrolls:        ${t.stats?.totalScrolls}`);
          console.log(`  Uptime:         ${t.uptimeMinutes} min`);
          console.log('──────────────────────────────────────\n');
          break;
        }
        case 'exit':
        case 'quit':
          console.log('[Console] Shutting down...');
          this.operator.stop();
          this.rl?.close();
          process.exit(0);
          break;
        default:
          if (line.trim().length > 0) {
            console.log(`[Console] Unknown: "${line.trim()}". Type "status" for help.`);
          }
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
