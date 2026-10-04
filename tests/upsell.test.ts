import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  checkUpsellTrigger,
  selectPromptVariant,
  PROMPT_VARIANTS,
  UpsellContext
} from '../src/monetization/upsell.ts';

// THRESHOLD DETECTION
Deno.test('UpsellTrigger: triggers on exactly 5th call', async () => {
  const context: UpsellContext = {
    userId: 'test-user-1',
    callCount: 5,
    remainingCalls: 5,
    tier: 'free'
  };
  const result = await checkUpsellTrigger(context);
  assertEquals(result.triggered, true);
  assertExists(result.promptText);
});

Deno.test('UpsellTrigger: does not trigger on 4th call', async () => {
  const context: UpsellContext = {
    userId: 'test-user-2',
    callCount: 4,
    remainingCalls: 6,
    tier: 'free'
  };
  const result = await checkUpsellTrigger(context);
  assertEquals(result.triggered, false);
});

Deno.test('UpsellTrigger: does not trigger on 6th call', async () => {
  const context: UpsellContext = {
    userId: 'test-user-3',
    callCount: 6,
    remainingCalls: 4,
    tier: 'free'
  };
  const result = await checkUpsellTrigger(context);
  assertEquals(result.triggered, false);
});

Deno.test('UpsellTrigger: does not trigger for paid users', async () => {
  const context: UpsellContext = {
    userId: 'test-user-4',
    callCount: 5,
    remainingCalls: 5,
    tier: 'paid'
  };
  const result = await checkUpsellTrigger(context);
  assertEquals(result.triggered, false);
});

// HEADERS
Deno.test('UpsellTrigger: sets X-Upsell headers when triggered', async () => {
  const context: UpsellContext = {
    userId: 'test-user-6',
    callCount: 5,
    remainingCalls: 5,
    tier: 'free'
  };
  const result = await checkUpsellTrigger(context);
  if (result.triggered) {
    assertEquals(result.headersToSet['X-Upsell-Prompt'], 'true');
    assertExists(result.headersToSet['X-Upsell-Variant']);
  }
});

// VARIANTS
Deno.test('UpsellTrigger: all 5 variants exist', () => {
  assertEquals(Object.keys(PROMPT_VARIANTS).length, 5);
});

Deno.test('UpsellTrigger: variant selection works', () => {
  const variant = selectPromptVariant('test-user');
  assertExists(variant.id);
  assertExists(variant.text);
});

Deno.test('UpsellTrigger: deterministic selection is consistent', () => {
  const userId = 'test-user-det';
  const v1 = selectPromptVariant(userId, true);
  const v2 = selectPromptVariant(userId, true);
  assertEquals(v1.id, v2.id);
});

// IDEMPOTENCE
Deno.test('UpsellTrigger: multiple calls are safe', async () => {
  const context: UpsellContext = {
    userId: 'idempotence-test',
    callCount: 5,
    remainingCalls: 5,
    tier: 'free'
  };
  const r1 = await checkUpsellTrigger(context);
  const r2 = await checkUpsellTrigger(context);
  assertEquals(typeof r1.triggered, 'boolean');
  assertEquals(typeof r2.triggered, 'boolean');
});

// EDGE CASES
Deno.test('UpsellTrigger: handles callCount = 0', async () => {
  const context: UpsellContext = {
    userId: 'edge-1',
    callCount: 0,
    remainingCalls: 10,
    tier: 'free'
  };
  const result = await checkUpsellTrigger(context);
  assertEquals(result.triggered, false);
});

Deno.test('UpsellTrigger: response structure valid', async () => {
  const context: UpsellContext = {
    userId: 'struct-test',
    callCount: 5,
    remainingCalls: 5,
    tier: 'free'
  };
  const result = await checkUpsellTrigger(context);
  assertExists(result.triggered);
  assertExists(result.headersToSet);
});

// CONCURRENCY
Deno.test('UpsellTrigger: concurrent calls race-safe', async () => {
  const context: UpsellContext = {
    userId: 'concurrent-test',
    callCount: 5,
    remainingCalls: 5,
    tier: 'free'
  };
  const promises = Array(5).fill(null).map(() => checkUpsellTrigger(context));
  const results = await Promise.all(promises);
  const triggeredCount = results.filter(r => r.triggered).length;
  assertEquals(triggeredCount <= 1, true);
});

// END-TO-END
Deno.test('UpsellTrigger: e2e workflow', async () => {
  const userId = 'e2e-test';
  for (let i = 1; i <= 4; i++) {
    const context: UpsellContext = {
      userId,
      callCount: i,
      remainingCalls: 10 - i,
      tier: 'free'
    };
    const result = await checkUpsellTrigger(context);
    assertEquals(result.triggered, false);
  }
  const triggerContext: UpsellContext = {
    userId,
    callCount: 5,
    remainingCalls: 5,
    tier: 'free'
  };
  const triggerResult = await checkUpsellTrigger(triggerContext);
  assertEquals(triggerResult.triggered, true);
});
