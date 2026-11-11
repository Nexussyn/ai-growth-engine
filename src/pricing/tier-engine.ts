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
 * - Tier 3 (Premium):  calls 500+     → $0.03
 * - Tier 4 (Priority): priority=true  → $0.10
 */
export function getTierPrice(callCount: number, priorityFlag = false): TierResult {
  const normalizedCount = Math.max(1, Math.floor(Number(callCount) || 1));
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
 * Snake-case alias required by Issue #1 specification:
 * `get_tier_price(call_count, priority_flag)` returns the numeric USDC price per call.
 */
export function get_tier_price(call_count: number, priority_flag = false): number {
  return getTierPrice(call_count, priority_flag).pricePerCall;
}

/**
 * Calculates total cost for a batch of calls.
 */
export function calculateBatchCost(startCount: number, numCalls: number, priority = false): number {
  if (numCalls <= 0) {
    return 0;
  }
  let total = 0;
  const start = Math.max(1, Math.floor(Number(startCount) || 1));
  for (let i = 0; i < numCalls; i++) {
    total += getTierPrice(start + i, priority).pricePerCall;
  }
  return Math.round(total * 1e6) / 1e6; // round to 6 decimals (USDC precision)
}
