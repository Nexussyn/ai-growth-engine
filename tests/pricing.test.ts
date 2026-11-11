import { calculateBatchCost, getTierPrice, get_tier_price } from '../src/pricing/tier-engine.ts';

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

export function runPricingSuite(): void {
  // Tier 1 (Free): First 50 calls = $0.00
  assertEqual(get_tier_price(1, false), 0.00, 'Call 1 should be free');
  assertEqual(get_tier_price(50, false), 0.00, 'Call 50 should be free');
  assertEqual(getTierPrice(1, false).tier, 'free', 'Call 1 tier name');
  assertEqual(getTierPrice(50, false).callsInTier, 1, 'Call 50 remaining in tier');

  // Tier 2 (Standard): Calls 51-500 = $0.01/call
  assertEqual(get_tier_price(51, false), 0.01, 'Call 51 should be $0.01');
  assertEqual(get_tier_price(250, false), 0.01, 'Call 250 should be $0.01');
  assertEqual(get_tier_price(500, false), 0.01, 'Call 500 should be $0.01');
  assertEqual(getTierPrice(51, false).tier, 'standard', 'Call 51 tier name');

  // Tier 3 (Premium): Calls 501+ = $0.03/call
  assertEqual(get_tier_price(501, false), 0.03, 'Call 501 should be $0.03');
  assertEqual(get_tier_price(1000, false), 0.03, 'Call 1000 should be $0.03');
  assertEqual(getTierPrice(501, false).tier, 'premium', 'Call 501 tier name');

  // Tier 4 (Priority): Flagged as priority = $0.10/call regardless of call count
  assertEqual(get_tier_price(1, true), 0.10, 'Priority call 1 should be $0.10');
  assertEqual(get_tier_price(100, true), 0.10, 'Priority call 100 should be $0.10');
  assertEqual(get_tier_price(600, true), 0.10, 'Priority call 600 should be $0.10');
  assertEqual(getTierPrice(10, true).tier, 'priority', 'Priority tier name');

  // Batch cost across tier boundaries
  assertEqual(calculateBatchCost(1, 50, false), 0.00, 'First 50 calls cost $0.00');
  assertEqual(calculateBatchCost(49, 4, false), 0.02, 'Calls 49,50 ($0) + 51,52 ($0.01 each) = $0.02');
  assertEqual(calculateBatchCost(500, 3, false), 0.07, 'Call 500 ($0.01) + 501,502 ($0.03 each) = $0.07');
  assertEqual(calculateBatchCost(1, 5, true), 0.50, '5 priority calls = $0.50');
}

runPricingSuite();

// Support Deno.test when executed via `deno test tests/`
const globalAny = globalThis as Record<string, unknown>;
if (typeof globalAny.Deno === 'object' && globalAny.Deno !== null) {
  const denoObj = globalAny.Deno as { test?: (name: string, fn: () => void) => void };
  if (typeof denoObj.test === 'function') {
    denoObj.test('Tiered pricing engine covers all 4 tiers and batch boundaries', () => {
      runPricingSuite();
    });
  }
}
