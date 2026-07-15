import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { calculateBatchCost, get_tier_price, getTierPrice } from '../src/pricing/tier-engine.ts';

Deno.test('Tier 1: free for first 50 calls', () => {
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
  assertEquals(getTierPrice(501).callsInTier, Infinity);
});

Deno.test('Tier 4: priority flag overrides all', () => {
  assertEquals(getTierPrice(1, true).tier, 'priority');
  assertEquals(getTierPrice(1000, true).pricePerCall, 0.10);
});

Deno.test('snake_case API matches bounty acceptance criteria', () => {
  assertEquals(get_tier_price(51), getTierPrice(51));
  assertEquals(get_tier_price(1000, true), getTierPrice(1000, true));
});

Deno.test('Batch cost calculation', () => {
  // 10 free calls = $0
  assertEquals(calculateBatchCost(1, 10), 0);
  // 1 standard call
  assertEquals(calculateBatchCost(51, 1), 0.01);
  // Crosses from free into standard: call 50 is free, calls 51-52 are $0.01
  assertEquals(calculateBatchCost(50, 3), 0.02);
  // Crosses from standard into premium: call 500 is $0.01, calls 501-502 are $0.03
  assertEquals(calculateBatchCost(500, 3), 0.07);
  // Priority pricing applies to every call in the batch
  assertEquals(calculateBatchCost(1, 3, true), 0.30);
});

Deno.test('Input validation rejects invalid counts', () => {
  assertThrows(() => getTierPrice(0), RangeError);
  assertThrows(() => getTierPrice(1.5), RangeError);
  assertThrows(() => calculateBatchCost(1, -1), RangeError);
  assertEquals(calculateBatchCost(1, 0), 0);
});
