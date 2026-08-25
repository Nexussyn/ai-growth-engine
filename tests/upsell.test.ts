import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { UpsellEngine, UPSELL_VARIANTS } from '../src/monetization/upsell.ts';

Deno.test('Auto-Upsell: does not trigger before 5th free call', () => {
  const engine = new UpsellEngine();
  const userId = 'user_dev_1';

  for (let i = 1; i <= 4; i++) {
    engine.recordCall(userId);
    const evalResult = engine.evaluateUpsell(userId);
    assertEquals(evalResult.shouldTrigger, false);
    assertEquals(evalResult.headerFlag, false);
  }
});

Deno.test('Auto-Upsell: triggers exactly on 5th free call with header flag and prompt', () => {
  const engine = new UpsellEngine();
  const userId = 'user_dev_2';

  for (let i = 1; i <= 5; i++) {
    engine.recordCall(userId);
  }

  const evalResult = engine.evaluateUpsell(userId, 'urgency');
  assertEquals(evalResult.shouldTrigger, true);
  assertEquals(evalResult.headerFlag, true);
  assertEquals(evalResult.variant, 'urgency');
  assertEquals(evalResult.promptMessage, UPSELL_VARIANTS.urgency.message);

  const trigger = engine.getTrigger(userId);
  assertEquals(trigger?.triggerType, 'free_limit_50');
  assertEquals(trigger?.converted, false);
});

Deno.test('Auto-Upsell: prevents double-triggering on subsequent calls (Idempotency)', () => {
  const engine = new UpsellEngine();
  const userId = 'user_dev_3';

  // 5th call triggers
  for (let i = 1; i <= 5; i++) engine.recordCall(userId);
  const firstEval = engine.evaluateUpsell(userId);
  assertEquals(firstEval.shouldTrigger, true);

  // 6th call should NOT re-trigger
  engine.recordCall(userId);
  const secondEval = engine.evaluateUpsell(userId);
  assertEquals(secondEval.shouldTrigger, false);
  assertEquals(secondEval.headerFlag, false);
});

Deno.test('Auto-Upsell: marks conversion upon plan upgrade', () => {
  const engine = new UpsellEngine();
  const userId = 'user_dev_4';

  for (let i = 1; i <= 5; i++) engine.recordCall(userId);
  engine.evaluateUpsell(userId);

  const converted = engine.markConversion(userId);
  assertEquals(converted, true);

  const record = engine.getTrigger(userId);
  assertEquals(record?.converted, true);
  assertEquals(typeof record?.convertedAt, 'string');
});
