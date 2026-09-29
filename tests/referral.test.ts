import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { InMemoryReferralStore, process_referral } from '../src/growth/referral.ts';

Deno.test('Happy path: awards 5 free credits to referrer and logs referral_conversion', () => {
  const store = new InMemoryReferralStore();
  store.createCode('user_A', 'REF12345');

  const res = process_referral('REF12345', 'user_B', store);
  assertEquals(res.status, 'ok');
  assertEquals(res.credits_awarded, 5);
  assertEquals(store.balances.get('user_A'), 5);
  assertEquals(store.systemEvents.length, 1);
  assertEquals(store.systemEvents[0].event_type, 'referral_conversion');
});

Deno.test('Idempotency: prevents duplicate referral usage by the same user', () => {
  const store = new InMemoryReferralStore();
  store.createCode('user_A', 'REF12345');

  process_referral('REF12345', 'user_B', store);
  const dup = process_referral('REF12345', 'user_B', store);
  assertEquals(dup.status, 'already_processed');
  assertEquals(store.balances.get('user_A'), 5);
  assertEquals(store.systemEvents.length, 1);
});
