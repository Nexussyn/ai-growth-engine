/**
 * Mock bounty data for testing the content generation agent.
 * Provides realistic sample bounties with various scopes and outcomes.
 */

export interface MockBounty {
  id: string;
  title: string;
  description: string;
  reward_amount: number;
  repo_owner: string;
  repo_name: string;
  pr_number: number;
  status: string;
}

export const MOCK_BOUNTIES: MockBounty[] = [
  {
    id: 'mock-bounty-001',
    title: 'Tiered pricing engine — +30% revenue',
    description: 'Implemented a multi-tier pricing engine for the AI Growth Engine API. Adds free (0-50 calls), standard (51-500 calls @ $0.01/call), and premium (500+ calls @ $0.03/call) tiers with a priority flag override at $0.10/call. Includes batch cost calculation and comprehensive tests.',
    reward_amount: 15,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 42,
    status: 'done'
  },
  {
    id: 'mock-bounty-002',
    title: 'Referral reward loop — +20% conversion',
    description: 'Built a referral reward loop system that issues unique referral codes to existing users. When a referred user completes their first paid call, both referrer and referee receive USDC credits. Includes referral code generation, validation, reward distribution, and conversion tracking.',
    reward_amount: 10,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 44,
    status: 'done'
  },
  {
    id: 'mock-bounty-003',
    title: 'Auto-upsell after 5th free call',
    description: 'Added an automatic upsell trigger that fires after a user completes their 5th free API call. The trigger presents a tier upgrade modal with personalized pricing options based on usage patterns. Includes A/B testing framework to measure conversion lift.',
    reward_amount: 10,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 45,
    status: 'done'
  },
  {
    id: 'mock-bounty-004',
    title: 'Mobile-first landing page',
    description: 'Designed and implemented a responsive mobile-first landing page optimized for AI agent visitors. Features include: touch-friendly navigation, optimized hero section with animated AI mesh, progressive web app support, and 95+ Lighthouse mobile score.',
    reward_amount: 10,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 46,
    status: 'done'
  },
  {
    id: 'mock-bounty-005',
    title: 'Content-generation agent scaffold',
    description: 'Built an autonomous content generation agent that creates tweet, thread, and blog post content from bounty completion events. Integrates with Groq Llama and Gemini Flash APIs. Content stored in outreach_sent table with full audit trail.',
    reward_amount: 5,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 47,
    status: 'done'
  }
];

/** Mock LLM that returns deterministic content for testing */
export async function mockLLM(prompt: string): Promise<string> {
  if (prompt.includes('tweet') && prompt.includes('max 280')) {
    return '🚀 Just completed the tiered pricing engine for the AI Growth Engine! $15 USDC bounty earned for building a multi-tier system that boosts revenue by 30%. Check it out at github.com/Nexussyn/ai-growth-engine #OpenSource';
  }
  if (prompt.includes('5-tweet Twitter thread')) {
    return (
      '1/5 Just closed another AI bounty on the @AIGrowthEngine! 🎉\n---\n' +
      '2/5 We built a tiered pricing engine that adapts to usage — free tier for exploration, standard for growth, premium for scale.\n---\n' +
      '3/5 The best part? This was a $15 USDC bounty, and any AI agent can claim the next one.\n---\n' +
      '4/5 Open-source AI development is the future. No walls, no gatekeepers — just code, PRs, and on-chain payments.\n---\n' +
      '5/5 Check out the open bounties at github.com/Nexussyn/ai-growth-engine and start earning. Your first PR could be your first USDC. 🤖💸'
    );
  }
  if (prompt.includes('300-word blog post')) {
    return (
      'The AI Growth Engine just hit another milestone with the completion of its tiered pricing bounty. ' +
      'This bounty, worth $15 USDC, called for a multi-tier pricing system that would intelligently scale costs based on API usage.\n\n' +
      'What was built? A three-tier pricing engine that offers a free tier for the first 50 calls, ' +
      'a standard tier at $0.01/call for calls 51-500, and a premium tier at $0.03/call beyond 500. ' +
      'A priority flag override allows urgent requests to skip queues at $0.10/call. ' +
      'Batch cost calculations were also implemented so users can estimate costs upfront.\n\n' +
      'Why this matters: The open autonomous AI ecosystem needs sustainable economic models. ' +
      'By implementing tiered pricing, the AI Growth Engine ensures that small developers can experiment for free ' +
      'while heavy users contribute proportionally. This funds further development and rewards contributors.\n\n' +
      'How to participate: The repo has $50 USDC in open bounties right now. ' +
      'Pick an issue, fork the repo, build your solution, and submit a PR. ' +
      'If it passes review, you get paid in USDC automatically via the x402 protocol. ' +
      'No KYC, no bureaucracy — just code and earn.\n\n' +
      'The future of AI development is open, collaborative, and rewarding. Come build with us.'
    );
  }
  return 'Mock LLM response for: ' + prompt.slice(0, 50);
}
