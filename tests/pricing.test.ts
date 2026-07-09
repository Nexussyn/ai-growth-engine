import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  getTierPrice,
  get_tier_price,
  calculateBatchCost,
} from '../src/pricing/tier-engine.ts';

Deno.test('Tier 1: free for first 50 calls', () => {
  assertEquals(getTierPrice(1).tier, 'free');
  assertEquals(getTierPrice(50).tier, 'free');
  assertEquals(getTierPrice(1).pricePerCall, 0.0);
  assertEquals(getTierPrice(50).pricePerCall, 0.0);
});

Deno.test('Tier 2: standard for calls 51-500', () => {
  assertEquals(getTierPrice(51).tier, 'standard');
  assertEquals(getTierPrice(500).tier, 'standard');
  assertEquals(getTierPrice(51).pricePerCall, 0.01);
  assertEquals(getTierPrice(500).pricePerCall, 0.01);
});

Deno.test('Tier 3: premium for calls 501+', () => {
  assertEquals(getTierPrice(501).tier, 'premium');
  assertEquals(getTierPrice(1000).tier, 'premium');
  assertEquals(getTierPrice(501).pricePerCall, 0.03);
});

Deno.test('Tier 4: priority flag overrides all', () => {
  assertEquals(getTierPrice(1, true).tier, 'priority');
  assertEquals(getTierPrice(50, true).pricePerCall, 0.1);
  assertEquals(getTierPrice(51, true).pricePerCall, 0.1);
  assertEquals(getTierPrice(500, true).pricePerCall, 0.1);
  assertEquals(getTierPrice(1000, true).pricePerCall, 0.1);
  assertEquals(getTierPrice(1000, true).tier, 'priority');
});

Deno.test('get_tier_price alias matches getTierPrice', () => {
  assertEquals(get_tier_price(51, false), getTierPrice(51, false));
  assertEquals(get_tier_price(1, true), getTierPrice(1, true));
});

Deno.test('Batch cost calculation', () => {
  assertEquals(calculateBatchCost(1, 10), 0);
  assertEquals(calculateBatchCost(51, 1), 0.01);
  assertEquals(calculateBatchCost(501, 2), 0.06);
  assertEquals(calculateBatchCost(1, 1, true), 0.1);
});

Deno.test('Migration is idempotent', async () => {
  const sql = await Deno.readTextFile('./migrations/add_tiered_pricing.sql');
  assertEquals(sql.includes('IF NOT EXISTS'), true);
  assertEquals(sql.includes('ON CONFLICT'), true);
});
