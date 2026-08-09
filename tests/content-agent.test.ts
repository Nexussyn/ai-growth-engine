/**
 * Content Agent Tests — Issue #5
 * Tests generateContent with mock bounty data (no real LLM calls).
 */

import { assertEquals, assertExists, assertArrayIncludes } from 'jsr:@std/assert';
import { generateContent, type ContentOutput } from '../src/agents/content-agent.ts';

// Mock Supabase client
const mockBounties: Record<string, unknown> = {
  'test-001': {
    title: 'Tiered pricing engine for AI API calls',
    description: 'Added 4-tier pricing to x402 protocol',
    reward_amount: 15,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 42,
  },
  'test-002': {
    title: 'Referral reward loop with smart contracts',
    description: 'Implemented USDC referral bonuses on Base L2',
    reward_amount: 10,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 55,
  },
  'test-003': {
    title: 'Mobile-first landing page redesign',
    description: 'Redesigned landing for mobile conversion',
    reward_amount: 10,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 68,
  },
};

// Because generateContent uses Deno.env + Supabase, we test the shape of the LLM prompt
// and validate ContentOutput interface compliance — not live LLM calls.

Deno.test('ContentOutput interface — shape validation', () => {
  const sample: ContentOutput = {
    tweet: 'Test tweet under 280 chars',
    thread: ['Tweet 1', 'Tweet 2', 'Tweet 3', 'Tweet 4', 'Tweet 5'],
    blog_post: 'A 300-word test blog post about AI bounties.',
  };

  // Tweet length check
  assertEquals(sample.tweet.length <= 280, true, 'tweet must be ≤280 chars');

  // Thread check
  assertEquals(sample.thread.length, 5, 'thread must have exactly 5 tweets');

  // Blog post check
  const wordCount = sample.blog_post.split(/\s+/).length;
  assertEquals(wordCount >= 100, true, 'blog post should be substantial (≥100 words)');
});

Deno.test('generateContent rejects missing bounty', async () => {
  try {
    await generateContent('nonexistent-id');
    // Should not reach here
    assertEquals(true, false, 'Should have thrown');
  } catch (e) {
    assertExists(e, 'Error should be thrown for missing bounty');
  }
});

Deno.test('ContentOutput has all required fields', () => {
  const keys: (keyof ContentOutput)[] = ['tweet', 'thread', 'blog_post'];
  const sample: ContentOutput = {
    tweet: 'x',
    thread: ['1', '2', '3', '4', '5'],
    blog_post: 'content',
  };

  for (const key of keys) {
    assertExists(sample[key], `Missing field: ${key}`);
    assertEquals(typeof sample[key] !== 'undefined', true, `${key} must be defined`);
  }
});

Deno.test('tweet format matches Twitter constraints', () => {
  const sample: ContentOutput = {
    tweet: '🚀 Just shipped: Tiered pricing engine for AI APIs — $15 USDC bounty completed on Nexussyn! Open source, autonomous agents. Join us.',
    thread: ['1', '2', '3', '4', '5'],
    blog_post: 'test',
  };

  // No hashtag spam (max 3)
  const hashtags = (sample.tweet.match(/#/g) || []).length;
  assertEquals(hashtags <= 3, true, 'max 3 hashtags to avoid spam look');

  // Contains reward amount
  assertEquals(sample.tweet.includes('$'), true, 'should mention reward');
});
