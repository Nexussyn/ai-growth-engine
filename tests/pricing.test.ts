import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { getTierPrice, calculateBatchCost, get_tier_price } from '../src/pricing/tier-engine.ts';

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

Deno.test('Alias get_tier_price testing', () => {
  assertEquals(get_tier_price(1).tier, 'free');
  assertEquals(get_tier_price(51).tier, 'standard');
  assertEquals(get_tier_price(501).tier, 'premium');
  assertEquals(get_tier_price(1, true).tier, 'priority');
  assertEquals(get_tier_price(1).pricePerCall, 0.00);
});

