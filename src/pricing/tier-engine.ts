/**
 * Tiered Pricing Engine — Issue #1
 * Implements 4-tier pricing for x402 API calls with dynamic volume-based pricing
 */

export type Tier = 'free' | 'standard' | 'premium' | 'priority';

export interface TierConfig {
  name: Tier;
  minCalls: number;
  maxCalls: number | 'unlimited';
  pricePerCall: number; // in USDC
}

export interface TierResult {
  tier: Tier;
  pricePerCall: number; // in USDC
  callsInTier: number;
  callsUntilNextTier: number;
}

export interface BatchCostResult {
  totalCost: number;
  breakdown: Array<{
    tier: Tier;
    calls: number;
    cost: number;
  }>;
  effectiveRate: number;
}

export interface RevenueProjection {
  currentTier: Tier;
  currentCallCount: number;
  projectedCalls: number;
  projectedRevenue: number;
  tierUpgrades: Array<{
    fromTier: Tier;
    toTier: Tier;
    atCallCount: number;
    additionalRevenue: number;
  }>;
}

/**
 * Default tier configuration for x402 API calls
 */
export const DEFAULT_TIER_CONFIG: TierConfig[] = [
  { name: 'free', minCalls: 1, maxCalls: 50, pricePerCall: 0.00 },
  { name: 'standard', minCalls: 51, maxCalls: 500, pricePerCall: 0.01 },
  { name: 'premium', minCalls: 501, maxCalls: 'unlimited', pricePerCall: 0.03 },
  { name: 'priority', minCalls: 1, maxCalls: 'unlimited', pricePerCall: 0.10 },
];

/**
 * Returns the price per call based on total call count and priority flag.
 * - Tier 1 (Free):     calls 1–50     → $0.00
 * - Tier 2 (Standard): calls 51–500  → $0.01
 * - Tier 3 (Premium):  calls 500+    → $0.03
 * - Tier 4 (Priority): priority=true → $0.10
 */
export function getTierPrice(callCount: number, priorityFlag = false, config: TierConfig[] = DEFAULT_TIER_CONFIG): TierResult {
  // Priority tier overrides all volume-based tiers
  if (priorityFlag) {
    const priorityTier = config.find(t => t.name === 'priority')!;
    return {
      tier: 'priority',
      pricePerCall: priorityTier.pricePerCall,
      callsInTier: Infinity, // Process all priority calls in one batch
      callsUntilNextTier: 0,
    };
  }

  // Find the appropriate volume-based tier
  for (const tier of config) {
    if (tier.name === 'priority') continue; // Skip priority in volume-based lookup
    const maxCalls = tier.maxCalls === 'unlimited' ? Infinity : tier.maxCalls;
    if (callCount >= tier.minCalls && callCount <= maxCalls) {
      const callsInTier = maxCalls - callCount + 1;
      const callsUntilNextTier = maxCalls === Infinity ? 0 : maxCalls - callCount + 1;
      return {
        tier: tier.name,
        pricePerCall: tier.pricePerCall,
        callsInTier,
        callsUntilNextTier: callsUntilNextTier,
      };
    }
  }

  // Fallback to premium for any edge cases
  const premiumTier = config.find(t => t.name === 'premium')!;
  return {
    tier: 'premium',
    pricePerCall: premiumTier.pricePerCall,
    callsInTier: Infinity,
    callsUntilNextTier: 0,
  };
}

/**
 * Calculates total cost for a batch of calls with detailed breakdown.
 */
export function calculateBatchCost(startCount: number, numCalls: number, priority = false, config: TierConfig[] = DEFAULT_TIER_CONFIG): BatchCostResult {
  const breakdown: BatchCostResult['breakdown'] = [];
  let remainingCalls = numCalls;
  let currentCount = startCount;
  let totalCost = 0;

  while (remainingCalls > 0) {
    const tierResult = getTierPrice(currentCount, priority, config);
    const callsInThisTier = Math.min(remainingCalls, tierResult.callsInTier);
    const tierCost = callsInThisTier * tierResult.pricePerCall;

    breakdown.push({
      tier: tierResult.tier,
      calls: callsInThisTier,
      cost: Math.round(tierCost * 1e6) / 1e6,
    });

    totalCost += tierCost;
    remainingCalls -= callsInThisTier;
    currentCount += callsInThisTier;

    // If we're in the last tier (unlimited), consume all remaining calls
    if (tierResult.callsInTier === Infinity) {
      break;
    }
  }

  return {
    totalCost: Math.round(totalCost * 1e6) / 1e6, // round to 6 decimals (USDC precision)
    breakdown,
    effectiveRate: numCalls > 0 ? Math.round((totalCost / numCalls) * 1e6) / 1e6 : 0,
  };
}

/**
 * Projects revenue for a given number of future calls.
 * Useful for growth forecasting and upsell triggers.
 */
export function projectRevenue(
  currentCallCount: number,
  projectedAdditionalCalls: number,
  priority = false,
  config: TierConfig[] = DEFAULT_TIER_CONFIG
): RevenueProjection {
  const currentTier = getTierPrice(currentCallCount, priority, config).tier;
  const batchResult = calculateBatchCost(currentCallCount + 1, projectedAdditionalCalls, priority, config);
  
  const tierUpgrades: RevenueProjection['tierUpgrades'] = [];
  let lastTier = currentTier;

  for (const segment of batchResult.breakdown) {
    if (segment.tier !== lastTier) {
      const fromTierConfig = config.find(t => t.name === lastTier)!;
      const toTierConfig = config.find(t => t.name === segment.tier)!;
      tierUpgrades.push({
        fromTier: lastTier,
        toTier: segment.tier,
        atCallCount: currentCallCount + 1, // Simplified - would need precise calculation
        additionalRevenue: segment.cost,
      });
      lastTier = segment.tier;
    }
  }

  return {
    currentTier,
    currentCallCount,
    projectedCalls: projectedAdditionalCalls,
    projectedRevenue: batchResult.totalCost,
    tierUpgrades,
  };
}

/**
 * Calculates the number of calls needed to reach the next tier.
 */
export function callsUntilNextTier(callCount: number, config: TierConfig[] = DEFAULT_TIER_CONFIG): number {
  const currentTier = getTierPrice(callCount, false, config);
  return currentTier.callsUntilNextTier;
}

/**
 * Estimates revenue uplift from enabling priority tier for a percentage of calls.
 */
export function estimatePriorityUplift(
  totalCalls: number,
  priorityPercentage: number,
  config: TierConfig[] = DEFAULT_TIER_CONFIG
): { standardRevenue: number; priorityRevenue: number; uplift: number; upliftPercentage: number } {
  const priorityCalls = Math.floor(totalCalls * priorityPercentage / 100);
  const standardCalls = totalCalls - priorityCalls;

  const standardResult = calculateBatchCost(1, standardCalls, false, config);
  const priorityResult = calculateBatchCost(1, priorityCalls, true, config);

  const standardRevenue = standardResult.totalCost;
  const priorityRevenue = standardResult.totalCost + priorityResult.totalCost;
  const uplift = priorityRevenue - standardRevenue;
  
  // Handle edge case: 100% priority means no standard revenue, uplift is 100% of priority revenue
  let upliftPercentage: number;
  if (standardRevenue > 0) {
    upliftPercentage = (uplift / standardRevenue) * 100;
  } else if (priorityRevenue > 0) {
    upliftPercentage = 100; // All revenue comes from priority tier
  } else {
    upliftPercentage = 0;
  }

  return {
    standardRevenue: Math.round(standardRevenue * 1e6) / 1e6,
    priorityRevenue: Math.round(priorityRevenue * 1e6) / 1e6,
    uplift: Math.round(uplift * 1e6) / 1e6,
    upliftPercentage: Math.round(upliftPercentage * 100) / 100,
  };
}