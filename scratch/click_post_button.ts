import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find((p) => p.url().includes('threads.com') || p.url().includes('threads.net')) || pages[0];

  const postBtnInfo = await page.evaluate(() => {
    const list: any[] = [];
    document.querySelectorAll('*').forEach((el) => {
      const text = (el.textContent || '').trim();
      const rect = el.getBoundingClientRect();
      if ((text === 'Post' || text === 'Create') && rect.width > 0 && rect.height > 0) {
        list.push({
          tag: el.tagName,
          role: el.getAttribute('role'),
          aria: el.getAttribute('aria-label'),
          clickable: el.getAttribute('role') === 'button' || el.tagName === 'BUTTON',
          rect: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) }
        });
      }
    });
    return list;
  });

  console.log('Post buttons found on page:', JSON.stringify(postBtnInfo, null, 2));

  // Now let's click the active Post button!
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
    for (const b of btns) {
      const text = (b.textContent || '').trim();
      const rect = b.getBoundingClientRect();
      if ((text === 'Post' || text === 'Create') && rect.top > 200 && rect.width > 0) {
        (b as HTMLElement).click();
        return { text, rect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height } };
      }
    }
    return null;
  });

  console.log('Click result:', clicked);

  await browser.disconnect();
}

main().catch(console.error);
