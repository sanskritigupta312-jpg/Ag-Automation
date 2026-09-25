import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  console.log(`Found ${pages.length} pages`);
  
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    console.log(`Page ${i}: ${p.url()} - "${await p.title()}"`);
  }

  // Find the active Threads page with the modal
  let targetPage = pages.find((p) => p.url().includes('threads.com') || p.url().includes('threads.net'));
  if (!targetPage) targetPage = pages[0];

  await targetPage.bringToFront();

  // Inspect all Post buttons and their state
  const postButtons = await targetPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('*')).filter(el => {
      const text = (el.textContent || '').trim();
      const role = el.getAttribute('role');
      const tag = el.tagName.toLowerCase();
      return (text === 'Post' || text === 'Create') && (role === 'button' || tag === 'button');
    });

    return btns.map(b => {
      const rect = b.getBoundingClientRect();
      const style = window.getComputedStyle(b);
      return {
        tag: b.tagName,
        text: b.textContent?.trim(),
        role: b.getAttribute('role'),
        ariaDisabled: b.getAttribute('aria-disabled'),
        disabled: (b as any).disabled,
        rect: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) },
        pointerEvents: style.pointerEvents,
        cursor: style.cursor,
        classes: b.className
      };
    });
  });

  console.log('Post buttons details:');
  console.log(JSON.stringify(postButtons, null, 2));

  await browser.disconnect();
}

main().catch(console.error);
