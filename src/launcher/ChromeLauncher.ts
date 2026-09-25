/**
 * ChromeLauncher.ts
 * Auto-detects Google Chrome on Windows and launches an instance with
 * Chrome DevTools Protocol enabled (--remote-debugging-port=9222).
 */

import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

export class ChromeLauncher {
  private static readonly CHROME_PATHS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  ];

  /**
   * Finds the valid Chrome executable path on the machine.
   */
  public static findChromePath(): string | null {
    for (const p of this.CHROME_PATHS) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    return null;
  }

  /**
   * Checks if the CDP endpoint (http://127.0.0.1:9222/json/version) is alive.
   */
  public static async isCdpActive(port: number = 9222): Promise<boolean> {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(1500),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Ensures Chrome is running with CDP enabled. If not, spawns it.
   */
  public static async ensureChromeWithCdp(port: number = 9222): Promise<boolean> {
    const alreadyRunning = await this.isCdpActive(port);
    if (alreadyRunning) {
      console.log(`[ChromeLauncher] Chrome CDP is already active on port ${port}.`);
      return true;
    }

    const chromePath = this.findChromePath();
    if (!chromePath) {
      console.error('[ChromeLauncher] Chrome executable was not found on this system.');
      return false;
    }

    const userDataDir = path.resolve(process.cwd(), '.chrome-session-profile');
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }

    console.log(`[ChromeLauncher] Launching Chrome from: ${chromePath}`);
    console.log(`[ChromeLauncher] Profile directory: ${userDataDir}`);

    const args = [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      'https://www.threads.com',
    ];

    if (process.platform === 'win32') {
      const { exec } = await import('child_process');
      const startCmd = `cmd.exe /c start "" "${chromePath}" ${args.join(' ')}`;
      exec(startCmd);
    } else {
      const child: ChildProcess = spawn(chromePath, args, {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    }

    // Poll until port 9222 responds (up to 15 seconds)
    const startTime = Date.now();
    while (Date.now() - startTime < 15000) {
      await new Promise((r) => setTimeout(r, 800));
      if (await this.isCdpActive(port)) {
        console.log(`[ChromeLauncher] Successfully connected to Chrome CDP on port ${port}.`);
        return true;
      }
    }

    console.warn(`[ChromeLauncher] Chrome launched, but port ${port} did not answer within 15s.`);
    return false;
  }
}

// Allow running directly via CLI
if (process.argv[1] && process.argv[1].endsWith('ChromeLauncher.ts')) {
  ChromeLauncher.ensureChromeWithCdp().then((success) => {
    console.log(`Chrome Launcher finished with status: ${success}`);
  });
}
