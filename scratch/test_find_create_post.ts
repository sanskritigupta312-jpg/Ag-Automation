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

  // Find all elements that can start a new post or thread
  const createElements = await page.evaluate(() => {
    const list: any[] = [];
    document.querySelectorAll('*').forEach((el) => {
      const text = (el.textContent || '').trim();
      const aria = (el.getAttribute('aria-label') || '').trim();
      const role = el.getAttribute('role') || '';
      const tag = el.tagName.toLowerCase();
      const rect = el.getBoundingClientRect();

      const matches =
        text === 'New thread' ||
        text === "What's new?" ||
        text.includes("What's new") ||
        text.includes("Start a thread") ||
        aria.toLowerCase().includes("new thread") ||
        aria.toLowerCase().includes("compose") ||
        aria.toLowerCase().includes("create");

      if (matches && rect.width > 0 && rect.height > 0) {
        list.push({
          tag,
          role,
          text: text.slice(0, 30),
          aria,
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        });
      }
    });
    return list;
  });

  console.log('Create post elements:', JSON.stringify(createElements, null, 2));
  await browser.disconnect();
}

main().catch(console.error);
