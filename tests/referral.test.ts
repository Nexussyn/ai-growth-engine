import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { ReferralEngine } from '../src/growth/referral.ts';

Deno.test('Referral Happy Path: awards 5 credits to referrer and logs system event', () => {
  const engine = new ReferralEngine();
  const code = engine.createReferralCode('user_alice', 'REF_ALICE');

  assertEquals(code.code, 'REF_ALICE');
  assertEquals(engine.getUserCredits('user_alice'), 0);

  const result = engine.processReferral('REF_ALICE', 'user_bob');
  assertEquals(result.success, true);
  assertEquals(result.creditsAwarded, 5);
  assertEquals(result.referrerId, 'user_alice');
  assertEquals(result.referredUserId, 'user_bob');

  // Verify credit balance
  assertEquals(engine.getUserCredits('user_alice'), 5);

  // Verify system event logged
  const events = engine.getEvents();
  assertEquals(events.length, 1);
  assertEquals(events[0].eventType, 'referral_conversion');
  assertEquals(events[0].userId, 'user_alice');
  assertEquals(events[0].metadata.referredUserId, 'user_bob');
});

Deno.test('Referral Idempotency: prevents duplicate claim by same referred user', () => {
  const engine = new ReferralEngine();
  engine.createReferralCode('user_alice', 'REF_ALICE');

  // First claim succeeds
  const first = engine.processReferral('REF_ALICE', 'user_bob');
  assertEquals(first.success, true);
  assertEquals(engine.getUserCredits('user_alice'), 5);

  // Second claim fails idempotently
  const second = engine.processReferral('REF_ALICE', 'user_bob');
  assertEquals(second.success, false);
  assertEquals(second.error, 'referral_already_claimed');

  // Credits are NOT doubled
  assertEquals(engine.getUserCredits('user_alice'), 5);
  assertEquals(engine.getEvents().length, 1);
});

Deno.test('Referral Self-Referral Prevention: rejects user referring themselves', () => {
  const engine = new ReferralEngine();
  engine.createReferralCode('user_alice', 'REF_ALICE');

  const result = engine.processReferral('REF_ALICE', 'user_alice');
  assertEquals(result.success, false);
  assertEquals(result.error, 'self_referral_forbidden');
  assertEquals(engine.getUserCredits('user_alice'), 0);
});

Deno.test('Referral Invalid Code: rejects non-existent referral code', () => {
  const engine = new ReferralEngine();
  const result = engine.processReferral('NON_EXISTENT_CODE', 'user_bob');
  assertEquals(result.success, false);
  assertEquals(result.error, 'invalid_referral_code');
});
