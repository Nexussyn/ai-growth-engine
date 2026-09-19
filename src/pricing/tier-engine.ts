/**
 * Tiered Pricing Engine — Issue #1
 * Implements 4-tier pricing for x402 API calls.
 */

export type Tier = 'free' | 'standard' | 'premium' | 'priority';

export interface TierResult {
  tier: Tier;
  pricePerCall: number; // USDC
  callsInTier: number;
}

function assertValidCallCount(callCount: number): number {
  if (!Number.isFinite(callCount) || !Number.isInteger(callCount)) {
    throw new TypeError('callCount must be a finite integer');
  }
  if (callCount < 1) {
    throw new RangeError('callCount must be >= 1');
  }
  return callCount;
}

/**
 * Returns the price per call based on total call count and priority flag.
 * - Tier 1 (Free):     calls 1–50     → $0.00
 * - Tier 2 (Standard): calls 51–500  → $0.01
 * - Tier 3 (Premium):  calls 501+    → $0.03
 * - Tier 4 (Priority): priority=true → $0.10
 */
export function getTierPrice(callCount: number, priorityFlag = false): TierResult {
  const n = assertValidCallCount(callCount);
  if (priorityFlag) {
    return { tier: 'priority', pricePerCall: 0.1, callsInTier: 1 };
  }
  if (n <= 50) {
    return { tier: 'free', pricePerCall: 0.0, callsInTier: 50 - n + 1 };
  }
  if (n <= 500) {
    return { tier: 'standard', pricePerCall: 0.01, callsInTier: 500 - n + 1 };
  }
  return { tier: 'premium', pricePerCall: 0.03, callsInTier: Number.POSITIVE_INFINITY };
}

/** Snake_case alias required by issue #1 acceptance criteria. */
export function get_tier_price(call_count: number, priority_flag = false): TierResult {
  return getTierPrice(call_count, priority_flag);
}

/** Batch cost across tier boundaries (USDC, 6 dp). */
export function calculateBatchCost(startCount: number, numCalls: number, priority = false): number {
  if (!Number.isInteger(numCalls) || numCalls < 0) {
    throw new RangeError('numCalls must be a non-negative integer');
  }
  let total = 0;
  for (let i = 0; i < numCalls; i++) {
    total += getTierPrice(startCount + i, priority).pricePerCall;
  }
  return Math.round(total * 1e6) / 1e6;
}
