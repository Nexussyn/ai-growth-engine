import { getTierPrice, resolvePricingTier } from '../src/pricing/tier-engine';

describe('Tiered Pricing Engine', () => {
  test('Tier 1 – Free (≤ 50 calls, non‑priority)', () => {
    expect(getTierPrice(0, false)).toBe(0.0);
    expect(getTierPrice(50, false)).toBe(0.0);
    expect(resolvePricingTier(25, false)).toBe('free');
  });

  test('Tier 2 – Standard (51‑500 calls, non‑priority)', () => {
    expect(getTierPrice(51, false)).toBe(0.01);
    expect(getTierPrice(200, false)).toBe(0.01);
    expect(getTierPrice(500, false)).toBe(0.01);
    expect(resolvePricingTier(300, false)).toBe('standard');
  });

  test('Tier 3 – Premium (> 500 calls, non‑priority)', () => {
    expect(getTierPrice(501, false)).toBe(0.03);
    expect(getTierPrice(1000, false)).toBe(0.03);
    expect(resolvePricingTier(750, false)).toBe('premium');
  });

  test('Tier 4 – Priority (any call count, priority flag true)', () => {
    expect(getTierPrice(0, true)).toBe(0.10);
    expect(getTierPrice(100, true)).toBe(0.10);
    expect(getTierPrice(1000, true)).toBe(0.10);
    expect(resolvePricingTier(10, true)).toBe('priority');
  });

  test('Negative call counts are treated as zero (free tier)', () => {
    expect(getTierPrice(-5, false)).toBe(0.0);
    expect(resolvePricingTier(-10, false)).toBe('free');
  });
});
