import {
  assert,
  assertEquals,
  assertNotEquals,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  createMockLLM,
  generate_content,
  type BountyOutcome,
  type ContentStore,
  type OutreachRecord,
} from '../src/agents/content-agent.ts';

const bounty: BountyOutcome = {
  id: 'bounty-a',
  title: 'Referral reward loop shipped',
  scope: 'Award credits when a referred user converts after the first paid call',
  outcome: 'Referrers receive five free credits, duplicate conversions are blocked, and events are auditable',
  tags: ['growth', 'bounty'],
};

const secondBounty: BountyOutcome = {
  ...bounty,
  id: 'bounty-b',
  title: 'Upsell trigger shipped',
  outcome: 'Upgrade prompts fire once at the free-credit threshold',
};

const llmResponse = JSON.stringify({
  tweet: 'Referral rewards shipped with auditable credit grants and duplicate protection.',
  thread: [
    'The referral loop now has a clear conversion path.',
    'Referrers receive credits only after a paid conversion.',
    'Duplicate referral usage is blocked by the processing contract.',
    'The outcome is easier to audit and measure after merge.',
    'Next step: compare referral conversion before and after launch.',
  ],
  blog_post: Array.from({ length: 285 }, (_, index) => `word${index}`).join(' '),
  social_card: {
    title: 'Referral loop shipped',
    subtitle: 'Auditable rewards for successful referral conversion',
    footer: 'AI Growth Engine bounty-a',
  },
});

function createStore(records: OutreachRecord[] = []): ContentStore {
  return {
    async getBountyOutcome(bountyId: string) {
      if (bountyId === bounty.id) return bounty;
      if (bountyId === secondBounty.id) return secondBounty;
      return null;
    },
    async upsertOutreachSent(record: OutreachRecord) {
      records.push(record);
    },
  };
}

Deno.test('generate_content stores tweet, thread, blog post, and social card', async () => {
  const records: OutreachRecord[] = [];
  const content = await generate_content(bounty.id, {
    store: createStore(records),
    llm: createMockLLM(llmResponse),
    now: () => new Date('2026-07-03T00:00:00.000Z'),
  });

  assert(content.tweet.length <= 280);
  assertEquals(content.thread.length, 5);
  assert(content.blog_post.split(/\s+/).length >= 260);
  assertEquals(content.social_card.title, 'Referral loop shipped');
  assertEquals(content.social_card.subtitle, 'Auditable rewards for successful referral conversion');
  assertEquals(records.length, 1);

  const stored = records[0];
  assertEquals(stored.bounty_id, bounty.id);
  assertEquals(stored.tweet, content.tweet);
  assertEquals(stored.thread, content.thread);
  assertEquals(stored.blog_post, content.blog_post);
  assertEquals(stored.social_card, content.social_card);
  assertEquals(stored.llm_provider, 'mock');
  assertEquals(stored.created_at, '2026-07-03T00:00:00.000Z');
  assert(stored.content_hash.length >= 8);
});

Deno.test('generate_content produces unique hashes and card footers per bounty', async () => {
  const records: OutreachRecord[] = [];
  const store = createStore(records);

  const first = await generate_content(bounty.id, {
    store,
    llm: createMockLLM(llmResponse),
    now: () => new Date('2026-07-03T00:00:00.000Z'),
  });
  const second = await generate_content(secondBounty.id, {
    store,
    llm: createMockLLM(llmResponse),
    now: () => new Date('2026-07-03T00:00:01.000Z'),
  });

  assertEquals(records.length, 2);
  assertNotEquals(records[1].content_hash, records[0].content_hash);
  assertNotEquals(second.social_card.footer, first.social_card.footer);
});

Deno.test('generate_content falls back to complete unique content when LLM output is empty', async () => {
  const records: OutreachRecord[] = [];
  const content = await generate_content(secondBounty.id, {
    store: createStore(records),
    llm: createMockLLM(''),
    now: () => new Date('2026-07-03T00:00:00.000Z'),
  });

  assert(content.tweet.includes(secondBounty.title));
  assertEquals(content.thread.length, 5);
  assert(content.blog_post.split(/\s+/).length >= 260);
  assertEquals(content.social_card.title, secondBounty.title);
  assert(content.social_card.footer.includes(secondBounty.id));
  assertEquals(records[0].social_card, content.social_card);
});

Deno.test('generate_content rejects missing bounty ids', async () => {
  await assertRejects(
    () => generate_content('missing', { store: createStore(), llm: createMockLLM(llmResponse) }),
    Error,
    'Bounty not found',
  );
});
