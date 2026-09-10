import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  createReferralStore,
  registerReferralCode,
  generateReferralCode,
  processReferral
} from '../src/growth/referral.ts';

Deno.test('Happy path: valid referral awards 5 credits and logs event', () => {
  const store = createReferralStore();
  registerReferralCode(store, 'REF-12345678', 'user_alice');

  const res = processReferral('REF-12345678', 'user_bob', store);
  assertEquals(res.status, 'ok');
  assertEquals(res.creditsAwarded, 5);
  assertEquals(res.ownerId, 'user_alice');

  const code = store.codes.get('REF-12345678');
  assertEquals(code?.uses, 1);
  assertEquals(code?.creditsAwarded, 5);

  assertEquals(store.events.length, 1);
  assertEquals(store.events[0].eventType, 'referral_conversion');
  assertEquals(store.events[0].payload.newUserId, 'user_bob');
  assertEquals(store.events[0].payload.credits, 5);
});

Deno.test('Duplicate prevention: second conversion with same user is idempotent', () => {
  const store = createReferralStore();
  registerReferralCode(store, 'REF-12345678', 'user_alice');

  const first = processReferral('REF-12345678', 'user_bob', store);
  assertEquals(first.status, 'ok');

  const second = processReferral('REF-12345678', 'user_bob', store);
  assertEquals(second.status, 'already_processed');

  // Uses and credits must remain 1 and 5
  const code = store.codes.get('REF-12345678');
  assertEquals(code?.uses, 1);
  assertEquals(code?.creditsAwarded, 5);
  assertEquals(store.events.length, 1);
});

Deno.test('Invalid referral code: returns invalid_code status', () => {
  const store = createReferralStore();
  const res = processReferral('NONEXISTENT_CODE', 'user_bob', store);
  assertEquals(res.status, 'invalid_code');
  assertEquals(store.events.length, 0);
});

Deno.test('Self-referral prevention: owner cannot refer themselves', () => {
  const store = createReferralStore();
  registerReferralCode(store, 'REF-ALICE001', 'user_alice');

  const res = processReferral('REF-ALICE001', 'user_alice', store);
  assertEquals(res.status, 'invalid_code');
  assertEquals(store.events.length, 0);
});

Deno.test('Multiple referrals from different users accumulate correctly', () => {
  const store = createReferralStore();
  registerReferralCode(store, 'REF-MULTI001', 'user_alice');

  processReferral('REF-MULTI001', 'user_bob', store);
  processReferral('REF-MULTI001', 'user_carol', store);
  processReferral('REF-MULTI001', 'user_dave', store);

  const code = store.codes.get('REF-MULTI001');
  assertEquals(code?.uses, 3);
  assertEquals(code?.creditsAwarded, 15);
  assertEquals(store.events.length, 3);
});

Deno.test('Referral code generator produces valid formatted codes', () => {
  const code1 = generateReferralCode('user_alice');
  const code2 = generateReferralCode('user_alice');
  assertEquals(code1.startsWith('REF-'), true);
  assertEquals(code2.startsWith('REF-'), true);
  assertEquals(code1.length, 12);
});
