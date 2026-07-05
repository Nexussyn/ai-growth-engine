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

function assertWholeCallCount(value: number, name: string, allowZero = false): void {
  const minimum = allowZero ? 0 : 1;

  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be a safe integer >= ${minimum}`);
  }
}

/**
 * Returns the price per call based on total call count and priority flag.
 * - Tier 1 (Free):     calls 1–50     → $0.00
 * - Tier 2 (Standard): calls 51–500  → $0.01
 * - Tier 3 (Premium):  calls 500+    → $0.03
 * - Tier 4 (Priority): priority=true → $0.10
 */
export function getTierPrice(callCount: number, priorityFlag = false): TierResult {
  assertWholeCallCount(callCount, 'callCount');

  if (priorityFlag) {
    return { tier: 'priority', pricePerCall: 0.10, callsInTier: 1 };
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
