import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  checkUpsell,
  createMemoryUpsellStore,
  UPSELL_HEADER,
  UPSELL_THRESHOLD,
} from '../src/monetization/upsell.ts';

Deno.test('fires on 5th call with X-Upsell-Prompt header', () => {
  const store = createMemoryUpsellStore();
  const result = checkUpsell(store, 'user-1', UPSELL_THRESHOLD);
  assertEquals(result.trigger, true);
  assertEquals(result.headers[UPSELL_HEADER], 'true');
  assertEquals(typeof result.promptText, 'string');
  assertEquals(store.rows.size, 1);
});

Deno.test('does not fire before threshold', () => {
  const store = createMemoryUpsellStore();
  assertEquals(checkUpsell(store, 'user-1', 4).trigger, false);
  assertEquals(store.rows.size, 0);
});

Deno.test('does not fire after threshold', () => {
  const store = createMemoryUpsellStore();
  assertEquals(checkUpsell(store, 'user-1', 6).trigger, false);
});

Deno.test('idempotent — no double trigger', () => {
  const store = createMemoryUpsellStore();
  const first = checkUpsell(store, 'user-1', 5);
  const second = checkUpsell(store, 'user-1', 5);
  assertEquals(first.trigger, true);
  assertEquals(second.trigger, false);
  assertEquals(store.rows.size, 1);
});

Deno.test('independent users can each trigger once', () => {
  const store = createMemoryUpsellStore();
  assertEquals(checkUpsell(store, 'a', 5).trigger, true);
  assertEquals(checkUpsell(store, 'b', 5).trigger, true);
  assertEquals(store.rows.size, 2);
});
