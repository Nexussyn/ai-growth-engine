/**
 * Tiered Pricing Engine — Issue #1
 * Implements 4-tier pricing for x402 API calls
 */

export type Tier = 'free' | 'standard' | 'premium' | 'priority';

export interface TierResult {
  tier: Tier;
  pricePerCall: number; // in USDC
  callsInTier: number;
}

/**
 * Returns the price per call based on total call count and priority flag.
 * - Tier 1 (Free):     calls 1–50     → $0.00
 * - Tier 2 (Standard): calls 51–500   → $0.01
 * - Tier 3 (Premium):  calls 501+     → $0.03
 * - Tier 4 (Priority): priority=true  → $0.10
 */
export function getTierPrice(callCount: number, priorityFlag = false): TierResult {
  if (priorityFlag) {
    return { tier: 'priority', pricePerCall: 0.1, callsInTier: 1 };
  }
  if (callCount <= 50) {
    return {
      tier: 'free',
      pricePerCall: 0.0,
      callsInTier: Math.max(0, 50 - Math.max(callCount, 1) + 1),
    };
  }
  if (callCount <= 500) {
    return {
      tier: 'standard',
      pricePerCall: 0.01,
      callsInTier: 500 - callCount + 1,
    };
  }
  return { tier: 'premium', pricePerCall: 0.03, callsInTier: Number.POSITIVE_INFINITY };
}

/** Snake_case alias matching acceptance criteria name. */
export const get_tier_price = getTierPrice;

/**
 * Calculates total cost for a batch of calls.
 */
export function calculateBatchCost(
  startCount: number,
  numCalls: number,
  priority = false,
): number {
  let total = 0;
  for (let i = 0; i < numCalls; i++) {
    total += getTierPrice(startCount + i, priority).pricePerCall;
  }
  return Math.round(total * 1e6) / 1e6; // USDC precision
}
