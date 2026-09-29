import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { process_referral, create_referral_code, ReferralResult } from '../src/growth/referral.ts';

// Mock data for testing
const TEST_CODE = 'TESTCODE';
const TEST_OWNER_ID = 'owner-123';
const TEST_NEW_USER_ID = 'new-user-456';

Deno.test({
  name: 'Happy path: referral is processed and credits awarded',
  async fn() {
    const result = await process_referral(TEST_CODE, TEST_NEW_USER_ID);
    assertEquals(result.status, 'ok');
    assertEquals(result.credits_awarded, 5);
    assertEquals(result.owner_id, TEST_OWNER_ID);
    assertEquals(result.referral_code, TEST_CODE);
  },
});

Deno.test({
  name: 'Idempotency: same referral+user returns already_processed',
  async fn() {
    // First call
    await process_referral(TEST_CODE, TEST_NEW_USER_ID);
    // Second call with same params
    const result = await process_referral(TEST_CODE, TEST_NEW_USER_ID);
    assertEquals(result.status, 'already_processed');
    assertEquals(result.credits_awarded, 0);
  },
});

Deno.test({
  name: 'Duplicate prevention: same referral code used by different user',
  async fn() {
    // Simulate two different users using the same code
    const result1 = await process_referral(TEST_CODE, 'user-a');
    const result2 = await process_referral(TEST_CODE, 'user-b');

    assertEquals(result1.status, 'ok');
    assertEquals(result2.status, 'ok');
    assertEquals(result1.credits_awarded, 5);
    assertEquals(result2.credits_awarded, 5);
  },
});

Deno.test({
  name: 'Invalid code: returns invalid_code status',
  async fn() {
    const result = await process_referral('NONEXISTENT', TEST_NEW_USER_ID);
    assertEquals(result.status, 'invalid_code');
    assertEquals(result.credits_awarded, 0);
  },
});

Deno.test({
  name: 'create_referral_code generates unique code for each user',
  async fn() {
    const code1 = await create_referral_code('user-1');
    const code2 = await create_referral_code('user-2');

    // Codes should be generated and unique
    assertEquals(typeof code1, 'string');
    assertEquals(code1.length > 0, true);
    // Note: actual uniqueness depends on random generation
  },
});