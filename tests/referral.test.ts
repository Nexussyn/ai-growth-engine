/**
 * Tests for Referral Reward Loop — Issue #2
 *
 * Covers:
 * - process_referral: happy path, invalid code, self-referral, duplicate
 * - createReferralCode: new code creation
 * - getReferralStats: stats aggregation
 */

import { assertEquals, assertExists, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  createReferralCode,
  processReferral,
  getReferralStats,
  getReferralCodes,
} from '../src/growth/referral.ts';

// ─── mocks ───────────────────────────────────────────────────────────

const MOCK_OWNER = 'user_test_owner_001';
const MOCK_NEW_USER = 'user_test_new_002';
const MOCK_CODE = 'TESTCODE';
const INVALID_CODE = 'NONEXISTENT';

// ─── Helper to set up a fresh referral code ──────────────────────────

async function setupReferralCode(ownerId: string, code?: string): Promise<string> {
  const result = await createReferralCode(ownerId, code);
  return result.code;
}

// ─── Tests ───────────────────────────────────────────────────────────

Deno.test('createReferralCode — creates a code and returns it', async () => {
  const code = await setupReferralCode(MOCK_OWNER, MOCK_CODE);
  assertEquals(code, MOCK_CODE);
});

Deno.test('createReferralCode — generates a random code when not specified', async () => {
  const result = await createReferralCode('user_random_owner');
  assertExists(result.code);
  assertEquals(result.code.length, 8, 'auto-generated code should be 8 chars');
});

Deno.test('processReferral — happy path: awards credits', async () => {
  const code = await setupReferralCode(MOCK_OWNER, 'HAPPY01');
  const result = await processReferral(code, MOCK_NEW_USER);
  assertEquals(result.status, 'ok');
  assertEquals(result.credits_awarded, 5);
});

Deno.test('processReferral — invalid code returns error', async () => {
  const result = await processReferral(INVALID_CODE, MOCK_NEW_USER);
  assertEquals(result.status, 'invalid_code');
});

Deno.test('processReferral — self-referral is blocked', async () => {
  const code = await setupReferralCode('user_self_ref', 'SELF001');
  const result = await processReferral(code, 'user_self_ref');
  assertEquals(result.status, 'self_referral_blocked');
});

Deno.test('processReferral — duplicate referral returns already_processed', async () => {
  const code = await setupReferralCode(MOCK_OWNER, 'DUP001');
  // First call should succeed
  const first = await processReferral(code, 'user_dup_target');
  assertEquals(first.status, 'ok');

  // Second call should be idempotent
  const second = await processReferral(code, 'user_dup_target');
  assertEquals(second.status, 'already_processed');
});

Deno.test('getReferralCodes — returns codes for a user', async () => {
  const codes = await getReferralCodes(MOCK_OWNER);
  assertExists(codes);
  // Should have at least the ones we created
  const codeStrings = codes.map((c) => c.code);
  assertStringIncludes(codeStrings.join(','), MOCK_CODE);
});

Deno.test('getReferralStats — aggregates correctly', async () => {
  // Create a dedicated owner for isolated stats test
  const statsOwner = 'user_stats_owner';
  await setupReferralCode(statsOwner, 'STATS01');

  const stats = await getReferralStats(statsOwner);
  assertExists(stats);
  assertEquals(stats.total_uses, 0);
  assertEquals(stats.total_credits_awarded, 0);
  assertExists(stats.codes);
});