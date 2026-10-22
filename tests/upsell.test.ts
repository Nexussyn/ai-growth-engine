import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  UpsellTriggerStore,
  isUpsellThreshold,
  selectUpsellVariant,
  buildUpsellPrompt,
  checkUpsellTrigger,
  applyUpsellMiddleware,
  UPSELL_HEADER,
} from '../src/monetization/upsell.ts';

Deno.test('Threshold detection fires only at 50% of free credit limit (5th of 10 calls)', () => {
  assertEquals(isUpsellThreshold(4, 10), false);
  assertEquals(isUpsellThreshold(5, 10), true);
  assertEquals(isUpsellThreshold(6, 10), false);
});

Deno.test('Upsell trigger fires once on 5th call and never double-triggers', () => {
  const store = new UpsellTriggerStore();

  const call4 = checkUpsellTrigger('user_1', 4, { store });
  assertEquals(call4.upsell, false);

  const call5First = checkUpsellTrigger('user_1', 5, { store });
  assertEquals(call5First.upsell, true);
  assertEquals(call5First.headers[UPSELL_HEADER], 'true');

  // Repeat 5th call check must not fire a second time
  const call5Repeat = checkUpsellTrigger('user_1', 5, { store });
  assertEquals(call5Repeat.upsell, false);
  assertEquals(call5Repeat.headers[UPSELL_HEADER], undefined);

  const call6 = checkUpsellTrigger('user_1', 6, { store });
  assertEquals(call6.upsell, false);
});

Deno.test('A/B prompt variants and burst usage pattern produce distinct contextual prompts', () => {
  const variantA = selectUpsellVariant('user_a');
  assertEquals(variantA === 'A' || variantA === 'B', true);

  const stdPromptA = buildUpsellPrompt('A', 5, 10, 'standard');
  const stdPromptB = buildUpsellPrompt('B', 5, 10, 'standard');
  const burstPromptA = buildUpsellPrompt('A', 5, 10, 'burst');

  assertEquals(stdPromptA !== stdPromptB, true);
  assertEquals(stdPromptA !== burstPromptA, true);
  assertEquals(stdPromptA.includes('5 remaining'), true);
});

Deno.test('Middleware sets X-Upsell-Prompt: true header only on first threshold crossing', () => {
  const store = new UpsellTriggerStore();
  const baseResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });

  const { response: firstRes, result: firstResult } = applyUpsellMiddleware(
    baseResponse.clone(),
    'user_mw',
    5,
    { store },
  );
  assertEquals(firstResult.upsell, true);
  assertEquals(firstRes.headers.get(UPSELL_HEADER), 'true');

  const { response: secondRes, result: secondResult } = applyUpsellMiddleware(
    baseResponse.clone(),
    'user_mw',
    5,
    { store },
  );
  assertEquals(secondResult.upsell, false);
  assertEquals(secondRes.headers.get(UPSELL_HEADER), null);
});
