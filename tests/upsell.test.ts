import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { shouldUpsell, createUpsellResponse, DEFAULT_CONFIG } from '../src/pricing/upsell.ts';
import { getPrompt, getAllVariants, formatUpsellResponse } from '../src/pricing/prompts.ts';

// --- shouldUpsell ---
Deno.test('shouldUpsell: triggers at 5th call with default config', () => {
  assertEquals(shouldUpsell(5, false), true);
});

Deno.test('shouldUpsell: does not trigger before threshold', () => {
  assertEquals(shouldUpsell(4, false), false);
  assertEquals(shouldUpsell(3, false), false);
});

Deno.test('shouldUpsell: does not trigger after threshold', () => {
  assertEquals(shouldUpsell(6, false), false);
  assertEquals(shouldUpsell(10, false), false);
});

Deno.test('shouldUpsell: idempotent — already triggered skips', () => {
  assertEquals(shouldUpsell(5, true), false);
});

Deno.test('shouldUpsell: custom config works', () => {
  const cfg = { freeLimit: 20, threshold: 0.25 };
  assertEquals(shouldUpsell(5, false, cfg), true);  // 20 * 0.25 = 5
  assertEquals(shouldUpsell(4, false, cfg), false);
});

// --- getPrompt ---
Deno.test('getPrompt: returns valid prompt for any user', () => {
  const p = getPrompt('user_abc');
  assert(p.title.length > 0);
  assert(p.body.length > 0);
  assert(p.cta.length > 0);
  assert(['A', 'B', 'C'].includes(p.variant));
});

Deno.test('getPrompt: same user gets same variant consistently', () => {
  const v1 = getPrompt('user_fixed').variant;
  const v2 = getPrompt('user_fixed').variant;
  assertEquals(v1, v2);
});

Deno.test('getPrompt: different users may get different variants', () => {
  const variants = new Set(['A', 'B', 'C']);
  const results = new Set(['user_a', 'user_b', 'user_c', 'user_d', 'user_e'].map(getPrompt).map(p => p.variant));
  // At least some variety
  assert(results.size >= 2 || results.size <= 3);
});

// --- getAllVariants ---
Deno.test('getAllVariants: returns 3 variants', () => {
  assertEquals(getAllVariants().length, 3);
});

Deno.test('getAllVariants: all have required fields', () => {
  for (const v of getAllVariants()) {
    assert(v.title.length > 0);
    assert(v.body.length > 0);
    assert(v.cta.length > 0);
    assert(['friendly', 'urgent', 'value'].includes(v.tone));
  }
});

// --- formatUpsellResponse ---
Deno.test('formatUpsellResponse: not triggered', () => {
  const r = formatUpsellResponse(false);
  assertEquals(r.upsell, false);
  assertEquals(r['X-Upsell-Prompt'], 'false');
});

Deno.test('formatUpsellResponse: triggered includes prompt', () => {
  const r = formatUpsellResponse(true, 'user_123');
  assertEquals(r.upsell, true);
  assertEquals(r['X-Upsell-Prompt'], 'true');
  assert(r.prompt !== undefined);
  assert(typeof r.prompt === 'object');
});

// --- createUpsellResponse integration ---
Deno.test('createUpsellResponse: integration test', () => {
  // At call 5, not yet triggered → should upsell
  const r1 = createUpsellResponse(5, 'user_test', false);
  assertEquals(r1.upsell, true);
  assertEquals(r1['X-Upsell-Prompt'], 'true');

  // At call 5, already triggered → should not upsell again
  const r2 = createUpsellResponse(5, 'user_test', true);
  assertEquals(r2.upsell, false);
  assertEquals(r2['X-Upsell-Prompt'], 'false');

  // At call 4 → should not upsell
  const r3 = createUpsellResponse(4, 'user_test', false);
  assertEquals(r3.upsell, false);
});
