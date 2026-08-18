import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  createMockDatabase,
  generateReferralCode,
  processReferral
} from '../src/growth/referral.ts';

Deno.test('Referral: successful conversion awards 5 credits', () => {
  const db = createMockDatabase();
  const code = generateReferralCode('user_alice', 'ALICE2026', db);

  const result = processReferral(code, 'user_bob', db);
  assertEquals(result.status, 'ok');
  assertEquals(result.creditsAwarded, 5);
  assertEquals(result.ownerId, 'user_alice');

  const referralData = db.referralCodes.get(code);
  assertEquals(referralData?.uses, 1);
  assertEquals(referralData?.creditsAwarded, 5);
  assertEquals(db.systemEvents.length, 1);
  assertEquals(db.systemEvents[0].type, 'referral_conversion');
});

Deno.test('Referral: prevents duplicate conversions (idempotency)', () => {
  const db = createMockDatabase();
  const code = generateReferralCode('user_alice', 'ALICE2026', db);

  processReferral(code, 'user_bob', db);
  const secondAttempt = processReferral(code, 'user_bob', db);

  assertEquals(secondAttempt.status, 'already_processed');
  assertEquals(db.referralCodes.get(code)?.uses, 1);
});

Deno.test('Referral: rejects invalid referral code', () => {
  const db = createMockDatabase();
  const result = processReferral('NON_EXISTENT_CODE', 'user_bob', db);
  assertEquals(result.status, 'invalid_code');
});
