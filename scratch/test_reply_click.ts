import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find((p) => p.url().includes('threads.com'));
  if (!page) {
    console.log('No threads page found');
    await browser.disconnect();
    return;
  }

  // Find visible reply buttons
  const replyBtns = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
    const list: any[] = [];
    for (const b of btns) {
      const text = (b.textContent || '').trim();
      const aria = (b.getAttribute('aria-label') || '').trim();
      const rect = b.getBoundingClientRect();
      if ((text.startsWith('Reply') || aria.startsWith('Reply')) && rect.top > 80 && rect.top < 600 && rect.width > 0) {
        list.push({
          text,
          aria,
          rect: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) }
        });
      }
    }
    return list;
  });

  console.log('Visible reply buttons:', JSON.stringify(replyBtns, null, 2));
  await browser.disconnect();
}

main().catch(console.error);
