import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  getTierPrice,
  calculateBatchCost,
  projectRevenue,
  callsUntilNextTier,
  estimatePriorityUplift,
  DEFAULT_TIER_CONFIG,
  type TierConfig,
} from '../src/pricing/tier-engine.ts';

// ============================================
// CORE TIER TESTS (Original Requirements)
// ============================================

Deno.test('Tier 1: free for first 50 calls', () => {
  assertEquals(getTierPrice(1).tier, 'free');
  assertEquals(getTierPrice(50).tier, 'free');
  assertEquals(getTierPrice(1).pricePerCall, 0.00);
});

Deno.test('Tier 2: standard for calls 51-500', () => {
  assertEquals(getTierPrice(51).tier, 'standard');
  assertEquals(getTierPrice(500).tier, 'standard');
  assertEquals(getTierPrice(51).pricePerCall, 0.01);
});

Deno.test('Tier 3: premium for calls 500+', () => {
  assertEquals(getTierPrice(501).tier, 'premium');
  assertEquals(getTierPrice(10000).tier, 'premium');
  assertEquals(getTierPrice(501).pricePerCall, 0.03);
});

Deno.test('Tier 4: priority flag overrides all', () => {
  assertEquals(getTierPrice(1, true).tier, 'priority');
  assertEquals(getTierPrice(50, true).tier, 'priority');
  assertEquals(getTierPrice(500, true).tier, 'priority');
  assertEquals(getTierPrice(1000, true).pricePerCall, 0.10);
});

// ============================================
// BATCH COST CALCULATION TESTS
// ============================================

Deno.test('Batch cost: 10 free calls = $0', () => {
  assertEquals(calculateBatchCost(1, 10).totalCost, 0);
});

Deno.test('Batch cost: 1 standard call = $0.01', () => {
  assertEquals(calculateBatchCost(51, 1).totalCost, 0.01);
});

Deno.test('Batch cost: crosses free to standard boundary', () => {
  const result = calculateBatchCost(48, 10); // 3 free + 7 standard = $0.07
  assertEquals(result.totalCost, 0.07);
  assertEquals(result.breakdown.length, 2);
  assertEquals(result.breakdown[0].tier, 'free');
  assertEquals(result.breakdown[0].calls, 3);
  assertEquals(result.breakdown[1].tier, 'standard');
  assertEquals(result.breakdown[1].calls, 7);
});

Deno.test('Batch cost: crosses standard to premium boundary', () => {
  const result = calculateBatchCost(498, 10); // 3 standard + 7 premium = $0.03 + $0.21 = $0.24
  assertEquals(result.totalCost, 0.24);
  assertEquals(result.breakdown.length, 2);
  assertEquals(result.breakdown[0].tier, 'standard');
  assertEquals(result.breakdown[1].tier, 'premium');
});

Deno.test('Batch cost: priority batch', () => {
  const result = calculateBatchCost(1, 5, true);
  assertEquals(result.totalCost, 0.50);
  assertEquals(result.breakdown.length, 1);
  assertEquals(result.breakdown[0].tier, 'priority');
});

// ============================================
// REVENUE PROJECTION TESTS
// ============================================

Deno.test('Revenue projection: free tier user projects standard tier upgrade', () => {
  const projection = projectRevenue(30, 50); // 30 calls, project 50 more (to 80)
  assertEquals(projection.currentTier, 'free');
  assertEquals(projection.projectedCalls, 50);
  assertExists(projection.projectedRevenue);
  assertEquals(projection.projectedRevenue > 0, true);
});

Deno.test('Revenue projection: standard tier user projects premium upgrade', () => {
  const projection = projectRevenue(400, 200); // 400 calls, project 200 more (to 600)
  assertEquals(projection.currentTier, 'standard');
  assertEquals(projection.projectedRevenue > 0, true);
});

Deno.test('Revenue projection: priority mode', () => {
  const projection = projectRevenue(10, 100, true);
  assertEquals(projection.currentTier, 'priority');
  assertEquals(projection.projectedRevenue, 10.00); // 100 * $0.10
});

// ============================================
// CALLS UNTIL NEXT TIER TESTS
// ============================================

Deno.test('Calls until next tier from free tier', () => {
  assertEquals(callsUntilNextTier(1), 50); // 50 - 1 + 1 = 50
  assertEquals(callsUntilNextTier(25), 26); // 50 - 25 + 1 = 26
  assertEquals(callsUntilNextTier(50), 1); // 50 - 50 + 1 = 1
});

Deno.test('Calls until next tier from standard tier', () => {
  assertEquals(callsUntilNextTier(51), 450); // 500 - 51 + 1 = 450
  assertEquals(callsUntilNextTier(300), 201); // 500 - 300 + 1 = 201
  assertEquals(callsUntilNextTier(500), 1); // 500 - 500 + 1 = 1
});

Deno.test('Calls until next tier from premium tier = 0 (unlimited)', () => {
  assertEquals(callsUntilNextTier(501), 0);
  assertEquals(callsUntilNextTier(10000), 0);
});

// ============================================
// PRIORITY UPLIFT ESTIMATION TESTS
// ============================================

Deno.test('Priority uplift estimation', () => {
  const result = estimatePriorityUplift(1000, 10); // 1000 calls, 10% priority
  assertExists(result.standardRevenue);
  assertExists(result.priorityRevenue);
  assertExists(result.uplift);
  assertExists(result.upliftPercentage);
  assertEquals(result.uplift > 0, true);
  assertEquals(result.upliftPercentage > 0, true);
});

Deno.test('Priority uplift with 0% priority = no uplift', () => {
  const result = estimatePriorityUplift(1000, 0);
  assertEquals(result.uplift, 0);
  assertEquals(result.upliftPercentage, 0);
});

Deno.test('Priority uplift with 100% priority = maximum uplift', () => {
  const result = estimatePriorityUplift(100, 100);
  assertEquals(result.standardRevenue, 0);
  assertEquals(result.priorityRevenue, 10.00); // 100 * $0.10
  assertEquals(result.uplift, 10.00);
  assertEquals(result.upliftPercentage, 100);
});

// ============================================
// CUSTOM CONFIG TESTS
// ============================================

Deno.test('Custom tier configuration', () => {
  const customConfig: TierConfig[] = [
    { name: 'free', minCalls: 1, maxCalls: 100, pricePerCall: 0.00 },
    { name: 'standard', minCalls: 101, maxCalls: 1000, pricePerCall: 0.02 },
    { name: 'premium', minCalls: 1001, maxCalls: 'unlimited', pricePerCall: 0.05 },
    { name: 'priority', minCalls: 1, maxCalls: 'unlimited', pricePerCall: 0.20 },
  ];

  assertEquals(getTierPrice(50, false, customConfig).tier, 'free');
  assertEquals(getTierPrice(150, false, customConfig).tier, 'standard');
  assertEquals(getTierPrice(150, false, customConfig).pricePerCall, 0.02);
  assertEquals(getTierPrice(2000, false, customConfig).tier, 'premium');
  assertEquals(getTierPrice(1, true, customConfig).pricePerCall, 0.20);
});

// ============================================
// EDGE CASES & PRECISION TESTS
// ============================================

Deno.test('USDC precision: 6 decimal places', () => {
  const result = calculateBatchCost(1, 3, false);
  assertEquals(result.totalCost, 0);
  
  const result2 = calculateBatchCost(51, 3, false);
  assertEquals(result2.totalCost, 0.03);
});

Deno.test('Large batch calculation performance', () => {
  const result = calculateBatchCost(1, 10000, false);
  assertEquals(result.totalCost > 0, true);
  assertEquals(result.breakdown.length >= 3, true); // Should span multiple tiers
});

Deno.test('Effective rate calculation', () => {
  const result = calculateBatchCost(1, 100, false);
  assertEquals(result.effectiveRate > 0, true);
  assertEquals(result.effectiveRate < 0.03, true); // Should be weighted average
});

Deno.test('Zero calls batch', () => {
  const result = calculateBatchCost(1, 0, false);
  assertEquals(result.totalCost, 0);
  assertEquals(result.breakdown.length, 0);
  assertEquals(result.effectiveRate, 0);
});

// ============================================
// INTEGRATION TEST: Complete user journey
// ============================================

Deno.test('Complete user journey: free -> standard -> premium', () => {
  // Start with free tier
  let result = getTierPrice(1);
  assertEquals(result.tier, 'free');
  
  // Make 50 calls (still free)
  result = getTierPrice(50);
  assertEquals(result.tier, 'free');
  
  // Cross to standard
  result = getTierPrice(51);
  assertEquals(result.tier, 'standard');
  
  // Make many standard calls
  result = getTierPrice(300);
  assertEquals(result.tier, 'standard');
  
  // Cross to premium
  result = getTierPrice(501);
  assertEquals(result.tier, 'premium');
  
  // Very high volume
  result = getTierPrice(10000);
  assertEquals(result.tier, 'premium');
  
  // Enable priority at any point
  result = getTierPrice(100, true);
  assertEquals(result.tier, 'priority');
  assertEquals(result.pricePerCall, 0.10);
});