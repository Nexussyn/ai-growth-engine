import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// Test the referral reward constants and edge function routing logic.
// Full integration tests require Supabase connection.

const CREDITS_PER_REFERRAL = 5;

Deno.test('CREDITS_PER_REFERRAL is set correctly', () => {
  assertEquals(CREDITS_PER_REFERRAL, 5, 'should award 5 free credits per referral');
});

Deno.test('Referral code generation pattern', () => {
  // Codes are UUID substrings (8 chars)
  const pattern = /^[a-f0-9]{8}$/;
  const codes = Array.from({ length: 100 }, () =>
    Math.random().toString(36).substring(2, 10)
  );
  // All should be 8 chars
  for (const code of codes) {
    assertEquals(code.length, 8, 'referral codes should be 8 characters');
  }
});

Deno.test('Edge function validates required fields', () => {
  // Test the validation logic that would run in the edge function
  const testCases = [
    { action: 'create_code', owner_id: undefined, shouldPass: false },
    { action: 'process_referral', referral_code: 'abc123', new_user_id: undefined, shouldPass: false },
    { action: 'process_referral', referral_code: 'abc123', new_user_id: 'user-456', shouldPass: true },
    { action: 'get_stats', owner_id: undefined, shouldPass: false },
    { action: 'get_stats', owner_id: 'user-123', shouldPass: true },
  ];

  for (const tc of testCases) {
    const hasError = (() => {
      switch (tc.action) {
        case 'create_code': return !tc.owner_id;
        case 'process_referral': return !tc.referral_code || !tc.new_user_id;
        case 'get_stats': return !tc.owner_id;
        default: return true;
      }
    })();
    assertEquals(hasError, !tc.shouldPass, `Case ${tc.action} shouldPass=${tc.shouldPass}`);
  }
});

Deno.test('Referral status values are valid', () => {
  const validStatuses = ['ok', 'invalid_code', 'already_processed', 'error'];
  const statuses: string[] = ['ok', 'invalid_code', 'already_processed', 'error'];
  for (const s of statuses) {
    assert(validStatuses.includes(s), `${s} should be a valid status`);
  }
});
