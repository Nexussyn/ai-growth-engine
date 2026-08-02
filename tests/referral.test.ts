import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { processReferralConversion, DatabaseClient } from '../src/growth/referral.ts';

// Helper to create a mock database client
function createMockDb(resultData: any): DatabaseClient {
  return {
    query: (_sql: string, _params: any[]) => Promise.resolve([{ result: resultData }])
  };
}

Deno.test('Referral: Happy path awards credits', async () => {
  const mockDb = createMockDb({
    status: 'ok',
    credits_awarded: 5,
    owner_id: 'user_123'
  });

  const res = await processReferralConversion('VALID_CODE', 'new_user_456', mockDb);
  
  assertEquals(res.status, 'ok');
  assertEquals(res.credits_awarded, 5);
  assertEquals(res.owner_id, 'user_123');
});

Deno.test('Referral: Idempotent prevents duplicate processing', async () => {
  const mockDb = createMockDb({
    status: 'already_processed'
  });

  const res = await processReferralConversion('VALID_CODE', 'existing_user_456', mockDb);
  
  assertEquals(res.status, 'already_processed');
  assertEquals(res.credits_awarded, undefined);
});

Deno.test('Referral: Invalid code returns appropriate status', async () => {
  const mockDb = createMockDb({
    status: 'invalid_code'
  });

  const res = await processReferralConversion('INVALID_CODE', 'new_user_456', mockDb);
  
  assertEquals(res.status, 'invalid_code');
  assertEquals(res.credits_awarded, undefined);
});

Deno.test('Referral: Throws on empty database result', async () => {
  const emptyDb: DatabaseClient = {
    query: () => Promise.resolve([])
  };

  await assertRejects(
    () => processReferralConversion('CODE', 'USER', emptyDb),
    Error,
    'Database returned empty result from process_referral'
  );
});
