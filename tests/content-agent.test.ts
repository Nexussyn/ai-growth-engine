import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { generateContent, formatOutreachRecord, type BountyInput } from '../src/agents/content-agent.ts';

const mockBounty: BountyInput = {
  bountyId: 2,
  title: 'Implement referral reward loop engine',
  contributor: 'angelTomo9',
  rewardAmount: 10,
  rewardCurrency: 'USDC',
  repo: 'Nexussyn/ai-growth-engine',
  summary: 'Implemented viral referral engine with idempotent credit awards and SQL system event tracking.',
  mergedAt: '2026-08-25T03:00:00Z',
};

Deno.test('Content Agent: generates compliant 280-character single tweet', () => {
  const content = generateContent(mockBounty);
  assert(content.tweet.length <= 280, `Tweet length (${content.tweet.length}) exceeds 280 chars`);
  assert(content.tweet.includes('angelTomo9'));
  assert(content.tweet.includes('$10 USDC'));
});

Deno.test('Content Agent: generates structured 5-tweet narrative thread', () => {
  const content = generateContent(mockBounty);
  assertEquals(content.thread.length, 5);
  assert(content.thread[0].startsWith('1/5'));
  assert(content.thread[4].startsWith('5/5'));
  assert(content.thread[3].includes('$10 USDC'));
});

Deno.test('Content Agent: generates structured blog post with case study sections', () => {
  const content = generateContent(mockBounty);
  const words = content.blogPost.trim().split(/\s+/).length;
  assert(words >= 120, `Blog post word count (${words}) is too short`);
  assert(content.blogPost.includes('Case Study:'));
  assert(content.blogPost.includes('Technical Challenge'));
  assert(content.blogPost.includes('On-Chain Settlement'));
});

Deno.test('Content Agent: formats valid database outreach record', () => {
  const content = generateContent(mockBounty);
  const record = formatOutreachRecord(content);

  assertEquals(record.bountyId, 2);
  assertEquals(record.status, 'pending');
  assert(record.id.startsWith('outreach_'));
  assertEquals(record.contentPayload.bountyId, 2);
});
