/**
 * Tiered Pricing Engine — Issue #1
 * Implements 4-tier pricing for x402 API calls.
 *
 * Tiers:
 *   Tier 1 (Free):     Calls 1–50        → $0.00/call
 *   Tier 2 (Standard): Calls 51–500      → $0.01/call
 *   Tier 3 (Premium):  Calls 501+        → $0.03/call
 *   Tier 4 (Priority): priorityFlag=true → $0.10/call (overrides all)
 */

/** The four pricing tiers. */
export type Tier = 'free' | 'standard' | 'premium' | 'priority';

/** Result returned by getTierPrice. */
export interface TierResult {
  tier: Tier;
  /** Price in USDC for a single call at this position. */
  pricePerCall: number;
  /** How many consecutive calls remain in this tier (or Infinity). */
  callsInTier: number;
}

/** Tier definition used internally. */
interface TierDef {
  tier: Tier;
  price: number;
  min: number;   // inclusive lower bound (1-based call count)
  max: number;   // inclusive upper bound, Infinity = no limit
}

const TIERS: TierDef[] = [
  { tier: 'free',     price: 0.00, min: 1,   max: 50   },
  { tier: 'standard', price: 0.01, min: 51,  max: 500  },
  { tier: 'premium',  price: 0.03, min: 501, max: Infinity },
];

/**
 * Assert that `value` is a safe, whole number ≥ minimum.
 * @throws RangeError if the value is invalid.
 */
function assertSafeInteger(value: number, name: string, minimum = 1): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(
      `${name} must be a safe integer ≥ ${minimum}, got ${value}`,
    );
  }
}

/**
 * Returns the price for a single call based on total call count.
 *
 * @param callCount   1-based index of the call (1 = first call ever).
 * @param priorityFlag When true, the call is priced at the priority rate ($0.10).
 * @returns A TierResult describing the applicable tier, price, and remaining calls in that tier.
 */
export function getTierPrice(callCount: number, priorityFlag = false): TierResult {
  assertSafeInteger(callCount, 'callCount');

  if (priorityFlag) {
    return { tier: 'priority', pricePerCall: 0.10, callsInTier: Infinity };
  }

  for (const t of TIERS) {
    if (callCount >= t.min && callCount <= t.max) {
      const remaining = t.max === Infinity ? Infinity : t.max - callCount + 1;
      return { tier: t.tier, pricePerCall: t.price, callsInTier: remaining };
    }
  }

  // Safety fallback (should not be reachable since the last tier has max=Infinity)
  return { tier: 'premium', pricePerCall: 0.03, callsInTier: Infinity };
}

/**
 * Calculates the total cost for a batch of consecutive calls starting at `startCount`.
 *
 * @param startCount 1-based index of the first call in the batch.
 * @param numCalls   Number of calls in the batch (0 is valid — returns 0).
 * @param priority   When true, every call in the batch is priced at the priority rate.
 * @returns Total cost in USDC, rounded to 6 decimal places.
 */
export function calculateBatchCost(
  startCount: number,
  numCalls: number,
  priority = false,
): number {
  assertSafeInteger(startCount, 'startCount');
  assertSafeInteger(numCalls, 'numCalls', 0);

  let total = 0;
  for (let i = 0; i < numCalls; i++) {
    total += getTierPrice(startCount + i, priority).pricePerCall;
  }
  // Round to 6 decimal places (USDC micro-unit precision)
  return Math.round(total * 1e6) / 1e6;
}

/**
 * Result from calculateBill — includes per-tier breakdown and total.
 */
export interface BillBreakdown {
  totalCost: number;
  breakdown: { tier: Tier; calls: number; cost: number }[];
}

/**
 * Calculate a full bill spanning one or more tiers.
 * This is equivalent to calculateBatchCost but also returns a per-tier breakdown.
 *
 * @param startCount 1-based index of the first call.
 * @param numCalls   Number of calls in the batch.
 * @param priority   When true, all calls are priority-priced.
 * @returns A BillBreakdown with total and per-tier breakdown.
 */
export function calculateBill(
  startCount: number,
  numCalls: number,
  priority = false,
): BillBreakdown {
  assertSafeInteger(startCount, 'startCount');
  assertSafeInteger(numCalls, 'numCalls', 0);

  const breakdownMap = new Map<Tier, { calls: number; cost: number }>();

  for (let i = 0; i < numCalls; i++) {
    const result = getTierPrice(startCount + i, priority);
    const entry = breakdownMap.get(result.tier) ?? { calls: 0, cost: 0 };
    entry.calls += 1;
    entry.cost += result.pricePerCall;
    breakdownMap.set(result.tier, entry);
  }

  const breakdown = Array.from(breakdownMap.entries()).map(([tier, data]) => ({
    tier,
    calls: data.calls,
    cost: Math.round(data.cost * 1e6) / 1e6,
  }));

  const totalCost = Math.round(
    breakdown.reduce((s, b) => s + b.cost, 0) * 1e6,
  ) / 1e6;

  return { totalCost, breakdown };
}
