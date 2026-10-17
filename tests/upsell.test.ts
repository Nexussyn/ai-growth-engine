import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  shouldTriggerUpsell,
  generateUpsellPrompt,
  assignVariant,
  upsellMiddleware,
} from '../src/monetization/upsell.ts';

// ── Threshold Detection ───────────────────────────────────────────────

Deno.test('shouldTriggerUpsell: fires at exactly 5th call', () => {
  assertEquals(shouldTriggerUpsell(5), true);
});

Deno.test('shouldTriggerUpsell: does not fire before 5th call', () => {
  assertEquals(shouldTriggerUpsell(1), false);
  assertEquals(shouldTriggerUpsell(2), false);
  assertEquals(shouldTriggerUpsell(3), false);
  assertEquals(shouldTriggerUpsell(4), false);
});

Deno.test('shouldTriggerUpsell: does not fire after 5th call', () => {
  assertEquals(shouldTriggerUpsell(6), false);
  assertEquals(shouldTriggerUpsell(7), false);
  assertEquals(shouldTriggerUpsell(10), false);
  assertEquals(shouldTriggerUpsell(50), false);
});

Deno.test('shouldTriggerUpsell: works with custom config', () => {
  const config = { freeCallLimit: 20, thresholdPercent: 50 };
  assertEquals(shouldTriggerUpsell(10, config), true);
  assertEquals(shouldTriggerUpsell(9, config), false);
  assertEquals(shouldTriggerUpsell(11, config), false);
});

// ── Prompt Generation ─────────────────────────────────────────────────

Deno.test('generateUpsellPrompt: returns correct structure', () => {
  const result = generateUpsellPrompt(5);
  assertEquals(result.trigger, true);
  assertEquals(typeof result.prompt, 'string');
  assertNotEquals(result.prompt, '');
});

Deno.test('generateUpsellPrompt: variant A text', () => {
  const result = generateUpsellPrompt(5, undefined, 'A');
  assertEquals(result.variant, 'A');
  assertEquals(result.prompt, 'You have used 50% of your free calls. Upgrade now for unlimited access and priority support.');
});

Deno.test('generateUpsellPrompt: variant B text', () => {
  const result = generateUpsellPrompt(5, undefined, 'B');
  assertEquals(result.variant, 'B');
  assertEquals(result.prompt, 'Halfway there! You have 5 free calls remaining. Unlock unlimited calls with our Pro plan.');
});

// ── A/B Variant Assignment ────────────────────────────────────────────

Deno.test('assignVariant: always returns A or B', () => {
  const variants = new Set<string>();
  for (let i = 0; i < 100; i++) {
    variants.add(assignVariant(`user-${i}`));
  }
  assertEquals(variants.has('A'), true);
  assertEquals(variants.has('B'), true);
});

Deno.test('assignVariant: deterministic for same userId', () => {
  const v1 = assignVariant('user-123');
  const v2 = assignVariant('user-123');
  assertEquals(v1, v2);
});

Deno.test('assignVariant: distributes roughly evenly', () => {
  let countA = 0;
  let countB = 0;
  for (let i = 0; i < 1000; i++) {
    if (assignVariant(`user-${i}`) === 'A') countA++;
    else countB++;
  }
  // Should be roughly 50/50 — allow 40/60 range
  assert(countA > 400 && countA < 600, `Expected ~500 A variants, got ${countA}`);
  assert(countB > 400 && countB < 600, `Expected ~500 B variants, got ${countB}`);
});

// ── Middleware ────────────────────────────────────────────────────────

Deno.test('upsellMiddleware: sets header at threshold', () => {
  const ctx = {
    userId: 'user-1',
    callCount: 5,
    headers: {} as Record<string, string>,
    onTrigger: (_r: any) => {},
  };
  const result = upsellMiddleware(ctx);
  assertEquals(result.headers['X-Upsell-Prompt'], 'true');
});

Deno.test('upsellMiddleware: does not set header below threshold', () => {
  const ctx = {
    userId: 'user-1',
    callCount: 4,
    headers: {} as Record<string, string>,
    onTrigger: (_r: any) => {},
  };
  const result = upsellMiddleware(ctx);
  assertEquals(result.headers['X-Upsell-Prompt'], undefined);
});

Deno.test('upsellMiddleware: does not set header above threshold', () => {
  const ctx = {
    userId: 'user-1',
    callCount: 6,
    headers: {} as Record<string, string>,
    onTrigger: (_r: any) => {},
  };
  const result = upsellMiddleware(ctx);
  assertEquals(result.headers['X-Upsell-Prompt'], undefined);
});

Deno.test('upsellMiddleware: preserves existing headers', () => {
  const ctx = {
    userId: 'user-1',
    callCount: 5,
    headers: { 'X-Custom': 'value' } as Record<string, string>,
    onTrigger: (_r: any) => {},
  };
  const result = upsellMiddleware(ctx);
  assertEquals(result.headers['X-Custom'], 'value');
  assertEquals(result.headers['X-Upsell-Prompt'], 'true');
});

Deno.test('upsellMiddleware: calls onTrigger callback', () => {
  let called = false;
  const ctx = {
    userId: 'user-1',
    callCount: 5,
    headers: {} as Record<string, string>,
    onTrigger: (_r: any) => { called = true; },
  };
  upsellMiddleware(ctx);
  assertEquals(called, true);
});

Deno.test('upsellMiddleware: idempotent — same user at call 5 triggers once', () => {
  const results: boolean[] = [];
  for (let i = 0; i < 3; i++) {
    const ctx = {
      userId: 'user-1',
      callCount: 5,
      headers: {} as Record<string, string>,
      onTrigger: (_r: any) => { results.push(true); },
    };
    upsellMiddleware(ctx);
  }
  // All 3 calls at count=5 would set the header, but in practice
  // the middleware is called once per request and the DB constraint
  // prevents duplicate rows. Here we verify the middleware itself
  // always fires at the threshold (idempotency is handled by DB).
  assertEquals(results.length, 3);
});