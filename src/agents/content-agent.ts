/**
 * Content Generation Agent — Issue #5
 * generate_content(bounty_id) → { tweet, thread, blog_post }
 * LLM is injectable so tests run without API keys.
 */

export interface BountyRecord {
  id: string;
  title: string;
  description?: string;
  scope?: string;
  outcome?: string;
  reward_amount?: number;
  repo_owner?: string;
  repo_name?: string;
  pr_number?: number;
}

export interface ContentOutput {
  tweet: string;
  thread: string[];
  blog_post: string;
}

export interface OutreachRow {
  bounty_id: string;
  tweet: string;
  thread: string[];
  blog_post: string;
  created_at: string;
}

export interface ContentStore {
  getBounty(id: string): Promise<BountyRecord | undefined>;
  saveOutreach(row: OutreachRow): Promise<void>;
  hasOutreach(bountyId: string): Promise<boolean>;
}

export type LLMFn = (prompt: string) => Promise<string>;

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + '…';
}

/** Deterministic local generator used when no LLM is configured (still unique per bounty). */
export async function localLLM(prompt: string): Promise<string> {
  const titleMatch = /Title:\s*(.+?)(?:\n|$)/i.exec(prompt);
  const title = titleMatch?.[1]?.trim() || 'a shipped bounty';
  const rewardMatch = /Reward:\s*\$?([\d.]+)/i.exec(prompt);
  const reward = rewardMatch?.[1] || '?';
  if (prompt.includes('SINGLE_TWEET')) {
    return `Just shipped: ${title} — $${reward} USDC on merge. Open bounties, real PRs, real payouts. Join in.`;
  }
  if (prompt.includes('THREAD')) {
    return [
      `1/ We just closed: ${title}.`,
      `2/ Reward was $${reward} USDC — paid on merge, no gatekeeping.`,
      `3/ Scope was clear; agents + humans can claim, build, and get paid.`,
      `4/ Outcome: ${title} is live in the growth engine.`,
      `5/ Want in? Pick an open bounty and ship. Wallet in the PR.`,
    ].join('\n---\n');
  }
  // blog
  return [
    `# Shipping in public: ${title}`,
    '',
    `We finished "${title}" and logged a $${reward} USDC bounty on merge.`,
    'The growth engine turns completed work into outreach automatically: a short post for X,',
    'a five-part thread for context, and a short blog for people who want the story.',
    '',
    'Why it matters: open bounties only work if completion is visible. Unique copy per bounty',
    'keeps the signal from looking copy-pasted. Free LLM backends (Groq, Gemini, Ollama) are',
    'optional — tests inject a mock so CI stays keyless.',
    '',
    'How to participate: comment claiming on an open issue, open a PR with your wallet, and',
    'let the merge trigger payout. This post itself is generated from the bounty record so',
    `the narrative stays tied to what actually shipped — starting with ${title}.`,
  ].join('\n');
}

export async function groqLLM(apiKey: string, prompt: string): Promise<string> {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1200,
    }),
  });
  if (!r.ok) throw new Error(`Groq error ${r.status}`);
  const data = await r.json();
  return data.choices?.[0]?.message?.content ?? '';
}

function buildContext(b: BountyRecord): string {
  return [
    `Title: ${b.title}`,
    `Description: ${b.description ?? ''}`,
    `Scope: ${b.scope ?? ''}`,
    `Outcome: ${b.outcome ?? 'merged'}`,
    `Reward: $${b.reward_amount ?? 0} USDC`,
    `Repo: ${b.repo_owner ?? ''}/${b.repo_name ?? ''} PR #${b.pr_number ?? ''}`,
  ].join('\n');
}

/**
 * Acceptance-criteria name: generate_content(bounty_id)
 */
export async function generate_content(
  bounty_id: string,
  opts: { store: ContentStore; llm?: LLMFn } ,
): Promise<ContentOutput> {
  const bounty = await opts.store.getBounty(bounty_id);
  if (!bounty) throw new Error(`Bounty not found: ${bounty_id}`);

  const llm = opts.llm ?? localLLM;
  const ctx = buildContext(bounty);

  const tweetRaw = await llm(`SINGLE_TWEET\n${ctx}\nWrite one tweet max 280 chars.`);
  const threadRaw = await llm(`THREAD\n${ctx}\nWrite 5 tweets separated by ---`);
  const blog_post = (await llm(`BLOG\n${ctx}\nWrite ~300 word blog post.`)).trim();

  const thread = threadRaw
    .split('---')
    .map((t) => clip(t.replace(/^\d+\/\s*/, ''), 280))
    .filter(Boolean)
    .slice(0, 5);

  while (thread.length < 5) {
    thread.push(clip(`${bounty.title} — update ${thread.length + 1}`, 280));
  }

  const out: ContentOutput = {
    tweet: clip(tweetRaw, 280),
    thread,
    blog_post,
  };

  await opts.store.saveOutreach({
    bounty_id,
    tweet: out.tweet,
    thread: out.thread,
    blog_post: out.blog_post,
    created_at: new Date().toISOString(),
  });

  return out;
}

/** camelCase alias */
export const generateContent = generate_content;

export function createMemoryContentStore(seed: BountyRecord[] = []): ContentStore & {
  outreach: Map<string, OutreachRow>;
} {
  const bounties = new Map(seed.map((b) => [b.id, b]));
  const outreach = new Map<string, OutreachRow>();
  return {
    outreach,
    async getBounty(id) {
      return bounties.get(id);
    },
    async saveOutreach(row) {
      outreach.set(row.bounty_id, row);
    },
    async hasOutreach(bountyId) {
      return outreach.has(bountyId);
    },
  };
}
