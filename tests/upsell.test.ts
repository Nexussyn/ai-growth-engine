import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  createUpsellDatabase,
  checkAndTriggerUpsell,
  getUpsellPromptVariant
} from '../src/monetization/upsell.ts';

Deno.test('Upsell: does not trigger before threshold (e.g. call 4)', () => {
  const db = createUpsellDatabase();
  const res = checkAndTriggerUpsell('usr_alpha', 4, db);
  assertEquals(res.shouldPrompt, false);
  assertEquals(Object.keys(res.headers).length, 0);
});

Deno.test('Upsell: triggers exactly at threshold (call 5) with headers', () => {
  const db = createUpsellDatabase();
  const res = checkAndTriggerUpsell('usr_alpha', 5, db);
  assertEquals(res.shouldPrompt, true);
  assertEquals(res.headers['X-Upsell-Prompt'], 'true');
  assertEquals(typeof res.promptText, 'string');
});

Deno.test('Upsell: idempotent — does not trigger twice for same user', () => {
  const db = createUpsellDatabase();
  checkAndTriggerUpsell('usr_alpha', 5, db);
  const secondCheck = checkAndTriggerUpsell('usr_alpha', 6, db);
  assertEquals(secondCheck.shouldPrompt, false);
});

Deno.test('Upsell: prompt variant distribution', () => {
  const v1 = getUpsellPromptVariant('usr_1');
  const v2 = getUpsellPromptVariant('usr_2');
  assertEquals(typeof v1.text, 'string');
  assertEquals(typeof v2.text, 'string');
});
