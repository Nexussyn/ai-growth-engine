import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { getTierPrice, get_tier_price, calculateBatchCost } from '../src/pricing/tier-engine.ts';

Deno.test('Tier 1: free for first 50 calls', () => {
  assertEquals(getTierPrice(1).tier, 'free');
  assertEquals(getTierPrice(25).tier, 'free');
  assertEquals(getTierPrice(50).tier, 'free');
  assertEquals(getTierPrice(1).pricePerCall, 0.00);
  assertEquals(getTierPrice(50).pricePerCall, 0.00);
});

Deno.test('Tier 2: standard for calls 51-500', () => {
  assertEquals(getTierPrice(51).tier, 'standard');
  assertEquals(getTierPrice(250).tier, 'standard');
  assertEquals(getTierPrice(500).tier, 'standard');
  assertEquals(getTierPrice(51).pricePerCall, 0.01);
  assertEquals(getTierPrice(500).pricePerCall, 0.01);
});

Deno.test('Tier 3: premium for calls 501+', () => {
  assertEquals(getTierPrice(501).tier, 'premium');
  assertEquals(getTierPrice(1000).tier, 'premium');
  assertEquals(getTierPrice(501).pricePerCall, 0.03);
  assertEquals(getTierPrice(1000).pricePerCall, 0.03);
});

Deno.test('Tier 4: priority flag overrides all tiers', () => {
  assertEquals(getTierPrice(1, true).tier, 'priority');
  assertEquals(getTierPrice(1, true).pricePerCall, 0.10);
  assertEquals(getTierPrice(250, true).tier, 'priority');
  assertEquals(getTierPrice(250, true).pricePerCall, 0.10);
  assertEquals(getTierPrice(1000, true).tier, 'priority');
  assertEquals(getTierPrice(1000, true).pricePerCall, 0.10);
});

Deno.test('get_tier_price snake_case alias compatibility', () => {
  assertEquals(get_tier_price(1).tier, 'free');
  assertEquals(get_tier_price(51).tier, 'standard');
  assertEquals(get_tier_price(501).tier, 'premium');
  assertEquals(get_tier_price(1, true).tier, 'priority');
});

Deno.test('Batch cost calculation spanning tiers', () => {
  // 10 free calls = $0.00
  assertEquals(calculateBatchCost(1, 10), 0.00);
  // 1 standard call = $0.01
  assertEquals(calculateBatchCost(51, 1), 0.01);
  // Spanning from call 45 to 55 (6 free calls @ $0 + 5 standard calls @ $0.01 = $0.05)
  assertEquals(calculateBatchCost(45, 11), 0.05);
  // 5 priority calls = $0.50
  assertEquals(calculateBatchCost(1, 5, true), 0.50);
});
