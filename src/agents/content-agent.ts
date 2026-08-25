export interface BountyInput {
  bountyId: string | number;
  title: string;
  contributor: string;
  rewardAmount: string | number;
  rewardCurrency?: string;
  repo: string;
  summary: string;
  mergedAt?: string;
}

export interface GeneratedContent {
  bountyId: string | number;
  tweet: string;
  thread: string[];
  blogPost: string;
  generatedAt: string;
}

export interface OutreachRecord {
  id: string;
  bountyId: string | number;
  channel: string;
  contentPayload: GeneratedContent;
  status: 'pending' | 'published';
  createdAt: string;
}

export function generateContent(bounty: BountyInput): GeneratedContent {
  const currency = bounty.rewardCurrency || 'USDC';
  const repoName = bounty.repo || 'Nexussyn/ai-growth-engine';
  const now = new Date().toISOString();

  // 1. Single 280-char Tweet
  const tweet = `🚀 Bounty Completed on ${repoName}!\n\n` +
    `"${bounty.title}" by @${bounty.contributor}\n` +
    `💰 Reward: $${bounty.rewardAmount} ${currency} paid on-chain.\n\n` +
    `Contribute code & earn with AI Growth Engine ⚡ #Web3 #AI #OpenSource`;

  // 2. 5-Tweet Narrative Thread
  const thread: string[] = [
    `1/5 ⚡ Another milestone achieved! We just merged and settled Bounty #${bounty.bountyId} on ${repoName}. Here is the technical breakdown 🧵👇`,
    `2/5 🎯 The Objective: ${bounty.title}. The goal was to eliminate conversion bottlenecks and deliver robust automated infrastructure for decentralized monetization.`,
    `3/5 🛠️ Technical Solution: ${bounty.summary}. Delivered with complete test suites and zero-downtime database migrations.`,
    `4/5 💸 On-Chain Settlement: @${bounty.contributor} was awarded $${bounty.rewardAmount} ${currency} directly upon PR merge. Fast, trustless, and fully automated.`,
    `5/5 🌟 Want to build and earn? Browse our open tasks on GitHub and claim your next bounty today: https://github.com/${repoName}/issues 🚀`
  ];

  // 3. 300-Word Structured Blog Post
  const blogPost = `# Case Study: Resolving ${bounty.title} on ${repoName}

## Executive Summary
We are excited to announce the successful completion and on-chain settlement of Bounty #${bounty.bountyId}: "${bounty.title}". Developed and delivered by **@${bounty.contributor}**, this release represents a critical enhancement for our decentralized growth ecosystem.

## Technical Challenge & Architecture
${bounty.summary}

The engineering challenge required an architecture that balanced high-throughput performance with strict idempotency and cryptographic auditability. The solution was delivered with comprehensive unit tests and automated continuous integration checks.

## On-Chain Settlement & Community Impact
Following automated validation and merge into \`main\`, a reward of **$${bounty.rewardAmount} ${currency}** was immediately credited to the contributor's registry profile.

By incentivizing open-source developers and autonomous AI coding agents, our protocol continues to accelerate development velocity while maintaining enterprise-grade code quality.

## Get Involved
Explore our open bounties and start contributing today. Check out the latest issues on [GitHub](https://github.com/${repoName}/issues) and get paid on-chain for your pull requests.
`;

  return {
    bountyId: bounty.bountyId,
    tweet,
    thread,
    blogPost,
    generatedAt: now,
  };
}

export function formatOutreachRecord(content: GeneratedContent): OutreachRecord {
  return {
    id: `outreach_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    bountyId: content.bountyId,
    channel: 'multi_channel_social',
    contentPayload: content,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}
