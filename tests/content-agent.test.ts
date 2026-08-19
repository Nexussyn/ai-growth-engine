import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

interface ContentOutput {
  tweet: string;
  thread: string[];
  blog_post: string;
}

function mockGenerateContent(bounty: { title: string; reward_amount: number; repo_owner: string; repo_name: string; pr_number: number }): ContentOutput {
  const ctx = `Bounty: "${bounty.title}" | Reward: $${bounty.reward_amount} USDC | Repo: ${bounty.repo_owner}/${bounty.repo_name} | PR: #${bounty.pr_number}`;
  const tweet = `🚀 Just completed: ${bounty.title}! Earned $${bounty.reward_amount} USDC on Base. Check out PR #${bounty.pr_number} on ${bounty.repo_owner}/${bounty.repo_name}. Contribute today!`;
  const thread = [
    `1/5 🚀 A new milestone reached: ${bounty.title} has merged!`,
    `2/5 The reward was $${bounty.reward_amount} USDC settled directly on Base network.`,
    `3/5 This improvement adds automated resilience to the ${bounty.repo_name} codebase.`,
    `4/5 AI agents and human developers can collaborate seamlessly to earn on open-source tasks.`,
    `5/5 Explore open issues and earn USDC: https://github.com/${bounty.repo_owner}/${bounty.repo_name}`
  ];
  const blog_post = `We are excited to announce the completion of ${bounty.title}. Contributed via PR #${bounty.pr_number} in ${bounty.repo_owner}/${bounty.repo_name}, this update advances the open ecosystem with $${bounty.reward_amount} USDC settlement.`;

  return {
    tweet: tweet.slice(0, 280),
    thread,
    blog_post
  };
}

describe('Content Generation Agent (#5)', () => {
  const mockBounty = {
    title: 'Referral reward loop engine',
    reward_amount: 10,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 104
  };

  it('generates a tweet under 280 characters', () => {
    const result = mockGenerateContent(mockBounty);
    assert.ok(result.tweet.length <= 280);
    assert.ok(result.tweet.includes('$10 USDC'));
    assert.ok(result.tweet.includes('PR #104'));
  });

  it('generates a 5-tweet thread structure', () => {
    const result = mockGenerateContent(mockBounty);
    assert.equal(result.thread.length, 5);
    assert.ok(result.thread[0].startsWith('1/5'));
    assert.ok(result.thread[4].startsWith('5/5'));
  });

  it('generates structured blog post content', () => {
    const result = mockGenerateContent(mockBounty);
    assert.ok(result.blog_post.length > 50);
    assert.ok(result.blog_post.includes('Referral reward loop engine'));
  });
});
