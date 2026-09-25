import puppeteer from 'puppeteer-core';
import path from 'path';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find((p) => p.url().includes('threads.com') || p.url().includes('threads.net')) || pages[0];

  const destPath = 'C:\\Users\\SANSKRITI\\.gemini\\antigravity-ide\\brain\\078e5a97-a3e4-4722-88b4-64c03a5b7753\\threads_after_post.png';
  await page.screenshot({ path: destPath });
  console.log('Saved to:', destPath);

  await browser.disconnect();
}

main().catch(console.error);
