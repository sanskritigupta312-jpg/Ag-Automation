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

  const posts = await page.evaluate(() => {
    const vh = window.innerHeight;
    const containers = Array.from(
      document.querySelectorAll('div[data-pressable-container="true"], article, div[role="article"]')
    );

    const results: any[] = [];
    let counter = 1;

    for (const c of containers) {
      const rect = c.getBoundingClientRect();
      // Must be partially or fully visible in the current viewport
      if (rect.bottom < 60 || rect.top > vh - 40 || rect.width < 180 || rect.height < 50) continue;

      // Extract author
      const authorEl = c.querySelector('a[href^="/@"], div[role="link"] span, h2, a[role="link"]');
      let author = '';
      if (authorEl) {
        author = (authorEl.textContent || '').trim();
      }

      // Extract post text
      const textNodes = Array.from(c.querySelectorAll('div[dir="auto"], span[dir="auto"], p'));
      const textPieces = textNodes
        .map((n) => (n.textContent || '').trim())
        .filter((t) =>
          t.length > 5 &&
          !t.startsWith('Like') &&
          !t.startsWith('Reply') &&
          !t.startsWith('Repost') &&
          !t.startsWith('Share') &&
          t !== author &&
          t !== 'Follow' &&
          t !== 'More'
        );

      // Reply button
      const replyBtn = Array.from(c.querySelectorAll('div[role="button"], button')).find((b) => {
        const text = (b.textContent || '').trim();
        const aria = (b.getAttribute('aria-label') || '').trim();
        return text.startsWith('Reply') || aria.startsWith('Reply');
      });

      let replyCoord = null;
      if (replyBtn) {
        const bRect = (replyBtn as HTMLElement).getBoundingClientRect();
        if (bRect.width > 0 && bRect.height > 0) {
          replyCoord = {
            x: Math.round(bRect.left + bRect.width / 2),
            y: Math.round(bRect.top + bRect.height / 2),
          };
        }
      }

      const fullText = textPieces.join(' ');
      if (fullText.length > 8) {
        results.push({
          id: counter++,
          author,
          text: fullText.slice(0, 160),
          replyCoord,
          rect: {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        });
      }
    }

    return results;
  });

  console.log('VISIBLE POSTS ON SCREEN NOW:', JSON.stringify(posts, null, 2));
  await browser.disconnect();
}

main().catch(console.error);
