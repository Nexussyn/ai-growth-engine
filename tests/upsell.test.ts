import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  UPSELL_THRESHOLD,
  evaluateUpsellTrigger,
  buildUpsellHeaders,
} from '../src/monetization/upsell.ts';

Deno.test('threshold is 5th free call (50% of 10)', () => {
  assertEquals(UPSELL_THRESHOLD, 5);
});

Deno.test('triggers exactly at threshold', () => {
  const d = evaluateUpsellTrigger({ callCount: 5, alreadyTriggered: false });
  assertEquals(d.shouldTrigger, true);
  assertEquals(d.prompt?.headerValue, 'true');
  assertEquals(buildUpsellHeaders(d)['X-Upsell-Prompt'], 'true');
});

Deno.test('does not trigger before or after threshold', () => {
  assertEquals(evaluateUpsellTrigger({ callCount: 4, alreadyTriggered: false }).shouldTrigger, false);
  assertEquals(evaluateUpsellTrigger({ callCount: 6, alreadyTriggered: false }).shouldTrigger, false);
});

Deno.test('idempotent: no double-trigger when already shown', () => {
  const d = evaluateUpsellTrigger({ callCount: 5, alreadyTriggered: true });
  assertEquals(d.shouldTrigger, false);
  assertEquals(d.alreadyTriggered, true);
  assertEquals(Object.keys(buildUpsellHeaders(d)).length, 0);
});

Deno.test('variant B prompt differs from A', () => {
  const a = evaluateUpsellTrigger({ callCount: 5, alreadyTriggered: false, variant: 'A' });
  const b = evaluateUpsellTrigger({ callCount: 5, alreadyTriggered: false, variant: 'B' });
  assertEquals(a.prompt!.text !== b.prompt!.text, true);
});
