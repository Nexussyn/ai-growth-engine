import assert from 'node:assert/strict';
import { createMockLLM, generate_content, type BountyOutcome, type OutreachRecord } from '../src/agents/content-agent';

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

async function run() {
  const records: OutreachRecord[] = [];
  const store = {
    async getBountyOutcome(bountyId: string) {
      if (bountyId === bounty.id) return bounty;
      if (bountyId === secondBounty.id) return secondBounty;
      return null;
    },
    async upsertOutreachSent(record: OutreachRecord) {
      records.push(record);
    },
  };

  const content = await generate_content(bounty.id, {
    store,
    llm: createMockLLM(llmResponse),
    now: () => new Date('2026-07-03T00:00:00.000Z'),
  });

  assert.equal(content.tweet.length <= 280, true);
  assert.equal(content.thread.length, 5);
  assert.equal(content.blog_post.split(/\s+/).length >= 260, true);
  assert.equal(content.social_card.title, 'Referral loop shipped');
  assert.equal(records.length, 1);
  const stored = records[0];
  assert.equal(stored.bounty_id, bounty.id);
  assert.equal(stored.tweet, content.tweet);
  assert.deepEqual(stored.thread, content.thread);
  assert.equal(stored.blog_post, content.blog_post);
  assert.deepEqual(stored.social_card, content.social_card);
  assert.equal(stored.llm_provider, 'mock');
  assert.equal(stored.created_at, '2026-07-03T00:00:00.000Z');
  assert.equal(stored.content_hash.length >= 8, true);

  const second = await generate_content(secondBounty.id, {
    store,
    llm: createMockLLM(llmResponse),
    now: () => new Date('2026-07-03T00:00:01.000Z'),
  });
  const secondStored = records[1];
  assert.notEqual(secondStored.content_hash, stored.content_hash);
  assert.notEqual(second.social_card.footer, content.social_card.footer);

  await assert.rejects(
    () => generate_content('missing', { store, llm: createMockLLM(llmResponse) }),
    /Bounty not found/,
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
