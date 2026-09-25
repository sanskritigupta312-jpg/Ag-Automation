/**
 * BrowserClient.ts
 * Manages Puppeteer connection via Chrome DevTools Protocol (CDP port 9222).
 * Implements visual fallback, recursive Shadow DOM extraction,
 * natural sight-alignment pauses (350ms-1400ms), and raw CDP input event dispatching.
 */

import path from 'path';
import puppeteer, { Browser, Page, CDPSession } from 'puppeteer-core';
import { ChromeLauncher } from '../launcher/ChromeLauncher.js';
import { Point, BoundingBox } from '../humanizer/CursorPhysics.js';
import { KeystrokeAction } from '../humanizer/KeystrokeSynthesizer.js';

export interface SemanticElement {
  id: number;
  tagName: string;
  role: string | null;
  ariaLabel: string | null;
  placeholder: string | null;
  textSnippet: string;
  isEditable: boolean;
  isClickable: boolean;
  boundingBox: BoundingBox;
}

export class BrowserClient {
  private browserUrl: string;
  private browser: Browser | null = null;
  private activePage: Page | null = null;
  private cdpSession: CDPSession | null = null;

  constructor(browserUrl: string = 'http://127.0.0.1:9222') {
    this.browserUrl = browserUrl;
  }

  public async connect(): Promise<boolean> {
    try {
      try {
        this.browser = await puppeteer.connect({
          browserURL: this.browserUrl,
          defaultViewport: null,
        });
      } catch {
        console.log(`[BrowserClient] Direct CDP attach failed; launching Chrome instance directly...`);
        const chromePath = ChromeLauncher.findChromePath();
        const userDataDir = path.resolve(process.cwd(), '.chrome-session-profile');
        this.browser = await puppeteer.launch({
          executablePath: chromePath || undefined,
          headless: false,
          userDataDir,
          defaultViewport: null,
          args: [
            '--remote-debugging-port=9222',
            '--no-first-run',
            '--no-default-browser-check',
          ],
        });
      }

      const pages = await this.browser.pages();
      for (const p of pages) {
        const url = p.url().toLowerCase();
        let title = '';
        try {
          title = (await p.title()).toLowerCase();
        } catch {}

        // Exclude dashboard and other non-threads tabs
        if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('instagram.com')) {
          continue;
        }

        if (url.includes('threads.net') || url.includes('threads.com')) {
          this.activePage = p;
          console.log(`[BrowserClient] Bound to active Threads tab: ${url} ("${title}")`);
          break;
        }
      }

      if (!this.activePage) {
        console.log(`[BrowserClient] No active Threads tab found. Navigating to https://www.threads.com...`);
        this.activePage = await this.browser.newPage();
        await this.activePage.goto('https://www.threads.com', {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        });
      }

      await this.activePage.bringToFront();
      this.cdpSession = await this.activePage.createCDPSession();
      return true;
    } catch (error) {
      console.warn(`[BrowserClient] Could not connect to CDP at ${this.browserUrl}: ${(error as Error).message}`);
      return false;
    }
  }

  public isConnected(): boolean {
    const isBrowserConnected = this.browser ? ((this.browser as any).connected ?? true) : false;
    return isBrowserConnected && this.activePage !== null && !this.activePage.isClosed();
  }

  public getActivePage(): Page | null {
    return this.activePage;
  }

  public getCdpSession(): CDPSession | null {
    return this.cdpSession;
  }

  /**
   * Ensures the active Threads page is connected, responsive, and ready for operations.
   * Auto-recovers from session disconnects, tab switches, and crashes.
   */
  public async ensureActivePage(): Promise<Page> {
    // 1. If we have an activePage, verify it's not closed and still responsive
    if (this.activePage && !this.activePage.isClosed()) {
      try {
        await this.activePage.evaluate(() => 1);
        return this.activePage;
      } catch {
        console.warn('[BrowserClient] Active page unresponsive or session detached. Recovering...');
        this.activePage = null;
        this.cdpSession = null;
      }
    }

    // 2. Ensure browser itself is connected
    const isBrowserConnected = this.browser ? ((this.browser as any).connected ?? true) : false;
    if (!isBrowserConnected) {
      console.log('[BrowserClient] Browser disconnected. Reconnecting to CDP...');
      const ok = await this.connect();
      if (ok && this.activePage) return this.activePage;
    }

    if (!this.browser) {
      throw new Error('Chrome browser instance is unavailable');
    }

    // 3. Scan open browser pages for any Threads tab
    try {
      const pages = await this.browser.pages();
      for (const p of pages) {
        if (p.isClosed()) continue;
        const url = p.url().toLowerCase();
        if (url.includes('localhost') || url.includes('127.0.0.1')) continue;

        if (url.includes('threads.net') || url.includes('threads.com')) {
          this.activePage = p;
          try {
            await this.activePage.bringToFront();
            this.cdpSession = await this.activePage.createCDPSession();
            console.log(`[BrowserClient] Successfully recovered active Threads tab: ${url}`);
            return this.activePage;
          } catch (err) {
            console.warn('[BrowserClient] Could not attach CDPSession to Threads tab:', (err as Error).message);
          }
        }
      }
    } catch (err) {
      console.warn('[BrowserClient] Error scanning browser pages:', (err as Error).message);
    }

    // 4. If no Threads page exists, open a fresh one
    console.log('[BrowserClient] No open Threads tab found. Opening https://www.threads.com...');
    this.activePage = await this.browser.newPage();
    await this.activePage.goto('https://www.threads.com', {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await this.activePage.bringToFront();
    this.cdpSession = await this.activePage.createCDPSession();
    return this.activePage;
  }

  public async ensureCdpSession(): Promise<CDPSession> {
    const page = await this.ensureActivePage();
    if (!this.cdpSession) {
      this.cdpSession = await page.createCDPSession();
    }
    return this.cdpSession;
  }

  /**
   * Captures viewport screenshot as Base64 JPEG for visual processing.
   * Auto-retries with session recovery if target was disconnected.
   */
  public async captureScreenshot(): Promise<string> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const page = await this.ensureActivePage();
        const buffer = await page.screenshot({
          type: 'jpeg',
          quality: 80,
          encoding: 'base64',
        });
        return buffer as string;
      } catch (err) {
        console.warn(`[BrowserClient] Screenshot attempt ${attempt + 1} failed: ${(err as Error).message}`);
        this.activePage = null;
        this.cdpSession = null;
        if (attempt === 1) throw err;
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    throw new Error('Screenshot capture failed after retry');
  }

  /**
   * Extracts visible semantic interactive elements dynamically.
   * Completely avoids dynamic hashed CSS classes (e.g. `_a9--`).
   * Recursively traverses open Shadow DOM roots for full platform resilience.
   */
  public async extractSemanticElements(): Promise<SemanticElement[]> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const page = await this.ensureActivePage();
        const elements = await page.evaluate(() => {
          // Esbuild / tsx helper compatibility
          (window as any).__name = (window as any).__name || ((fn: any) => fn);

          const results: Array<{
            id: number;
            tagName: string;
            role: string | null;
            ariaLabel: string | null;
            placeholder: string | null;
            textSnippet: string;
            isEditable: boolean;
            isClickable: boolean;
            boundingBox: { x: number; y: number; width: number; height: number };
          }> = [];

          let counter = 1;
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;

          // Recursive tree traversal including Shadow DOM roots
          function collectNodes(root: Node | ShadowRoot) {
            const children = root.childNodes;
            for (let i = 0; i < children.length; i++) {
              const node = children[i];
              if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;

                // Inspect shadow root if attached
                if (el.shadowRoot) {
                  collectNodes(el.shadowRoot);
                }

                const rect = el.getBoundingClientRect();

                // Filter out off-screen, zero-sized, or hidden elements
                if (
                  rect.width >= 10 &&
                  rect.height >= 10 &&
                  rect.bottom > 0 &&
                  rect.top < viewportHeight &&
                  rect.right > 0 &&
                  rect.left < viewportWidth
                ) {
                  const style = window.getComputedStyle(el);
                  if (
                    style.visibility !== 'hidden' &&
                    style.display !== 'none' &&
                    parseFloat(style.opacity) > 0
                  ) {
                    const tagName = el.tagName.toLowerCase();
                    const role = el.getAttribute('role');
                    const ariaLabel =
                      el.getAttribute('aria-label') ||
                      el.querySelector('[aria-label]')?.getAttribute('aria-label') ||
                      null;
                    const placeholder = el.getAttribute('placeholder');
                    const isContentEditable = el.getAttribute('contenteditable') === 'true';
                    const isInput =
                      tagName === 'input' ||
                      tagName === 'textarea' ||
                      isContentEditable ||
                      role === 'textbox';
                    const isButton = tagName === 'button' || role === 'button';
                    const isLink = tagName === 'a' || role === 'link';
                    const isClickable =
                      isButton || isLink || style.cursor === 'pointer' || el.hasAttribute('onclick');

                    const rawText = el.textContent
                      ? el.textContent
                          .split('\n')
                          .join(' ')
                          .split('\t')
                          .join(' ')
                          .split(' ')
                          .filter(Boolean)
                          .join(' ')
                          .trim()
                      : '';
                    const textSnippet =
                      rawText.length > 120 ? rawText.substring(0, 120) + '...' : rawText;

                    if (
                      isInput ||
                      isClickable ||
                      ariaLabel ||
                      (textSnippet.length > 0 &&
                        (role || tagName.startsWith('h') || tagName === 'p' || tagName === 'span'))
                    ) {
                      results.push({
                        id: counter++,
                        tagName,
                        role,
                        ariaLabel,
                        placeholder,
                        textSnippet,
                        isEditable: isInput,
                        isClickable,
                        boundingBox: {
                          x: Math.round(rect.left),
                          y: Math.round(rect.top),
                          width: Math.round(rect.width),
                          height: Math.round(rect.height),
                        },
                      });
                    }
                  }
                }

                // Recurse light DOM children
                if (el.childNodes.length > 0) {
                  collectNodes(el);
                }
              }
            }
          }

          collectNodes(document.body);
          return results.slice(0, 150);
        });

        return elements;
      } catch (err) {
        console.warn(
          `[BrowserClient] extractSemanticElements attempt ${attempt + 1} failed: ${(err as Error).message}`
        );
        this.activePage = null;
        this.cdpSession = null;
        if (attempt === 1) return [];
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    return [];
  }

  /**
   * Dispatches Bézier mouse movements across a trajectory of points via CDP.
   */
  public async dispatchMouseMoveTrajectory(points: Point[]): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const cdp = await this.ensureCdpSession();
        for (const pt of points) {
          await cdp.send('Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            x: pt.x,
            y: pt.y,
          });
          await new Promise((r) => setTimeout(r, 12 + Math.floor(Math.random() * 10)));
        }
        return;
      } catch (err) {
        console.warn(`[BrowserClient] MouseMove error: ${(err as Error).message}. Retrying...`);
        this.cdpSession = null;
        this.activePage = null;
        if (attempt === 1) throw err;
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }

  /**
   * Dispatches a human-timed mouse click at target coordinates with natural
   * sight-alignment pause (350ms to 1400ms) prior to dispatching click.
   */
  public async dispatchMouseClick(point: Point, preClickSightPauseMs?: number): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const cdp = await this.ensureCdpSession();

        // Natural sight-alignment pause (350ms to 1400ms)
        const pauseDuration = preClickSightPauseMs ?? Math.floor(350 + Math.random() * 1050);
        await new Promise((r) => setTimeout(r, pauseDuration));

        // Mouse Down
        await cdp.send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: point.x,
          y: point.y,
          button: 'left',
          clickCount: 1,
        });

        // Hold duration (50ms - 110ms)
        const holdDuration = 50 + Math.floor(Math.random() * 60);
        await new Promise((r) => setTimeout(r, holdDuration));

        // Mouse Up
        await cdp.send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: point.x,
          y: point.y,
          button: 'left',
          clickCount: 1,
        });
        return;
      } catch (err) {
        console.warn(`[BrowserClient] MouseClick error: ${(err as Error).message}. Retrying...`);
        this.cdpSession = null;
        this.activePage = null;
        if (attempt === 1) throw err;
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }

  /**
   * Types humanized keystrokes using CDP Input.dispatchKeyEvent.
   */
  public async dispatchKeystrokeActions(actions: KeystrokeAction[]): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const cdp = await this.ensureCdpSession();

        for (const action of actions) {
          if (action.type === 'pause') {
            await new Promise((r) => setTimeout(r, action.delayMs));
          } else if (action.type === 'backspace') {
            await cdp.send('Input.dispatchKeyEvent', {
              type: 'rawKeyDown',
              windowsVirtualKeyCode: 8,
              code: 'Backspace',
              key: 'Backspace',
            });
            await new Promise((r) => setTimeout(r, 30 + Math.floor(Math.random() * 20)));
            await cdp.send('Input.dispatchKeyEvent', {
              type: 'keyUp',
              windowsVirtualKeyCode: 8,
              code: 'Backspace',
              key: 'Backspace',
            });
            await new Promise((r) => setTimeout(r, action.delayMs));
          } else if (action.type === 'type' && action.char) {
            await cdp.send('Input.insertText', { text: action.char });
            await new Promise((r) => setTimeout(r, action.delayMs));
          }
        }
        return;
      } catch (err) {
        console.warn(`[BrowserClient] Keystroke error: ${(err as Error).message}. Retrying...`);
        this.cdpSession = null;
        this.activePage = null;
        if (attempt === 1) throw err;
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }

  /**
   * Smoothly scrolls the viewport using organic micro-scroll wheel steps.
   */
  public async dispatchSmoothScroll(distanceY: number, steps: number = 8): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const cdp = await this.ensureCdpSession();
        const stepDelta = distanceY / steps;
        for (let i = 0; i < steps; i++) {
          const jitter = (Math.random() - 0.5) * 4;
          await cdp.send('Input.dispatchMouseEvent', {
            type: 'mouseWheel',
            x: 400 + Math.floor((Math.random() - 0.5) * 50),
            y: 350 + Math.floor((Math.random() - 0.5) * 50),
            deltaX: 0,
            deltaY: stepDelta + jitter,
          });
          await new Promise((r) => setTimeout(r, 35 + Math.floor(Math.random() * 30)));
        }
        return;
      } catch (err) {
        console.warn(`[BrowserClient] SmoothScroll error: ${(err as Error).message}. Retrying...`);
        this.cdpSession = null;
        this.activePage = null;
        if (attempt === 1) throw err;
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }

  /**
   * Navigates the active page to a given URL.
   * Automatically normalizes to threads.com to avoid redirect loops.
   */
  public async navigateTo(url: string): Promise<void> {
    const normalizedUrl = url.replace('threads.net', 'threads.com');
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const page = await this.ensureActivePage();
        await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        return;
      } catch (err) {
        console.warn(`[BrowserClient] navigateTo(${normalizedUrl}) attempt ${attempt + 1} failed: ${(err as Error).message}`);
        this.activePage = null;
        this.cdpSession = null;
        if (attempt === 1) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  /**
   * Navigates back using browser history (like pressing the Back button).
   */
  public async navigateBack(): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const page = await this.ensureActivePage();
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 20000 });
        return;
      } catch (err) {
        console.warn(`[BrowserClient] navigateBack() attempt ${attempt + 1} failed: ${(err as Error).message}`);
        this.activePage = null;
        this.cdpSession = null;
        if (attempt === 1) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.disconnect();
      } catch {}
      this.browser = null;
      this.activePage = null;
      this.cdpSession = null;
    }
  }
}
