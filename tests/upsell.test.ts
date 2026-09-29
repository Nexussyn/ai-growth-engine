import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { UpsellTriggerStore, evaluateUpsellMiddleware } from '../src/monetization/upsell.ts';

Deno.test('Fires upsell trigger on 5th call with X-Upsell-Prompt header', () => {
  const store = new UpsellTriggerStore();
  assertEquals(evaluateUpsellMiddleware('user_1', 4, store).triggered, false);

  const fifth = evaluateUpsellMiddleware('user_1', 5, store, 'x402 inference');
  assertEquals(fifth.triggered, true);
  assertEquals(fifth.headers['X-Upsell-Prompt'], 'true');
});

Deno.test('Idempotent: does not double-trigger for the same user', () => {
  const store = new UpsellTriggerStore();
  const first = evaluateUpsellMiddleware('user_1', 5, store);
  const second = evaluateUpsellMiddleware('user_1', 5, store);
  assertEquals(first.triggered, true);
  assertEquals(second.triggered, false);
});
