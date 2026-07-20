import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  generate_content,
  generateContentOffline,
  storeOutreach,
  type BountyInput,
} from '../src/agents/content-agent.ts';

const mockA: BountyInput = {
  id: 'b1',
  title: 'Fix offline queue clear',
  description: 'Clear queue after server ACK',
  reward_amount: 15,
  repo_owner: 'cocohub-mobileapp',
  repo_name: 'cocohub-main',
  pr_number: 212,
};

const mockB: BountyInput = {
  id: 'b2',
  title: 'Deep link t3code protocol',
  reward_amount: 100,
  repo_owner: 'UnsafeLabs',
  repo_name: 'Bounty-Hunters',
  pr_number: 8045,
};

Deno.test('generate_content returns tweet/thread/blog', async () => {
  const out = await generate_content(mockA);
  assertEquals(typeof out.tweet, 'string');
  assertEquals(out.tweet.length <= 280, true);
  assertEquals(out.thread.length, 5);
  assertEquals(out.blog_post.length > 100, true);
});

Deno.test('content unique per bounty (not identical template)', () => {
  const a = generateContentOffline(mockA);
  const b = generateContentOffline(mockB);
  assertNotEquals(a.tweet, b.tweet);
  assertNotEquals(a.blog_post, b.blog_post);
});

Deno.test('storeOutreach appends outreach_sent rows', async () => {
  const rows: Array<{ bounty_id: string; content: unknown; sent_at: string }> = [];
  const content = await generate_content(mockA);
  storeOutreach(rows as never, mockA.id, content);
  assertEquals(rows.length, 1);
  assertEquals(rows[0].bounty_id, 'b1');
});
