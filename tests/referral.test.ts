import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { ReferralEngine } from '../src/growth/referral.ts';

Deno.test('Happy path: valid referral awards 5 credits and records event', () => {
  const engine = new ReferralEngine();
  engine.registerCode('WELCOME5', 'user_alice');

  const result = engine.processReferral('WELCOME5', 'user_bob');
  assertEquals(result.status, 'ok');
  assertEquals(result.creditsAwarded, 5);
  assertEquals(result.ownerId, 'user_alice');

  const codeState = engine.getCode('WELCOME5');
  assertEquals(codeState?.uses, 1);
  assertEquals(codeState?.creditsAwarded, 5);

  assertEquals(engine.events.length, 1);
  assertEquals(engine.events[0].eventType, 'referral_conversion');
  assertEquals(engine.events[0].payload.new_user, 'user_bob');
  assertEquals(engine.events[0].payload.credits, 5);
});

Deno.test('Idempotency: same referral cannot be processed twice for same user', () => {
  const engine = new ReferralEngine();
  engine.registerCode('VIPCODE1', 'user_alice');

  const first = engine.processReferral('VIPCODE1', 'user_bob');
  assertEquals(first.status, 'ok');

  const second = engine.processReferral('VIPCODE1', 'user_bob');
  assertEquals(second.status, 'already_processed');

  // Credits and uses must not double-increment
  const codeState = engine.getCode('VIPCODE1');
  assertEquals(codeState?.uses, 1);
  assertEquals(codeState?.creditsAwarded, 5);
  assertEquals(engine.events.length, 1);
});

Deno.test('Invalid code returns invalid_code status without changes', () => {
  const engine = new ReferralEngine();
  const result = engine.processReferral('NON_EXISTENT', 'user_charlie');
  assertEquals(result.status, 'invalid_code');
  assertEquals(engine.events.length, 0);
});

Deno.test('Prevent self-referral: owner cannot use own code', () => {
  const engine = new ReferralEngine();
  engine.registerCode('ALICE_REF', 'user_alice');

  const result = engine.processReferral('ALICE_REF', 'user_alice');
  assertEquals(result.status, 'cannot_refer_self');
  assertEquals(engine.events.length, 0);
});
