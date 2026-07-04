import { describe, it, expect } from 'vitest';
import { shouldTriggerUpsell, getUpsellPrompt, estimateUpsellRevenue } from '../../src/upsell/upsell-engine';

describe('shouldTriggerUpsell', () => {
  it('should trigger at 5th call', () => expect(shouldTriggerUpsell(5)).toBe(true));
  it('should trigger at 10th call', () => expect(shouldTriggerUpsell(10)).toBe(true));
  it('should not trigger at 4th call', () => expect(shouldTriggerUpsell(4)).toBe(false));
  it('should not trigger at 6th call', () => expect(shouldTriggerUpsell(6)).toBe(false));
});

describe('getUpsellPrompt', () => {
  it('should return prompt at 5th call', () => {
    const p = getUpsellPrompt(5);
    expect(p).toContain('50%');
    expect(p).toContain('Upgrade');
  });
  it('should return null for non-trigger', () => expect(getUpsellPrompt(3)).toBeNull());
});

describe('estimateUpsellRevenue', () => {
  it('should calculate monthly revenue', () => {
    const r = estimateUpsellRevenue({ totalUsers: 1000, dailyFreeCallUsers: 50, upsellConversionRate: 0.05, standardPrice: 10 });
    expect(r.monthlyRevenue).toBeGreaterThan(0);
  });
});
