import { assertEquals, assert, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  checkUpsellTrigger,
  recordUpsellConversion,
  computeUpsellThreshold,
  classifyUsage,
  pickUpsellVariant,
  buildUpsellPrompt,
  InMemoryUpsellStore,
  UPSELL_HEADER,
  TRIGGER_TYPE_FREE_LIMIT_50PCT,
} from '../src/monetization/upsell.ts';

Deno.test('Header constant is X-Upsell-Prompt', () => {
  assertEquals(UPSELL_HEADER, 'X-Upsell-Prompt');
});

Deno.test('Threshold: 10 free calls fires on the 5th', () => {
  assertEquals(computeUpsellThreshold(10), 5);
});

Deno.test('Threshold: scales with any limit (ceil of 50%)', () => {
  assertEquals(computeUpsellThreshold(50), 25);
  assertEquals(computeUpsellThreshold(7), 4); // ceil(3.5)
  assertEquals(computeUpsellThreshold(1), 1);
});

Deno.test('Threshold: rejects bad input', () => {
  assertThrows(() => computeUpsellThreshold(0), RangeError);
  assertThrows(() => computeUpsellThreshold(-10), RangeError);
  assertThrows(() => computeUpsellThreshold(10, 1), RangeError);
});

Deno.test('Below threshold: no upsell, no header, no prompt', () => {
  const store = new InMemoryUpsellStore();
  for (const used of [1, 2, 3, 4]) {
    const d = checkUpsellTrigger('user-a', used, 10, { store });
    assertEquals(d.upsell, false);
    assertEquals(d.prompt, null);
    assertEquals(d.variant, null);
  }
  // Nothing recorded below threshold
  assertEquals(store.wasTriggered('user-a', TRIGGER_TYPE_FREE_LIMIT_50PCT), false);
});

Deno.test('At threshold: fires once, sets header signal, has prompt + variant', () => {
  const store = new InMemoryUpsellStore();
  const d = checkUpsellTrigger('user-b', 5, 10, { store });
  assertEquals(d.upsell, true); // -> set X-Upsell-Prompt: true
  assert(d.prompt !== null && d.prompt.length > 0);
  assert(d.variant === 'A' || d.variant === 'B');
  assertEquals(d.triggerType, TRIGGER_TYPE_FREE_LIMIT_50PCT);
  assertEquals(store.wasTriggered('user-b', TRIGGER_TYPE_FREE_LIMIT_50PCT), true);
});

Deno.test('No double-trigger: repeat calls at/above threshold stay silent', () => {
  const store = new InMemoryUpsellStore();
  checkUpsellTrigger('user-c', 5, 10, { store });
  for (const used of [5, 6, 7, 10]) {
    const d = checkUpsellTrigger('user-c', used, 10, { store });
    assertEquals(d.upsell, false);
    assertEquals(d.prompt, null);
  }
});

Deno.test('No double-trigger: even a racing re-fire is deduped by the store', () => {
  const store = new InMemoryUpsellStore();
  const first = checkUpsellTrigger('user-d', 5, 10, { store });
  assertEquals(first.upsell, true);
  // Simulate a second middleware instance that missed the wasTriggered check
  // but hits the atomic record gate: pre-record, then fire again.
  store.recordTrigger('user-e', TRIGGER_TYPE_FREE_LIMIT_50PCT);
  const raced = checkUpsellTrigger('user-e', 5, 10, { store });
  assertEquals(raced.upsell, false);
});

Deno.test('Late crossing still fires: jump from below to above threshold', () => {
  const store = new InMemoryUpsellStore();
  checkUpsellTrigger('user-f', 4, 10, { store });
  const d = checkUpsellTrigger('user-f', 6, 10, { store });
  assertEquals(d.upsell, true);
  // ...but only once
  assertEquals(checkUpsellTrigger('user-f', 7, 10, { store }).upsell, false);
});

Deno.test('Triggers are per-user: one user firing does not fire another', () => {
  const store = new InMemoryUpsellStore();
  checkUpsellTrigger('user-g', 5, 10, { store });
  const d = checkUpsellTrigger('user-h', 5, 10, { store });
  assertEquals(d.upsell, true);
});

Deno.test('Converted flag: marks conversion only on a recorded trigger', () => {
  const store = new InMemoryUpsellStore();
  // No trigger recorded -> cannot convert
  assertEquals(recordUpsellConversion('user-i', store), false);
  checkUpsellTrigger('user-i', 5, 10, { store });
  assertEquals(recordUpsellConversion('user-i', store), true);
  assertEquals(store.wasConverted('user-i', TRIGGER_TYPE_FREE_LIMIT_50PCT), true);
});

Deno.test('A/B variants: sticky per user, both produce distinct non-empty text', () => {
  const v1 = pickUpsellVariant('sticky-user');
  const v2 = pickUpsellVariant('sticky-user');
  assertEquals(v1, v2); // deterministic bucketing
  const a = buildUpsellPrompt({
    userId: 'x', freeCallsUsed: 5, freeCallLimit: 10,
    usagePattern: 'standard', variant: 'A',
  });
  const b = buildUpsellPrompt({
    userId: 'x', freeCallsUsed: 5, freeCallLimit: 10,
    usagePattern: 'standard', variant: 'B',
  });
  assert(a.length > 0 && b.length > 0);
  assert(a !== b); // distinct variants
});

Deno.test('Prompt text is generated from the usage pattern', () => {
  const heavy = buildUpsellPrompt({
    userId: 'x', freeCallsUsed: 5, freeCallLimit: 10,
    usagePattern: 'heavy', variant: 'A',
  });
  const light = buildUpsellPrompt({
    userId: 'x', freeCallsUsed: 5, freeCallLimit: 10,
    usagePattern: 'light', variant: 'A',
  });
  assert(heavy !== light); // pattern-tailored copy
  assert(heavy.includes('5 of 10'));
});

Deno.test('Usage classification: heavy vs light vs standard', () => {
  assertEquals(classifyUsage({ callsInLastHour: 20 }), 'heavy');
  assertEquals(classifyUsage({ avgCallsPerDay: 100 }), 'heavy');
  assertEquals(classifyUsage({ callsInLastHour: 1, avgCallsPerDay: 3 }), 'light');
  assertEquals(classifyUsage({ callsInLastHour: 3, avgCallsPerDay: 10 }), 'standard');
  assertEquals(classifyUsage(), 'standard');
});

Deno.test('Middleware passes usage stats into the prompt decision', () => {
  const store = new InMemoryUpsellStore();
  const heavy = checkUpsellTrigger('user-j', 5, 10, {
    store,
    usage: { callsInLastHour: 25 },
  });
  assertEquals(heavy.upsell, true);
  assertEquals(heavy.usagePattern, 'heavy');
  assert(heavy.prompt !== null && heavy.prompt.length > 0);
});
