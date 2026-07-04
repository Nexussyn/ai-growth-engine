import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { processReferral } from '../src/growth/referral.ts';

Deno.test('processReferral awards 5 credits on valid referral', () => {
  const codes = [{ code: 'ABC12345', ownerId: 'user1', uses: 0, creditsAwarded: 0 }];
  const conversions = [];
  const result = processReferral('ABC12345', 'user2', codes, conversions);
  assertEquals(result.status, 'ok');
  assertEquals(result.creditsAwarded, 5);
  assertEquals(result.ownerId, 'user1');
});

Deno.test('processReferral returns already_processed for duplicate', () => {
  const codes = [{ code: 'ABC12345', ownerId: 'user1', uses: 0, creditsAwarded: 0 }];
  const conversions = [{ referralCode: 'ABC12345', newUserUserId: 'user2', convertedAt: '2026-07-04' }];
  const result = processReferral('ABC12345', 'user2', codes, conversions);
  assertEquals(result.status, 'already_processed');
});

Deno.test('processReferral returns invalid_code for bad code', () => {
  const codes = [];
  const conversions = [];
  const result = processReferral('BADCODE', 'user2', codes, conversions);
  assertEquals(result.status, 'invalid_code');
});
