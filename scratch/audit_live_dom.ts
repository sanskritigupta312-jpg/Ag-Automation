import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find((p) => p.url().includes('threads.com'));
  if (!page) {
    console.log('No threads page found');
    await browser.disconnect();
    return;
  }

  const domReport = await page.evaluate(() => {
    // 1. Check title & URL
    const title = document.title;
    const url = window.location.href;

    // 2. Check for login / account state
    const loginBtn = Array.from(document.querySelectorAll('a, button, div[role="button"]')).find(
      (el) => el.textContent?.toLowerCase().includes('log in')
    );
    const isLoggedIn = !loginBtn;

    // 3. Find visible posts
    const postContainers = Array.from(
      document.querySelectorAll('div[data-pressable-container="true"], article, div[role="article"]')
    );

    // 4. Sample text snippets from the feed
    const textNodes = Array.from(document.querySelectorAll('div[dir="auto"], span[dir="auto"]'))
      .map((el) => (el.textContent || '').trim())
      .filter((t) => t.length > 20 && !t.includes('©') && !t.includes('Terms'));

    // 5. Check composers on screen
    const textboxes = Array.from(document.querySelectorAll('div[role="textbox"], textarea')).map(
      (el) => ({
        placeholder: el.getAttribute('placeholder') || '',
        aria: el.getAttribute('aria-label') || '',
        text: (el.textContent || '').trim(),
        visible: (el as HTMLElement).offsetParent !== null,
        rect: el.getBoundingClientRect(),
      })
    );

    // 6. Check reply / post buttons
    const actionButtons = Array.from(document.querySelectorAll('div[role="button"], button'))
      .map((el) => ({
        text: (el.textContent || '').trim(),
        aria: el.getAttribute('aria-label') || '',
        rect: el.getBoundingClientRect(),
      }))
      .filter(
        (b) =>
          b.text.includes('Reply') ||
          b.text.includes('Post') ||
          b.text.includes('Like') ||
          b.aria.includes('Reply') ||
          b.aria.includes('Post')
      );

    return {
      title,
      url,
      isLoggedIn,
      postContainersCount: postContainers.length,
      sampleTexts: textNodes.slice(0, 10),
      textboxes,
      actionButtonsCount: actionButtons.length,
      sampleButtons: actionButtons.slice(0, 6),
    };
  });

  console.log('DOM REPORT:', JSON.stringify(domReport, null, 2));
  await browser.disconnect();
}

main().catch(console.error);
