import { BrowserClient } from '../src/cdp/BrowserClient.js';

async function main() {
  const client = new BrowserClient('http://127.0.0.1:9222');
  await client.connect();
  const page = client.getActivePage()!;
  const elements = await page.evaluate(() => {
    const list: any[] = [];
    document.querySelectorAll('button, div[role="button"], div[role="textbox"], input, textarea, div[contenteditable="true"], a[role="link"]').forEach((el: any) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0) {
        list.push({
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role'),
          text: (el.textContent || '').trim().slice(0, 50),
          aria: el.getAttribute('aria-label'),
          y: Math.round(rect.top),
          x: Math.round(rect.left),
        });
      }
    });
    return list;
  });
  console.log(`Interactive elements currently on screen: ${elements.length}`);
  console.log(JSON.stringify(elements, null, 2));

  const inputs = elements.filter(e => e.isEditable || e.role === 'textbox');
  console.log('Input candidates:');
  console.log(JSON.stringify(inputs.map(i => ({
    id: i.id,
    tag: i.tagName,
    role: i.role,
    text: i.textSnippet,
    aria: i.ariaLabel,
    editable: i.isEditable,
    rect: i.boundingBox
  })), null, 2));

  await client.disconnect();
}

main().catch(console.error);
