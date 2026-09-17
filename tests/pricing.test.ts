import { get_tier_price } from '../src/pricing/tier-engine';

describe('Tiered Pricing Engine', () => {
  it('should return 0.00 for Tier 1 (Free: <= 50 calls)', () => {
    expect(get_tier_price(25, false)).toBe(0.00);
    expect(get_tier_price(50, false)).toBe(0.00);
  });

  it('should return 0.01 for Tier 2 (Standard: 51-500 calls)', () => {
    expect(get_tier_price(51, false)).toBe(0.01);
    expect(get_tier_price(250, false)).toBe(0.01);
    expect(get_tier_price(500, false)).toBe(0.01);
  });

  it('should return 0.03 for Tier 3 (Premium: > 500 calls)', () => {
    expect(get_tier_price(501, false)).toBe(0.03);
    expect(get_tier_price(1000, false)).toBe(0.03);
  });

  it('should return 0.10 for Tier 4 (Priority) regardless of calls', () => {
    expect(get_tier_price(10, true)).toBe(0.10);
    expect(get_tier_price(600, true)).toBe(0.10);
  });
});
