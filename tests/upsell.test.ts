import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  UPSELL_THRESHOLD,
  UPSELL_PROMPTS,
  UpsellStore,
  checkUpsellTrigger,
  applyUpsellHeaders,
  pickVariant,
} from '../src/monetization/upsell.ts';

Deno.test('threshold is 5th call (50% of 10 free)', () => {
  assertEquals(UPSELL_THRESHOLD, 5);
});

Deno.test('no trigger before threshold', () => {
  const store = new UpsellStore();
  const r = checkUpsellTrigger('user-a', 4, store);
  assertEquals(r.triggered, false);
  assertEquals(r.header['X-Upsell-Prompt'], undefined);
  assertEquals(store.get('user-a'), undefined);
});

Deno.test('triggers exactly once at threshold with header + prompt', () => {
  const store = new UpsellStore();
  const r = checkUpsellTrigger('user-b', 5, store);
  assertEquals(r.triggered, true);
  assertEquals(r.header['X-Upsell-Prompt'], 'true');
  assertExists(r.prompt);
  assertEquals(Object.values(UPSELL_PROMPTS).includes(r.prompt!), true);
  assertExists(store.get('user-b'));
});

Deno.test('idempotent: second crossing does not re-fire', () => {
  const store = new UpsellStore();
  const first = checkUpsellTrigger('user-c', 5, store);
  assertEquals(first.triggered, true);
  const second = checkUpsellTrigger('user-c', 5, store);
  assertEquals(second.triggered, false);
  assertEquals(second.alreadyShown, true);
  assertEquals(second.header['X-Upsell-Prompt'], undefined);
  // still only one row
  assertEquals(store.get('user-c')?.userId, 'user-c');
});

Deno.test('calls after threshold without prior trigger do not fire (must hit exactly 5)', () => {
  const store = new UpsellStore();
  const r = checkUpsellTrigger('user-d', 6, store);
  assertEquals(r.triggered, false);
});

Deno.test('A/B variants are stable per user', () => {
  const v1 = pickVariant('stable-user-42');
  const v2 = pickVariant('stable-user-42');
  assertEquals(v1, v2);
  assertEquals(Object.keys(UPSELL_PROMPTS).includes(v1), true);
});

Deno.test('applyUpsellHeaders merges only when triggered', () => {
  const store = new UpsellStore();
  const hit = checkUpsellTrigger('user-e', 5, store);
  const merged = applyUpsellHeaders({ 'Content-Type': 'application/json' }, hit);
  assertEquals(merged['Content-Type'], 'application/json');
  assertEquals(merged['X-Upsell-Prompt'], 'true');

  const miss = checkUpsellTrigger('user-f', 1, store);
  const untouched = applyUpsellHeaders({ 'Content-Type': 'application/json' }, miss);
  assertEquals(untouched['X-Upsell-Prompt'], undefined);
});

Deno.test('invalid inputs are safe no-ops', () => {
  const store = new UpsellStore();
  assertEquals(checkUpsellTrigger('', 5, store).triggered, false);
  assertEquals(checkUpsellTrigger('x', -1, store).triggered, false);
});
