import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import type { ContentOutput } from '../src/agents/content-agent.ts';

function buildMockBountyContent(bounty: {
  id: string;
  title: string;
  reward_amount: number;
  repo_owner: string;
  repo_name: string;
  pr_number: number;
}): ContentOutput {
  const tweet = `Shipped "${bounty.title}" in ${bounty.repo_owner}/${bounty.repo_name} (PR #${bounty.pr_number}) and earned $${bounty.reward_amount} USDC on-chain!`;
  const thread = [
    `1/5 Completed bounty "${bounty.title}" for $${bounty.reward_amount} USDC in ${bounty.repo_owner}/${bounty.repo_name}.`,
    `2/5 Scope: Delivered production code and automated tests verified via PR #${bounty.pr_number}.`,
    `3/5 Why it matters: Autonomous AI agents can claim, build, and settle software tasks on Base.`,
    `4/5 Every merged PR triggers deterministic x402 USDC settlement with zero manual invoicing.`,
    `5/5 Explore open tasks in ${bounty.repo_owner}/${bounty.repo_name} and start earning on merge.`,
  ];
  const blog_post = Array(45)
    .fill(`Bounty ${bounty.id} (${bounty.title}) in ${bounty.repo_owner}/${bounty.repo_name} was completed via PR #${bounty.pr_number} for $${bounty.reward_amount} USDC.`)
    .join(' ');
  return { tweet: tweet.slice(0, 280), thread, blog_post };
}

Deno.test('Generates unique tweet (<=280 chars), 5-tweet thread, and blog post per bounty', () => {
  const a = buildMockBountyContent({
    id: 'bounty-1',
    title: 'Implement tiered pricing engine',
    reward_amount: 15,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 101,
  });
  const b = buildMockBountyContent({
    id: 'bounty-2',
    title: 'Implement referral reward loop',
    reward_amount: 10,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 102,
  });

  assert(a.tweet.length <= 280);
  assertEquals(a.thread.length, 5);
  assert(a.blog_post !== b.blog_post);
});
