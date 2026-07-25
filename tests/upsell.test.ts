import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { checkUpsellTrigger, selectVariant } from '../src/monetization/upsell.ts';

// ---- Mock Database ----

class MockDB {
  triggers = new Map<string, Set<string>>();
  events: Array<{ type: string; user_id: string; metadata: string }> = [];

  async query(sql: string, params: unknown[] = []): Promise<{ rows: Record<string, unknown>[] }> {
    if (sql.includes('INSERT INTO upsell_triggers')) {
      const userId = params[0] as string;
      const triggerType = params[1] as string;
      const key = `${userId}:${triggerType}`;
      if (this.triggers.has(key)) {
        return { rows: [] }; // ON CONFLICT DO NOTHING — no rows returned
      }
      this.triggers.set(key, new Set());
      return { rows: [{ id: crypto.randomUUID() }] };
    }

    if (sql.includes('INSERT INTO system_events')) {
      this.events.push({
        type: params[0] as string,
        user_id: params[1] as string,
        metadata: params[2] as string,
      });
      return { rows: [] };
    }

    return { rows: [] };
  }
}

// ---- Tests ----

Deno.test('No trigger when call count is below threshold', async () => {
  const db = new MockDB();
  const result = await checkUpsellTrigger(db, 'user_1', 3);
  assertEquals(result.triggered, false);
  assertEquals(db.triggers.size, 0);
});

Deno.test('No trigger when call count is above threshold', async () => {
  const db = new MockDB();
  const result = await checkUpsellTrigger(db, 'user_1', 7);
  assertEquals(result.triggered, false);
});

Deno.test('Trigger fires at exactly call #5 (50% of 10)', async () => {
  const db = new MockDB();
  const result = await checkUpsellTrigger(db, 'user_1', 5);
  assertEquals(result.triggered, true);
  assertEquals(result.triggerType, 'free_limit_50pct');
  assertEquals(typeof result.prompt, 'string');
  assertEquals(result.prompt!.length > 0, true);
});

Deno.test('Idempotent: second trigger for same user does NOT fire', async () => {
  const db = new MockDB();

  // First trigger — should fire
  const first = await checkUpsellTrigger(db, 'user_1', 5);
  assertEquals(first.triggered, true);

  // Second trigger — same user, same threshold — should NOT fire
  const second = await checkUpsellTrigger(db, 'user_1', 5);
  assertEquals(second.triggered, false);
});

Deno.test('Different users can both trigger independently', async () => {
  const db = new MockDB();

  const r1 = await checkUpsellTrigger(db, 'user_A', 5);
  const r2 = await checkUpsellTrigger(db, 'user_B', 5);

  assertEquals(r1.triggered, true);
  assertEquals(r2.triggered, true);
});

Deno.test('System event is logged on trigger', async () => {
  const db = new MockDB();
  await checkUpsellTrigger(db, 'user_1', 5);

  assertEquals(db.events.length, 1);
  assertEquals(db.events[0].type, 'upsell_trigger_fired');
  assertEquals(db.events[0].user_id, 'user_1');
});

Deno.test('A/B variant is deterministic per user', () => {
  const v1 = selectVariant('user_abc');
  const v2 = selectVariant('user_abc');
  assertEquals(v1, v2); // Same user always gets same variant

  // Variant is always A or B
  assertEquals(['A', 'B'].includes(selectVariant('user_xyz')), true);
});

Deno.test('No event logged when trigger does not fire', async () => {
  const db = new MockDB();
  await checkUpsellTrigger(db, 'user_1', 3);
  assertEquals(db.events.length, 0);
});
