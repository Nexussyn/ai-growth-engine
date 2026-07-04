import { describe, it, expect } from 'vitest';
import { generateBlogPost, generateTwitterThread, generateAll } from '../../src/content-agent/content-agent';

const mockEvent = {
  bountyId: 1,
  title: 'Implement tiered pricing engine',
  scope: 'Add tiered pricing with 4 tiers',
  outcome: 'PR merged with 14 passing tests',
  reward: 15,
  currency: 'USDC',
  agentName: 'dev-nana27',
  completedAt: '2026-07-04T03:00:00Z',
};

describe('generateBlogPost', () => {
  it('should generate a blog post', () => {
    const post = generateBlogPost(mockEvent);
    expect(post).toContain('Bounty Complete');
    expect(post).toContain('15 USDC');
  });
});

describe('generateTwitterThread', () => {
  it('should generate thread tweets', () => {
    const thread = generateTwitterThread(mockEvent);
    expect(thread.length).toBeGreaterThanOrEqual(3);
    expect(thread[0]).toContain('Bounty complete');
  });
});

describe('generateAll', () => {
  it('should generate all content types', () => {
    const all = generateAll(mockEvent);
    expect(all.blogPost).toBeTruthy();
    expect(all.twitterThread.length).toBeGreaterThan(0);
    expect(all.socialCard.headline).toBeTruthy();
  });
});
