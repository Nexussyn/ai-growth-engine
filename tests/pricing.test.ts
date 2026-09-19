import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { getTierPrice, get_tier_price, calculateBatchCost } from '../src/pricing/tier-engine.ts';

Deno.test('Tier 1: free for first 50 calls', () => {
  assertEquals(getTierPrice(1).tier, 'free');
  assertEquals(getTierPrice(50).tier, 'free');
  assertEquals(getTierPrice(1).pricePerCall, 0.0);
  assertEquals(get_tier_price(50, false).pricePerCall, 0.0);
});

Deno.test('Tier 2: standard for calls 51-500', () => {
  assertEquals(getTierPrice(51).tier, 'standard');
  assertEquals(getTierPrice(500).tier, 'standard');
  assertEquals(getTierPrice(51).pricePerCall, 0.01);
});

Deno.test('Tier 3: premium for calls 501+', () => {
  assertEquals(getTierPrice(501).tier, 'premium');
  assertEquals(getTierPrice(501).pricePerCall, 0.03);
});

Deno.test('Tier 4: priority flag overrides all', () => {
  assertEquals(getTierPrice(1, true).tier, 'priority');
  assertEquals(get_tier_price(1000, true).pricePerCall, 0.1);
});

Deno.test('Batch cost calculation', () => {
  assertEquals(calculateBatchCost(1, 10), 0);
  assertEquals(calculateBatchCost(51, 1), 0.01);
  assertEquals(calculateBatchCost(49, 3), 0.01); // 49,50 free; 51 standard
});

Deno.test('Rejects invalid callCount', () => {
  assertThrows(() => getTierPrice(0), RangeError);
  assertThrows(() => getTierPrice(1.5), TypeError);
});
