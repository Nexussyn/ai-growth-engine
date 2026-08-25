/**
 * Content Agent Tests — Issue #5
 * Mock bounty data; no live LLM / network required.
 */

import {
  assertEquals,
  assertExists,
  assertNotEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  CHANNEL,
  ContentOutput,
  MemoryBountyStore,
  MemoryOutreachStore,
  generateContent,
  generate_content,
  hashSeed,
  synthesizeContent,
} from '../src/agents/content-agent.ts';

function seedStore(): MemoryBountyStore {
  const store = new MemoryBountyStore();
  store.put({
    id: 'test-001',
    title: 'Tiered pricing engine for AI API calls',
    description: 'Added 4-tier pricing to x402 protocol',
    reward_amount: 15,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 42,
    execution_status: 'done',
  });
  store.put({
    id: 'test-002',
    title: 'Referral reward loop with smart contracts',
    description: 'Implemented USDC referral bonuses on Base L2',
    reward_amount: 10,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 55,
    execution_status: 'done',
  });
  store.put({
    id: 'test-003',
    title: 'Mobile-first landing page redesign',
    description: 'Redesigned landing for mobile conversion',
    reward_amount: 10,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 68,
    execution_status: 'done',
  });
  return store;
}

Deno.test('ContentOutput shape: tweet ≤280, thread=5, blog substantial', () => {
  const sample: ContentOutput = synthesizeContent({
    id: 'shape-1',
    title: 'Shape check bounty',
    description: 'Validate output contract',
    reward_amount: 5,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 1,
  });
  assertEquals(sample.tweet.length <= 280, true);
  assertEquals(sample.thread.length, 5);
  for (const t of sample.thread) {
    assertEquals(t.length <= 280, true);
  }
  const words = sample.blog_post.trim().split(/\s+/).length;
  assertEquals(words >= 280, true, `blog words=${words}`);
});

Deno.test('generateContent rejects missing bounty', async () => {
  const bountyStore = new MemoryBountyStore();
  const outreachStore = new MemoryOutreachStore();
  let threw = false;
  try {
    await generateContent('missing', { bountyStore, outreachStore, forceOffline: true });
  } catch (e) {
    threw = true;
    assertEquals(String(e).includes('Bounty not found'), true);
  }
  assertEquals(threw, true);
  assertEquals(outreachStore.rows.length, 0);
});

Deno.test('generate_content alias + persists outreach_sent row', async () => {
  const bountyStore = seedStore();
  const outreachStore = new MemoryOutreachStore();
  const out = await generate_content('test-001', {
    bountyStore,
    outreachStore,
    forceOffline: true,
  });
  assertExists(out.tweet);
  assertEquals(out.thread.length, 5);
  assertExists(out.blog_post);
  assertEquals(outreachStore.rows.length, 1);
  assertEquals(outreachStore.rows[0].bounty_id, 'test-001');
  assertEquals(outreachStore.rows[0].channel, CHANNEL);
  assertEquals(outreachStore.rows[0].tweet, out.tweet);
  const parsed = JSON.parse(outreachStore.rows[0].content);
  assertEquals(parsed.tweet, out.tweet);
});

Deno.test('content is unique per bounty (not templated)', async () => {
  const bountyStore = seedStore();
  const outreachStore = new MemoryOutreachStore();
  const a = await generateContent('test-001', {
    bountyStore,
    outreachStore,
    forceOffline: true,
  });
  const b = await generateContent('test-002', {
    bountyStore,
    outreachStore,
    forceOffline: true,
  });
  const c = await generateContent('test-003', {
    bountyStore,
    outreachStore,
    forceOffline: true,
  });
  assertNotEquals(a.tweet, b.tweet);
  assertNotEquals(b.tweet, c.tweet);
  assertNotEquals(a.blog_post, c.blog_post);
  assertNotEquals(hashSeed('test-001|x'), hashSeed('test-002|x'));
  assertEquals(outreachStore.rows.length, 3);
});

Deno.test('injected LLM path parses thread separators', async () => {
  const bountyStore = seedStore();
  const outreachStore = new MemoryOutreachStore();
  let n = 0;
  const llm = async (_prompt: string) => {
    n++;
    if (n === 1) {
      return 'Shipped Tiered pricing engine for AI API calls — $15 USDC. Join us.';
    }
    if (n === 2) {
      return [
        'One about the merge',
        'Two about Base payouts',
        'Three about x402',
        'Four about agents',
        'Five call to action',
      ].join('\n---\n');
    }
    return (
      'This is a long enough blog post about the completed bounty. '.repeat(40)
    );
  };
  const out = await generateContent('test-001', {
    bountyStore,
    outreachStore,
    llm,
  });
  assertEquals(out.thread.length, 5);
  assertEquals(out.tweet.includes('Tiered pricing') || out.tweet.includes('$15'), true);
  assertEquals(outreachStore.rows.length, 1);
});

Deno.test('tweet mentions reward marker', () => {
  const out = synthesizeContent({
    id: 'pay-1',
    title: 'Paycheck demo',
    reward_amount: 5,
  });
  assertEquals(out.tweet.includes('$'), true);
});

Deno.test('migration file documents outreach_sent', async () => {
  const sql = await Deno.readTextFile(
    new URL('../migrations/add_outreach_sent.sql', import.meta.url),
  );
  assertEquals(sql.includes('outreach_sent'), true);
  assertEquals(sql.includes('bounty_id'), true);
  assertEquals(sql.includes('content_agent'), true);
});
