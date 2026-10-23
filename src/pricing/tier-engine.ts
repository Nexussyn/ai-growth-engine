/**
 * Tiered Pricing Engine — Issue #1
 * Implements 4-tier pricing for x402 API calls:
 * - Tier 1 (Free):     First 50 calls (1–50) = $0.00/call
 * - Tier 2 (Standard): Calls 51–500          = $0.01/call
 * - Tier 3 (Premium):  Calls 500+ (501+)     = $0.03/call
 * - Tier 4 (Priority): Flagged as priority   = $0.10/call
 */

export type Tier = 'free' | 'standard' | 'premium' | 'priority';

export interface TierConfig {
  tier: Tier;
  pricePerCall: number;
  callMin: number | null;
  callMax: number | null;
  description: string;
}

export interface TierResult {
  tier: Tier;
  pricePerCall: number; // in USDC
  callsInTier: number;
}

export interface BatchCostBreakdown {
  totalCostUsdc: number;
  totalCalls: number;
  byTier: Record<Tier, { calls: number; subtotalUsdc: number }>;
}

export const PRICING_TIERS: Record<Tier, TierConfig> = {
  free: {
    tier: 'free',
    pricePerCall: 0.00,
    callMin: 1,
    callMax: 50,
    description: 'First 50 calls = $0.00',
  },
  standard: {
    tier: 'standard',
    pricePerCall: 0.01,
    callMin: 51,
    callMax: 500,
    description: 'Calls 51-500 = $0.01/call',
  },
  premium: {
    tier: 'premium',
    pricePerCall: 0.03,
    callMin: 501,
    callMax: null,
    description: 'Calls 500+ = $0.03/call',
  },
  priority: {
    tier: 'priority',
    pricePerCall: 0.10,
    callMin: null,
    callMax: null,
    description: 'Flagged as priority = $0.10/call',
  },
};

function validateCallCount(callCount: number): void {
  if (typeof callCount !== 'number' || !Number.isFinite(callCount) || callCount < 0 || !Number.isInteger(callCount)) {
    throw new RangeError(`Invalid callCount: expected a non-negative integer, got ${callCount}`);
  }
}

/**
 * Returns the tier details and price per call based on call count and priority flag.
 * - Tier 1 (Free):     calls 0–50    -> $0.00
 * - Tier 2 (Standard): calls 51–500  -> $0.01
 * - Tier 3 (Premium):  calls 501+    -> $0.03
 * - Tier 4 (Priority): priority=true -> $0.10
 */
export function getTierPrice(callCount: number, priorityFlag = false): TierResult {
  validateCallCount(callCount);
  if (Boolean(priorityFlag)) {
    return { tier: 'priority', pricePerCall: 0.10, callsInTier: 1 };
  }
  if (callCount <= 50) {
    return { tier: 'free', pricePerCall: 0.00, callsInTier: Math.max(0, 50 - callCount + 1) };
  }
  if (callCount <= 500) {
    return { tier: 'standard', pricePerCall: 0.01, callsInTier: 500 - callCount + 1 };
  }
  return { tier: 'premium', pricePerCall: 0.03, callsInTier: Infinity };
}

/**
 * Direct numeric helper specified in Issue #1 acceptance criteria:
 * `get_tier_price(call_count, priority_flag)` returns the numeric USDC price for the call.
 */
export function get_tier_price(call_count: number, priority_flag = false): number {
  return getTierPrice(call_count, priority_flag).pricePerCall;
}

/**
 * Calculates total cost in USDC (6-decimal precision) for a batch of calls starting at `startCount`.
 */
export function calculateBatchCost(startCount: number, numCalls: number, priority = false): number {
  return calculateBatchBreakdown(startCount, numCalls, priority).totalCostUsdc;
}

/**
 * Computes a full per-tier cost breakdown for a sequence of API calls.
 */
export function calculateBatchBreakdown(
  startCount: number,
  numCalls: number,
  priority = false,
): BatchCostBreakdown {
  validateCallCount(startCount);
  validateCallCount(numCalls);

  const byTier: Record<Tier, { calls: number; subtotalUsdc: number }> = {
    free: { calls: 0, subtotalUsdc: 0 },
    standard: { calls: 0, subtotalUsdc: 0 },
    premium: { calls: 0, subtotalUsdc: 0 },
    priority: { calls: 0, subtotalUsdc: 0 },
  };

  let totalMicros = 0;
  for (let i = 0; i < numCalls; i++) {
    const result = getTierPrice(startCount + i, priority);
    const micros = Math.round(result.pricePerCall * 1_000_000);
    totalMicros += micros;
    byTier[result.tier].calls += 1;
    byTier[result.tier].subtotalUsdc = Math.round((byTier[result.tier].subtotalUsdc * 1_000_000) + micros) / 1_000_000;
  }

  return {
    totalCostUsdc: totalMicros / 1_000_000,
    totalCalls: numCalls,
    byTier,
  };
}

/**
 * Builds a payment row payload ready for insertion into `x402_calls`.
 */
export function buildX402CallPaymentRow(
  callerWallet: string,
  callCount: number,
  priorityFlag = false,
): {
  caller_wallet: string;
  call_number: number;
  tier: Tier;
  price_per_call: number;
  priority_flag: boolean;
} {
  if (!callerWallet || typeof callerWallet !== 'string' || !callerWallet.trim()) {
    throw new Error('callerWallet must be a non-empty string');
  }
  const result = getTierPrice(callCount, priorityFlag);
  return {
    caller_wallet: callerWallet.trim(),
    call_number: callCount,
    tier: result.tier,
    price_per_call: result.pricePerCall,
    priority_flag: Boolean(priorityFlag),
  };
}
