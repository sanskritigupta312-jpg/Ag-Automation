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

  // Find the reply button and click it
  const replyButton = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
    for (const b of btns) {
      const text = (b.textContent || '').trim();
      const rect = b.getBoundingClientRect();
      if (text.startsWith('Reply') && rect.top > 50 && rect.top < window.innerHeight && rect.width > 0) {
        return {
          text,
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
        };
      }
    }
    return null;
  });

  if (!replyButton) {
    console.log('No reply button found');
    await browser.disconnect();
    return;
  }

  await page.mouse.click(replyButton.x, replyButton.y);
  await new Promise((r) => setTimeout(r, 1500));

  // Focus and type into the textbox
  await page.evaluate(() => {
    const tb = document.querySelector('div[role="textbox"][contenteditable="true"]');
    if (tb) {
      (tb as HTMLElement).focus();
    }
  });

  // Type some test text
  await page.keyboard.type('Test typing verification', { delay: 40 });
  await new Promise((r) => setTimeout(r, 1000));

  const buttonsState = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('div[role="button"], button')).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        text: (el.textContent || '').trim(),
        aria: el.getAttribute('aria-label') || '',
        disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
        rect: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        },
      };
    }).filter((b) => b.text.includes('Post') || b.text.includes('Reply') || b.aria.includes('Post') || b.aria.includes('Reply'));
  });

  console.log('Post buttons after typing:', JSON.stringify(buttonsState, null, 2));

  // Clear text and press Escape to close composer
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Backspace');
  }
  await page.keyboard.press('Escape');
  await browser.disconnect();
}

main().catch(console.error);
