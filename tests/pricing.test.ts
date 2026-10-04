import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { getTierPrice, get_tier_price, calculateBatchCost } from '../src/pricing/tier-engine.ts';

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
  assertEquals(getTierPrice(501).pricePerCall, 0.03);
});

Deno.test('Tier 4: priority flag overrides all', () => {
  assertEquals(getTierPrice(1, true).tier, 'priority');
  assertEquals(getTierPrice(1000, true).pricePerCall, 0.10);
});

Deno.test('Batch cost calculation', () => {
  // 10 free calls = $0
  assertEquals(calculateBatchCost(1, 10), 0);
  // 1 standard call
  assertEquals(calculateBatchCost(51, 1), 0.01);
});

Deno.test('Batch cost across tier boundaries', () => {
  // calls 45-55: 6 free + 5 standard = $0.05
  assertEquals(calculateBatchCost(45, 11), 0.05);
  // calls 498-502: 3 standard + 2 premium = 0.03 + 0.06 = $0.09
  assertEquals(calculateBatchCost(498, 5), 0.09);
  // full first 500 paid calls: 450 * 0.01 = $4.50
  assertEquals(calculateBatchCost(51, 450), 4.5);
});

Deno.test('Priority batch cost', () => {
  assertEquals(calculateBatchCost(1, 10, true), 1.0);
  assertEquals(calculateBatchCost(600, 3, true), 0.3);
});

Deno.test('Boundary: 500 is standard, 501 is premium', () => {
  assertEquals(getTierPrice(500).tier, 'standard');
  assertEquals(getTierPrice(500).pricePerCall, 0.01);
  assertEquals(getTierPrice(501).tier, 'premium');
  assertEquals(getTierPrice(501).pricePerCall, 0.03);
});

Deno.test('Input validation rejects bad call counts', () => {
  assertThrows(() => getTierPrice(0), RangeError);
  assertThrows(() => getTierPrice(-5), RangeError);
  assertThrows(() => getTierPrice(2.5), RangeError);
  assertThrows(() => getTierPrice(NaN), RangeError);
  assertThrows(() => calculateBatchCost(0, 10), RangeError);
  assertThrows(() => calculateBatchCost(1, -1), RangeError);
  // zero calls in a batch is fine (costs nothing)
  assertEquals(calculateBatchCost(1, 0), 0);
});

Deno.test('get_tier_price alias matches getTierPrice', () => {
  assertEquals(get_tier_price(25).tier, 'free');
  assertEquals(get_tier_price(300).pricePerCall, 0.01);
  assertEquals(get_tier_price(999, true).tier, 'priority');
});
