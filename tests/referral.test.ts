import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  ReferralStore,
  create_referral_code,
  process_referral,
  REFERRAL_REWARD_CREDITS,
  REFERRAL_EVENT_TYPE,
} from '../src/growth/referral.ts';

Deno.test('Referral happy path: awards 5 free credits, logs system_events, and notifies both users', () => {
  const store = new ReferralStore();
  const codeObj = create_referral_code('user_a', 'GROWTH20', store);

  const res = process_referral(codeObj.code, 'user_b', store);

  assertEquals(res.status, 'ok');
  assertEquals(res.credits_awarded, REFERRAL_REWARD_CREDITS);
  assertEquals(res.owner_id, 'user_a');
  assertEquals(res.referrer_balance, 5);
  assertEquals(store.getReferrerBalance('user_a'), 5);
  assertEquals(store.getCode('GROWTH20')?.uses, 1);
  assertEquals(store.getCode('GROWTH20')?.credits_awarded, 5);

  // Verify notifications for both users
  assertEquals(
    res.notifications?.referrer,
    'You earned 5 free credits for referring user user_b!',
  );
  assertEquals(
    res.notifications?.referee,
    'Your referral code GROWTH20 was applied! user_a earned 5 free credits.',
  );

  // Verify system_events log
  const events = store.getSystemEvents();
  assertEquals(events.length, 1);
  assertEquals(events[0].event_type, REFERRAL_EVENT_TYPE);
  assertEquals(events[0].payload.code, 'GROWTH20');
  assertEquals(events[0].payload.new_user, 'user_b');
  assertEquals(events[0].payload.credits, 5);
});

Deno.test('Referral idempotency: same referral cannot be used twice by the same user', () => {
  const store = new ReferralStore();
  create_referral_code('user_a', 'REF100', store);

  const first = process_referral('REF100', 'user_b', store);
  const second = process_referral('REF100', 'user_b', store);

  assertEquals(first.status, 'ok');
  assertEquals(second.status, 'already_processed');
  assertEquals(second.credits_awarded, 0);
  assertEquals(store.getReferrerBalance('user_a'), 5);
  assertEquals(store.getCode('REF100')?.uses, 1);
  assertEquals(store.getSystemEvents().length, 1);
});

Deno.test('Referral duplicate prevention across different codes for same new_user_id', () => {
  const store = new ReferralStore();
  create_referral_code('user_a', 'CODE_A', store);
  create_referral_code('user_c', 'CODE_C', store);

  const first = process_referral('CODE_A', 'user_b', store);
  const second = process_referral('CODE_C', 'user_b', store);

  assertEquals(first.status, 'ok');
  assertEquals(second.status, 'already_processed');
  assertEquals(store.getReferrerBalance('user_a'), 5);
  assertEquals(store.getReferrerBalance('user_c'), 0);
});

Deno.test('Referral rejects self-referral and invalid codes', () => {
  const store = new ReferralStore();
  create_referral_code('user_a', 'SELF1', store);

  const selfRes = process_referral('SELF1', 'user_a', store);
  assertEquals(selfRes.status, 'self_referral');
  assertEquals(selfRes.credits_awarded, 0);

  const invalidRes = process_referral('NONEXISTENT', 'user_b', store);
  assertEquals(invalidRes.status, 'invalid_code');
  assertEquals(invalidRes.credits_awarded, 0);
  assertEquals(store.getSystemEvents().length, 0);
});
