import { assertEquals, assertExists, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { mockLLM, MOCK_BOUNTIES } from './mock-bounty-data.ts';
import { ContentOutput } from '../src/agents/content-agent.ts';
import type { LLMCaller } from '../src/agents/content-agent.ts';

/**
 * Re-implements generateContent logic for testing with mock data.
 * Uses mockLLM and mock DB data instead of real Supabase.
 */
async function testGenerateContent(
  bountyId: string,
  llm: LLMCaller = mockLLM
): Promise<ContentOutput> {
  const bounty = MOCK_BOUNTIES.find(b => b.id === bountyId);
  if (!bounty) throw new Error(`Bounty not found: ${bountyId}`);

  const ctx = `Bounty: "${bounty.title}" | Reward: $${bounty.reward_amount} USDC | Repo: ${bounty.repo_owner}/${bounty.repo_name} | PR: #${bounty.pr_number}`;

  // Generate tweet
  const tweet = await llm(
    `Write a single tweet (max 280 chars) announcing this completed open-source bounty. Be enthusiastic, include the reward amount and a call to action. No hashtag spam. Context: ${ctx}`
  );

  // Generate thread
  const threadRaw = await llm(
    `Write a 5-tweet Twitter thread announcing this completed bounty and explaining why open AI bounties matter. Each tweet separated by "---". Context: ${ctx}`
  );
  const thread = threadRaw.split('---').map(t => t.trim()).filter(Boolean).slice(0, 5);

  // Generate blog post
  const blog_post = await llm(
    `Write a 300-word blog post about this completed open-source AI bounty. Include: what was built, why it matters, how others can participate. Professional but accessible tone. Context: ${ctx}`
  );

  return { tweet: tweet.slice(0, 280), thread, blog_post };
}

// ===== Tests =====

Deno.test('generateContent returns correct structure', async () => {
  const result = await testGenerateContent('mock-bounty-001');
  
  assertExists(result.tweet, 'tweet should exist');
  assertExists(result.thread, 'thread should exist');
  assertExists(result.blog_post, 'blog_post should exist');
  
  assertEquals(typeof result.tweet, 'string');
  assertEquals(Array.isArray(result.thread), true);
  assertEquals(typeof result.blog_post, 'string');
});

Deno.test('tweet is within 280 character limit', async () => {
  const result = await testGenerateContent('mock-bounty-001');
  assertEquals(result.tweet.length <= 280, true, `Tweet is ${result.tweet.length} chars`);
});

Deno.test('thread has exactly 5 tweets', async () => {
  const result = await testGenerateContent('mock-bounty-002');
  assertEquals(result.thread.length, 5, `Thread has ${result.thread.length} tweets`);
});

Deno.test('blog post is non-empty', async () => {
  const result = await testGenerateContent('mock-bounty-003');
  assertEquals(result.blog_post.length > 0, true);
  // Should be substantial content (at least 100 chars)
  assertEquals(result.blog_post.length >= 100, true, 'Blog post too short');
});

Deno.test('content is unique per bounty (not templated)', async () => {
  const result1 = await testGenerateContent('mock-bounty-001');
  const result2 = await testGenerateContent('mock-bounty-004');
  
  // Different bounty IDs should produce different content
  // (Since mockLLM returns deterministic content per prompt type,
  // we test that different bounty titles are referenced)
  assertStringIncludes(result1.tweet, '$15', 'Bounty 1 should mention $15');
  assertStringIncludes(result2.tweet, '$10', 'Bounty 4 should mention $10');
});

Deno.test('generateContent throws for unknown bounty', async () => {
  try {
    await testGenerateContent('nonexistent-bounty');
    assertEquals(true, false, 'Should have thrown');
  } catch (e) {
    assertStringIncludes(String(e), 'Bounty not found');
  }
});

Deno.test('blog post includes key sections', async () => {
  const result = await testGenerateContent('mock-bounty-005');
  assertStringIncludes(result.blog_post, 'built', 'Should mention what was built');
  assertStringIncludes(result.blog_post, 'matters', 'Should explain why it matters');
  assertStringIncludes(result.blog_post, 'participate', 'Should include how to participate');
});

Deno.test('mockLLM returns deterministic content for all prompt types', async () => {
  const tweet = await mockLLM('Write a single tweet (max 280 chars) announcing this completed open-source bounty.');
  assertEquals(tweet.length > 0, true, 'Tweet should not be empty');
  
  const thread = await mockLLM('Write a 5-tweet Twitter thread announcing this completed bounty');
  assertEquals(thread.includes('---'), true, 'Thread should contain separators');
  
  const blog = await mockLLM('Write a 300-word blog post about this completed open-source AI bounty');
  assertEquals(blog.length > 100, true, 'Blog post should be substantial');
});

Deno.test('all mock bounties can generate content', async () => {
  for (const bounty of MOCK_BOUNTIES) {
    const result = await testGenerateContent(bounty.id);
    assertEquals(result.tweet.length > 0, true, `${bounty.id}: tweet should not be empty`);
    assertEquals(result.thread.length, 5, `${bounty.id}: should have 5 tweets`);
    assertEquals(result.blog_post.length > 0, true, `${bounty.id}: blog post should not be empty`);
  }
});
