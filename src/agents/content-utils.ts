/**
 * Pure helpers for the content-generation agent.
 * Kept dependency-free so they can be tested without Supabase or LLM credentials.
 */

export interface ContentOutput {
  tweet: string;
  thread: string[];
  blog_post: string;
}

export function clipTweet(text: string): string {
  return text.trim().slice(0, 280);
}

export function splitThread(raw: string): string[] {
  const normalized = raw
    .replace(/\r/g, '')
    .replace(/\*\*Tweet\s*\d+\s*:?\*\*/gi, '')
    .trim();

  const parts = normalized
    .split(/\n\s*---\s*\n|\n\s*\d+[.)]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.slice(0, 5);
}

export function validateContent(output: ContentOutput): void {
  if (!output.tweet || output.tweet.length > 280) {
    throw new Error('Generated tweet must be non-empty and <= 280 characters');
  }
  if (output.thread.length !== 5 || output.thread.some((item) => !item)) {
    throw new Error('Generated thread must contain exactly 5 non-empty tweets');
  }

  const normalized = [
    output.tweet,
    ...output.thread,
    output.blog_post,
  ].map((item) => item.trim().toLowerCase());

  if (new Set(normalized).size !== normalized.length) {
    throw new Error('Generated content must contain unique outputs');
  }
}

export function buildContext(bounty: {
  title: string;
  description?: string | null;
  reward_amount?: number | string | null;
  repo_owner?: string | null;
  repo_name?: string | null;
  pr_number?: number | null;
}): string {
  return [
    `Bounty: "${bounty.title}"`,
    bounty.description ? `Scope: ${bounty.description}` : '',
    `Reward: $${bounty.reward_amount ?? 0} USDC`,
    bounty.repo_owner && bounty.repo_name ? `Repo: ${bounty.repo_owner}/${bounty.repo_name}` : '',
    bounty.pr_number != null ? `PR: #${bounty.pr_number}` : '',
  ].filter(Boolean).join(' | ');
}
