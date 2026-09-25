import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find((p) => p.url().includes('threads.com') || p.url().includes('threads.net')) || pages[0];

  const clickedPost = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
    // Find the button whose trimmed text is exactly "Post"
    const postBtns = btns.filter((b) => (b.textContent || '').trim() === 'Post' && b.getBoundingClientRect().height > 0);
    // The modal's post button is the last one in DOM or the one with positive y in viewport
    const modalPostBtn = postBtns.find(b => {
      const rect = b.getBoundingClientRect();
      return rect.top > 100 && rect.top < 700;
    }) || postBtns[postBtns.length - 1];

    if (modalPostBtn) {
      (modalPostBtn as HTMLElement).click();
      const rect = modalPostBtn.getBoundingClientRect();
      return { text: modalPostBtn.textContent?.trim(), x: rect.left, y: rect.top };
    }
    return null;
  });

  console.log('Clicked exact Post button:', clickedPost);

  // Wait 3 seconds
  await new Promise(r => setTimeout(r, 3000));

  // Take screenshot after posting!
  const destPath = 'C:\\Users\\SANSKRITI\\.gemini\antigravity-ide\\brain\\078e5a97-a3e4-4722-88b4-64c03a5b7753\\threads_after_post_screenshot.png';
  await page.screenshot({ path: destPath });
  console.log('Saved after-post screenshot to:', destPath);

  await browser.disconnect();
}

main().catch(console.error);
