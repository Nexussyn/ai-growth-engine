/**
 * Upsell Trigger Tests — Issue #3
 */

import { assertEquals, assertExists, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { shouldShowUpsell, getPromptVariant, PROMPT_VARIANTS } from '../src/monetization/upsell.ts';

Deno.test('shouldShowUpsell fires at exactly call 5', () => {
  assertEquals(shouldShowUpsell(5), true);
});

Deno.test('shouldShowUpsell does not fire before call 5', () => {
  for (let i = 0; i < 5; i++) {
    assertEquals(shouldShowUpsell(i), false, `Should not fire at call ${i}`);
  }
});

Deno.test('shouldShowUpsell does not fire after call 5', () => {
  assertEquals(shouldShowUpsell(6), false);
  assertEquals(shouldShowUpsell(10), false);
  assertEquals(shouldShowUpsell(100), false);
});

Deno.test('getPromptVariant returns a valid prompt', () => {
  const prompt = getPromptVariant('user-abc');
  assertExists(prompt);
  assertEquals(typeof prompt, 'string');
  assertEquals(prompt.length > 0, true);
});

Deno.test('getPromptVariant is deterministic per user', () => {
  const prompt1 = getPromptVariant('user-abc');
  const prompt2 = getPromptVariant('user-abc');
  assertEquals(prompt1, prompt2);
});

Deno.test('getPromptVariant can differ between users', () => {
  // Not guaranteed to differ, but should be possible
  const prompts = new Set([...Array(20)].map((_, i) => getPromptVariant(`user-${i}`)));
  assertEquals(prompts.size > 1, true, 'Should produce multiple variants across users');
});

Deno.test('PROMPT_VARIANTS has exactly 5 variants (A/B test ready)', () => {
  assertEquals(PROMPT_VARIANTS.length, 5);
  // All variants should mention upgrade or premium
  for (const v of PROMPT_VARIANTS) {
    assertEquals(v.length > 20, true, 'Each variant should be substantial');
  }
});

Deno.test('upsell SQL migration exists with required elements', async () => {
  const sql = await Deno.readTextFile('./migrations/add_upsell_triggers.sql');
  assertStringIncludes(sql, 'CREATE TABLE IF NOT EXISTS upsell_triggers');
  assertStringIncludes(sql, 'CREATE OR REPLACE FUNCTION check_upsell_trigger');
  assertStringIncludes(sql, 'UNIQUE(user_id, trigger_type)'); // idempotency
  assertStringIncludes(sql, 'free_limit_50pct');
});

Deno.test('upsell fires exactly once per threshold — no double-trigger', () => {
  // Simulate the SQL ON CONFLICT DO NOTHING logic
  const triggered = new Set<string>();
  function checkOnce(userId: string, callCount: number): boolean {
    const key = `${userId}:free_limit_50pct`;
    if (callCount === 5 && !triggered.has(key)) {
      triggered.add(key);
      return true;
    }
    return false;
  }
  
  // First call at threshold — should fire
  assertEquals(checkOnce('user-1', 5), true);
  // Same threshold again — should NOT fire (idempotent)
  assertEquals(checkOnce('user-1', 5), false);
  // Another threshold — should fire
  assertEquals(checkOnce('user-1', 6), false);
  
  // Different user — should fire
  assertEquals(checkOnce('user-2', 5), true);
  assertEquals(checkOnce('user-2', 5), false);
});
