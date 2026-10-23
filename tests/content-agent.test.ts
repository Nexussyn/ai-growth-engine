import assert from 'node:assert/strict';
import {
  generate_content,
  generateContent,
  validateDraft,
  type BountyRecord,
} from '../src/agents/content-agent.ts';

function make300WordPost(bounty: BountyRecord): string {
  const baseWords = [
    `Bounty`,
    bounty.id,
    `titled`,
    bounty.title,
    `delivered`,
    bounty.outcome ?? 'merged pull request',
    `for`,
    String(bounty.reward_amount ?? 15),
    `USDC.`,
    `Scope:`,
    bounty.scope ?? bounty.description ?? 'engineering task.',
  ];
  const filler =
    'Open-source autonomous engineering workflows accelerate shipping velocity by pairing clear issue specifications with deterministic verification suites, automated code review gates, and transparent on-chain USDC settlement across contributors worldwide.';
  const words = [...baseWords];
  while (words.join(' ').split(/\s+/).length < 285) {
    words.push(filler);
  }
  return words.join(' ').split(/\s+/).slice(0, 300).join(' ');
}

function createMockFetch(bountiesById: Record<string, BountyRecord>) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}'));
    const prompt: string =
      body.messages?.[0]?.content ??
      body.contents?.[0]?.parts?.[0]?.text ??
      body.prompt ??
      '';
    const matched = Object.values(bountiesById).find((b) => prompt.includes(`Bounty ID: ${b.id}`));
    const b = matched ?? Object.values(bountiesById)[0];

    let text = '';
    if (prompt.includes('single tweet')) {
      text = `Shipped "${b.title}" (${b.outcome}) for $${b.reward_amount} USDC! Build with us on open-source AI bounties.`;
    } else if (prompt.includes('5-tweet Twitter thread')) {
      text = [
        `1/5 Completed bounty ${b.id}: ${b.title} ($${b.reward_amount} USDC).`,
        `2/5 Scope tackled: ${b.scope ?? b.description}.`,
        `3/5 Outcome verified: ${b.outcome} with full unit test coverage.`,
        `4/5 Autonomous agents and developers collaborate through verifiable PRs.`,
        `5/5 Claim the next open bounty in ${b.repo_owner}/${b.repo_name} today!`,
      ].join(' --- ');
    } else {
      text = make300WordPost(b);
    }

    if (String(url).includes('groq.com')) {
      return new Response(
        JSON.stringify({ choices: [{ message: { content: text } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;
}

async function runTests() {
  const b1: BountyRecord = {
    id: 'bounty-101',
    title: 'Implement tiered pricing engine',
    scope: '4-tier x402 pricing calculation and overage billing',
    outcome: 'PR #215 merged with 6 unit tests',
    execution_status: 'done',
    reward_amount: 15,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 215,
  };
  const b2: BountyRecord = {
    id: 'bounty-102',
    title: 'Mobile-first landing page with wallet deep-link',
    scope: 'Responsive hero CTA with Coinbase, MetaMask, and Rainbow deep-links',
    outcome: 'PR #216 merged with 5 unit tests',
    execution_status: 'done',
    reward_amount: 10,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 216,
  };

  const inserted: Array<{ bounty_id: string; channel: string; content: string; sent_at: string }> = [];
  const db = {
    async getBounty(id: string) {
      return ({ [b1.id]: b1, [b2.id]: b2 }[id] ?? null);
    },
    async insertOutreach(row: { bounty_id: string; channel: string; content: string; sent_at: string }) {
      inserted.push(row);
    },
  };

  const fetchFn = createMockFetch({ [b1.id]: b1, [b2.id]: b2 });

  // 1. Generates valid tweet, 5-tweet thread, and ~300-word blog post and stores in outreach_sent
  const res1 = await generate_content('bounty-101', {
    db,
    fetchFn,
    env: { GROQ_API_KEY: 'test-groq-key' },
  });
  assert.ok(res1.tweet.length <= 280);
  assert.equal(res1.thread.length, 5);
  const words1 = res1.blog_post.split(/\s+/).length;
  assert.ok(words1 >= 250 && words1 <= 350, `Expected ~300 words, got ${words1}`);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].bounty_id, 'bounty-101');
  assert.equal(inserted[0].channel, 'content_agent');

  // 2. Content is unique per bounty (not templated)
  const res2 = await generateContent('bounty-102', {
    db,
    fetchFn,
    env: { GEMINI_API_KEY: 'test-gemini-key' },
  });
  assert.notEqual(res1.tweet, res2.tweet);
  assert.notEqual(res1.blog_post, res2.blog_post);
  assert.notDeepEqual(res1.thread, res2.thread);
  assert.equal(inserted.length, 2);

  // 3. Bounded provider fallback (Groq failure falls back to Gemini)
  let groqAttempts = 0;
  const fallbackFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes('groq.com')) {
      groqAttempts += 1;
      return new Response('rate limit', { status: 429 });
    }
    return fetchFn(url, init);
  }) as typeof fetch;

  const resFallback = await generate_content('bounty-101', {
    db,
    fetchFn: fallbackFetch,
    env: { GROQ_API_KEY: 'bad-key', GEMINI_API_KEY: 'good-gemini-key' },
  });
  assert.equal(groqAttempts, 3);
  assert.equal(resFallback.thread.length, 5);

  // 4. Rejects oversized tweets or malformed threads
  assert.throws(() =>
    validateDraft({
      tweet: 'x'.repeat(281),
      thread: ['1', '2', '3', '4', '5'],
      blog_post: res1.blog_post,
    })
  );

  console.log('All content-agent tests passed (4/4 suites).');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
