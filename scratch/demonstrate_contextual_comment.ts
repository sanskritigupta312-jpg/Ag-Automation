import { BrowserClient } from '../src/cdp/BrowserClient.js';
import { SemanticPostReasoner } from '../src/engine/SemanticPostReasoner.js';
import { CustomerProfile } from '../src/types/CustomerProfile.js';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Connecting to Chrome CDP...');
  const client = new BrowserClient('http://127.0.0.1:9222');
  await client.connect();

  const page = client.getActivePage()!;
  console.log(`Active URL: ${page.url()}`);

  const profilePath = path.resolve(process.cwd(), '.customer-profile.json');
  let profile: CustomerProfile | null = null;
  if (fs.existsSync(profilePath)) {
    profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  }

  // 1. Extract post text and author from DOM
  const pageData = await page.evaluate(() => {
    const textElements = Array.from(document.querySelectorAll('span, p, div[dir="auto"]'))
      .map(el => (el.textContent || '').trim())
      .filter(t => t.length > 15 && !t.startsWith('Reply') && !t.startsWith('Like') && !t.startsWith('Repost'));
    
    // Find author handle
    const links = Array.from(document.querySelectorAll('a[role="link"]'))
      .map(a => (a.textContent || '').trim())
      .filter(t => t.length > 2 && t.length < 25 && !t.includes(' ') && !t.includes('Thread'));

    return {
      postText: textElements.join(' '),
      author: links[0] || 'author',
    };
  });

  console.log(`Author: @${pageData.author}`);
  console.log(`Post Context: "${pageData.postText.slice(0, 150)}..."`);

  // 2. Perform deep semantic reasoning (ZERO REGEX)
  const analysis = SemanticPostReasoner.evaluatePost(pageData.postText, pageData.author, profile);
  console.log('\nSemantic Evaluation Result:');
  console.log(JSON.stringify(analysis, null, 2));

  if (!analysis.isRelevant || !analysis.synthesizedComment) {
    console.log(`[FILTER] Post is irrelevant: ${analysis.reason}. Skipping without commenting!`);
    await client.disconnect();
    return;
  }

  console.log(`\n[MATCH] Post is relevant (${analysis.reason})`);
  console.log(`Authentic Contextual Comment to be typed:\n"${analysis.synthesizedComment}"\n`);

  // 3. Find reply textbox
  const session = await page.createCDPSession();
  const inputInfo = await page.evaluate(() => {
    const box = document.querySelector('div[role="textbox"][contenteditable="true"]');
    if (!box) return null;
    const rect = box.getBoundingClientRect();
    return {
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
    };
  });

  if (!inputInfo) {
    console.log('No reply textbox currently focused, clicking reply button...');
    const replyBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('div[role="button"]'));
      const btn = btns.find(b => (b.textContent || '').trim().startsWith('Reply'));
      if (!btn) return null;
      const rect = btn.getBoundingClientRect();
      return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
    });
    if (replyBtn) {
      await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: replyBtn.x, y: replyBtn.y, button: 'left', clickCount: 1 });
      await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: replyBtn.x, y: replyBtn.y, button: 'left', clickCount: 1 });
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // Focus textbox
  await page.evaluate(() => {
    const box = document.querySelector('div[role="textbox"][contenteditable="true"]') as HTMLElement;
    if (box) {
      box.focus();
      box.scrollIntoView({ block: 'center' });
    }
  });
  await new Promise(r => setTimeout(r, 500));

  // Type characters with human typing rhythm
  const textToType = analysis.synthesizedComment;
  console.log('Typing humanized characters via CDP...');
  for (const char of textToType) {
    await session.send('Input.dispatchKeyEvent', { type: 'keyDown', text: char });
    await session.send('Input.dispatchKeyEvent', { type: 'keyUp', text: char });
    await new Promise(r => setTimeout(r, 45 + Math.random() * 60));
  }
  console.log('Finished typing.');
  await new Promise(r => setTimeout(r, 1200));

  // Capture screenshot of typed comment
  const typedScreenshot = path.resolve(process.cwd(), 'scratch', 'contextual_typed_proof.png');
  await page.screenshot({ path: typedScreenshot });
  console.log(`Saved typed screenshot: ${typedScreenshot}`);

  // Submit via Ctrl+Enter and button click
  console.log('Dispatching Ctrl + Enter submission...');
  await session.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 17 }); // Ctrl
  await session.send('Input.dispatchKeyEvent', { type: 'keyDown', windowsVirtualKeyCode: 13, text: '\r' }); // Enter
  await session.send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 13 });
  await session.send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 17 });

  await new Promise(r => setTimeout(r, 800));

  // Also click Post button if visible
  const postBtnCoord = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('div[role="button"]'));
    const btn = btns.find(b => (b.textContent || '').trim() === 'Post');
    if (!btn) return null;
    const rect = btn.getBoundingClientRect();
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
  });

  if (postBtnCoord) {
    console.log(`Clicking Post button at (${postBtnCoord.x}, ${postBtnCoord.y})...`);
    await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: postBtnCoord.x, y: postBtnCoord.y, button: 'left', clickCount: 1 });
    await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: postBtnCoord.x, y: postBtnCoord.y, button: 'left', clickCount: 1 });
  }

  await new Promise(r => setTimeout(r, 3000));

  // Capture published result screenshot
  const submittedScreenshot = path.resolve(process.cwd(), 'scratch', 'contextual_submitted_proof.png');
  await page.screenshot({ path: submittedScreenshot });
  console.log(`Saved submitted screenshot: ${submittedScreenshot}`);

  await client.disconnect();
  console.log('Done!');
}

main().catch(console.error);
