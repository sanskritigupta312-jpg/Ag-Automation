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

  // Click Reply button
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

  // Focus the textbox
  await page.evaluate(() => {
    const tb = document.querySelector('div[role="textbox"][contenteditable="true"]');
    if (tb) (tb as HTMLElement).focus();
  });

  // Type test text
  await page.keyboard.type('Great work! Keep it up 🚀', { delay: 40 });
  await new Promise((r) => setTimeout(r, 1000));

  // Inspect the exact submit button right next to or below the composer
  const submitButton = await page.evaluate(() => {
    const tb = document.querySelector('div[role="textbox"][contenteditable="true"]');
    if (!tb) return null;
    const tbRect = tb.getBoundingClientRect();

    // The submit button is near the textbox (same vertical region, or right below it)
    const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
    for (const b of btns) {
      const t = (b.textContent || '').trim();
      const rect = b.getBoundingClientRect();
      if ((t === 'Post' || t === 'Reply') && rect.top >= tbRect.top - 20 && rect.top <= tbRect.bottom + 60 && rect.width > 0) {
        return {
          text: t,
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
          rect: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) }
        };
      }
    }
    return null;
  });

  console.log('Target submit button near composer:', submitButton);

  // Clean up: delete text and close
  for (let i = 0; i < 35; i++) {
    await page.keyboard.press('Backspace');
  }
  await page.keyboard.press('Escape');
  await browser.disconnect();
}

main().catch(console.error);
