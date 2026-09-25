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
    // On Threads, each post container in the feed has data-pressable-container="true" or role="article"
    const containers = Array.from(
      document.querySelectorAll('div[data-pressable-container="true"], article, div[role="article"]')
    );

    const results: any[] = [];
    for (const c of containers) {
      const rect = c.getBoundingClientRect();
      // Only visible in or near viewport
      if (rect.width < 200 || rect.height < 60) continue;

      // Author handle
      const authorEl = c.querySelector('a[href^="/@"], div[role="link"] span, h2, a[role="link"]');
      let author = '';
      if (authorEl) {
        author = (authorEl.textContent || '').trim();
      }

      // Post text
      const textNodes = Array.from(c.querySelectorAll('div[dir="auto"], span[dir="auto"], p'));
      const textPieces = textNodes
        .map((n) => (n.textContent || '').trim())
        .filter((t) => t.length > 5 && !t.startsWith('Like') && !t.startsWith('Reply') && !t.startsWith('Repost') && !t.startsWith('Share') && t !== author);

      // Reply button
      const replyBtn = Array.from(c.querySelectorAll('div[role="button"], button, svg')).find((b) => {
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
      if (fullText.length > 10) {
        results.push({
          author,
          fullText: fullText.slice(0, 150),
          rect: { top: Math.round(rect.top), height: Math.round(rect.height) },
          hasReplyBtn: !!replyCoord,
          replyCoord,
        });
      }
    }

    return results;
  });

  console.log('Extracted individual posts:', JSON.stringify(posts, null, 2));
  await browser.disconnect();
}

main().catch(console.error);
