import assert from 'node:assert/strict';
import { shouldTriggerUpsell, generateMiddlewarePayload, SimpleUpsellStore } from '../src/monetization/upsell';

const hit = shouldTriggerUpsell({
  userId: 'u1',
  freeCreditsTotal: 10,
  freeCreditsUsed: 5,
  shownPrompt: false,
});

assert.equal(hit.triggered, true);
assert.equal(!!hit.promptHeader, true);
assert.ok(hit.variant);

const miss = shouldTriggerUpsell({
  userId: 'u2',
  freeCreditsTotal: 10,
  freeCreditsUsed: 4,
  shownPrompt: false,
});

assert.equal(miss.triggered, false);

const afterThreshold = shouldTriggerUpsell({
  userId: 'u2',
  freeCreditsTotal: 10,
  freeCreditsUsed: 6,
  shownPrompt: false,
});

assert.equal(afterThreshold.triggered, false);

const already = shouldTriggerUpsell({
  userId: 'u1',
  freeCreditsTotal: 10,
  freeCreditsUsed: 5,
  shownPrompt: true,
});

assert.equal(already.triggered, false);

const headers = generateMiddlewarePayload({
  userId: 'u3',
  freeCreditsTotal: 10,
  freeCreditsUsed: 5,
});

assert.equal(headers.headers['X-Upsell-Prompt'], 'true');
assert.ok(headers.headers['X-Upsell-Prompt-Variant']);

const store = new SimpleUpsellStore();

async function run() {
  await store.markAsShown('u9');
  assert.equal(await store.hasBeenShown('u9'), true);
  assert.equal(await store.hasBeenShown('u10'), false);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
