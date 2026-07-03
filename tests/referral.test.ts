import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { generateReferralCode, processReferral, referralStore } from '../src/growth/referral.ts';

Deno.test('Generate referral code', () => {
  const result = generateReferralCode('user-abc');
  assertEquals(typeof result.code, 'string');
  assertEquals(result.code.length, 8);
  assertEquals(result.ownerId, 'user-abc');
});

Deno.test('Process valid referral', () => {
  const code = generateReferralCode('user-referrer');
  const result = processReferral(code.code, 'user-new');
  
  assertEquals(result.status, 'ok');
  assertEquals(result.creditsAwarded, 5);
  assertEquals(result.ownerId, 'user-referrer');
});

Deno.test('Idempotent: same referral code + user cannot be used twice', () => {
  const code = generateReferralCode('user-dup');
  
  const first = processReferral(code.code, 'user-dup-new');
  assertEquals(first.status, 'ok');

  const second = processReferral(code.code, 'user-dup-new');
  assertEquals(second.status, 'already_processed');
});

Deno.test('Invalid referral code', () => {
  const result = processReferral('INVALID', 'user-test');
  assertEquals(result.status, 'invalid_code');
});

Deno.test('Referral code with processedRefs set', () => {
  const code = generateReferralCode('user-referrer2');
  const processed = new Set<string>();
  
  const result = processReferral(code.code, 'user-new2', processed);
  assertEquals(result.status, 'ok');
  assertEquals(processed.size, 1);
});

Deno.test('Happy path: credits awarded correctly', () => {
  const code = generateReferralCode('user-happy');
  
  // First referral
  processReferral(code.code, 'new-user-1');
  const codeEntry = referralStore.getCode(code.code);
  assertEquals(codeEntry?.uses, 1);
  assertEquals(codeEntry?.creditsAwarded, 5);
  
  // Second referral
  processReferral(code.code, 'new-user-2');
  const updatedEntry = referralStore.getCode(code.code);
  assertEquals(updatedEntry?.uses, 2);
  assertEquals(updatedEntry?.creditsAwarded, 10);
});
