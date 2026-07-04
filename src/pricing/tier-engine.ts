/**
 * Tiered Pricing Engine
 * 
 * Determines the appropriate price for API calls based on:
 * - Current call count (volume tiers)
 * - Priority flag (premium routing)
 * 
 * Expected impact: +30% revenue from unmetered and premium tiers
 */

export interface PriceResult {
  tier: 'free' | 'standard' | 'premium' | 'priority';
  pricePerCall: number;
  callCount: number;
  isPriority: boolean;
}

export interface TierConfig {
  tier: 'free' | 'standard' | 'premium' | 'priority';
  minCalls: number;
  maxCalls: number | null;
  pricePerCall: number;
}

const DEFAULT_TIERS: TierConfig[] = [
  { tier: 'free',      minCalls: 0,   maxCalls: 50,  pricePerCall: 0.00 },
  { tier: 'standard',  minCalls: 51,  maxCalls: 500, pricePerCall: 0.01 },
  { tier: 'premium',   minCalls: 501, maxCalls: null,pricePerCall: 0.03 },
];

/**
 * Get the tier and price for a given call count.
 * Tier 4 (priority) overrides all other tiers at $0.10/call.
 */
export function getTierPrice(callCount: number, isPriority: boolean = false): PriceResult {
  if (isPriority) {
    return {
      tier: 'priority',
      pricePerCall: 0.10,
      callCount,
      isPriority: true,
    };
  }

  for (const tier of DEFAULT_TIERS) {
    if (callCount >= tier.minCalls && (tier.maxCalls === null || callCount <= tier.maxCalls)) {
      return {
        tier: tier.tier,
        pricePerCall: tier.pricePerCall,
        callCount,
        isPriority: false,
      };
    }
  }

  // Fallback: premium pricing for very high volumes
  return {
    tier: 'premium',
    pricePerCall: 0.03,
    callCount,
    isPriority: false,
  };
}

/**
 * Calculate total charge for a batch of calls.
 */
export function calculateBatchCharge(
  callCount: number,
  priorityCount: number = 0,
  existingCallCount: number = 0
): number {
  let total = 0;
  
  // Priority calls charged at $0.10 regardless of tier
  total += priorityCount * 0.10;
  
  // Remaining calls charged at tiered rate
  const standardCalls = callCount - priorityCount;
  for (let i = 0; i < standardCalls; i++) {
    const result = getTierPrice(existingCallCount + i + 1, false);
    total += result.pricePerCall;
  }
  
  return total;
}

/**
 * Estimate revenue impact of tiered pricing vs flat rate.
 * Current flat rate: $0.01/call
 */
export function estimateRevenueImpact(callDistribution: number[]): {
  flatRevenue: number;
  tieredRevenue: number;
  increase: number;
  increasePercent: string;
} {
  let callCount = 0;
  let flatRevenue = 0;
  let tieredRevenue = 0;

  for (const batchSize of callDistribution) {
    for (let i = 0; i < batchSize; i++) {
      callCount++;
      const result = getTierPrice(callCount, false);
      tieredRevenue += result.pricePerCall;
      flatRevenue += 0.01;
    }
  }

  const increase = tieredRevenue - flatRevenue;
  const increasePercent = flatRevenue > 0 
    ? `+${((increase / flatRevenue) * 100).toFixed(1)}%`
    : 'N/A';

  return {
    flatRevenue,
    tieredRevenue,
    increase,
    increasePercent,
  };
}
