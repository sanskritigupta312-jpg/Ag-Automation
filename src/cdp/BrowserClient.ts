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
            '--disable-blink-features=AutomationControlled',
          ],
        });
      }

      const pages = await this.browser.pages();
      for (const p of pages) {
        const url = p.url();
        if (url.includes('threads.net')) {
          this.activePage = p;
          break;
        }
      }

      if (!this.activePage) {
        if (pages.length > 0 && pages[0].url() === 'about:blank') {
          this.activePage = pages[0];
        } else {
          this.activePage = await this.browser.newPage();
        }
        await this.activePage.goto('https://www.threads.net', {
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
    return this.browser !== null && this.activePage !== null;
  }

  public getActivePage(): Page | null {
    return this.activePage;
  }

  public getCdpSession(): CDPSession | null {
    return this.cdpSession;
  }

  /**
   * Captures viewport screenshot as Base64 JPEG for visual processing.
   */
  public async captureScreenshot(): Promise<string> {
    if (!this.activePage) {
      throw new Error('Active page is not available');
    }
    const buffer = await this.activePage.screenshot({
      type: 'jpeg',
      quality: 80,
      encoding: 'base64',
    });
    return buffer as string;
  }

  /**
   * Extracts visible semantic interactive elements dynamically.
   * Completely avoids dynamic hashed CSS classes (e.g. `_a9--`).
   * Recursively traverses open Shadow DOM roots for full platform resilience.
   */
  public async extractSemanticElements(): Promise<SemanticElement[]> {
    if (!this.activePage) return [];

    try {
      const elements = await this.activePage.evaluate(() => {
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
                  const ariaLabel = el.getAttribute('aria-label');
                  const placeholder = el.getAttribute('placeholder');
                  const isContentEditable = el.getAttribute('contenteditable') === 'true';
                  const isInput = tagName === 'input' || tagName === 'textarea' || isContentEditable;
                  const isButton = tagName === 'button' || role === 'button';
                  const isLink = tagName === 'a' || role === 'link';
                  const isClickable = isButton || isLink || style.cursor === 'pointer' || el.hasAttribute('onclick');

                  const rawText = el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '';
                  const textSnippet = rawText.length > 120 ? rawText.substring(0, 120) + '...' : rawText;

                  if (
                    isInput ||
                    isClickable ||
                    ariaLabel ||
                    (textSnippet.length > 0 && (role || tagName.startsWith('h') || tagName === 'p' || tagName === 'span'))
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
        return results.slice(0, 60);
      });

      return elements;
    } catch (err) {
      console.warn(`[BrowserClient] Error extracting semantic elements: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Dispatches Bézier mouse movements across a trajectory of points via CDP.
   */
  public async dispatchMouseMoveTrajectory(points: Point[]): Promise<void> {
    if (!this.cdpSession) {
      if (!this.activePage) return;
      this.cdpSession = await this.activePage.createCDPSession();
    }

    for (const pt of points) {
      await this.cdpSession.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: pt.x,
        y: pt.y,
      });
      await new Promise((r) => setTimeout(r, 12 + Math.floor(Math.random() * 10)));
    }
  }

  /**
   * Dispatches a human-timed mouse click at target coordinates with natural
   * sight-alignment pause (350ms to 1400ms) prior to dispatching click.
   */
  public async dispatchMouseClick(point: Point, preClickSightPauseMs?: number): Promise<void> {
    if (!this.cdpSession) {
      if (!this.activePage) return;
      this.cdpSession = await this.activePage.createCDPSession();
    }

    // Natural sight-alignment pause (350ms to 1400ms)
    const pauseDuration = preClickSightPauseMs ?? Math.floor(350 + Math.random() * 1050);
    await new Promise((r) => setTimeout(r, pauseDuration));

    // Mouse Down
    await this.cdpSession.send('Input.dispatchMouseEvent', {
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
    await this.cdpSession.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: point.x,
      y: point.y,
      button: 'left',
      clickCount: 1,
    });
  }

  /**
   * Types humanized keystrokes using CDP Input.dispatchKeyEvent.
   */
  public async dispatchKeystrokeActions(actions: KeystrokeAction[]): Promise<void> {
    if (!this.cdpSession) {
      if (!this.activePage) return;
      this.cdpSession = await this.activePage.createCDPSession();
    }

    for (const action of actions) {
      if (action.type === 'pause') {
        await new Promise((r) => setTimeout(r, action.delayMs));
      } else if (action.type === 'backspace') {
        await this.cdpSession.send('Input.dispatchKeyEvent', {
          type: 'rawKeyDown',
          windowsVirtualKeyCode: 8,
          code: 'Backspace',
          key: 'Backspace',
        });
        await new Promise((r) => setTimeout(r, 30 + Math.floor(Math.random() * 20)));
        await this.cdpSession.send('Input.dispatchKeyEvent', {
          type: 'keyUp',
          windowsVirtualKeyCode: 8,
          code: 'Backspace',
          key: 'Backspace',
        });
        await new Promise((r) => setTimeout(r, action.delayMs));
      } else if (action.type === 'type' && action.char) {
        await this.cdpSession.send('Input.dispatchKeyEvent', {
          type: 'keyDown',
          text: action.char,
          unmodifiedText: action.char,
          key: action.char,
        });
        await new Promise((r) => setTimeout(r, 20 + Math.floor(Math.random() * 20)));
        await this.cdpSession.send('Input.dispatchKeyEvent', {
          type: 'keyUp',
          key: action.char,
        });
        await new Promise((r) => setTimeout(r, action.delayMs));
      }
    }
  }

  /**
   * Smoothly scrolls the viewport using organic micro-scroll wheel steps.
   */
  public async dispatchSmoothScroll(distanceY: number, steps: number = 8): Promise<void> {
    if (!this.cdpSession) {
      if (!this.activePage) return;
      this.cdpSession = await this.activePage.createCDPSession();
    }

    const stepDelta = distanceY / steps;
    for (let i = 0; i < steps; i++) {
      const jitter = (Math.random() - 0.5) * 4;
      await this.cdpSession.send('Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x: 400 + Math.floor((Math.random() - 0.5) * 50),
        y: 350 + Math.floor((Math.random() - 0.5) * 50),
        deltaX: 0,
        deltaY: stepDelta + jitter,
      });
      await new Promise((r) => setTimeout(r, 35 + Math.floor(Math.random() * 30)));
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
