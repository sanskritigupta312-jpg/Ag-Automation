/**
 * SessionManager.ts
 * Manages persistent session state (cookies, localStorage, session profile),
 * monitors browser runtime health, and coordinates graceful 2-hour browser reloads
 * to prevent memory exhaustion during infinite scrolling.
 */

import fs from 'fs';
import path from 'path';
import { Page, CDPSession } from 'puppeteer-core';

export interface StoredSessionState {
  savedAt: number;
  cookies: any[];
  localStorageData: Record<string, string>;
}

export class SessionManager {
  private profileDir: string;
  private stateFilePath: string;
  private sessionStartTime: number;
  private reloadIntervalMs: number;

  constructor(profileDir: string = '.chrome-session-profile', reloadIntervalHours: number = 2) {
    this.profileDir = path.resolve(process.cwd(), profileDir);
    this.stateFilePath = path.join(this.profileDir, 'session_state.json');
    this.sessionStartTime = Date.now();
    this.reloadIntervalMs = reloadIntervalHours * 60 * 60 * 1000;

    if (!fs.existsSync(this.profileDir)) {
      fs.mkdirSync(this.profileDir, { recursive: true });
    }
  }

  public getProfileDir(): string {
    return this.profileDir;
  }

  public getSessionUptimeMs(): number {
    return Date.now() - this.sessionStartTime;
  }

  /**
   * Checks whether the 2-hour runtime health reload threshold has elapsed.
   */
  public isGracefulReloadDue(): boolean {
    return this.getSessionUptimeMs() >= this.reloadIntervalMs;
  }

  public markReloadCompleted(): void {
    this.sessionStartTime = Date.now();
    console.log('[SessionManager] Runtime timer reset. Next graceful reload in 2 hours.');
  }

  /**
   * Serializes active cookies and localStorage to disk.
   */
  public async saveSessionState(page: Page, cdpSession: CDPSession): Promise<boolean> {
    try {
      // 1. Export network cookies via CDP
      const cookiesResponse = await cdpSession.send('Network.getCookies', {
        urls: ['https://www.threads.net', 'https://threads.net'],
      });

      // 2. Export localStorage from the page context
      const storageData = await page.evaluate(() => {
        const data: Record<string, string> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            data[key] = localStorage.getItem(key) || '';
          }
        }
        return data;
      });

      const sessionState: StoredSessionState = {
        savedAt: Date.now(),
        cookies: cookiesResponse.cookies || [],
        localStorageData: storageData,
      };

      fs.writeFileSync(this.stateFilePath, JSON.stringify(sessionState, null, 2), 'utf-8');
      console.log(`[SessionManager] Session state preserved to ${this.stateFilePath} (${sessionState.cookies.length} cookies).`);
      return true;
    } catch (err) {
      console.warn(`[SessionManager] Error preserving session state: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Restores stored cookies and localStorage into active browser instance.
   */
  public async restoreSessionState(page: Page, cdpSession: CDPSession): Promise<boolean> {
    if (!fs.existsSync(this.stateFilePath)) {
      return false;
    }

    try {
      const raw = fs.readFileSync(this.stateFilePath, 'utf-8');
      const state: StoredSessionState = JSON.parse(raw);

      // Restore cookies
      if (state.cookies && state.cookies.length > 0) {
        await cdpSession.send('Network.setCookies', {
          cookies: state.cookies,
        });
      }

      // Restore localStorage
      if (state.localStorageData && Object.keys(state.localStorageData).length > 0) {
        await page.evaluate((data) => {
          for (const [k, v] of Object.entries(data)) {
            localStorage.setItem(k, v);
          }
        }, state.localStorageData);
      }

      console.log(`[SessionManager] Successfully restored session state from ${this.stateFilePath}.`);
      return true;
    } catch (err) {
      console.warn(`[SessionManager] Error restoring session state: ${(err as Error).message}`);
      return false;
    }
  }
}
