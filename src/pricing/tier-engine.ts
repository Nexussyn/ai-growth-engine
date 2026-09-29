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

export function getTierPrice(callCount: number, priorityFlag = false): TierResult {
  const normalizedCount = Math.max(1, Math.floor(callCount));
  if (priorityFlag) {
    return { tier: 'priority', pricePerCall: 0.10, callsInTier: 1 };
  }
  if (normalizedCount <= 50) {
    return { tier: 'free', pricePerCall: 0.00, callsInTier: 50 - normalizedCount + 1 };
  }
  if (normalizedCount <= 500) {
    return { tier: 'standard', pricePerCall: 0.01, callsInTier: 500 - normalizedCount + 1 };
  }
  return { tier: 'premium', pricePerCall: 0.03, callsInTier: Infinity };
}

/**
 * Snake_case alias required by Issue #1 acceptance criteria:
 * get_tier_price(call_count, priority_flag)
 */
export function get_tier_price(call_count: number, priority_flag = false): number {
  return getTierPrice(call_count, priority_flag).pricePerCall;
}

export function calculateBatchCost(startCount: number, numCalls: number, priority = false): number {
  let total = 0;
  for (let i = 0; i < numCalls; i++) {
    total += getTierPrice(startCount + i, priority).pricePerCall;
  }
  return Math.round(total * 1e6) / 1e6;
}
