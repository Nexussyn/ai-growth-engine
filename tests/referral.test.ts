import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { processReferral, REFERRAL_CREDIT_AWARD } from '../src/growth/referral.ts';

/**
 * Minimal in-memory mock of the Supabase client surface used by processReferral.
 * Supports: from(table).select().eq().eq().maybeSingle(), .insert(), .update().eq(), .upsert()
 */
function createMockClient(initial: {
  referral_codes?: any[];
  referral_redemptions?: any[];
  user_credits?: any[];
  system_events?: any[];
  notifications?: any[];
} = {}) {
  const tables: Record<string, any[]> = {
    referral_codes: initial.referral_codes ?? [],
    referral_redemptions: initial.referral_redemptions ?? [],
    user_credits: initial.user_credits ?? [],
    system_events: initial.system_events ?? [],
    notifications: initial.notifications ?? []
  };

  function from(table: string) {
    const rows = tables[table];

    const builder: any = {
      _filters: [] as Array<[string, any]>,
      select(_cols?: string) {
        return builder;
      },
      eq(col: string, val: any) {
        builder._filters.push([col, val]);
        return builder;
      },
      async maybeSingle() {
        const match = rows.find(r => builder._filters.every(([col, val]: [string, any]) => r[col] === val));
        return { data: match ?? null, error: null };
      },
      async insert(payload: any) {
        const items = Array.isArray(payload) ? payload : [payload];
        // enforce unique (referral_code, new_user_id) for referral_redemptions
        if (table === 'referral_redemptions') {
          for (const item of items) {
            const dup = rows.find(
              r => r.referral_code === item.referral_code && r.new_user_id === item.new_user_id
            );
            if (dup) {
              return { data: null, error: { message: 'duplicate key value violates unique constraint' } };
            }
          }
        }
        for (const item of items) rows.push({ id: crypto.randomUUID(), ...item });
        return { data: items, error: null };
      },
      update(payload: any) {
        return {
          async eq(col: string, val: any) {
            const idx = rows.findIndex(r => r[col] === val);
            if (idx >= 0) rows[idx] = { ...rows[idx], ...payload };
            return { data: idx >= 0 ? [rows[idx]] : [], error: null };
          }
        };
      },
      async upsert(payload: any) {
        const idx = rows.findIndex(r => r.user_id === payload.user_id);
        if (idx >= 0) rows[idx] = { ...rows[idx], ...payload };
        else rows.push(payload);
        return { data: [payload], error: null };
      }
    };

    return builder;
  }

  return { from, tables } as any;
}

Deno.test('processReferral: happy path awards credits, logs event, notifies both users', async () => {
  const client = createMockClient({
    referral_codes: [{ code: 'ABC123', owner_id: 'user-a', uses: 0, credits_awarded: 0 }],
    user_credits: [{ user_id: 'user-a', balance: 10 }]
  });

  const result = await processReferral('ABC123', 'user-b', client);

  assertEquals(result.ok, true);
  assertEquals(result.alreadyProcessed, false);
  assertEquals(result.creditsAwarded, REFERRAL_CREDIT_AWARD);
  assertEquals(result.ownerId, 'user-a');

  // credits updated
  const credits = client.tables.user_credits.find((r: any) => r.user_id === 'user-a');
  assertEquals(credits.balance, 15);

  // referral_codes stats updated
  const code = client.tables.referral_codes.find((r: any) => r.code === 'ABC123');
  assertEquals(code.uses, 1);
  assertEquals(code.credits_awarded, REFERRAL_CREDIT_AWARD);

  // system_events logged
  const events = client.tables.system_events.filter((e: any) => e.event_type === 'referral_conversion');
  assertEquals(events.length, 1);
  assertEquals(events[0].payload.owner_id, 'user-a');
  assertEquals(events[0].payload.new_user_id, 'user-b');

  // notifications sent to both users
  const notifs = client.tables.notifications;
  assertEquals(notifs.length, 2);
  assertEquals(notifs.some((n: any) => n.user_id === 'user-a'), true);
  assertEquals(notifs.some((n: any) => n.user_id === 'user-b'), true);

  // redemption recorded
  const redemptions = client.tables.referral_redemptions;
  assertEquals(redemptions.length, 1);
  assertEquals(redemptions[0].referral_code, 'ABC123');
  assertEquals(redemptions[0].new_user_id, 'user-b');
});

Deno.test('processReferral: idempotent — same user cannot redeem twice', async () => {
  const client = createMockClient({
    referral_codes: [{ code: 'ABC123', owner_id: 'user-a', uses: 0, credits_awarded: 0 }],
    user_credits: [{ user_id: 'user-a', balance: 0 }]
  });

  const first = await processReferral('ABC123', 'user-b', client);
  assertEquals(first.alreadyProcessed, false);
  assertEquals(first.creditsAwarded, REFERRAL_CREDIT_AWARD);

  const second = await processReferral('ABC123', 'user-b', client);
  assertEquals(second.alreadyProcessed, true);
  assertEquals(second.creditsAwarded, 0);

  // credits should only be awarded once
  const credits = client.tables.user_credits.find((r: any) => r.user_id === 'user-a');
  assertEquals(credits.balance, REFERRAL_CREDIT_AWARD);

  // only one event logged
  const events = client.tables.system_events.filter((e: any) => e.event_type === 'referral_conversion');
  assertEquals(events.length, 1);

  // only one redemption row
  assertEquals(client.tables.referral_redemptions.length, 1);
});

Deno.test('processReferral: rejects self-referral', async () => {
  const client = createMockClient({
    referral_codes: [{ code: 'SELF1', owner_id: 'user-a', uses: 0, credits_awarded: 0 }]
  });

  await assertRejects(
    () => processReferral('SELF1', 'user-a', client),
    Error,
    'cannot redeem their own referral code'
  );
});

Deno.test('processReferral: rejects invalid referral code', async () => {
  const client = createMockClient({});

  await assertRejects(
    () => processReferral('DOES-NOT-EXIST', 'user-b', client),
    Error,
    'Invalid referral code'
  );
});

Deno.test('processReferral: different new users can each redeem the same code', async () => {
  const client = createMockClient({
    referral_codes: [{ code: 'SHARE1', owner_id: 'user-a', uses: 0, credits_awarded: 0 }],
    user_credits: [{ user_id: 'user-a', balance: 0 }]
  });

  const r1 = await processReferral('SHARE1', 'user-b', client);
  const r2 = await processReferral('SHARE1', 'user-c', client);

  assertEquals(r1.alreadyProcessed, false);
  assertEquals(r2.alreadyProcessed, false);

  const credits = client.tables.user_credits.find((r: any) => r.user_id === 'user-a');
  assertEquals(credits.balance, REFERRAL_CREDIT_AWARD * 2);

  const code = client.tables.referral_codes.find((r: any) => r.code === 'SHARE1');
  assertEquals(code.uses, 2);
});
