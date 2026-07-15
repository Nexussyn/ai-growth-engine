/**
 * Tiered Pricing Engine - Issue #1
 * Implements 4-tier pricing for x402 API calls.
 */

export type Tier = 'free' | 'standard' | 'premium' | 'priority';

export interface TierResult {
  tier: Tier;
  pricePerCall: number; // in USDC
  callsInTier: number;
}

const FREE_TIER_LIMIT = 50;
const STANDARD_TIER_LIMIT = 500;
const PRICES: Record<Tier, number> = {
  free: 0.00,
  standard: 0.01,
  premium: 0.03,
  priority: 0.10,
};

function assertWholeCallCount(value: number, name: string, allowZero = false): void {
  const minimum = allowZero ? 0 : 1;
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be a safe integer greater than or equal to ${minimum}`);
  }
}

/**
 * Returns the price per call based on total call count and priority flag.
 * - Tier 1 (Free):     calls 1-50    -> $0.00
 * - Tier 2 (Standard): calls 51-500  -> $0.01
 * - Tier 3 (Premium):  calls 501+    -> $0.03
 * - Tier 4 (Priority): priority=true -> $0.10
 */
export function getTierPrice(callCount: number, priorityFlag = false): TierResult {
  assertWholeCallCount(callCount, 'callCount');

  if (priorityFlag) {
    return { tier: 'priority', pricePerCall: PRICES.priority, callsInTier: 1 };
  }
  if (callCount <= FREE_TIER_LIMIT) {
    return { tier: 'free', pricePerCall: PRICES.free, callsInTier: FREE_TIER_LIMIT - callCount + 1 };
  }
  if (callCount <= STANDARD_TIER_LIMIT) {
    return {
      tier: 'standard',
      pricePerCall: PRICES.standard,
      callsInTier: STANDARD_TIER_LIMIT - callCount + 1,
    };
  }
  return { tier: 'premium', pricePerCall: PRICES.premium, callsInTier: Infinity };
}

/**
 * Snake-case compatibility API requested in the bounty acceptance criteria.
 */
export function get_tier_price(call_count: number, priority_flag = false): number {
  return getTierPrice(call_count, priority_flag).pricePerCall;
}

/**
 * Calculates total cost for a batch of calls.
 */
export function calculateBatchCost(startCount: number, numCalls: number, priority = false): number {
  assertWholeCallCount(startCount, 'startCount');
  assertWholeCallCount(numCalls, 'numCalls', true);

  let total = 0;
  for (let i = 0; i < numCalls; i++) {
    total += getTierPrice(startCount + i, priority).pricePerCall;
  }
  return Math.round(total * 1e6) / 1e6; // round to 6 decimals (USDC precision)
}
