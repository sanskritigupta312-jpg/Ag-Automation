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

  // Scroll a bit so a post with Reply button is in view
  await page.evaluate(() => window.scrollBy(0, 300));
  await new Promise((r) => setTimeout(r, 1000));

  // Find the first visible Reply button
  const replyButton = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
    for (const b of btns) {
      const text = (b.textContent || '').trim();
      const rect = b.getBoundingClientRect();
      if (text.startsWith('Reply') && rect.top > 50 && rect.top < window.innerHeight && rect.width > 0) {
        return {
          text,
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
        };
      }
    }
    return null;
  });

  console.log('Found reply button:', replyButton);

  if (replyButton) {
    // Click the reply button
    await page.mouse.click(replyButton.x, replyButton.y);
    console.log('Clicked reply button at', replyButton.x, replyButton.y);
    await new Promise((r) => setTimeout(r, 2000));

    // Now check what appeared!
    const composerInfo = await page.evaluate(() => {
      const textboxes = Array.from(document.querySelectorAll('div[role="textbox"], textarea, div[contenteditable="true"]')).map((el) => ({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        editable: el.getAttribute('contenteditable'),
        placeholder: el.getAttribute('placeholder'),
        aria: el.getAttribute('aria-label'),
        rect: {
          x: Math.round(el.getBoundingClientRect().left),
          y: Math.round(el.getBoundingClientRect().top),
          w: Math.round(el.getBoundingClientRect().width),
          h: Math.round(el.getBoundingClientRect().height),
        }
      }));

      const submitBtns = Array.from(document.querySelectorAll('div[role="button"], button'))
        .map((el) => ({
          text: (el.textContent || '').trim(),
          aria: el.getAttribute('aria-label') || '',
          rect: {
            x: Math.round(el.getBoundingClientRect().left),
            y: Math.round(el.getBoundingClientRect().top),
            w: Math.round(el.getBoundingClientRect().width),
            h: Math.round(el.getBoundingClientRect().height),
          }
        }))
        .filter((b) => b.text === 'Post' || b.text === 'Reply' || b.aria === 'Post' || b.aria === 'Reply');

      const modal = document.querySelector('div[role="dialog"]');

      return {
        hasModal: !!modal,
        textboxes,
        submitBtns,
      };
    });

    console.log('Composer info after clicking Reply:', JSON.stringify(composerInfo, null, 2));

    // Close / cancel the reply so we don't leave it hanging
    await page.keyboard.press('Escape');
  }

  await browser.disconnect();
}

main().catch(console.error);
