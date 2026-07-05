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

Deno.test('Batch cost crosses free and standard tiers exactly', () => {
  // Calls 49-50 are free, 51-53 are standard.
  assertEquals(calculateBatchCost(49, 5), 0.03);
});

Deno.test('Batch cost crosses standard and premium tiers exactly', () => {
  // Calls 499-500 are standard, 501-502 are premium.
  assertEquals(calculateBatchCost(499, 4), 0.08);
});

Deno.test('Priority batch cost applies to every call', () => {
  assertEquals(calculateBatchCost(1, 3, true), 0.3);
  assertEquals(calculateBatchCost(499, 4, true), 0.4);
});

Deno.test('Pricing rejects impossible call counts', () => {
  const invalid = [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY];

  for (const value of invalid) {
    try {
      getTierPrice(value);
      throw new Error(`expected getTierPrice(${value}) to fail`);
    } catch (error) {
      assertEquals(error instanceof RangeError, true);
    }
  }
});

Deno.test('Batch cost rejects invalid ranges but allows zero calls', () => {
  assertEquals(calculateBatchCost(1, 0), 0);

  for (const args of [[0, 1], [1, -1], [1.2, 1], [1, 1.2]]) {
    try {
      calculateBatchCost(args[0], args[1]);
      throw new Error(`expected calculateBatchCost(${args.join(', ')}) to fail`);
    } catch (error) {
      assertEquals(error instanceof RangeError, true);
    }
  }
});
