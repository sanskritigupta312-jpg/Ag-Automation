import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find((p) => p.url().includes('threads')) || pages[0];

  // Inspect the open modal and its post buttons
  const modalButtons = await page.evaluate(() => {
    const list: Array<{ tag: string; role: string | null; aria: string | null; text: string; x: number; y: number }> = [];
    document.querySelectorAll('*').forEach((el) => {
      const role = el.getAttribute('role');
      const text = (el.textContent || '').trim();
      const rect = el.getBoundingClientRect();
      if ((role === 'button' || el.tagName.toLowerCase() === 'button') && rect.width > 0 && rect.top > 0) {
        list.push({
          tag: el.tagName.toLowerCase(),
          role,
          aria: el.getAttribute('aria-label'),
          text: text.slice(0, 30),
          x: Math.round(rect.left),
          y: Math.round(rect.top),
        });
      }
    });
    return list;
  });

  console.log('Buttons visible in modal:', JSON.stringify(modalButtons, null, 2));

  await browser.disconnect();
}

main().catch(console.error);
