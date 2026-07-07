import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  checkUpsellTrigger,
  isUpsellThreshold,
  getUpsellPromptText,
  UPSELL_PROMPT_VARIANTS,
  UPSELL_TRIGGER_TYPE,
  UpsellTriggerRow,
} from '../src/monetization/upsell.ts';

/**
 * Simple in-memory mock DB client implementing the subset of the
 * Supabase-like interface used by `checkUpsellTrigger`.
 */
function createMockDb() {
  const rows: UpsellTriggerRow[] = [];

  const db = {
    from(_table: string) {
      return {
        select(_columns: string) {
          return {
            eq(_col1: string, val1: string) {
              return {
                eq(_col2: string, val2: string) {
                  return {
                    maybeSingle() {
                      const found = rows.find(
                        r => r.user_id === val1 && r.trigger_type === val2
                      );
                      return Promise.resolve({ data: found ?? null, error: null });
                    },
                  };
                },
              };
            },
          };
        },
        insert(row: Partial<UpsellTriggerRow>) {
          rows.push({
            user_id: row.user_id!,
            trigger_type: row.trigger_type!,
            shown_at: row.shown_at ?? new Date().toISOString(),
            converted: row.converted ?? false,
          });
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
    _rows: rows,
  };

  return db;
}

Deno.test('isUpsellThreshold: true only at exactly the 5th call', () => {
  assertEquals(isUpsellThreshold(1), false);
  assertEquals(isUpsellThreshold(4), false);
  assertEquals(isUpsellThreshold(5), true);
  assertEquals(isUpsellThreshold(6), false);
  assertEquals(isUpsellThreshold(10), false);
});

Deno.test('checkUpsellTrigger: does not trigger before threshold', async () => {
  const db = createMockDb();
  const result = await checkUpsellTrigger(db as any, 'user-1', 3);
  assertEquals(result.shouldTrigger, false);
  assertEquals(result.headers, {});
  assertEquals(result.promptText, null);
  assertEquals(db._rows.length, 0);
});

Deno.test('checkUpsellTrigger: triggers exactly on the 5th call', async () => {
  const db = createMockDb();
  const result = await checkUpsellTrigger(db as any, 'user-2', 5);
  assertEquals(result.shouldTrigger, true);
  assertEquals(result.headers['X-Upsell-Prompt'], 'true');
  assert(result.promptText !== null);
  assertEquals(db._rows.length, 1);
  assertEquals(db._rows[0].user_id, 'user-2');
  assertEquals(db._rows[0].trigger_type, UPSELL_TRIGGER_TYPE);
  assertEquals(db._rows[0].converted, false);
});

Deno.test('checkUpsellTrigger: idempotent — does not double-trigger for same user', async () => {
  const db = createMockDb();

  const first = await checkUpsellTrigger(db as any, 'user-3', 5);
  assertEquals(first.shouldTrigger, true);
  assertEquals(db._rows.length, 1);

  // Simulate calling again at the same threshold (e.g. retried request)
  const second = await checkUpsellTrigger(db as any, 'user-3', 5);
  assertEquals(second.shouldTrigger, false);
  assertEquals(second.headers, {});
  assertEquals(second.promptText, null);
  assertEquals(db._rows.length, 1); // no duplicate row inserted
});

Deno.test('checkUpsellTrigger: separate users each get their own trigger', async () => {
  const db = createMockDb();

  const userA = await checkUpsellTrigger(db as any, 'user-a', 5);
  const userB = await checkUpsellTrigger(db as any, 'user-b', 5);

  assertEquals(userA.shouldTrigger, true);
  assertEquals(userB.shouldTrigger, true);
  assertEquals(db._rows.length, 2);
});

Deno.test('getUpsellPromptText: returns a known variant deterministically per user', () => {
  const promptOne = getUpsellPromptText('user-x');
  const promptOneAgain = getUpsellPromptText('user-x');
  assertEquals(promptOne, promptOneAgain);
  assert(UPSELL_PROMPT_VARIANTS.includes(promptOne));
});
