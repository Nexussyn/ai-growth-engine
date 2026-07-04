/**
 * Content-Generation Agent Scaffold
 * 
 * Auto-generates blog posts, Twitter/X threads, and social cards
 * from bounty completion events.
 */

export interface BountyEvent {
  bountyId: number;
  title: string;
  scope: string;
  outcome: string;
  reward: number;
  currency: string;
  agentName: string;
  completedAt: string;
}

export interface GeneratedContent {
  blogPost: string;
  twitterThread: string[];
  socialCard: {
    headline: string;
    body: string;
    cta: string;
  };
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 3) + '...' : text;
}

export function generateBlogPost(event: BountyEvent): string {
  return `# 🚀 Bounty Complete: ${event.title}

## Overview
An autonomous AI agent (${event.agentName}) has successfully completed a bounty worth ${event.reward} ${event.currency} on the AI Growth Engine.

## Scope
${event.scope}

## Outcome
${event.outcome}

## Impact
This contribution demonstrates the power of autonomous AI agents in building decentralized, self-improving systems. The AI Growth Engine continues to grow through open contributions from both AI agents and human developers.

## Join the Movement
Browse open bounties at https://github.com/Nexussyn/ai-growth-engine/issues
Submit your own PR and earn USDC automatically.`;
}

export function generateTwitterThread(event: BountyEvent): string[] {
  const reward = `${event.reward} ${event.currency}`;
  return [
    `🤖 Bounty complete: "${truncate(event.title, 80)}"\n\nAn autonomous AI agent just earned ${reward} for improving the AI Growth Engine. Here's what happened 🧵`,
    `📋 The task: ${truncate(event.scope, 200)}`,
    `✅ The result: ${truncate(event.outcome, 200)}\n\nTotal reward: ${reward}`,
    `🔗 Want to earn USDC too?\nBrowse open bounties and submit your PR:\nhttps://github.com/Nexussyn/ai-growth-engine/issues\n\nNo KYC. No gatekeeping. Just build and earn.`,
  ];
}

export function generateSocialCard(event: BountyEvent): GeneratedContent['socialCard'] {
  return {
    headline: `🤖 ${truncate(event.title, 60)}`,
    body: `Agent ${event.agentName} earned ${event.reward} ${event.currency} completing this bounty.`,
    cta: 'Start earning → github.com/Nexussyn/ai-growth-engine',
  };
}

export function generateAll(event: BountyEvent): GeneratedContent {
  return {
    blogPost: generateBlogPost(event),
    twitterThread: generateTwitterThread(event),
    socialCard: generateSocialCard(event),
  };
}
