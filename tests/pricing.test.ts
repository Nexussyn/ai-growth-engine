import { getTierPrice } from '../src/pricing/tier-engine';

describe('Tiered Pricing', () => {
  test('Tier 1 (Free) - First 50 calls', () => {
    expect(getTierPrice(1)).toEqual({ tier: 'free', pricePerCall: 0.00, callsInTier: 49 });
    expect(getTierPrice(50)).toEqual({ tier: 'free', pricePerCall: 0.00, callsInTier: 1 });
  });

  test('Tier 2 (Standard) - Calls 51–500', () => {
    expect(getTierPrice(51)).toEqual({ tier:'standard', pricePerCall: 0.01, callsInTier: 449 });
    expect(getTierPrice(500)).toEqual({ tier: 'standard', pricePerCall: 0.01, callsInTier: 1 });
  });

  test('Tier 3 (Premium) - Calls 500+', () => {
    expect(getTierPrice(501)).toEqual({ tier: 'premium', pricePerCall: 0.03, callsInTier: Infinity });
    expect(getTierPrice(1000)).toEqual({ tier: 'premium', pricePerCall: 0.03, callsInTier: Infinity });
  });

  test('Tier 4 (Priority) - Flagged as priority', () => {
    expect(getTierPrice(1, true)).toEqual({ tier: 'priority', pricePerCall: 0.10, callsInTier: 1 });
  });
});
