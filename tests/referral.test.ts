/**
 * Referral System Tests — Issue #2
 */

import { assertEquals, assertExists, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { generateReferralCode } from '../src/growth/referral.ts';

Deno.test('generateReferralCode returns a valid format', () => {
  const code = generateReferralCode('user-abc-123');
  assertExists(code);
  assertEquals(code.startsWith('NX-'), true);
  assertEquals(code.length, 9); // "NX-" + 6 chars
});

Deno.test('generateReferralCode is deterministic for same user', () => {
  const code1 = generateReferralCode('user-abc-123');
  const code2 = generateReferralCode('user-abc-123');
  assertEquals(code1, code2);
});

Deno.test('generateReferralCode differs for different users', () => {
  const code1 = generateReferralCode('user-abc-123');
  const code2 = generateReferralCode('user-xyz-789');
  assertEquals(code1 !== code2, true);
});

Deno.test('generateReferralCode handles empty string', () => {
  const code = generateReferralCode('');
  assertExists(code);
  assertEquals(code.startsWith('NX-'), true);
});

Deno.test('generateReferralCode handles special characters', () => {
  const code = generateReferralCode('user@email.com!');
  assertExists(code);
  assertEquals(code.startsWith('NX-'), true);
});

// test the SQL migration's idempotency concept
Deno.test('referral process_referral migration exists', async () => {
  // Verify the SQL migration contains the required elements
  const sql = await Deno.readTextFile('./migrations/add_referral_system.sql');
  assertStringIncludes(sql, 'CREATE TABLE IF NOT EXISTS referral_codes');
  assertStringIncludes(sql, 'CREATE TABLE IF NOT EXISTS referral_conversions');
  assertStringIncludes(sql, 'CREATE OR REPLACE FUNCTION process_referral');
  assertStringIncludes(sql, 'UNIQUE(referral_code, new_user_id)'); // idempotency
  assertStringIncludes(sql, 'referral_conversion'); // event logging
});
