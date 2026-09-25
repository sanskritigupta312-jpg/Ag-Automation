import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find((p) => p.url().includes('threads')) || pages[0];
  await page.bringToFront();

  // Find the exact Post button in the dialog modal
  const postBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
    const modalBtn = btns.find(b => {
      const text = (b.textContent || '').trim();
      const rect = b.getBoundingClientRect();
      return text === 'Post' && rect.top > 200 && rect.top < 600 && rect.width > 30;
    });
    if (modalBtn) {
      const rect = modalBtn.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, text: modalBtn.textContent?.trim() };
    }
    return null;
  });

  console.log('Target Post Button:', postBtn);

  if (postBtn) {
    console.log(`Clicking exact Post button at (${postBtn.x}, ${postBtn.y})...`);
    await page.mouse.move(postBtn.x, postBtn.y, { steps: 5 });
    await new Promise(r => setTimeout(r, 200));
    await page.mouse.down();
    await new Promise(r => setTimeout(r, 100));
    await page.mouse.up();
  }

  // Also send Ctrl+Enter to the active element in case keyboard submission is listened
  await new Promise(r => setTimeout(r, 500));
  await page.keyboard.down('Control');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Control');

  console.log('Dispatched click and Ctrl+Enter!');

  // Wait 4 seconds for modal to submit
  await new Promise(r => setTimeout(r, 4000));

  // Check if modal is still open
  const isModalOpen = await page.evaluate(() => {
    const textboxes = Array.from(document.querySelectorAll('div[role="textbox"]'));
    return textboxes.some(t => t.getBoundingClientRect().top > 100 && t.getBoundingClientRect().height > 50);
  });
  console.log('Is modal still open after submit?', isModalOpen);

  const destPath = 'C:\\Users\\SANSKRITI\\.gemini\\antigravity-ide\\brain\\078e5a97-a3e4-4722-88b4-64c03a5b7753\\threads_after_submit_check.png';
  await page.screenshot({ path: destPath });
  console.log('Saved screenshot to:', destPath);

  await browser.disconnect();
}

main().catch(console.error);
