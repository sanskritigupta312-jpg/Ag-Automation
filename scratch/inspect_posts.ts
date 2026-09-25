import { BrowserClient } from '../src/cdp/BrowserClient.js';

async function main() {
  const client = new BrowserClient('http://127.0.0.1:9222');
  await client.connect();
  const page = client.getActivePage()!;

  const posts = await page.evaluate(() => {
    // Find all post cards in viewport
    const results: any[] = [];
    const elements = Array.from(document.querySelectorAll('div, article'));
    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      // Look for elements with reply/like buttons inside them
      if (rect.height > 80 && rect.height < 600 && rect.top >= 0 && rect.top < window.innerHeight) {
        const hasReply = !!el.querySelector('div[role="button"][aria-label*="Reply"], div[role="button"]:has(svg)');
        const text = (el.textContent || '').trim();
        if (hasReply && text.length > 30 && text.length < 500) {
          results.push({
            text: text.slice(0, 120),
            y: Math.round(rect.top),
            height: Math.round(rect.height),
          });
        }
      }
    }
    return results.slice(0, 5);
  });

  console.log('Posts in current viewport:', JSON.stringify(posts, null, 2));
  await client.disconnect();
}

main().catch(console.error);
