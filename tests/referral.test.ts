import { assertEquals, assertMatch, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { generateCode, isValidCode, calculateReward, formatResult } from '../src/growth/referral.ts';

Deno.test('generateCode produces 8-char alphanumeric string', () => {
  const code = generateCode();
  assertEquals(code.length, 8);
  assertMatch(code, /^[A-Z2-9]{8}$/);
});

Deno.test('generateCode produces unique codes', () => {
  const codes = new Set(Array.from({ length: 100 }, () => generateCode()));
  assertEquals(codes.size, 100, 'All 100 codes should be unique');
});

Deno.test('isValidCode accepts valid format', () => {
  assert(isValidCode('ABC2DEF3'));
  assert(isValidCode('XYZ98765'));
});

Deno.test('isValidCode rejects invalid formats', () => {
  assertEquals(isValidCode('abc12345'), false);  // lowercase
  assertEquals(isValidCode('ABC'), false);        // too short
  assertEquals(isValidCode('ABCDEFGHI'), false);  // too long
  assertEquals(isValidCode('ABCDEFO0'), false);   // contains O and 0
  assertEquals(isValidCode(''), false);           // empty
});

Deno.test('calculateReward: standard tier (0-9 referrals)', () => {
  assertEquals(calculateReward(0), 5);
  assertEquals(calculateReward(5), 5);
  assertEquals(calculateReward(9), 5);
});

Deno.test('calculateReward: premium tier (10-49 referrals)', () => {
  assertEquals(calculateReward(10), 10);
  assertEquals(calculateReward(25), 10);
  assertEquals(calculateReward(49), 10);
});

Deno.test('calculateReward: VIP tier (50+ referrals)', () => {
  assertEquals(calculateReward(50), 15);
  assertEquals(calculateReward(100), 15);
});

Deno.test('formatResult: ok status', () => {
  const result = formatResult({ status: 'ok', credits_awarded: 5, owner_id: 'user_123' });
  assertEquals(result.status, 'ok');
  assertEquals(result.credits_awarded, 5);
  assertEquals(result.owner_id, 'user_123');
});

Deno.test('formatResult: error status', () => {
  const result = formatResult({ status: 'error', error: 'Database connection failed' });
  assertEquals(result.status, 'error');
  assertEquals(result.error, 'Database connection failed');
});

Deno.test('formatResult: already_processed is idempotent', () => {
  const result = formatResult({ status: 'already_processed' });
  assertEquals(result.status, 'already_processed');
});
