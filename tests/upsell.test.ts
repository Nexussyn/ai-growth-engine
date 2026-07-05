import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  evaluateUpsellTrigger,
  UPSELL_PROMPT_HEADER,
  UPSELL_PROMPT_VARIANT_HEADER,
  UPSELL_TRIGGER_TYPE,
  upsellThreshold,
  type UpsellStore,
} from '../src/monetization/upsell.ts';

class FakeUpsellStore implements UpsellStore {
  triggers = new Set<string>();
  records: Array<{ userId: string; triggerType: string; metadata: Record<string, unknown> }> = [];
  events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];

  async hasTrigger(userId: string, triggerType: string): Promise<boolean> {
    return this.triggers.has(`${userId}:${triggerType}`);
  }

  async recordTrigger(userId: string, triggerType: string, metadata: Record<string, unknown>): Promise<void> {
    this.triggers.add(`${userId}:${triggerType}`);
    this.records.push({ userId, triggerType, metadata });
  }

  async logSystemEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
    this.events.push({ eventType, payload });
  }
}

Deno.test('upsellThreshold returns the 50 percent free-call boundary', () => {
  assertEquals(upsellThreshold(10), 5);
  assertEquals(upsellThreshold(9), 5);
});

Deno.test('evaluateUpsellTrigger does not fire below threshold', async () => {
  const store = new FakeUpsellStore();

  const result = await evaluateUpsellTrigger({ userId: 'user-a', callCount: 4 }, store);

  assertEquals(result.showPrompt, false);
  assertEquals(result.reason, 'below_threshold');
  assertEquals(store.records.length, 0);
});

Deno.test('evaluateUpsellTrigger fires exactly once at the fifth call', async () => {
  const store = new FakeUpsellStore();

  const result = await evaluateUpsellTrigger({ userId: 'user-a', callCount: 5 }, store);
  const duplicate = await evaluateUpsellTrigger({ userId: 'user-a', callCount: 5 }, store);

  assertEquals(result.showPrompt, true);
  assertEquals(result.reason, 'triggered');
  assertEquals(result.triggerType, UPSELL_TRIGGER_TYPE);
  assertEquals(result.headers[UPSELL_PROMPT_HEADER], 'true');
  assertEquals(Boolean(result.headers[UPSELL_PROMPT_VARIANT_HEADER]), true);
  assertEquals(duplicate.showPrompt, false);
  assertEquals(duplicate.reason, 'already_triggered');
  assertEquals(store.records.length, 1);
});

Deno.test('evaluateUpsellTrigger does not fire after the threshold is missed', async () => {
  const store = new FakeUpsellStore();

  const result = await evaluateUpsellTrigger({ userId: 'user-a', callCount: 6 }, store);

  assertEquals(result.showPrompt, false);
  assertEquals(result.reason, 'above_threshold');
  assertEquals(store.records.length, 0);
});

Deno.test('evaluateUpsellTrigger logs an event with prompt metadata', async () => {
  const store = new FakeUpsellStore();

  const result = await evaluateUpsellTrigger({ userId: 'user-a', callCount: 5 }, store);

  assertEquals(store.events.length, 1);
  assertEquals(store.events[0].eventType, 'upsell_trigger_shown');
  assertEquals(store.events[0].payload.user_id, 'user-a');
  assertEquals(store.events[0].payload.prompt_variant, result.variant);
});
