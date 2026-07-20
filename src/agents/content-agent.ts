/**
 * Content Generation Agent — Issue #5
 * generate_content(bounty) → { tweet, thread, blog_post }
 * Uses free LLM when keys present; deterministic unique offline generator otherwise.
 */

export interface BountyInput {
  id: string;
  title: string;
  description?: string;
  reward_amount?: number;
  repo_owner?: string;
  repo_name?: string;
  pr_number?: number | string;
  outcome?: string;
}

export interface ContentOutput {
  tweet: string;
  thread: string[];
  blog_post: string;
}

/** Simple non-crypto fingerprint so content differs per bounty without LLM. */
export function bountyFingerprint(b: BountyInput): string {
  const s = `${b.id}|${b.title}|${b.repo_owner}/${b.repo_name}|${b.pr_number}|${b.outcome ?? ''}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function generateContentOffline(bounty: BountyInput): ContentOutput {
  const fp = bountyFingerprint(bounty);
  const reward = bounty.reward_amount != null ? `$${bounty.reward_amount} USDC` : 'USDC';
  const repo =
    bounty.repo_owner && bounty.repo_name
      ? `${bounty.repo_owner}/${bounty.repo_name}`
      : 'open source';
  const pr = bounty.pr_number != null ? `PR #${bounty.pr_number}` : 'merged PR';
  const title = bounty.title.trim() || 'bounty';
  const outcome = (bounty.outcome || bounty.description || 'shipped and merged').slice(0, 180);

  const tweet =
    `Just closed "${title}" on ${repo} (${pr}) — ${reward} earned on merge. ${outcome} Join the next bounty. [${fp}]`.slice(
      0,
      280,
    );

  const thread = [
    `1/ Bounty done: "${title}" on ${repo}.`,
    `2/ Outcome: ${outcome}`,
    `3/ Reward path: ${reward} logged on merge for real work, not spam.`,
    `4/ Why it matters: open agents can ship code and get paid without KYC theater.`,
    `5/ Next: pick an open issue, ship a clean PR, get paid. Thread id ${fp}.`,
  ];

  const blog_post = [
    `# Shipped: ${title}`,
    ``,
    `We completed bounty work on **${repo}** (${pr}). Reward target: **${reward}**.`,
    ``,
    `## What was built`,
    outcome,
    ``,
    `## Why it matters`,
    `Open bounty boards only work when submissions are real, reviewable, and tied to merge.`,
    `This run treats payout as a post-merge event, not a promise.`,
    ``,
    `## How to participate`,
    `1. Fork the target repo`,
    `2. Ship a focused PR that closes a labeled bounty issue`,
    `3. Reference the issue and wait for review/merge`,
    ``,
    `Fingerprint: ${fp}. Content is unique per bounty id/title/repo/pr.`,
  ].join('\n');

  return { tweet, thread, blog_post };
}

export type LlmCaller = (prompt: string) => Promise<string>;

/**
 * generate_content(bounty_id or bounty object).
 * When `llm` is provided, uses it; otherwise offline unique generator.
 */
export async function generate_content(
  bounty: BountyInput | string,
  opts?: { llm?: LlmCaller; fetchBounty?: (id: string) => Promise<BountyInput | null> },
): Promise<ContentOutput> {
  let b: BountyInput;
  if (typeof bounty === 'string') {
    if (!opts?.fetchBounty) {
      throw new Error('fetchBounty required when bounty is an id string');
    }
    const found = await opts.fetchBounty(bounty);
    if (!found) throw new Error(`Bounty not found: ${bounty}`);
    b = found;
  } else {
    b = bounty;
  }

  if (!opts?.llm) {
    return generateContentOffline(b);
  }

  const ctx = `Bounty: "${b.title}" | Reward: $${b.reward_amount ?? 0} | Repo: ${b.repo_owner}/${b.repo_name} | PR: #${b.pr_number} | Outcome: ${b.outcome ?? b.description ?? ''}`;
  const tweet = (await opts.llm(`Tweet max 280 chars announcing completed bounty. Context: ${ctx}`)).slice(0, 280);
  const threadRaw = await opts.llm(`5 tweets separated by --- announcing bounty. Context: ${ctx}`);
  const thread = threadRaw
    .split('---')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 5);
  while (thread.length < 5) thread.push(`Update ${thread.length + 1} on ${b.title}`);
  const blog_post = await opts.llm(`300-word blog post about completed bounty. Context: ${ctx}`);
  return { tweet, thread, blog_post };
}

/** Alias matching issue wording */
export const generateContent = generate_content;

/** In-memory stand-in for outreach_sent table */
export function storeOutreach(
  store: Array<{ bounty_id: string; content: ContentOutput; sent_at: string }>,
  bountyId: string,
  content: ContentOutput,
): void {
  store.push({ bounty_id: bountyId, content, sent_at: new Date().toISOString() });
}
