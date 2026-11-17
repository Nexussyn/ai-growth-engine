// deno-lint-ignore no-import-prefix
import { assertEquals, assertRejects, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  createReferralCode,
  createReferralStore,
  getReferralCode,
  getSystemEvents,
  getUserCredits,
  getUserNotifications,
  process_referral,
  processReferralRpc,
  recordFirstPaidCall,
  REFERRAL_REWARD_CREDITS,
  registerReferredSignup,
  resetDefaultReferralStore,
} from '../src/growth/referral.ts';

Deno.test('Happy path: process_referral awards 5 credits, logs event, and notifies both users', () => {
  const store = createReferralStore();
  const codeRec = createReferralCode('user-a', 'GROWTH20', store);
  assertEquals(codeRec.code, 'GROWTH20');
  assertEquals(codeRec.uses, 0);
  assertEquals(codeRec.credits_awarded, 0);

  const result = process_referral('GROWTH20', 'user-b', { store });
  assertEquals(result.status, 'ok');
  assertEquals(result.credits_awarded, REFERRAL_REWARD_CREDITS);
  assertEquals(result.credits_awarded, 5);
  assertEquals(result.owner_id, 'user-a');
  assertEquals(result.referrer_balance, 5);

  // Credits added to referrer balance
  assertEquals(getUserCredits('user-a', store), 5);
  assertEquals(getUserCredits('user-b', store), 0);

  // Referral code counters updated
  const updatedCode = getReferralCode('GROWTH20', store);
  assertEquals(updatedCode?.uses, 1);
  assertEquals(updatedCode?.credits_awarded, 5);

  // Event logged in system_events with type referral_conversion
  const events = getSystemEvents(store);
  assertEquals(events.length, 1);
  assertEquals(events[0].event_type, 'referral_conversion');
  assertEquals(events[0].payload, {
    code: 'GROWTH20',
    referrer_id: 'user-a',
    new_user: 'user-b',
    credits: 5,
  });

  // Both users receive a notification
  const referrerNotes = getUserNotifications('user-a', store);
  const refereeNotes = getUserNotifications('user-b', store);
  assertEquals(referrerNotes.length, 1);
  assertEquals(referrerNotes[0].notification_type, 'referral_reward');
  assertEquals(refereeNotes.length, 1);
  assertEquals(refereeNotes[0].notification_type, 'referral_welcome');
});

Deno.test('Idempotency: duplicate referral by same user is blocked with zero extra credits', () => {
  const store = createReferralStore();
  createReferralCode('user-a', 'DUPTEST1', store);

  const first = process_referral('DUPTEST1', 'user-b', { store });
  assertEquals(first.status, 'ok');
  assertEquals(getUserCredits('user-a', store), 5);

  const second = process_referral('DUPTEST1', 'user-b', { store });
  assertEquals(second.status, 'already_processed');
  assertEquals(second.credits_awarded, undefined);

  // State remains unchanged after duplicate call
  assertEquals(getUserCredits('user-a', store), 5);
  assertEquals(getReferralCode('DUPTEST1', store)?.uses, 1);
  assertEquals(getReferralCode('DUPTEST1', store)?.credits_awarded, 5);
  assertEquals(getSystemEvents(store).length, 1);
  assertEquals(getUserNotifications('user-a', store).length, 1);
  assertEquals(getUserNotifications('user-b', store).length, 1);
});

Deno.test('Multiple distinct referrals accumulate credits on referrer balance', () => {
  const store = createReferralStore();
  const generated = createReferralCode('user-a', undefined, store);
  assertEquals(generated.code.length, 8);

  assertEquals(process_referral(generated.code, 'user-1', { store }).status, 'ok');
  assertEquals(process_referral(generated.code, 'user-2', { store }).status, 'ok');
  assertEquals(process_referral(generated.code, 'user-3', { store }).status, 'ok');

  assertEquals(getUserCredits('user-a', store), 15);
  assertEquals(getReferralCode(generated.code, store)?.uses, 3);
  assertEquals(getReferralCode(generated.code, store)?.credits_awarded, 15);
  assertEquals(getSystemEvents(store).length, 3);
});

Deno.test('Validation guards: invalid code, blank input, and self-referral are rejected', () => {
  const store = createReferralStore();
  createReferralCode('user-a', 'SELFCHK1', store);

  assertEquals(process_referral('UNKNOWN9', 'user-b', { store }).status, 'invalid_code');
  assertEquals(process_referral('', 'user-b', { store }).status, 'invalid_input');
  assertEquals(process_referral('SELFCHK1', '   ', { store }).status, 'invalid_input');
  assertEquals(process_referral('SELFCHK1', 'user-a', { store }).status, 'self_referral');

  assertEquals(getUserCredits('user-a', store), 0);
  assertEquals(getSystemEvents(store).length, 0);

  assertThrows(() => createReferralCode('   ', 'BADOWNER', store));
  assertThrows(() => createReferralCode('user-a', 'SELFCHK1', store));
});

Deno.test('First paid call lifecycle: signup holds referral until first paid call then stays idempotent', () => {
  resetDefaultReferralStore();
  createReferralCode('referrer-1', 'FIRSTPAID');

  // Before first paid call, strict mode defers conversion
  const premature = process_referral('FIRSTPAID', 'signup-user', {
    requireFirstPaidCall: true,
  });
  assertEquals(premature.status, 'awaiting_first_paid_call');
  assertEquals(getUserCredits('referrer-1'), 0);

  // Register signup and trigger first paid call
  assertEquals(registerReferredSignup('FIRSTPAID', 'signup-user'), true);
  const firstPaid = recordFirstPaidCall('signup-user');
  assertEquals(firstPaid?.status, 'ok');
  assertEquals(getUserCredits('referrer-1'), 5);

  // Subsequent paid calls do not re-trigger conversion
  const secondPaid = recordFirstPaidCall('signup-user', 'FIRSTPAID');
  assertEquals(secondPaid?.status, 'already_processed');
  assertEquals(getUserCredits('referrer-1'), 5);
  resetDefaultReferralStore();
});

Deno.test('Supabase RPC adapter forwards parameters and surfaces RPC errors cleanly', async () => {
  const okClient = {
    rpc(fn: string, params: Record<string, unknown>) {
      assertEquals(fn, 'process_referral');
      assertEquals(params, { p_code: 'RPC2026', p_new_user_id: 'user-z' });
      return Promise.resolve({
        data: {
          status: 'ok' as const,
          credits_awarded: 5,
          owner_id: 'owner-x',
          referrer_balance: 10,
        },
        error: null,
      });
    },
  };

  const res = await processReferralRpc(okClient, ' RPC2026 ', ' user-z ');
  assertEquals(res.status, 'ok');
  assertEquals(res.referrer_balance, 10);

  const errClient = {
    rpc() {
      return Promise.resolve({
        data: null,
        error: { message: 'connection refused' },
      });
    },
  };

  await assertRejects(
    () => processReferralRpc(errClient, 'RPC2026', 'user-z'),
    Error,
    'process_referral RPC failed: connection refused',
  );
});
