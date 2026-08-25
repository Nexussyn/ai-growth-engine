import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  REFERRAL_CREDITS,
  EVENT_TYPE,
  ReferralStore,
  processReferral,
} from '../src/growth/referral.ts';

Deno.test('happy path awards 5 credits and logs event + notifications', () => {
  const store = new ReferralStore();
  store.createCode('alice', 'ALICE01');
  const r = processReferral('alice01', 'bob', store);
  assertEquals(r.status, 'ok');
  assertEquals(r.creditsAwarded, REFERRAL_CREDITS);
  assertEquals(r.ownerId, 'alice');
  assertEquals(store.getBalance('alice'), 5);
  assertEquals(store.getCode('ALICE01')?.uses, 1);
  assertEquals(store.getCode('ALICE01')?.creditsAwarded, 5);
  assertEquals(store.events.length, 1);
  assertEquals(store.events[0].eventType, EVENT_TYPE);
  assertEquals(store.notifications.length, 2);
});

Deno.test('idempotent: duplicate conversion for same user is rejected', () => {
  const store = new ReferralStore();
  store.createCode('alice', 'ALICE02');
  const first = processReferral('ALICE02', 'bob', store);
  assertEquals(first.status, 'ok');
  const second = processReferral('ALICE02', 'bob', store);
  assertEquals(second.status, 'already_processed');
  assertEquals(store.getBalance('alice'), 5);
  assertEquals(store.getCode('ALICE02')?.uses, 1);
  assertEquals(store.events.length, 1);
});

Deno.test('same code can convert different users', () => {
  const store = new ReferralStore();
  store.createCode('alice', 'SHARE01');
  assertEquals(processReferral('SHARE01', 'bob', store).status, 'ok');
  assertEquals(processReferral('SHARE01', 'carol', store).status, 'ok');
  assertEquals(store.getBalance('alice'), 10);
  assertEquals(store.getCode('SHARE01')?.uses, 2);
});

Deno.test('invalid code returns invalid_code', () => {
  const store = new ReferralStore();
  const r = processReferral('NOPE', 'bob', store);
  assertEquals(r.status, 'invalid_code');
});

Deno.test('self-referral is blocked', () => {
  const store = new ReferralStore();
  store.createCode('alice', 'SELF01');
  const r = processReferral('SELF01', 'alice', store);
  assertEquals(r.status, 'self_referral');
  assertEquals(store.getBalance('alice'), 0);
});

Deno.test('invalid inputs are safe no-ops', () => {
  const store = new ReferralStore();
  assertEquals(processReferral('', 'bob', store).status, 'invalid_input');
  assertEquals(processReferral('X', '', store).status, 'invalid_input');
});

Deno.test('event payload includes code, new_user, credits', () => {
  const store = new ReferralStore();
  store.createCode('owner', 'EVT001');
  const r = processReferral('EVT001', 'newbie', store);
  assertEquals(r.status, 'ok');
  assertExists(r.event);
  assertEquals(r.event!.payload.code, 'EVT001');
  assertEquals(r.event!.payload.new_user, 'newbie');
  assertEquals(r.event!.payload.credits, 5);
});
