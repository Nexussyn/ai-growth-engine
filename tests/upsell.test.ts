import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  decideUpsell,
  shouldTriggerUpsell,
  generateUpsellPrompt,
  pickVariant,
  buildUpsellHeaders,
  recordUpsellTrigger,
  createUpsellMiddleware,
  FREE_CALL_LIMIT,
  UPSELL_THRESHOLD,
  TRIGGER_TYPE,
} from '../src/monetization/upsell.ts';

// --- threshold detection ---------------------------------------------------

Deno.test('threshold is 50% of the free limit', () => {
  assertEquals(FREE_CALL_LIMIT, 10);
  assertEquals(UPSELL_THRESHOLD, 5);
});

Deno.test('fires exactly on the 5th call', () => {
  assertEquals(shouldTriggerUpsell(4), false);
  assertEquals(shouldTriggerUpsell(5), true);
  assertEquals(shouldTriggerUpsell(6), false);
  assertEquals(shouldTriggerUpsell(10), false);
});

Deno.test('respects a custom free call limit', () => {
  assertEquals(shouldTriggerUpsell(5, 20), false);
  assertEquals(shouldTriggerUpsell(10, 20), true);
});

Deno.test('rejects invalid call counts', () => {
  assertEquals(shouldTriggerUpsell(-1), false);
  assertEquals(shouldTriggerUpsell(Number.NaN), false);
});

// --- decision --------------------------------------------------------------

Deno.test('no upsell below the threshold', () => {
  const decision = decideUpsell({ userId: 'u1', callCount: 4 });
  assertEquals(decision.upsell, false);
  assertEquals(decision.prompt, null);
  assertEquals(decision.headers, {});
});

Deno.test('upsell on the threshold with header and prompt', () => {
  const decision = decideUpsell({ userId: 'u1', callCount: 5 });
  assertEquals(decision.upsell, true);
  assertEquals(decision.triggerType, TRIGGER_TYPE);
  assertEquals(decision.headers['X-Upsell-Prompt'], 'true');
  assert(decision.prompt && decision.prompt.length > 0);
});

// --- A/B variants ----------------------------------------------------------

Deno.test('variant assignment is deterministic per user', () => {
  assertEquals(pickVariant('user-a'), pickVariant('user-a'));
  assert(['A', 'B'].includes(pickVariant('user-a')));
});

Deno.test('both variants produce distinct prompts', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const { variant, prompt } = generateUpsellPrompt({ userId: `user-${i}`, callCount: 5 });
    seen.add(variant);
    assert(prompt.length > 0);
  }
  assertEquals(seen.size, 2); // A and B both reachable
});

Deno.test('buildUpsellHeaders only sets the header when upsell fires', () => {
  assertEquals(buildUpsellHeaders({ upsell: false, triggerType: null, variant: null, prompt: null, headers: {} }), {});
  assertEquals(buildUpsellHeaders({ upsell: true, triggerType: TRIGGER_TYPE, variant: 'A', prompt: 'x', headers: { 'X-Upsell-Prompt': 'true' } }), {
    'X-Upsell-Prompt': 'true',
  });
});

// --- idempotency -----------------------------------------------------------

Deno.test('trigger fires exactly once per crossing', async () => {
  const rows = new Set<string>();
  const store = {
    insertTrigger(userId: string, triggerType: string) {
      const key = `${userId}:${triggerType}`;
      if (rows.has(key)) return false;
      rows.add(key);
      return true;
    },
  };

  const first = await recordUpsellTrigger(store, 'u1');
  const second = await recordUpsellTrigger(store, 'u1');
  const other = await recordUpsellTrigger(store, 'u2');

  assertEquals(first.inserted, true);
  assertEquals(second.inserted, false);
  assertEquals(other.inserted, true);
  assertEquals(rows.size, 2);
});

Deno.test('middleware sets the header once and does not throw on store errors', async () => {
  const rows = new Set<string>();
  const store = {
    insertTrigger(userId: string, triggerType: string) {
      const key = `${userId}:${triggerType}`;
      if (rows.has(key)) return false;
      rows.add(key);
      return true;
    },
  };
  const middleware = createUpsellMiddleware({ store });

  const headers: Record<string, string> = {};
  const res = { setHeader: (k: string, v: string) => { headers[k] = v; }, locals: {} as Record<string, unknown> };
  let nextCalls = 0;

  await middleware({ userId: 'u1', callCount: 5, path: '/api/run' }, res, () => { nextCalls++; });
  assertEquals(headers['X-Upsell-Prompt'], 'true');
  assertEquals(nextCalls, 1);

  const headers2: Record<string, string> = {};
  const res2 = { setHeader: (k: string, v: string) => { headers2[k] = v; }, locals: {} as Record<string, unknown> };
  await middleware({ userId: 'u1', callCount: 5, path: '/api/run' }, res2, () => {});
  assertEquals(headers2['X-Upsell-Prompt'], undefined); // already recorded

  const broken = createUpsellMiddleware({ store: { insertTrigger() { throw new Error('db down'); } } });
  let err: unknown = null;
  await broken({ userId: 'u9', callCount: 5 }, { setHeader() {}, locals: {} }, (e) => { err = e; });
  assert(err instanceof Error);
});
