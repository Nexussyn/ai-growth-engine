import assert from 'node:assert/strict';
import { getTier, getPrice } from '../src/pricing/tier-engine';

const cases = [
  { callCount: 0, priority: false, tier: 'free', price: 0 },
  { callCount: 50, priority: false, tier: 'free', price: 0 },
  { callCount: 51, priority: false, tier: 'standard', price: 0.01 },
  { callCount: 500, priority: false, tier: 'standard', price: 0.01 },
  { callCount: 501, priority: false, tier: 'premium', price: 0.03 },
  { callCount: 1200, priority: true, tier: 'priority', price: 0.1 },
];

for (const row of cases) {
  const resultTier = getTier(row.callCount, row.priority);
  const resultPrice = getPrice(row.callCount, row.priority);

  assert.equal(resultTier, row.tier, `tier for calls=${row.callCount}, priority=${row.priority}`);
  assert.equal(resultPrice, row.price, `price for calls=${row.callCount}, priority=${row.priority}`);
}

assert.throws(() => getTier(-1), /non-negative/);
assert.throws(() => getTier(Number.NaN), /non-negative/);
assert.throws(() => getPrice(1.2), /non-negative/);
