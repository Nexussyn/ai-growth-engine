import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  REFERRAL_CREDITS,
  processReferral,
  applyCredits,
  generateReferralCode,
} from '../src/growth/referral.ts';

const codeRec = { code: 'REF-ALICE', ownerId: 'alice', uses: 0, creditsAwarded: 0 };

Deno.test('happy path: first paid call awards 5 credits', () => {
  const r = processReferral({
    referralCode: 'REF-ALICE',
    newUserId: 'bob',
    firstPaidCall: true,
    codeRecord: codeRec,
    alreadyRedeemedByUser: false,
    alreadyRedeemedPair: false,
  });
  assertEquals(r.ok, true);
  if (r.ok) {
    assertEquals(r.creditsGranted, REFERRAL_CREDITS);
    assertEquals(r.event.type, 'referral_conversion');
    assertEquals(r.event.referrerId, 'alice');
  }
});

Deno.test('idempotent: same user cannot redeem twice', () => {
  const r = processReferral({
    referralCode: 'REF-ALICE',
    newUserId: 'bob',
    firstPaidCall: true,
    codeRecord: codeRec,
    alreadyRedeemedByUser: true,
    alreadyRedeemedPair: false,
  });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.reason, 'already_redeemed');
});

Deno.test('blocks before first paid call', () => {
  const r = processReferral({
    referralCode: 'REF-ALICE',
    newUserId: 'bob',
    firstPaidCall: false,
    codeRecord: codeRec,
    alreadyRedeemedByUser: false,
    alreadyRedeemedPair: false,
  });
  assertEquals(r.ok, false);
});

Deno.test('blocks self-referral', () => {
  const r = processReferral({
    referralCode: 'REF-ALICE',
    newUserId: 'alice',
    firstPaidCall: true,
    codeRecord: codeRec,
    alreadyRedeemedByUser: false,
    alreadyRedeemedPair: false,
  });
  assertEquals(r.ok, false);
});

Deno.test('applyCredits adds grant', () => {
  assertEquals(applyCredits(2, 5), 7);
});

Deno.test('generateReferralCode is stable-ish prefix', () => {
  const c = generateReferralCode('alice-1');
  assertEquals(c.startsWith('REF-'), true);
});
