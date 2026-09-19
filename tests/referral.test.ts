import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  createMemoryReferralStore,
  process_referral,
  REFERRAL_CREDITS,
} from '../src/growth/referral.ts';

Deno.test('happy path awards credits and logs event', () => {
  const store = createMemoryReferralStore([
    { code: 'ABC12345', owner_id: 'user-a', uses: 0, credits_awarded: 0 },
  ]);
  const result = process_referral(store, 'ABC12345', 'user-b');
  assertEquals(result.status, 'ok');
  assertEquals(result.credits_awarded, REFERRAL_CREDITS);
  assertEquals(store.codes.get('ABC12345')!.credits_awarded, REFERRAL_CREDITS);
  assertEquals(store.codes.get('ABC12345')!.uses, 1);
  assertEquals(store.events[0].event_type, 'referral_conversion');
  assertEquals(store.notifications.length, 2);
});

Deno.test('duplicate referral is idempotent', () => {
  const store = createMemoryReferralStore([
    { code: 'ABC12345', owner_id: 'user-a', uses: 0, credits_awarded: 0 },
  ]);
  process_referral(store, 'ABC12345', 'user-b');
  const second = process_referral(store, 'ABC12345', 'user-b');
  assertEquals(second.status, 'already_processed');
  assertEquals(store.codes.get('ABC12345')!.uses, 1);
  assertEquals(store.codes.get('ABC12345')!.credits_awarded, REFERRAL_CREDITS);
});

Deno.test('invalid code rejected', () => {
  const store = createMemoryReferralStore([]);
  assertEquals(process_referral(store, 'NOPE', 'user-b').status, 'invalid_code');
});

Deno.test('self-referral rejected', () => {
  const store = createMemoryReferralStore([
    { code: 'ABC12345', owner_id: 'user-a', uses: 0, credits_awarded: 0 },
  ]);
  assertEquals(process_referral(store, 'ABC12345', 'user-a').status, 'self_referral');
});
