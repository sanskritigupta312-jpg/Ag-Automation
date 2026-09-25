import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find((p) => p.url().includes('threads.com') || p.url().includes('threads.net')) || pages[0];

  // Get real bounding box of the Post button
  const postBtnCoord = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
    for (const b of btns) {
      const text = (b.textContent || '').trim();
      const rect = b.getBoundingClientRect();
      if (text === 'Post' && rect.top > 200 && rect.width > 30) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }
    }
    return null;
  });

  console.log('Post button coordinates:', postBtnCoord);

  if (postBtnCoord) {
    // Real CDP mouse move and click!
    await page.mouse.move(postBtnCoord.x, postBtnCoord.y, { steps: 5 });
    await new Promise(r => setTimeout(r, 200));
    await page.mouse.down();
    await new Promise(r => setTimeout(r, 120));
    await page.mouse.up();
    console.log('Dispatched real CDP mouse click on Post button!');
  }

  // Wait 4 seconds for Threads to submit and close modal
  await new Promise(r => setTimeout(r, 4000));

  const destPath = 'C:\\Users\\SANSKRITI\\.gemini\\antigravity-ide\\brain\\078e5a97-a3e4-4722-88b4-64c03a5b7753\\threads_posted_result.png';
  await page.screenshot({ path: destPath });
  console.log('Screenshot saved to:', destPath);

  await browser.disconnect();
}

main().catch(console.error);
