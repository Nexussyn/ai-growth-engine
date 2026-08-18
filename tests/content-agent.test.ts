import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { generateContent, BountyOutcome } from '../src/agents/content-agent.ts';

Deno.test('Content Agent: generates tweet, thread, and blog post from bounty', () => {
  const mockBounty: BountyOutcome = {
    id: 'bounty_123',
    title: '[AGENT-TASK] Implement Tiered Pricing Engine',
    scope: 'Implemented 4-tier pricing model for x402 API calls with automated SQL migrations and unit tests.',
    contributor: 'angelTomo9',
    rewardUSDC: 15,
    mergedAt: new Date(),
    impactMetrics: '+30% revenue boost from tier-based monetization'
  };

  const content = generateContent(mockBounty);

  // Check Tweet
  assertEquals(typeof content.tweet, 'string');
  assertEquals(content.tweet.includes('angelTomo9'), true);
  assertEquals(content.tweet.includes('$15 USDC'), true);

  // Check Thread
  assertEquals(content.thread.length, 5);
  assertEquals(content.thread[0].startsWith('1/5'), true);
  assertEquals(content.thread[4].startsWith('5/5'), true);

  // Check Blog Post
  assertEquals(typeof content.blogPost, 'string');
  assertEquals(content.blogPost.includes('Case Study'), true);
  assertEquals(content.blogPost.includes('$15 USDC'), true);
});
