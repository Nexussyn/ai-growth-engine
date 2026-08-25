/**
 * Tiered Pricing Engine — Issue #1
 * Implements 4-tier pricing for x402 API calls.
 *
 * Acceptance surface includes both camelCase and snake_case entry points:
 * `getTierPrice` / `get_tier_price(call_count, priority_flag)`.
 */

export type Tier = "free" | "standard" | "premium" | "priority";

export interface TierResult {
  tier: Tier;
  pricePerCall: number; // in USDC
  callsInTier: number;
}

function normalizeCallCount(callCount: number): number {
  if (!Number.isFinite(callCount)) {
    throw new RangeError("callCount must be a finite number");
  }
  // Treat non-positive counts as "first call" so free tier applies.
  if (callCount < 1) return 1;
  return Math.floor(callCount);
}

/**
 * Returns the price per call based on total call count and priority flag.
 * - Tier 1 (Free):     calls 1–50     → $0.00
 * - Tier 2 (Standard): calls 51–500   → $0.01
 * - Tier 3 (Premium):  calls 501+     → $0.03
 * - Tier 4 (Priority): priority=true  → $0.10 (overrides count tiers)
 */
export function getTierPrice(
  callCount: number,
  priorityFlag = false,
): TierResult {
  const n = normalizeCallCount(callCount);
  if (priorityFlag) {
    return { tier: "priority", pricePerCall: 0.1, callsInTier: 1 };
  }
  if (n <= 50) {
    return { tier: "free", pricePerCall: 0.0, callsInTier: 50 - n + 1 };
  }
  if (n <= 500) {
    return { tier: "standard", pricePerCall: 0.01, callsInTier: 500 - n + 1 };
  }
  return { tier: "premium", pricePerCall: 0.03, callsInTier: Infinity };
}

/** Snake_case alias required by issue #1 acceptance criteria. */
export function get_tier_price(
  call_count: number,
  priority_flag = false,
): TierResult {
  return getTierPrice(call_count, priority_flag);
}

/**
 * Calculates total cost for a batch of calls starting at `startCount`.
 */
export function calculateBatchCost(
  startCount: number,
  numCalls: number,
  priority = false,
): number {
  if (!Number.isFinite(numCalls) || numCalls < 0) {
    throw new RangeError("numCalls must be a non-negative finite number");
  }
  let total = 0;
  const n = Math.floor(numCalls);
  for (let i = 0; i < n; i++) {
    total += getTierPrice(startCount + i, priority).pricePerCall;
  }
  return Math.round(total * 1e6) / 1e6; // USDC precision
}
