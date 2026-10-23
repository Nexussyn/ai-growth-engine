import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildX402CallPaymentRow,
  calculateBatchBreakdown,
  calculateBatchCost,
  get_tier_price,
  getTierPrice,
  PRICING_TIERS,
} from '../src/pricing/tier-engine.ts';

Deno.test('Tier 1 (Free): first 50 calls are $0.00', () => {
  assertEquals(getTierPrice(1).tier, 'free');
  assertEquals(getTierPrice(25).tier, 'free');
  assertEquals(getTierPrice(50).tier, 'free');
  assertEquals(getTierPrice(1).pricePerCall, 0.00);
  assertEquals(getTierPrice(50).pricePerCall, 0.00);
  assertEquals(getTierPrice(1).callsInTier, 50);
  assertEquals(getTierPrice(50).callsInTier, 1);
  assertEquals(get_tier_price(1), 0.00);
  assertEquals(get_tier_price(50, false), 0.00);
});

Deno.test('Tier 2 (Standard): calls 51-500 are $0.01/call', () => {
  assertEquals(getTierPrice(51).tier, 'standard');
  assertEquals(getTierPrice(250).tier, 'standard');
  assertEquals(getTierPrice(500).tier, 'standard');
  assertEquals(getTierPrice(51).pricePerCall, 0.01);
  assertEquals(getTierPrice(500).pricePerCall, 0.01);
  assertEquals(getTierPrice(51).callsInTier, 450);
  assertEquals(getTierPrice(500).callsInTier, 1);
  assertEquals(get_tier_price(51), 0.01);
  assertEquals(get_tier_price(500, false), 0.01);
});

Deno.test('Tier 3 (Premium): calls 501+ are $0.03/call', () => {
  assertEquals(getTierPrice(501).tier, 'premium');
  assertEquals(getTierPrice(10_000).tier, 'premium');
  assertEquals(getTierPrice(501).pricePerCall, 0.03);
  assertEquals(getTierPrice(501).callsInTier, Infinity);
  assertEquals(get_tier_price(501), 0.03);
  assertEquals(get_tier_price(2500, false), 0.03);
});

Deno.test('Tier 4 (Priority): priority flag overrides all call count tiers at $0.10/call', () => {
  for (const count of [1, 50, 51, 500, 501, 5000]) {
    const res = getTierPrice(count, true);
    assertEquals(res.tier, 'priority');
    assertEquals(res.pricePerCall, 0.10);
    assertEquals(res.callsInTier, 1);
    assertEquals(get_tier_price(count, true), 0.10);
  }
});

Deno.test('Batch cost and cross-tier breakdown calculation', () => {
  assertEquals(calculateBatchCost(1, 50), 0.00);
  assertEquals(calculateBatchCost(51, 1), 0.01);
  assertEquals(calculateBatchCost(49, 4), 0.02); // calls 49, 50 ($0) + calls 51, 52 ($0.01 each)

  const breakdown = calculateBatchBreakdown(49, 4, false);
  assertEquals(breakdown.totalCalls, 4);
  assertEquals(breakdown.totalCostUsdc, 0.02);
  assertEquals(breakdown.byTier.free.calls, 2);
  assertEquals(breakdown.byTier.standard.calls, 2);
  assertEquals(breakdown.byTier.standard.subtotalUsdc, 0.02);

  // Across standard -> premium boundary (calls 500 and 501)
  const boundary = calculateBatchBreakdown(500, 2, false);
  assertEquals(boundary.totalCostUsdc, 0.04);
  assertEquals(boundary.byTier.standard.calls, 1);
  assertEquals(boundary.byTier.premium.calls, 1);
});

Deno.test('Input validation and x402 payment row builder', () => {
  assertThrows(() => getTierPrice(-1), RangeError);
  assertThrows(() => getTierPrice(1.5), RangeError);
  assertThrows(() => getTierPrice(Number.NaN), RangeError);

  const row = buildX402CallPaymentRow('0xdF4Ff9D2f45f99f11A90b16F277D4B7EddDB72A5', 55, false);
  assertEquals(row.tier, 'standard');
  assertEquals(row.price_per_call, 0.01);
  assertEquals(row.priority_flag, false);
  assertEquals(Object.keys(PRICING_TIERS).length, 4);
});
