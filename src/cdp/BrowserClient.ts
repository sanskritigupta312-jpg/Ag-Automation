/**
 * BrowserClient.ts
 * Manages Puppeteer connection via Chrome DevTools Protocol (CDP port 9222).
 * Handles visual screenshot capture, dynamic semantic DOM element extraction,
 * and raw CDP input event dispatching.
 */

import puppeteer, { Browser, Page, CDPSession } from 'puppeteer-core';
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

  /**
   * Connects to an existing Chrome instance via CDP port 9222.
   */
  public async connect(): Promise<boolean> {
    try {
      this.browser = await puppeteer.connect({
        browserURL: this.browserUrl,
        defaultViewport: null,
      });

      const pages = await this.browser.pages();
      // Look for an existing threads.net tab
      for (const p of pages) {
        const url = p.url();
        if (url.includes('threads.net')) {
          this.activePage = p;
          break;
        }
      }

      // If no threads tab found, pick the first page or open a new one
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

  /**
   * Captures viewport screenshot as Base64 JPEG.
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
   * Dynamically inspects the DOM and extracts visible, semantic candidate elements.
   * Completely avoids hardcoded CSS selectors or fixed regex.
   */
  public async extractSemanticElements(): Promise<SemanticElement[]> {
    if (!this.activePage) return [];

    try {
      const elements = await this.activePage.evaluate(() => {
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

        // Traverse visible elements in the current viewport
        const allElements = document.querySelectorAll('*');
        let counter = 1;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        allElements.forEach((el) => {
          const rect = el.getBoundingClientRect();

          // Filter out invisible, off-screen, or zero-sized elements
          if (
            rect.width < 10 ||
            rect.height < 10 ||
            rect.bottom < 0 ||
            rect.top > viewportHeight ||
            rect.right < 0 ||
            rect.left > viewportWidth
          ) {
            return;
          }

          const style = window.getComputedStyle(el);
          if (style.visibility === 'hidden' || style.display === 'none' || parseFloat(style.opacity) === 0) {
            return;
          }

          const tagName = el.tagName.toLowerCase();
          const role = el.getAttribute('role');
          const ariaLabel = el.getAttribute('aria-label');
          const placeholder = el.getAttribute('placeholder');
          const isContentEditable = el.getAttribute('contenteditable') === 'true';
          const isInput = tagName === 'input' || tagName === 'textarea' || isContentEditable;
          const isButton = tagName === 'button' || role === 'button';
          const isLink = tagName === 'a' || role === 'link';
          const isClickable = isButton || isLink || style.cursor === 'pointer' || el.hasAttribute('onclick');

          // Text content directly inside element (trimmed to 120 chars)
          const rawText = el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '';
          const textSnippet = rawText.length > 120 ? rawText.substring(0, 120) + '...' : rawText;

          // Retain elements that have semantic interaction value or meaningful text
          if (isInput || isClickable || ariaLabel || (textSnippet.length > 0 && (role || tagName.startsWith('h') || tagName === 'p' || tagName === 'span'))) {
            // Avoid duplicate parents when child has identical rect
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
        });

        // Return up to 60 most relevant candidate nodes in viewport
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
      // Micro interval between points (10ms - 22ms)
      await new Promise((r) => setTimeout(r, 12 + Math.floor(Math.random() * 10)));
    }
  }

  /**
   * Dispatches a human-timed mouse click at target coordinates.
   */
  public async dispatchMouseClick(point: Point, preClickPauseMs: number = 80): Promise<void> {
    if (!this.cdpSession) {
      if (!this.activePage) return;
      this.cdpSession = await this.activePage.createCDPSession();
    }

    // Natural pre-click gaze alignment pause
    await new Promise((r) => setTimeout(r, preClickPauseMs));

    // Mouse Down
    await this.cdpSession.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: point.x,
      y: point.y,
      button: 'left',
      clickCount: 1,
    });

    // Natural click hold duration (50ms - 110ms)
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
      await this.browser.disconnect();
      this.browser = null;
      this.activePage = null;
      this.cdpSession = null;
    }
  }
}
