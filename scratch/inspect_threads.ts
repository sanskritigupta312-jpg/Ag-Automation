import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find((p) => p.url().includes('threads')) || pages[0];
  console.log('Active Page URL:', page.url());
  console.log('Active Page Title:', await page.title());

  // Search for Reply buttons, posts, and compose triggers
  const replyElements = await page.evaluate(() => {
    const list: Array<{ tag: string; aria: string | null; role: string | null; text: string; x: number; y: number }> = [];
    document.querySelectorAll('*').forEach((el) => {
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      const text = (el.textContent || '').trim().slice(0, 60);
      const rect = el.getBoundingClientRect();
      if (
        (aria.includes('reply') ||
         aria.includes('post') ||
         aria.includes('what\'s new') ||
         aria.includes('compose') ||
         text.toLowerCase().includes('reply') ||
         text.toLowerCase().includes('what\'s new')) &&
        rect.width > 0 && rect.height > 0
      ) {
        list.push({
          tag: el.tagName.toLowerCase(),
          aria: el.getAttribute('aria-label'),
          role: el.getAttribute('role'),
          text,
          x: Math.round(rect.left),
          y: Math.round(rect.top),
        });
      }
    });
    return list;
  });

  console.log('Reply/Post/Composer triggers found:');
  console.log(JSON.stringify(replyElements, null, 2));

  await browser.disconnect();
}

main().catch(console.error);
