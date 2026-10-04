/**
 * Content agent tests (Issue #5).
 *
 * The LLM layer and the Supabase client are both mocked: no real API calls,
 * no env vars, no network. Run with: deno test --allow-env tests/
 */
import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  __setDb,
  __setLLM,
  generateContent,
} from '../src/agents/content-agent.ts';

// ---------------------------------------------------------------------------
// Mock bounty data
// ---------------------------------------------------------------------------

interface MockBounty {
  id: string;
  title: string;
  description: string;
  reward_amount: number;
  repo_owner: string;
  repo_name: string;
  pr_number: number;
}

const BOUNTY_A: MockBounty = {
  id: 'bounty-a',
  title: 'Add dark-mode toggle to landing page',
  description: 'Implement a theme toggle with system-preference detection',
  reward_amount: 5,
  repo_owner: 'Nexussyn',
  repo_name: 'ai-growth-engine',
  pr_number: 42,
};

const BOUNTY_B: MockBounty = {
  id: 'bounty-b',
  title: 'Fix retry backoff in x402 payment verifier',
  description: 'Exponential backoff with jitter on 429 responses',
  reward_amount: 10,
  repo_owner: 'Nexussyn',
  repo_name: 'ai-growth-engine',
  pr_number: 43,
};

// ---------------------------------------------------------------------------
// Mock DB: implements the tiny slice of the Supabase client that
// generateContent uses, and records every outreach_sent insert.
// ---------------------------------------------------------------------------

interface InsertRecord {
  table: string;
  row: Record<string, unknown>;
}

function makeMockDb(bounties: Record<string, MockBounty>) {
  const inserts: InsertRecord[] = [];
  const db = {
    inserts,
    from(table: string) {
      if (table === 'bounty_executions') {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, id: string) => ({
              maybeSingle: async () => ({ data: bounties[id] ?? null, error: null }),
            }),
          }),
        };
      }
      if (table === 'outreach_sent') {
        return {
          insert: async (row: Record<string, unknown>) => {
            inserts.push({ table, row });
            return { data: [row], error: null };
          },
        };
      }
      throw new Error(`mock db: unexpected table "${table}"`);
    },
  };
  return db;
}

// ---------------------------------------------------------------------------
// Mock LLM: deterministic, bounty-aware (reads the bounty title out of the
// prompt context), so uniqueness tests are meaningful.
// ---------------------------------------------------------------------------

function bountyTitleFromPrompt(prompt: string): string {
  const m = /Bounty: "([^"]+)"/.exec(prompt);
  return m ? m[1] : 'unknown bounty';
}

function makeMockLLM() {
  const prompts: string[] = [];
  const fn = async (prompt: string): Promise<string> => {
    prompts.push(prompt);
    const title = bountyTitleFromPrompt(prompt);

    if (prompt.startsWith('Write a single tweet')) {
      return `🚀 Bounty complete: "${title}" just shipped and paid out! Open AI bounties turn real work into real USDC. Want your PR to pay? Grab an open bounty and ship it today — the queue is wide open and waiting for you!`;
    }

    if (prompt.startsWith('Write a 5-tweet Twitter thread')) {
      return [
        `1/5 Bounty complete: "${title}" just shipped. Open AI bounties are turning backlogs into paydays.`,
        `2/5 A contributor picked it up, opened the PR, and got paid in USDC. No interviews. No gatekeeping.`,
        `3/5 Why it matters: well-scoped tasks let anyone prove skill in public. The work speaks for itself.`,
        `4/5 Maintainers win too: the backlog shrinks while the contributor community grows. Everybody eats.`,
        `5/5 Your move: grab an open bounty, ship the PR, collect the USDC. The queue is open right now.`,
      ].join(' --- ');
    }

    // Blog post: bounty title first, padded to exactly 300 words.
    const words = title.split(/\s+/);
    while (words.length < 300) words.push('blog');
    return words.join(' ');
  };
  return { fn, prompts };
}

function setup(bounties: Record<string, MockBounty> = { [BOUNTY_A.id]: BOUNTY_A }) {
  const db = makeMockDb(bounties);
  const llm = makeMockLLM();
  __setDb(db as never);
  __setLLM(llm.fn);
  return { db, llm };
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test('generateContent returns {tweet, thread, blog_post} shape', async () => {
  setup();
  const out = await generateContent('bounty-a');
  assertEquals(Object.keys(out).sort(), ['blog_post', 'thread', 'tweet']);
  assert(typeof out.tweet === 'string', 'tweet is a string');
  assert(Array.isArray(out.thread), 'thread is an array');
  assert(out.thread.every((t) => typeof t === 'string'), 'thread entries are strings');
  assert(typeof out.blog_post === 'string', 'blog_post is a string');
});

Deno.test('tweet is truncated to 280 chars', async () => {
  setup();
  // Mock LLM returns a 400-char tweet; generateContent must cap it at 280.
  __setLLM(async () => 'x'.repeat(400));
  const out = await generateContent('bounty-a');
  assert(out.tweet.length <= 280, `tweet is ${out.tweet.length} chars, expected <= 280`);
  assertEquals(out.tweet.length, 280);
});

Deno.test('thread has exactly 5 entries', async () => {
  setup();
  const out = await generateContent('bounty-a');
  assertEquals(out.thread.length, 5);
  assert(out.thread.every((t) => t.length > 0), 'no empty thread entries');
});

Deno.test('blog post is roughly 300 words', async () => {
  setup();
  const out = await generateContent('bounty-a');
  const n = wordCount(out.blog_post);
  assert(n >= 250 && n <= 350, `blog post is ${n} words, expected 250-350`);
});

Deno.test('content is unique per bounty (not templated)', async () => {
  const { llm } = setup({ [BOUNTY_A.id]: BOUNTY_A, [BOUNTY_B.id]: BOUNTY_B });
  const a = await generateContent('bounty-a');
  const b = await generateContent('bounty-b');

  // Prompts sent to the LLM differ per bounty (per-bounty context injected).
  assert(llm.prompts.some((p) => p.includes(BOUNTY_A.title)), 'LLM saw bounty A context');
  assert(llm.prompts.some((p) => p.includes(BOUNTY_B.title)), 'LLM saw bounty B context');

  // Outputs differ per bounty and reference their own bounty.
  assert(a.tweet !== b.tweet, 'tweets differ across bounties');
  assertStringIncludes(a.tweet, BOUNTY_A.title);
  assertStringIncludes(b.tweet, BOUNTY_B.title);
  assert(
    a.thread.join('\n') !== b.thread.join('\n'),
    'threads differ across bounties',
  );
  assert(a.blog_post !== b.blog_post, 'blog posts differ across bounties');
});

Deno.test('content is persisted to outreach_sent', async () => {
  const { db } = setup();
  const out = await generateContent('bounty-a');

  assertEquals(db.inserts.length, 1, 'exactly one outreach_sent insert');
  const { table, row } = db.inserts[0];
  assertEquals(table, 'outreach_sent');
  assertEquals(row.bounty_id, 'bounty-a');
  assertEquals(row.channel, 'content_agent');
  assert(typeof row.sent_at === 'string' && row.sent_at.length > 0, 'sent_at recorded');

  // Stored JSON round-trips to the returned content.
  const stored = JSON.parse(row.content as string) as typeof out;
  assertEquals(stored.tweet, out.tweet);
  assertEquals(stored.thread, out.thread);
  assertEquals(stored.blog_post, out.blog_post);
});

Deno.test('throws when the bounty is not found', async () => {
  setup({});
  await assertRejects(
    () => generateContent('does-not-exist'),
    Error,
    'Bounty not found: does-not-exist',
  );
});

Deno.test('LLM failures propagate instead of being swallowed', async () => {
  setup();
  __setLLM(async () => {
    throw new Error('llm exploded');
  });
  await assertRejects(() => generateContent('bounty-a'), Error, 'llm exploded');
});
