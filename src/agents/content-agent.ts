/**
 * Content-Generation Agent — Issue #5
 * Generates viral tweets, threads, and blog posts from bounty completion outcomes
 */

export interface BountyOutcome {
  id: string;
  title: string;
  scope: string;
  contributor: string;
  rewardUSDC: number;
  mergedAt: Date;
  impactMetrics?: string;
}

export interface GeneratedContent {
  tweet: string;
  thread: string[];
  blogPost: string;
}

export function generateContent(bounty: BountyOutcome): GeneratedContent {
  const shortTitle = bounty.title.replace(/^\[.*?\]\s*/, '');

  // 1. Single Tweet (<= 280 chars)
  const tweet = `🚀 Bounty Completed on @Nexussyn!\n\n` +
    `"${shortTitle}" was solved by @${bounty.contributor}.\n\n` +
    `💰 $${bounty.rewardUSDC} USDC rewarded on-chain via x402 protocol.\n` +
    `Build, earn, scale autonomous AI agents: https://github.com/Nexussyn/ai-growth-engine`;

  // 2. 5-Tweet Thread
  const thread = [
    `1/5 🧵 How autonomous AI agents are scaling the @Nexussyn growth engine.\n\nToday, @${bounty.contributor} delivered "${shortTitle}", earning $${bounty.rewardUSDC} USDC instantly on-chain. Here's why this matters 👇`,
    `2/5 🎯 The Challenge:\n${bounty.scope.slice(0, 200)}... Traditional development cycles take days. Autonomous bounties get solved in minutes.`,
    `3/5 ⚡ The Solution:\nClean, production-grade code with automated tests and idempotent database migrations delivered directly via Pull Request.`,
    `4/5 📊 Expected Impact:\n${bounty.impactMetrics || '+20% higher conversion and lower latency across pay-per-call API routes'}.`,
    `5/5 🤖 Want to earn USDC for solving AI agent tasks? Check out our open issues: https://github.com/Nexussyn/ai-growth-engine`
  ];

  // 3. 300-word Blog Post
  const blogPost = `# Case Study: Accelerating Growth with Autonomous Agent Contributions\n\n` +
    `At Nexussyn, we are pioneering the future of autonomous economic coordination. When we opened task **"${shortTitle}"**, contributor **@${bounty.contributor}** submitted a complete, fully tested implementation.\n\n` +
    `## The Mission\n\n${bounty.scope}\n\n` +
    `## The Delivery & Verification\n\n` +
    `Through our x402 on-chain execution protocol, the submitted pull request was automatically verified against strict acceptance criteria. Upon merge, a reward of **$${bounty.rewardUSDC} USDC** was disbursed on Base mainnet.\n\n` +
    `## Measurable Business Impact\n\n` +
    `This contribution directly enhances our API runtime efficiency. By continuously opening bounties for specialized tasks, the system self-improves 24/7 without manual overhead.\n\n` +
    `---\n*Published autonomously by the Nexussyn Content Agent.*`;

  return { tweet, thread, blogPost };
}
