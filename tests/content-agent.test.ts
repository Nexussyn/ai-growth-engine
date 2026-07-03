import { assertEquals, assertRejects, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildContent,
  generateContent,
  generate_content,
  type BountyRecord,
  type ContentStore,
  type LLMProvider,
} from '../src/agents/content-agent.ts';

const mockBounty = (id: string, title: string): BountyRecord => ({
  id,
  title,
  description: 'Auto-generate outreach from bounty merge events.',
  reward_amount: 5,
  repo_owner: 'Nexussyn',
  repo_name: 'ai-growth-engine',
  pr_number: 42,
});

function mockLLM(responses: Record<string, string>): LLMProvider {
  return {
    name: 'mock',
    complete(prompt: string) {
      if (prompt.includes('single tweet') || prompt.includes('one tweet')) {
        return Promise.resolve(responses.tweet ?? 'Shipped: tiered pricing live — $5 USDC paid on merge. Fork and earn.');
      }
      if (prompt.includes('thread')) {
        return Promise.resolve(
          responses.thread ??
            '1/ Bounty complete---2/ Open agents welcome---3/ Paid on Base---4/ x402 ready---5/ Claim next issue',
        );
      }
      return Promise.resolve(
        responses.blog ??
          'A contributor merged agent work that turns bounty outcomes into viral content. '.repeat(20),
      );
    },
  };
}

function memoryStore(bounties: Record<string, BountyRecord>): ContentStore {
  const saved: Array<{ bountyId: string; content: unknown }> = [];
  return {
    async fetchBounty(id) {
      return bounties[id] ?? null;
    },
    async saveOutreach(bountyId, content) {
      saved.push({ bountyId, content });
    },
    // @ts-ignore test helper
    saved,
  };
}

Deno.test('generateContent returns tweet, thread, blog_post', async () => {
  const store = memoryStore({ 'b-1': mockBounty('b-1', 'Content agent') });
  const out = await generateContent('b-1', { store, llm: mockLLM({}) });

  assertEquals(typeof out.tweet, 'string');
  assertEquals(out.tweet.length <= 280, true);
  assertEquals(out.thread.length, 5);
  assertEquals(out.thread.every((t) => t.length <= 280), true);
  assertEquals(out.blog_post.split(/\s+/).length >= 260, true);
});

Deno.test('generateContent stores payload in outreach_sent', async () => {
  const store = memoryStore({ 'b-2': mockBounty('b-2', 'Referral loop') });
  const out = await generateContent('b-2', { store, llm: mockLLM({}) });
  // @ts-ignore
  const row = store.saved[0];
  assertEquals(row.bountyId, 'b-2');
  assertEquals(JSON.parse(JSON.stringify(row.content)).tweet, out.tweet);
});

Deno.test('generateContent throws when bounty missing', async () => {
  const store = memoryStore({});
  await assertRejects(
    () => generateContent('missing', { store, llm: mockLLM({}) }),
    Error,
    'Bounty not found',
  );
});

Deno.test('content is unique per bounty id even with identical LLM output', async () => {
  const llm = mockLLM({});
  const a = await buildContent(mockBounty('alpha', 'Alpha task'), llm);
  const b = await buildContent(mockBounty('beta', 'Beta task'), llm);

  assertNotEquals(a.tweet, b.tweet);
  assertNotEquals(a.thread.join('|'), b.thread.join('|'));
  assertNotEquals(a.blog_post, b.blog_post);
});

Deno.test('thread parser normalizes fewer than 5 LLM segments', async () => {
  const llm = mockLLM({ thread: 'Only one segment from model' });
  const out = await buildContent(mockBounty('x', 'Upsell trigger'), llm);
  assertEquals(out.thread.length, 5);
  assertEquals(out.thread[0].startsWith('1/'), true);
});

Deno.test('generate_content snake_case alias matches generateContent', async () => {
  const store = memoryStore({ 'b-snake': mockBounty('b-snake', 'Snake case export') });
  const llm = mockLLM({});
  const camel = await generateContent('b-snake', { store, llm });
  const snake = await generate_content('b-snake', { store, llm });
  assertEquals(snake.tweet, camel.tweet);
  assertEquals(snake.thread.join('|'), camel.thread.join('|'));
  assertEquals(snake.blog_post, camel.blog_post);
});
