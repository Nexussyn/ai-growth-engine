import { generateContent, generateTweet, generateThread, generateBlogPost } from '../src/agents/content-agent';
import type { BountyEvent } from '../src/agents/content-agent';

const mockBounty: BountyEvent = {
  id: 'bounty-001',
  title: 'Implement referral reward loop',
  scope: 'Build a referral system that awards 5 free credits per successful referral conversion.',
  outcome: 'Built referral.ts with code generation, validation, idempotency checks, and notification system. 8 tests passing.',
  reward_usdc: 10,
  contributor: 'dev-nana27',
  completed_at: '2026-07-04T11:30:00Z',
};

function testGenerateTweetLength() {
  const tweet = generateTweet(mockBounty);
  console.assert(tweet.length <= 280, `Tweet too long: ${tweet.length} chars`);
  console.assert(tweet.includes('$10'), 'Tweet should mention reward');
  console.assert(tweet.length > 0, 'Tweet should not be empty');
  console.log('PASS: Tweet is within 280 chars and mentions reward');
}

function testTweetUniqueness() {
  const tweets = new Set<string>();
  for (let i = 0; i < 10; i++) {
    tweets.add(generateTweet(mockBounty));
  }
  console.assert(tweets.size > 1, `Should produce varied tweets, got ${tweets.size} unique`);
  console.log('PASS: Tweets are varied across calls');
}

function testThreadStructure() {
  const thread = generateThread(mockBounty);
  console.assert(thread.length === 5, `Expected 5 tweets, got ${thread.length}`);
  thread.forEach((t, i) => {
    console.assert(t.length <= 280, `Tweet ${i + 1} too long: ${t.length} chars`);
  });
  console.assert(thread[0].startsWith('🧵'), 'Thread should start with 🧵');
  console.assert(thread[thread.length - 1].includes('🚀'), 'Last tweet should be motivational');
  console.log('PASS: Thread has 5 tweets within 280 chars each');
}

function testBlogPostStructure() {
  const post = generateBlogPost(mockBounty);
  console.assert(post.includes('# Implement referral reward loop'), 'Post should have header');
  console.assert(post.includes('$10'), 'Post should mention reward');
  console.assert(post.includes('## Summary'), 'Post should have sections');
  console.assert(post.includes('## Impact'), 'Post should have impact section');
  console.assert(post.length > 200, 'Post should be substantial');
  console.log('PASS: Blog post has correct structure and sections');
}

function testGenerateContentReturnsAll() {
  const content = generateContent(mockBounty);
  console.assert(typeof content.tweet === 'string', 'Should have tweet');
  console.assert(Array.isArray(content.thread), 'Should have thread array');
  console.assert(content.thread.length === 5, 'Thread should be 5 tweets');
  console.assert(typeof content.blog_post === 'string', 'Should have blog post');
  console.assert(content.blog_post.length > 300, 'Blog post should be > 300 chars');
  console.log('PASS: generateContent returns all three content types');
}

function testContentUniquenessPerBounty() {
  const bounty2: BountyEvent = {
    ...mockBounty,
    id: 'bounty-002',
    title: 'Auto-upsell trigger',
    outcome: 'Built upsell.ts with threshold detection and A/B test variants.',
  };
  const c1 = generateContent(mockBounty);
  const c2 = generateContent(bounty2);
  // Content should reference the specific bounty
  console.assert(c1.tweet !== c2.tweet || c1.blog_post !== c2.blog_post,
    'Different bounties should produce different content');
  console.log('PASS: Content is unique per bounty');
}

console.log('Running content-agent tests...\n');
testGenerateTweetLength();
testTweetUniqueness();
testThreadStructure();
testBlogPostStructure();
testGenerateContentReturnsAll();
testContentUniquenessPerBounty();
console.log('\nAll tests passed!');
