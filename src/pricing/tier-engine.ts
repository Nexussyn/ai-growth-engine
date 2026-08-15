/**
 * Tiered Pricing Engine — Issue #1
 * Implements 4-tier pricing model for x402 API calls
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
 *
 * @param callCount 1-indexed total API calls made by the client
 * @param priorityFlag boolean indicating if priority execution was requested
 * @returns TierResult with tier identifier, pricePerCall in USDC, and remaining calls in tier
 */
export function getTierPrice(callCount: number, priorityFlag = false): TierResult {
  if (priorityFlag) {
    return { tier: 'priority', pricePerCall: 0.10, callsInTier: 1 };
  }
  const count = Math.max(1, Math.floor(callCount));
  if (count <= 50) {
    return { tier: 'free', pricePerCall: 0.00, callsInTier: 50 - count + 1 };
  }
  if (count <= 500) {
    return { tier: 'standard', pricePerCall: 0.01, callsInTier: 500 - count + 1 };
  }
  return { tier: 'premium', pricePerCall: 0.03, callsInTier: Infinity };
}

/**
 * Snake_case compatibility alias for getTierPrice.
 */
export const get_tier_price = getTierPrice;

/**
 * Calculates total cost for a batch of consecutive calls.
 *
 * @param startCount The starting call count (inclusive)
 * @param numCalls Number of calls in the batch
 * @param priority Whether all calls in batch are priority
 * @returns Total cost rounded to 6 decimal places (USDC precision)
 */
export function calculateBatchCost(startCount: number, numCalls: number, priority = false): number {
  if (numCalls <= 0) return 0;
  let total = 0;
  for (let i = 0; i < numCalls; i++) {
    total += getTierPrice(startCount + i, priority).pricePerCall;
  }
  return Math.round(total * 1e6) / 1e6; // round to 6 decimals (USDC precision)
}
