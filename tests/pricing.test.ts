import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { getTierPrice, calculateBatchCost, getTierInfo } from '../src/pricing/tier-engine.ts';

Deno.test('Tier 1: free for first 50 calls', () => {
  assertEquals(getTierPrice(1).tier, 'free');
  assertEquals(getTierPrice(50).tier, 'free');
  assertEquals(getTierPrice(1).pricePerCall, 0.00);
  assertEquals(getTierPrice(50).pricePerCall, 0.00);
});

Deno.test('Tier 2: standard for calls 51-500', () => {
  assertEquals(getTierPrice(51).tier, 'standard');
  assertEquals(getTierPrice(500).tier, 'standard');
  assertEquals(getTierPrice(51).pricePerCall, 0.01);
  assertEquals(getTierPrice(500).pricePerCall, 0.01);
});

Deno.test('Tier 3: premium for calls 501+', () => {
  assertEquals(getTierPrice(501).tier, 'premium');
  assertEquals(getTierPrice(10000).tier, 'premium');
  assertEquals(getTierPrice(501).pricePerCall, 0.03);
});

Deno.test('Tier 4: priority flag overrides all tiers', () => {
  assertEquals(getTierPrice(1, true).tier, 'priority');
  assertEquals(getTierPrice(1000, true).pricePerCall, 0.10);
  assertEquals(getTierPrice(50, true).pricePerCall, 0.10);
  assertEquals(getTierPrice(51, true).pricePerCall, 0.10);
});

Deno.test('Batch cost: all free calls', () => {
  assertEquals(calculateBatchCost(1, 10), 0);
  assertEquals(calculateBatchCost(1, 50), 0);
});

Deno.test('Batch cost: single standard call', () => {
  assertEquals(calculateBatchCost(51, 1), 0.01);
});

Deno.test('Batch cost: crossing tier boundary (free to standard)', () => {
  // Call 50 = free ($0), Call 51 = standard ($0.01)
  assertEquals(calculateBatchCost(50, 2), 0.01);
});

Deno.test('Batch cost: crossing standard to premium', () => {
  // Call 500 = standard ($0.01), Call 501 = premium ($0.03)
  assertEquals(calculateBatchCost(500, 2), 0.04);
});

Deno.test('Batch cost: with priority flag', () => {
  assertEquals(calculateBatchCost(1, 3, true), 0.30);
});

Deno.test('Invalid: callCount <= 0 throws RangeError', () => {
  assertThrows(() => getTierPrice(0), RangeError);
  assertThrows(() => getTierPrice(-1), RangeError);
});

Deno.test('Invalid: startCount or numCalls <= 0 throws', () => {
  assertThrows(() => calculateBatchCost(0, 5), RangeError);
  assertThrows(() => calculateBatchCost(1, 0), RangeError);
});

Deno.test('getTierInfo returns correct metadata', () => {
  assertEquals(getTierInfo('free').pricePerCall, 0.00);
  assertEquals(getTierInfo('priority').pricePerCall, 0.10);
  assertEquals(getTierInfo('premium').description, 'Premium tier for high-volume usage');
});

Deno.test('snake_case alias works identically', () => {
  // Import the snake_case version
  import { get_tier_price } from '../src/pricing/tier-engine.ts';
  assertEquals(get_tier_price(1).tier, 'free');
  assertEquals(get_tier_price(51).pricePerCall, 0.01);
  assertEquals(get_tier_price(1, true).pricePerCall, 0.10);
});
