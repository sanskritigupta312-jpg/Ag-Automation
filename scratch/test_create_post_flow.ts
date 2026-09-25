import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find((p) => p.url().includes('threads.com'));
  if (!page) {
    console.log('No threads page');
    await browser.disconnect();
    return;
  }

  // 1. Click "New thread" button on the left bar or top
  const newThreadClicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
    for (const b of btns) {
      const text = (b.textContent || '').trim();
      const aria = (b.getAttribute('aria-label') || '').trim();
      if (text === 'New thread' || aria.toLowerCase().includes('new thread')) {
        const rect = b.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          (b as HTMLElement).click();
          return { text, aria, x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
        }
      }
    }
    return null;
  });

  console.log('New thread button clicked:', newThreadClicked);
  await new Promise((r) => setTimeout(r, 1500));

  // 2. Check what opened (composer dialog / textbox)
  const composerState = await page.evaluate(() => {
    const textboxes = Array.from(document.querySelectorAll('div[role="textbox"][contenteditable="true"]')).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        aria: el.getAttribute('aria-label'),
        rect: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        }
      };
    });

    const postButtons = Array.from(document.querySelectorAll('div[role="button"], button'))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          text: (el.textContent || '').trim(),
          aria: el.getAttribute('aria-label') || '',
          disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
          rect: {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          }
        };
      })
      .filter((b) => (b.text === 'Post' || b.aria === 'Post') && b.rect.w > 0);

    return {
      textboxes,
      postButtons,
    };
  });

  console.log('Composer state after clicking New thread:', JSON.stringify(composerState, null, 2));

  // Press Escape to dismiss
  await page.keyboard.press('Escape');
  await browser.disconnect();
}

main().catch(console.error);
