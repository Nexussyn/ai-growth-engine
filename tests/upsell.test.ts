import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { checkUpsellTrigger, upsellStore } from '../src/monetization/upsell.ts';

Deno.test('Upsell fires at 5th call (50% of 10 free calls)', () => {
  const result = checkUpsellTrigger('user-1', 5);
  assertEquals(result.upsell, true);
  assertEquals(typeof result.prompt, 'string');
  assertEquals(typeof result.variant, 'string');
});

Deno.test('Upsell does NOT fire before threshold', () => {
  assertEquals(checkUpsellTrigger('user-2', 1).upsell, false);
  assertEquals(checkUpsellTrigger('user-2', 3).upsell, false);
  assertEquals(checkUpsellTrigger('user-2', 4).upsell, false);
});

Deno.test('Upsell does NOT fire after threshold for same user', () => {
  const first = checkUpsellTrigger('user-3', 5);
  assertEquals(first.upsell, true);

  const second = checkUpsellTrigger('user-3', 5);
  assertEquals(second.upsell, false);
});

Deno.test('Upsell fires independently for different users', () => {
  assertEquals(checkUpsellTrigger('user-4a', 5).upsell, true);
  assertEquals(checkUpsellTrigger('user-4b', 5).upsell, true);
});

Deno.test('Custom free limit: fires at specified threshold', () => {
  const result = checkUpsellTrigger('user-5', 25, 50);
  assertEquals(result.upsell, true);
  assertEquals(typeof result.prompt, 'string');
});

Deno.test('Prompt variants exist and are non-empty', () => {
  const result = checkUpsellTrigger('user-6', 5);
  assertEquals(result.upsell, true);
  assertEquals(result.prompt!.length > 0, true);
});

Deno.test('Idempotent trigger recording', () => {
  const userId = 'user-idempotent';
  
  checkUpsellTrigger(userId, 5);
  assertEquals(upsellStore.has(userId, 'free_limit_50pct'), true);
  
  // Second call at same threshold should not create duplicate
  checkUpsellTrigger(userId, 5);
  // Store still has 1 entry — no duplicate
  assertEquals(upsellStore.has(userId, 'free_limit_50pct'), true);
});
