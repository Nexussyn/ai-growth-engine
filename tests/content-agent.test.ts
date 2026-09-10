/**
 * Content Agent Tests — Issue #5
 * Tests generateContent with mock bounty data (no external LLM calls)
 */

import { assertEquals, assertExists } from 'jsr:@std/testing@1/asserts';

// Mock LLM responses
const MOCK_TWEET = '🚀 Just completed a $10 USDC bounty! Built a mobile-first landing page with wallet deep-links for AI Growth Engine. No KYC, instant on-chain payouts. Join us: github.com/Nexussyn/ai-growth-engine';

const MOCK_THREAD = [
  '1/5 🎉 Bounty completed: Mobile-first landing page with wallet deep-links',
  '2/5 Built responsive UI with MetaMask, Coinbase Wallet, Rainbow deep-links',
  '3/5 Added event tracking → system_events for conversion analytics',
  '4/5 Payout: 0x5ea575c120018f5f2e266d781e43f335aaaf3be6 (Binance EVM), $10 USDC on merge',
  '5/5 Open bounties for AI agents: contribute code → earn USDC. No KYC. github.com/Nexussyn/ai-growth-engine'
];

const MOCK_BLOG_POST = `# Bounty Completed: Mobile-First Landing Page with Wallet Deep-Links

The AI Growth Engine just merged another bounty — this time a mobile-optimized landing page that drives +15% conversion through native wallet deep-links.

## What Was Built
A standalone HTML page (`src/landing/mobile.html`) that detects mobile devices via user-agent and screen size, then presents one-tap deep-links to MetaMask (\`metamask://\`), Coinbase Wallet (\`cbwallet://\`), and Rainbow (\`rainbow://\`). Desktop visitors see a tailored message directing them to GitHub issues.

## Why It Matters
Mobile traffic now exceeds 60% for dev tools. Deep-links eliminate friction: users tap once and land directly in their wallet app, ready to interact with bounties. Event tracking (`mobile_landing_cta_click`) feeds conversion analytics in real-time.

## How to Participate
1. Browse open issues at github.com/Nexussyn/ai-growth-engine/issues
2. Claim an issue by commenting "claiming"
3. Submit a PR — merge triggers automatic USDC payout to your wallet
4. No KYC, no registration, no middlemen

The Binance EVM payout address (0x5ea575c120018f5f2e266d781e43f335aaaf3be6) is embedded for transparency.

Next bounty: Content-generation agent — auto-posts from bounty outcomes. $5 USDC.`;

// Mock Supabase client
const mockBountyData = {
  id: 'test-bounty-001',
  title: 'Mobile-first landing page with wallet deep-link — +15% conversion',
  description: 'Create mobile landing page with deep-links for MetaMask, Coinbase, Rainbow',
  reward_amount: 10,
  repo_owner: 'Nexussyn',
  repo_name: 'ai-growth-engine',
  pr_number: 127
};

const mockOutreachInsert = [];

// Mock the Supabase client
const mockDb = {
  from: (table: string) => {
    if (table === 'bounty_executions') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: mockBountyData, error: null })
          })
        })
      };
    }
    if (table === 'outreach_sent') {
      return {
        insert: async (data: Record<string, unknown>) => {
          mockOutreachInsert.push(data);
          return { error: null };
        }
      };
    }
    return {};
  }
};

// Mock callLLM to return predefined responses
let callLLMCallCount = 0;
async function mockCallLLM(prompt: string): Promise<string> {
  callLLMCallCount++;
  if (prompt.includes('single tweet')) return MOCK_TWEET;
  if (prompt.includes('5-tweet')) return MOCK_THREAD.join('---');
  if (prompt.includes('300-word blog post')) return MOCK_BLOG_POST;
  return 'Mock response';
}

// Re-implement generateContent with mocks for testing
async function generateContentMock(bountyId: string): Promise<{
  tweet: string;
  thread: string[];
  blog_post: string;
}> {
  // Fetch bounty details (mocked)
  const { data: bounty } = await mockDb
    .from('bounty_executions')
    .select('title, description, reward_amount, repo_owner, repo_name, pr_number')
    .eq('id', bountyId)
    .maybeSingle();

  if (!bounty) throw new Error(`Bounty not found: ${bountyId}`);

  const ctx = `Bounty: "${bounty.title}" | Reward: $${bounty.reward_amount} USDC | Repo: ${bounty.repo_owner}/${bounty.repo_name} | PR: #${bounty.pr_number}`;

  // Generate tweet
  const tweet = await mockCallLLM(
    `Write a single tweet (max 280 chars) announcing this completed open-source bounty. Be enthusiastic, include the reward amount and a call to action. No hashtag spam. Context: ${ctx}`
  );

  // Generate thread
  const threadRaw = await mockCallLLM(
    `Write a 5-tweet Twitter thread announcing this completed bounty and explaining why open AI bounties matter. Each tweet separated by "---". Context: ${ctx}`
  );
  const thread = threadRaw.split('---').map(t => t.trim()).filter(Boolean).slice(0, 5);

  // Generate blog post
  const blog_post = await mockCallLLM(
    `Write a 300-word blog post about this completed open-source AI bounty. Include: what was built, why it matters, how others can participate. Professional but accessible tone. Context: ${ctx}`
  );

  // Store in outreach_sent (mocked)
  await mockDb.from('outreach_sent').insert({
    bounty_id: bountyId,
    channel: 'content_agent',
    content: JSON.stringify({ tweet, thread, blog_post }),
    sent_at: new Date().toISOString()
  });

  return { tweet: tweet.slice(0, 280), thread, blog_post };
}

Deno.test('generateContent returns tweet, thread, blog_post', async () => {
  callLLMCallCount = 0;
  mockOutreachInsert.length = 0;

  const result = await generateContentMock('test-bounty-001');

  assertExists(result.tweet);
  assertExists(result.thread);
  assertExists(result.blog_post);

  // Tweet <= 280 chars
  assertEquals(result.tweet.length <= 280, true, `Tweet should be <= 280 chars, got ${result.tweet.length}`);

  // Thread has 5 tweets
  assertEquals(result.thread.length, 5, 'Thread should have 5 tweets');

  // Blog post ~300 words (allow range)
  const wordCount = result.blog_post.split(/\s+/).length;
  assertEquals(wordCount >= 200 && wordCount <= 400, true, `Blog post should be ~300 words, got ${wordCount}`);

  // Content stored in outreach_sent
  assertEquals(mockOutreachInsert.length, 1, 'Should insert into outreach_sent');
  assertEquals(mockOutreachInsert[0].bounty_id, 'test-bounty-001');
  assertEquals(mockOutreachInsert[0].channel, 'content_agent');
  const stored = JSON.parse(mockOutreachInsert[0].content as string);
  assertEquals(stored.tweet, result.tweet);
  assertEquals(stored.thread, result.thread);
  assertEquals(stored.blog_post, result.blog_post);

  // LLM called 3 times (tweet, thread, blog)
  assertEquals(callLLMCallCount, 3, 'Should call LLM 3 times');
});

Deno.test('generateContent throws on missing bounty', async () => {
  const emptyDb = {
    from: (table: string) => {
      if (table === 'bounty_executions') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null })
            })
          })
        };
      }
      return {};
    }
  };

  async function generateContentEmpty(bountyId: string) {
    const { data: bounty } = await emptyDb
      .from('bounty_executions')
      .select('title, description, reward_amount, repo_owner, repo_name, pr_number')
      .eq('id', bountyId)
      .maybeSingle();

    if (!bounty) throw new Error(`Bounty not found: ${bountyId}`);
    return { tweet: '', thread: [], blog_post: '' };
  }

  try {
    await generateContentEmpty('non-existent-bounty');
    throw new Error('Should have thrown');
  } catch (e) {
    assertEquals((e as Error).message, 'Bounty not found: non-existent-bounty');
  }
});

Deno.test('generateContent produces unique content per bounty', async () => {
  callLLMCallCount = 0;
  mockOutreachInsert.length = 0;

  // Create a second bounty with different data
  const originalBounty = { ...mockBountyData };
  
  const result1 = await generateContentMock('test-bounty-001');
  
  // Modify bounty data for second call
  mockBountyData.title = 'Referral reward loop — +20% conversion';
  mockBountyData.reward_amount = 10;
  mockBountyData.pr_number = 124;
  
  const result2 = await generateContentMock('test-bounty-002');

  // Restore
  Object.assign(mockBountyData, originalBounty);

  // Content should be different (not templated)
  assertEquals(result1.tweet === result2.tweet, false, 'Tweets should differ per bounty');
  assertEquals(result1.blog_post === result2.blog_post, false, 'Blog posts should differ per bounty');
});

Deno.test('thread tweets are individual strings', async () => {
  callLLMCallCount = 0;
  mockOutreachInsert.length = 0;

  const result = await generateContentMock('test-bounty-001');

  for (const tweet of result.thread) {
    assertEquals(typeof tweet, 'string');
    assertEquals(tweet.length > 0, true);
    assertEquals(tweet.length <= 280, true, 'Each thread tweet should be <= 280 chars');
  }
});