import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { getTierPrice, calculateBatchCost } from '../src/pricing/tier-engine.ts';

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


Deno.test('Edge: zero calls returns free tier', () => {
  assertEquals(getTierPrice(0).tier, 'free');
  assertEquals(getTierPrice(0).pricePerCall, 0.00);
});

Deno.test('Edge: large call count still returns premium', () => {
  assertEquals(getTierPrice(1000000).tier, 'premium');
  assertEquals(getTierPrice(1000000).pricePerCall, 0.03);
});

Deno.test('Edge: negative call count defaults to free', () => {
  assertEquals(getTierPrice(-1).tier, 'free');
});

Deno.test('Edge: priority flag at tier boundary', () => {
  // Priority at different call counts should always return priority pricing
  assertEquals(getTierPrice(1, true).pricePerCall, 0.10);
  assertEquals(getTierPrice(50, true).pricePerCall, 0.10);
  assertEquals(getTierPrice(51, true).pricePerCall, 0.10);
  assertEquals(getTierPrice(500, true).pricePerCall, 0.10);
  assertEquals(getTierPrice(501, true).pricePerCall, 0.10);
});

Deno.test('Edge: batch cost with mixed tiers', () => {
  // 50 free calls + 1 standard = /usr/bin/bash.01
  const cost = calculateBatchCost(1, 51);
  assertEquals(cost > 0, true);
});

Deno.test('Migration is idempotent', async () => {
  const sql = await Deno.readTextFile('./migrations/add_tiered_pricing.sql');
  assertEquals(sql.includes('IF NOT EXISTS'), true);
  assertEquals(sql.includes('ON CONFLICT'), true);
});
