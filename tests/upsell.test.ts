import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  createUpsellStore,
  checkUpsellTrigger,
  getPromptVariant,
  evaluateUpsellMiddleware,
  UPSELL_PROMPT_VARIANTS
} from '../src/monetization/upsell.ts';

Deno.test('Threshold detection: fires on exactly 5th call', () => {
  const store = createUpsellStore();
  const res = checkUpsellTrigger('user_123', 5, store);

  assertEquals(res.upsell, true);
  assertEquals(res.headerActive, true);
  assertEquals(typeof res.prompt, 'string');
  assertEquals(store.triggers.has('user_123:free_limit_50pct'), true);
});

Deno.test('No trigger on non-threshold calls', () => {
  const store = createUpsellStore();
  assertEquals(checkUpsellTrigger('user_456', 1, store).upsell, false);
  assertEquals(checkUpsellTrigger('user_456', 4, store).upsell, false);
  assertEquals(checkUpsellTrigger('user_456', 6, store).upsell, false);
  assertEquals(checkUpsellTrigger('user_456', 10, store).upsell, false);
});

Deno.test('Idempotency: no double-trigger after crossing threshold', () => {
  const store = createUpsellStore();

  const first = checkUpsellTrigger('user_789', 5, store);
  assertEquals(first.upsell, true);

  const second = checkUpsellTrigger('user_789', 5, store);
  assertEquals(second.upsell, false);
  assertEquals(second.message, 'Already triggered for this threshold');
});

Deno.test('A/B test prompt variants: selects deterministically and matches schema', () => {
  const v1 = getPromptVariant('user_alpha');
  const v2 = getPromptVariant('user_alpha');
  assertEquals(v1.id, v2.id);

  for (const v of UPSELL_PROMPT_VARIANTS) {
    assertEquals(typeof v.id, 'string');
    assertEquals(typeof v.headline, 'string');
    assertEquals(typeof v.cta, 'string');
  }
});

Deno.test('Middleware evaluation: sets X-Upsell-Prompt header on trigger', () => {
  const store = createUpsellStore();
  const output = evaluateUpsellMiddleware('user_mid', store, 5);

  assertEquals(output.headers['X-Upsell-Prompt'], 'true');
  assertEquals(typeof output.headers['X-Upsell-Variant'], 'string');
  assertEquals(typeof output.prompt, 'string');

  // Second evaluation for same user should have no headers
  const secondOutput = evaluateUpsellMiddleware('user_mid', store, 5);
  assertEquals(secondOutput.headers['X-Upsell-Prompt'], undefined);
});
