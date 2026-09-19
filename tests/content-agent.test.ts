import { assertEquals, assertRejects, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  createMemoryContentStore,
  generate_content,
  localLLM,
} from '../src/agents/content-agent.ts';

Deno.test('generate_content returns tweet, thread, blog_post', async () => {
  const store = createMemoryContentStore([
    {
      id: 'b1',
      title: 'Tiered pricing engine',
      description: 'Four-tier x402 pricing',
      outcome: 'merged',
      reward_amount: 15,
      repo_owner: 'Nexussyn',
      repo_name: 'ai-growth-engine',
      pr_number: 143,
    },
  ]);
  const out = await generate_content('b1', { store, llm: localLLM });
  assertEquals(typeof out.tweet, 'string');
  assert(out.tweet.length > 0 && out.tweet.length <= 280);
  assertEquals(out.thread.length, 5);
  assert(out.blog_post.split(/\s+/).length > 40);
  assert(store.outreach.has('b1'));
});

Deno.test('content differs across bounties (not a fixed template)', async () => {
  const store = createMemoryContentStore([
    { id: 'a', title: 'Alpha referral loop', reward_amount: 10 },
    { id: 'b', title: 'Beta mobile landing', reward_amount: 10 },
  ]);
  const a = await generate_content('a', { store, llm: localLLM });
  const b = await generate_content('b', { store, llm: localLLM });
  assert(a.tweet !== b.tweet);
  assert(a.blog_post !== b.blog_post);
});

Deno.test('missing bounty throws', async () => {
  const store = createMemoryContentStore([]);
  await assertRejects(() => generate_content('nope', { store, llm: localLLM }));
});
