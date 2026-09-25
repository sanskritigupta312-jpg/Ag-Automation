import { BrowserClient } from '../src/cdp/BrowserClient.js';
import { SemanticPostReasoner } from '../src/engine/SemanticPostReasoner.js';
import { CustomerProfile } from '../src/types/CustomerProfile.js';
import fs from 'fs';
import path from 'path';

async function main() {
  const client = new BrowserClient('http://127.0.0.1:9222');
  await client.connect();
  const page = client.getActivePage()!;

  const profilePath = path.resolve(process.cwd(), '.customer-profile.json');
  let profile: CustomerProfile | null = null;
  if (fs.existsSync(profilePath)) {
    profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('   LIVE POST CONTEXT EXTRACTION & REASONING ON THREADS     ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Extract individual post cards in the feed
  const visibleCards = await page.evaluate(() => {
    const cards: Array<{ author: string; text: string; hasReply: boolean }> = [];
    // Each feed item has a reply button
    const replyButtons = Array.from(document.querySelectorAll('div[role="button"]'))
      .filter(b => (b.textContent || '').trim().startsWith('Reply'));

    for (const replyBtn of replyButtons) {
      // Find closest container that has the post content
      let parent = replyBtn.parentElement;
      let depth = 0;
      let containerText = '';
      let author = '';

      while (parent && depth < 8) {
        const text = (parent.textContent || '').trim();
        if (text.length > 25 && text.includes('Reply') && text.includes('Like')) {
          containerText = text;
          // Look for author link
          const authorLink = parent.querySelector('a[role="link"]');
          if (authorLink) {
            author = (authorLink.textContent || '').trim();
          }
          break;
        }
        parent = parent.parentElement;
        depth++;
      }

      if (containerText) {
        cards.push({
          author: author || 'unknown',
          text: containerText,
          hasReply: true,
        });
      }
    }
    return cards;
  });

  console.log(`Found ${visibleCards.length} distinct posts in viewport.\n`);

  for (let i = 0; i < visibleCards.length; i++) {
    const card = visibleCards[i];
    console.log(`-----------------------------------------------------------`);
    console.log(`POST #${i + 1} by @${card.author}`);
    console.log(`Raw snippet: "${card.text.slice(0, 100)}..."`);

    // Clean post text by removing button labels
    let cleanText = card.text
      .split('Like').join(' ')
      .split('Reply').join(' ')
      .split('Repost').join(' ')
      .split('Share').join(' ')
      .split('Follow').join(' ')
      .split('More').join(' ')
      .trim();

    const analysis = SemanticPostReasoner.evaluatePost(cleanText, card.author, profile);
    console.log(`\nSemantic Decision:`);
    console.log(`- Relevant?    ${analysis.isRelevant ? 'YES (Engage)' : 'NO (Skip)'}`);
    console.log(`- Intent:      ${analysis.intent}`);
    console.log(`- Reason:      ${analysis.reason}`);

    if (analysis.isRelevant && analysis.synthesizedComment) {
      console.log(`- Tailored Comment: "${analysis.synthesizedComment}"`);
    } else {
      console.log(`- Action:      [SKIPPED ORGANICALLY — NO SPAM]`);
    }
    console.log(`-----------------------------------------------------------\n`);
  }

  await client.disconnect();
}

main().catch(console.error);
