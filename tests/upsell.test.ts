import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { checkUpsellTrigger, getUpsellPrompt } from '../src/monetization/upsell.ts';

Deno.test('checkUpsellTrigger', async () => {
  const userId = 1;
  const callCount = 5;
  const trigger = await checkUpsellTrigger(userId, callCount);
  assertEquals(trigger, true);
});

Deno.test('getUpsellPrompt', async () => {
  const userId = 1;
  const prompt = await getUpsellPrompt(userId);
  assertEquals(typeof prompt, 'string');
});

Deno.test('setUpsellHeader', async () => {
  const userId = 1;
  const callCount = 5;
  const headers = await setUpsellHeader(userId, callCount);
  assertEquals(headers, { 'X-Upsell-Prompt': 'true' });
});
