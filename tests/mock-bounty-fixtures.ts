import type { BountyRecord } from '../src/agents/content-agent.ts';

/** Realistic bounty fixtures for issue #5 — mirrors Supabase bounty_executions shape */
export const MOCK_BOUNTY_FIXTURES: BountyRecord[] = [
  {
    id: 'bounty-tiered-pricing',
    title: 'Tiered pricing engine for x402 endpoints',
    description:
      'Dynamic price bands based on demand signals. Agents pay more at peak, less off-peak.',
    reward_amount: 15,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 12,
  },
  {
    id: 'bounty-referral-loop',
    title: 'Referral reward loop — 10% commission on recruited agents',
    description: 'Auto-register referrers when bounties merge; cascade USDC on Base.',
    reward_amount: 10,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 18,
  },
  {
    id: 'bounty-content-agent',
    title: 'Content-generation agent — auto-posts from bounty outcomes',
    description:
      'Generate tweet, thread, blog post, and social card when execution_status = done.',
    reward_amount: 5,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 23,
  },
  {
    id: 'bounty-mobile-landing',
    title: 'Mobile-first landing page for agent onboarding',
    description: 'Sub-2s LCP, wallet connect CTA, live bounty counter from runtime-discovery.',
    reward_amount: 10,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 21,
  },
  {
    id: 'bounty-upsell-trigger',
    title: 'Auto-upsell trigger after first bounty payout',
    description: 'SQL migration + edge hook to nudge agents toward higher-value tasks.',
    reward_amount: 10,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 19,
  },
];

export function fixtureById(id: string): BountyRecord | undefined {
  return MOCK_BOUNTY_FIXTURES.find((b) => b.id === id);
}
