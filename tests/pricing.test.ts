import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  calculateBatchCost,
  get_tier_price,
  getTierPrice,
} from "../src/pricing/tier-engine.ts";

Deno.test("Tier 1: free for first 50 calls", () => {
  assertEquals(getTierPrice(1).tier, "free");
  assertEquals(getTierPrice(50).tier, "free");
  assertEquals(getTierPrice(1).pricePerCall, 0.0);
  assertEquals(getTierPrice(50).pricePerCall, 0.0);
});

Deno.test("Tier 2: standard for calls 51-500", () => {
  assertEquals(getTierPrice(51).tier, "standard");
  assertEquals(getTierPrice(500).tier, "standard");
  assertEquals(getTierPrice(51).pricePerCall, 0.01);
  assertEquals(getTierPrice(500).pricePerCall, 0.01);
});

Deno.test("Tier 3: premium for calls 501+", () => {
  assertEquals(getTierPrice(501).tier, "premium");
  assertEquals(getTierPrice(10_000).tier, "premium");
  assertEquals(getTierPrice(501).pricePerCall, 0.03);
});

Deno.test("Tier 4: priority flag overrides all count tiers", () => {
  assertEquals(getTierPrice(1, true).tier, "priority");
  assertEquals(getTierPrice(1000, true).pricePerCall, 0.1);
  assertEquals(get_tier_price(25, true).tier, "priority");
});

Deno.test("snake_case get_tier_price matches getTierPrice", () => {
  for (const n of [1, 50, 51, 500, 501]) {
    assertEquals(get_tier_price(n), getTierPrice(n));
    assertEquals(get_tier_price(n, true), getTierPrice(n, true));
  }
});

Deno.test("boundaries: non-positive callCount clamps into free tier", () => {
  assertEquals(getTierPrice(0).tier, "free");
  assertEquals(getTierPrice(-3).tier, "free");
  assertEquals(get_tier_price(0).pricePerCall, 0);
});

Deno.test("invalid callCount throws", () => {
  assertThrows(() => getTierPrice(Number.NaN), RangeError);
  assertThrows(() => get_tier_price(Number.POSITIVE_INFINITY), RangeError);
});

Deno.test("Batch cost calculation", () => {
  assertEquals(calculateBatchCost(1, 10), 0);
  assertEquals(calculateBatchCost(51, 1), 0.01);
  // 2 free + 2 standard across the 50→51 boundary
  assertEquals(calculateBatchCost(49, 4), 0.02);
  assertEquals(calculateBatchCost(1, 3, true), 0.3);
});
