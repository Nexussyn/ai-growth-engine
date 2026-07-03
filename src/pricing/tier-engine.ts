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
 *
 * Tiers:
 *   Tier 1 (Free):     calls 1–50     → $0.00/call
 *   Tier 2 (Standard): calls 51–500  → $0.01/call
 *   Tier 3 (Premium):  calls 501+    → $0.03/call
 *   Tier 4 (Priority): priority=true → $0.10/call (overrides all)
 *
 * @param callCount - Total number of calls already made (1-indexed)
 * @param priorityFlag - Whether this call is flagged as priority
 * @returns TierResult with the applicable tier, price, and remaining calls in tier
 * @throws {RangeError} If callCount is negative or zero
 */
export function getTierPrice(callCount: number, priorityFlag = false): TierResult {
  if (callCount <= 0) {
    throw new RangeError('callCount must be a positive integer (1 or greater)');
  }

  if (priorityFlag) {
    return { tier: 'priority', pricePerCall: 0.10, callsInTier: Infinity };
  }

  if (callCount <= 50) {
    return { tier: 'free', pricePerCall: 0.00, callsInTier: 50 - callCount + 1 };
  }

  if (callCount <= 500) {
    return { tier: 'standard', pricePerCall: 0.01, callsInTier: 500 - callCount + 1 };
  }

  return { tier: 'premium', pricePerCall: 0.03, callsInTier: Infinity };
}

/**
 * Snake_case alias for `getTierPrice` to match issue-specified naming.
 * @see getTierPrice
 */
export function get_tier_price(callCount: number, priorityFlag = false): TierResult {
  return getTierPrice(callCount, priorityFlag);
}

/**
 * Calculates total cost for a batch of consecutive calls.
 *
 * For mixed-tier batches (e.g. spanning free → standard boundaries),
 * each call is priced individually according to its position in the sequence.
 *
 * @param startCount - The call count at which the batch begins (1-indexed)
 * @param numCalls - Number of calls in the batch
 * @param priority - Whether all calls in the batch are priority-flagged
 * @returns Total cost rounded to 6 decimal places (USDC micro-precision)
 */
export function calculateBatchCost(startCount: number, numCalls: number, priority = false): number {
  if (startCount <= 0) {
    throw new RangeError('startCount must be a positive integer (1 or greater)');
  }
  if (numCalls <= 0) {
    throw new RangeError('numCalls must be a positive integer');
  }

  let total = 0;
  for (let i = 0; i < numCalls; i++) {
    total += getTierPrice(startCount + i, priority).pricePerCall;
  }
  return Math.round(total * 1e6) / 1e6; // round to 6 decimals (USDC precision)
}

/**
 * Lookup pricing tier metadata from the database tiers configuration.
 * Returns the tier info for any valid tier name.
 */
export function getTierInfo(tier: Tier): {
  tier: Tier;
  pricePerCall: number;
  range: string;
  description: string;
} {
  const config: Record<Tier, { pricePerCall: number; range: string; description: string }> = {
    free:     { pricePerCall: 0.00, range: '1–50',       description: 'First 50 calls free' },
    standard: { pricePerCall: 0.01, range: '51–500',     description: 'Standard tier for regular usage' },
    premium:  { pricePerCall: 0.03, range: '501+',       description: 'Premium tier for high-volume usage' },
    priority: { pricePerCall: 0.10, range: 'Any',        description: 'Priority-flagged calls at a premium rate' },
  };
  return { tier, ...config[tier] };
}
