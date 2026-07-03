import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  checkUpsellTrigger,
  buildUpsellHeaders,
  upsellMiddleware,
} from '../src/monetization/upsell.ts';

Deno.test('checkUpsellTrigger: no upsell before 5th call', () => {
  for (let i = 1; i <= 4; i++) {
    const result = checkUpsellTrigger(i);
    assertEquals(result.upsell, false, `Call ${i} should not trigger upsell`);
  }
});

Deno.test('checkUpsellTrigger: triggers at 5th call (50%)', () => {
  const result = checkUpsellTrigger(5);
  assertEquals(result.upsell, true);
  assertEquals(result.type, 'free_limit_50pct');
  assert(typeof result.prompt === 'string', 'Prompt should be a string');
  assert(result.prompt!.length > 0, 'Prompt should not be empty');
});

Deno.test('checkUpsellTrigger: triggers at 9th call (90%)', () => {
  const result = checkUpsellTrigger(9);
  assertEquals(result.upsell, true);
  assertEquals(result.type, 'free_limit_90pct');
});

Deno.test('checkUpsellTrigger: triggers at 10th call (exhausted)', () => {
  const result = checkUpsellTrigger(10);
  assertEquals(result.upsell, true);
  assertEquals(result.type, 'free_exhausted');
});

Deno.test('checkUpsellTrigger: no trigger at non-threshold calls', () => {
  // Should not trigger at 6, 7, 8 (only 5, 9, 10)
  for (let i = 6; i <= 8; i++) {
    const result = checkUpsellTrigger(i);
    assertEquals(result.upsell, false, `Call ${i} should not trigger upsell`);
  }
});

Deno.test('buildUpsellHeaders: sets X-Upsell-Prompt true for upsell', () => {
  const result = checkUpsellTrigger(5);
  const headers = buildUpsellHeaders(result);
  assertEquals(headers['X-Upsell-Prompt'], 'true');
  assertEquals(headers['X-Upsell-Type'], 'free_limit_50pct');
});

Deno.test('buildUpsellHeaders: sets X-Upsell-Prompt false for no upsell', () => {
  const result = checkUpsellTrigger(3);
  const headers = buildUpsellHeaders(result);
  assertEquals(headers['X-Upsell-Prompt'], 'false');
  assertEquals(Object.keys(headers).length, 1);
});

Deno.test('upsellMiddleware returns both result and headers', () => {
  const { upsellResult, headers } = upsellMiddleware('user_1', 5);
  assertEquals(upsellResult.upsell, true);
  assertEquals(headers['X-Upsell-Prompt'], 'true');
  assertEquals(headers['X-Upsell-Type'], 'free_limit_50pct');
});

Deno.test('upsellMiddleware: no upsell for non-threshold', () => {
  const { upsellResult, headers } = upsellMiddleware('user_2', 4);
  assertEquals(upsellResult.upsell, false);
  assertEquals(headers['X-Upsell-Prompt'], 'false');
});
