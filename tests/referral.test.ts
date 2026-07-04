import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { processReferral } from '../src/growth/referral.ts';

class MockDatabase {
  conversions: any[] = [];
  codes = [
    { code: 'REF123', owner_id: 'user_A', uses: 0, credits_awarded: 0 }
  ];
  events: any[] = [];

  from(table: string) {
    const db = this;
    return {
      select: (fields: string) => {
        return {
          eq: (field1: string, val1: any) => {
            return {
              eq: (field2: string, val2: any) => {
                return {
                  maybeSingle: async () => {
                    if (table === 'referral_conversions') {
                      const match = db.conversions.find(
                        c => c.referral_code === val1 && c.new_user_id === val2
                      );
                      return { data: match || null };
                    }
                    return { data: null };
                  }
                };
              },
              maybeSingle: async () => {
                if (table === 'referral_codes') {
                  const match = db.codes.find(c => c.code === val1);
                  return { data: match || null };
                }
                return { data: null };
              }
            };
          }
        };
      },
      insert: async (data: any) => {
        if (table === 'referral_conversions') {
          db.conversions.push(data);
        } else if (table === 'system_events') {
          db.events.push(data);
        }
        return { error: null };
      },
      update: (data: any) => {
        return {
          eq: async (field: string, val: any) => {
            if (table === 'referral_codes') {
              const codeIdx = db.codes.findIndex(c => c.code === val);
              if (codeIdx !== -1) {
                db.codes[codeIdx] = { ...db.codes[codeIdx], ...data };
              }
            }
            return { error: null };
          }
        };
      }
    };
  }
}

Deno.test('Referral: processes successful conversion', async () => {
  const db = new MockDatabase();
  const result = await processReferral(db as any, 'REF123', 'user_B');

  assertEquals(result.status, 'ok');
  assertEquals(result.credits_awarded, 5);
  assertEquals(result.owner_id, 'user_A');

  // Verify referral code usage updated
  assertEquals(db.codes[0].uses, 1);
  assertEquals(db.codes[0].credits_awarded, 5);

  // Verify system event logged
  assertEquals(db.events.length, 1);
  assertEquals(db.events[0].event_type, 'referral_conversion');
  assertEquals(db.events[0].payload.new_user, 'user_B');
});

Deno.test('Referral: rejects invalid referral code', async () => {
  const db = new MockDatabase();
  const result = await processReferral(db as any, 'INVALID_CODE', 'user_B');
  assertEquals(result.status, 'invalid_code');
});

Deno.test('Referral: idempotent - rejects double conversion', async () => {
  const db = new MockDatabase();
  // Process once
  await processReferral(db as any, 'REF123', 'user_B');
  // Process second time
  const result = await processReferral(db as any, 'REF123', 'user_B');

  assertEquals(result.status, 'already_processed');
  // Verify uses didn't increment twice
  assertEquals(db.codes[0].uses, 1);
  assertEquals(db.codes[0].credits_awarded, 5);
});
