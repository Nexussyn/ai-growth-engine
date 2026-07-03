import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  generateReferralCode,
  processReferralLocal,
  registerLocalCode,
  getLocalCodeStats,
  clearLocalStore,
} from '../src/growth/referral.ts';

Deno.test('generateReferralCode produces valid format', () => {
  const code = generateReferralCode('user_abc123');
  assert(code.includes('-'), 'Code should contain a dash separator');
  assertEquals(code.length, 13, 'Code should be 13 chars: 4+1+8');
});

Deno.test('registerLocalCode stores a code', () => {
  clearLocalStore();
  registerLocalCode('USER-ABCD1234', 'owner_1');
  const stats = getLocalCodeStats('USER-ABCD1234');
  assertEquals(stats?.uses, 0);
  assertEquals(stats?.creditsAwarded, 0);
});

Deno.test('processReferralLocal: happy path', () => {
  clearLocalStore();
  registerLocalCode('TEST-CODE01', 'owner_1');

  const result = processReferralLocal('TEST-CODE01', 'new_user_1');
  assertEquals(result.status, 'ok');
  assertEquals(result.creditsAwarded, 5);
  assertEquals(result.ownerId, 'owner_1');

  const stats = getLocalCodeStats('TEST-CODE01');
  assertEquals(stats?.uses, 1);
  assertEquals(stats?.creditsAwarded, 5);
});

Deno.test('processReferralLocal: duplicate prevention', () => {
  clearLocalStore();
  registerLocalCode('DUP-TEST', 'owner_2');

  // First use — should succeed
  const first = processReferralLocal('DUP-TEST', 'user_b');
  assertEquals(first.status, 'ok');

  // Second use — should be blocked
  const second = processReferralLocal('DUP-TEST', 'user_b');
  assertEquals(second.status, 'already_processed');

  // Stats should still be 1 use
  const stats = getLocalCodeStats('DUP-TEST');
  assertEquals(stats?.uses, 1);
});

Deno.test('processReferralLocal: invalid code', () => {
  clearLocalStore();
  const result = processReferralLocal('INVALID-CODE', 'any_user');
  assertEquals(result.status, 'invalid_code');
});

Deno.test('processReferralLocal: multiple distinct users can use same code', () => {
  clearLocalStore();
  registerLocalCode('MULTI-CODE', 'owner_3');

  const user1 = processReferralLocal('MULTI-CODE', 'user_x');
  assertEquals(user1.status, 'ok');

  const user2 = processReferralLocal('MULTI-CODE', 'user_y');
  assertEquals(user2.status, 'ok');

  const stats = getLocalCodeStats('MULTI-CODE');
  assertEquals(stats?.uses, 2);
  assertEquals(stats?.creditsAwarded, 10); // 5 credits * 2
});
