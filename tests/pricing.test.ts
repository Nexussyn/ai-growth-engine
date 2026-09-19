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

Deno.test('get_tier_price returns numeric USDC prices at every boundary', () => {
  for (const [count, price] of [[1, 0], [50, 0], [51, 0.01], [500, 0.01], [501, 0.03]]) {
    assertEquals(get_tier_price(count, false), price);
    assertEquals(get_tier_price(count, true), 0.10);
    assertEquals(getTierPrice(count).pricePerCall, price);
  }
});

Deno.test('rejects invalid call ordinals even for priority requests', () => {
  for (const count of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assertThrows(() => getTierPrice(count), RangeError);
    assertThrows(() => get_tier_price(count, true), RangeError);
  }
});

Deno.test('batch billing spans boundaries and rounds exact decimal prices', () => {
  assertEquals(calculateBatchCost(49, 4), 0.02);
  assertEquals(calculateBatchCost(499, 4), 0.08);
  assertEquals(calculateBatchCost(1, 501), 4.53);
  assertEquals(calculateBatchCost(49, 4, true), 0.40);
  assertEquals(calculateBatchCost(51, 0), 0);
});

Deno.test('rejects invalid batch lengths and unsafe ending ordinals', () => {
  for (const count of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assertThrows(() => calculateBatchCost(1, count), RangeError);
  }
  assertThrows(() => calculateBatchCost(0, 1), RangeError);
  assertThrows(() => calculateBatchCost(Number.MAX_SAFE_INTEGER, 2), RangeError);
});
