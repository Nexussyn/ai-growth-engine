import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildUpsellPrompt,
  evaluateUpsellTrigger,
  shouldTriggerUpsell,
} from '../src/monetization/upsell.ts';

Deno.test('fires exactly on the 5th free call', () => {
  assertEquals(shouldTriggerUpsell(4, false), false);
  assertEquals(shouldTriggerUpsell(5, false), true);
  assertEquals(shouldTriggerUpsell(6, false), false);
});

Deno.test('does not double-trigger after an existing trigger', () => {
  assertEquals(shouldTriggerUpsell(5, true), false);
});

Deno.test('sets upsell headers and trigger record', () => {
  const result = evaluateUpsellTrigger({
    userId: 'user_123',
    callCount: 5,
    now: new Date('2026-07-08T00:00:00.000Z'),
  });

  assertEquals(result.shouldTrigger, true);
  assertEquals(result.headers['X-Upsell-Prompt'], 'true');
  assertEquals(result.headers['X-Upsell-Threshold'], '5/10');
  assertEquals(result.trigger?.user_id, 'user_123');
  assertEquals(result.trigger?.trigger_type, 'free_limit_50pct');
  assertEquals(result.trigger?.converted, false);
});

Deno.test('returns no-op result when threshold is not crossed', () => {
  const result = evaluateUpsellTrigger({ userId: 'user_123', callCount: 3 });
  assertEquals(result.shouldTrigger, false);
  assertEquals(result.headers, {});
  assertEquals(result.prompt, null);
});

Deno.test('prompt variant is deterministic per user and count', () => {
  assertEquals(buildUpsellPrompt('user_123', 5), buildUpsellPrompt('user_123', 5));
});
