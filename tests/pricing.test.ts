import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  getTierPrice,
  calculateBatchCost,
  calculateBill,
} from '../src/pricing/tier-engine.ts';

// ---------------------------------------------------------------------------
// Tier 1: Free (calls 1–50)
// ---------------------------------------------------------------------------
Deno.test('Tier 1: free for first 50 calls', () => {
  assertEquals(getTierPrice(1).tier, 'free');
  assertEquals(getTierPrice(1).pricePerCall, 0.00);
  assertEquals(getTierPrice(50).tier, 'free');
  assertEquals(getTierPrice(50).pricePerCall, 0.00);
});

Deno.test('Tier 1: callsInTier counts down correctly', () => {
  assertEquals(getTierPrice(1).callsInTier, 50);
  assertEquals(getTierPrice(25).callsInTier, 26);
  assertEquals(getTierPrice(50).callsInTier, 1);
});

// ---------------------------------------------------------------------------
// Tier 2: Standard (calls 51–500)
// ---------------------------------------------------------------------------
Deno.test('Tier 2: standard for calls 51-500', () => {
  assertEquals(getTierPrice(51).tier, 'standard');
  assertEquals(getTierPrice(51).pricePerCall, 0.01);
  assertEquals(getTierPrice(500).tier, 'standard');
  assertEquals(getTierPrice(500).pricePerCall, 0.01);
});

Deno.test('Tier 2: callsInTier for standard', () => {
  assertEquals(getTierPrice(51).callsInTier, 450);
  assertEquals(getTierPrice(500).callsInTier, 1);
});

// ---------------------------------------------------------------------------
// Tier 3: Premium (calls 501+)
// ---------------------------------------------------------------------------
Deno.test('Tier 3: premium for calls 501+', () => {
  assertEquals(getTierPrice(501).tier, 'premium');
  assertEquals(getTierPrice(501).pricePerCall, 0.03);
  assertEquals(getTierPrice(10000).tier, 'premium');
  assertEquals(getTierPrice(10000).pricePerCall, 0.03);
});

Deno.test('Tier 3: callsInTier is Infinity for premium', () => {
  assertEquals(getTierPrice(501).callsInTier, Infinity);
  assertEquals(getTierPrice(999999).callsInTier, Infinity);
});

// ---------------------------------------------------------------------------
// Tier 4: Priority (overrides all)
// ---------------------------------------------------------------------------
Deno.test('Tier 4: priority flag overrides all tiers', () => {
  assertEquals(getTierPrice(1, true).tier, 'priority');
  assertEquals(getTierPrice(1, true).pricePerCall, 0.10);
  assertEquals(getTierPrice(50, true).pricePerCall, 0.10);
  assertEquals(getTierPrice(500, true).pricePerCall, 0.10);
  assertEquals(getTierPrice(1000, true).pricePerCall, 0.10);
});

Deno.test('Tier 4: priority has infinite callsInTier', () => {
  assertEquals(getTierPrice(1, true).callsInTier, Infinity);
});

// ---------------------------------------------------------------------------
// Batch cost calculation
// ---------------------------------------------------------------------------
Deno.test('Batch cost: 10 free calls = $0', () => {
  assertEquals(calculateBatchCost(1, 10), 0);
});

Deno.test('Batch cost: 1 standard call = $0.01', () => {
  assertEquals(calculateBatchCost(51, 1), 0.01);
});

Deno.test('Batch cost: crosses free → standard boundary', () => {
  // Calls 49–50 = free ($0), calls 51–53 = standard ($0.01 × 3 = $0.03)
  assertEquals(calculateBatchCost(49, 5), 0.03);
});

Deno.test('Batch cost: crosses standard → premium boundary', () => {
  // Calls 499–500 = standard ($0.01 × 2 = $0.02), calls 501–502 = premium ($0.03 × 2 = $0.06)
  // Total = $0.08
  assertEquals(calculateBatchCost(499, 4), 0.08);
});

Deno.test('Batch cost: crosses free → standard → premium (large batch)', () => {
  // Calls 45–50 = free (6 × $0 = $0)
  // Calls 51–500 = standard (450 × $0.01 = $4.50)
  // Calls 501–505 = premium (5 × $0.03 = $0.15)
  // Total = $4.65
  assertEquals(calculateBatchCost(45, 461), 4.65);
});

Deno.test('Batch cost: priority applies to every call', () => {
  assertEquals(calculateBatchCost(1, 3, true), 0.30);
  assertEquals(calculateBatchCost(499, 4, true), 0.40);
  assertEquals(calculateBatchCost(1000, 2, true), 0.20);
});

Deno.test('Batch cost: zero calls returns 0', () => {
  assertEquals(calculateBatchCost(1, 0), 0);
  assertEquals(calculateBatchCost(500, 0), 0);
});

// ---------------------------------------------------------------------------
// calculateBill (with per-tier breakdown)
// ---------------------------------------------------------------------------
Deno.test('calculateBill: single tier (free only)', () => {
  const bill = calculateBill(1, 10);
  assertEquals(bill.totalCost, 0);
  assertEquals(bill.breakdown.length, 1);
  assertEquals(bill.breakdown[0].tier, 'free');
  assertEquals(bill.breakdown[0].calls, 10);
});

Deno.test('calculateBill: spans free and standard', () => {
  const bill = calculateBill(49, 5);
  assertEquals(bill.totalCost, 0.03);
  assertEquals(bill.breakdown.length, 2);
  const free = bill.breakdown.find((b) => b.tier === 'free')!;
  const std = bill.breakdown.find((b) => b.tier === 'standard')!;
  assertEquals(free.calls, 2);
  assertEquals(free.cost, 0);
  assertEquals(std.calls, 3);
  assertEquals(std.cost, 0.03);
});

Deno.test('calculateBill: spans free, standard, and premium', () => {
  const bill = calculateBill(49, 5);
  assertEquals(bill.totalCost, 0.03);
});

Deno.test('calculateBill: priority only', () => {
  const bill = calculateBill(1, 5, true);
  assertEquals(bill.totalCost, 0.50);
  assertEquals(bill.breakdown.length, 1);
  assertEquals(bill.breakdown[0].tier, 'priority');
  assertEquals(bill.breakdown[0].calls, 5);
  assertEquals(bill.breakdown[0].cost, 0.50);
});

Deno.test('calculateBill: empty batch', () => {
  const bill = calculateBill(1, 0);
  assertEquals(bill.totalCost, 0);
  assertEquals(bill.breakdown.length, 0);
});

// ---------------------------------------------------------------------------
// Input validation — invalid call counts are rejected
// ---------------------------------------------------------------------------
Deno.test('Pricing rejects zero call count', () => {
  assertThrows(() => getTierPrice(0), RangeError);
});

Deno.test('Pricing rejects negative call count', () => {
  assertThrows(() => getTierPrice(-1), RangeError);
});

Deno.test('Pricing rejects fractional call count', () => {
  assertThrows(() => getTierPrice(1.5), RangeError);
});

Deno.test('Pricing rejects NaN', () => {
  assertThrows(() => getTierPrice(NaN), RangeError);
});

Deno.test('Pricing rejects Infinity', () => {
  assertThrows(() => getTierPrice(Infinity), RangeError);
});

Deno.test('Pricing rejects Number.MAX_SAFE_INTEGER + 1', () => {
  assertThrows(() => getTierPrice(Number.MAX_SAFE_INTEGER + 1), RangeError);
});

Deno.test('Batch cost rejects invalid startCount', () => {
  assertThrows(() => calculateBatchCost(0, 1), RangeError);
  assertThrows(() => calculateBatchCost(-1, 1), RangeError);
  assertThrows(() => calculateBatchCost(1.5, 1), RangeError);
  assertThrows(() => calculateBatchCost(NaN, 1), RangeError);
});

Deno.test('Batch cost rejects invalid numCalls', () => {
  assertThrows(() => calculateBatchCost(1, -1), RangeError);
  assertThrows(() => calculateBatchCost(1, 1.5), RangeError);
  assertThrows(() => calculateBatchCost(1, NaN), RangeError);
});

Deno.test('Batch cost allows zero numCalls', () => {
  assertEquals(calculateBatchCost(1, 0), 0);
});
