import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { calculateBatchCost, get_tier_price, getTierPrice } from '../src/pricing/tier-engine.ts';

Deno.test('Tier 1: free for calls 1-50', () => {
  assertEquals(getTierPrice(1).tier, 'free');
  assertEquals(getTierPrice(50).tier, 'free');
  assertEquals(getTierPrice(1).pricePerCall, 0.00);
  assertEquals(getTierPrice(50).callsInTier, 1);
});

Deno.test('Tier 2: standard for calls 51-500', () => {
  assertEquals(getTierPrice(51).tier, 'standard');
  assertEquals(getTierPrice(500).tier, 'standard');
  assertEquals(getTierPrice(51).pricePerCall, 0.01);
  assertEquals(getTierPrice(500).callsInTier, 1);
});

Deno.test('Tier 3: premium for calls 501+', () => {
  assertEquals(getTierPrice(501).tier, 'premium');
  assertEquals(getTierPrice(501).pricePerCall, 0.03);
});

Deno.test('Tier 4: priority flag overrides all', () => {
  assertEquals(getTierPrice(1, true).tier, 'priority');
  assertEquals(getTierPrice(1000, true).pricePerCall, 0.10);
});

Deno.test('snake_case get_tier_price returns only the price', () => {
  assertEquals(get_tier_price(50), 0.00);
  assertEquals(get_tier_price(51), 0.01);
  assertEquals(get_tier_price(501), 0.03);
  assertEquals(get_tier_price(1, true), 0.10);
});

Deno.test('Batch cost calculation', () => {
  // 10 free calls = $0
  assertEquals(calculateBatchCost(1, 10), 0);
  // 1 standard call
  assertEquals(calculateBatchCost(51, 1), 0.01);
  // Crosses free -> standard: calls 49, 50, 51, 52
  assertEquals(calculateBatchCost(49, 4), 0.02);
  // Crosses standard -> premium: calls 499, 500, 501, 502
  assertEquals(calculateBatchCost(499, 4), 0.08);
  // Priority overrides every volume tier
  assertEquals(calculateBatchCost(1, 3, true), 0.3);
  // Empty batch is valid and costs nothing
  assertEquals(calculateBatchCost(1, 0), 0);
});

Deno.test('invalid call counts fail fast', () => {
  assertThrows(() => getTierPrice(0), RangeError);
  assertThrows(() => getTierPrice(-1), RangeError);
  assertThrows(() => getTierPrice(1.5), RangeError);
  assertThrows(() => getTierPrice(Number.POSITIVE_INFINITY), RangeError);
  assertThrows(() => getTierPrice(Number.NaN), RangeError);
  assertThrows(() => calculateBatchCost(0, 1), RangeError);
  assertThrows(() => calculateBatchCost(1, -1), RangeError);
  assertThrows(() => calculateBatchCost(1, 1.5), RangeError);
});
