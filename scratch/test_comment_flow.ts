import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find((p) => p.url().includes('threads')) || pages[0];
  await page.bringToFront();

  console.log('Finding visible Reply button...');
  // Find a reply button currently in viewport (y between 100 and 700)
  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
    for (const b of buttons) {
      const rect = b.getBoundingClientRect();
      const text = (b.textContent || '').trim();
      const aria = (b.getAttribute('aria-label') || '').trim();
      if ((text.startsWith('Reply') || aria.startsWith('Reply')) && rect.top > 50 && rect.top < 650 && rect.width > 0) {
        (b as HTMLElement).click();
        return { text, aria, x: rect.left, y: rect.top };
      }
    }
    return null;
  });

  console.log('Clicked Reply button:', clicked);

  // Wait 1.5 seconds for dialog/modal to appear
  await new Promise((r) => setTimeout(r, 1500));

  // Inspect what input / contenteditable is now open
  const modalInputs = await page.evaluate(() => {
    const list: Array<{ tag: string; role: string | null; aria: string | null; isContentEditable: boolean; placeholder: string | null; text: string }> = [];
    document.querySelectorAll('*').forEach((el) => {
      const isContentEditable = el.getAttribute('contenteditable') === 'true';
      const role = el.getAttribute('role');
      const tag = el.tagName.toLowerCase();
      if (isContentEditable || role === 'textbox' || tag === 'textarea' || tag === 'input') {
        list.push({
          tag,
          role,
          aria: el.getAttribute('aria-label'),
          isContentEditable,
          placeholder: el.getAttribute('placeholder') || el.getAttribute('aria-placeholder'),
          text: (el.textContent || '').slice(0, 40),
        });
      }
    });
    return list;
  });

  console.log('Inputs found in reply modal:', JSON.stringify(modalInputs, null, 2));

  await browser.disconnect();
}

main().catch(console.error);
