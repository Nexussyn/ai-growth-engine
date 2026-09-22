import { assertEquals, assertThrows, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  parseReferralReply,
  validateReferralInput,
  processReferral,
  MalformedReferralReplyError,
  type ReferralResult,
} from '../src/growth/referral.ts';

// ---- parseReferralReply: valid shapes ----

Deno.test('parseReferralReply: ok reply', () => {
  const result = parseReferralReply({ status: 'ok', reason: null, credits_awarded: 5, owner_id: 'user-A' });
  assertEquals(result, { status: 'ok', reason: null, creditsAwarded: 5, ownerId: 'user-A' });
});

Deno.test('parseReferralReply: denied reply carries typed reason', () => {
  const result = parseReferralReply({ status: 'denied', reason: 'UNPAID' });
  assertEquals(result, { status: 'denied', reason: 'UNPAID', creditsAwarded: null, ownerId: null });
});

Deno.test('parseReferralReply: self-referral denial', () => {
  const result = parseReferralReply({ status: 'denied', reason: 'SELF_REFERRAL' });
  assertEquals(result.reason, 'SELF_REFERRAL');
});

Deno.test('parseReferralReply: already_processed (same-code duplicate)', () => {
  const result = parseReferralReply({ status: 'already_processed', reason: 'DUPLICATE_CODE' });
  assertEquals(result, { status: 'already_processed', reason: 'DUPLICATE_CODE', creditsAwarded: null, ownerId: null });
});

Deno.test('parseReferralReply: cross-code duplicate denial', () => {
  const result = parseReferralReply({ status: 'denied', reason: 'DUPLICATE_PAIR' });
  assertEquals(result.reason, 'DUPLICATE_PAIR');
});

// ---- parseReferralReply: malformed replies ----

Deno.test('parseReferralReply: rejects non-object reply', () => {
  assertThrows(() => parseReferralReply('ok'), MalformedReferralReplyError);
  assertThrows(() => parseReferralReply(null), MalformedReferralReplyError);
  assertThrows(() => parseReferralReply([1, 2, 3]), MalformedReferralReplyError);
  assertThrows(() => parseReferralReply(undefined), MalformedReferralReplyError);
});

Deno.test('parseReferralReply: rejects missing status', () => {
  assertThrows(() => parseReferralReply({ reason: 'UNPAID' }), MalformedReferralReplyError);
});

Deno.test('parseReferralReply: rejects unknown status value', () => {
  assertThrows(() => parseReferralReply({ status: 'success' }), MalformedReferralReplyError);
});

Deno.test('parseReferralReply: rejects unknown reason value', () => {
  assertThrows(() => parseReferralReply({ status: 'denied', reason: 'BECAUSE_I_SAID_SO' }), MalformedReferralReplyError);
});

Deno.test('parseReferralReply: rejects "ok" status carrying a denial reason', () => {
  assertThrows(
    () => parseReferralReply({ status: 'ok', reason: 'UNPAID', credits_awarded: 5, owner_id: 'user-A' }),
    MalformedReferralReplyError,
  );
});

Deno.test('parseReferralReply: rejects denial status missing a reason', () => {
  assertThrows(() => parseReferralReply({ status: 'denied' }), MalformedReferralReplyError);
});

Deno.test('parseReferralReply: rejects "ok" status missing credits_awarded', () => {
  assertThrows(() => parseReferralReply({ status: 'ok', reason: null, owner_id: 'user-A' }), MalformedReferralReplyError);
});

Deno.test('parseReferralReply: rejects "ok" status missing owner_id', () => {
  assertThrows(() => parseReferralReply({ status: 'ok', reason: null, credits_awarded: 5 }), MalformedReferralReplyError);
});

Deno.test('parseReferralReply: rejects non-numeric credits_awarded', () => {
  assertThrows(
    () => parseReferralReply({ status: 'ok', reason: null, credits_awarded: '5', owner_id: 'user-A' }),
    MalformedReferralReplyError,
  );
});

// ---- validateReferralInput ----

Deno.test('validateReferralInput: accepts non-empty strings', () => {
  assertEquals(validateReferralInput('CODE1', 'user-B'), null);
});

Deno.test('validateReferralInput: rejects empty code', () => {
  assertEquals(validateReferralInput('', 'user-B'), 'INVALID_INPUT');
  assertEquals(validateReferralInput('   ', 'user-B'), 'INVALID_INPUT');
});

Deno.test('validateReferralInput: rejects empty new user id', () => {
  assertEquals(validateReferralInput('CODE1', ''), 'INVALID_INPUT');
});

Deno.test('validateReferralInput: rejects non-string inputs', () => {
  assertEquals(validateReferralInput(null, 'user-B'), 'INVALID_INPUT');
  assertEquals(validateReferralInput('CODE1', undefined), 'INVALID_INPUT');
  assertEquals(validateReferralInput(123, 'user-B'), 'INVALID_INPUT');
});

// ---- processReferral: wiring, using a fake Supabase client ----

function fakeDb(rpcResult: { data?: unknown; error?: { message: string } | null }) {
  let called: { fn: string; args: unknown } | null = null;
  const db = {
    rpc(fn: string, args: unknown) {
      called = { fn, args };
      return Promise.resolve({ data: rpcResult.data ?? null, error: rpcResult.error ?? null });
    },
  };
  return { db: db as unknown as Parameters<typeof processReferral>[0], getCalled: () => called };
}

Deno.test('processReferral: short-circuits invalid input without calling the RPC', async () => {
  const { db, getCalled } = fakeDb({ data: { status: 'ok', reason: null, credits_awarded: 5, owner_id: 'x' } });
  const result = await processReferral(db, '', 'user-B');
  assertEquals(result, { status: 'denied', reason: 'INVALID_INPUT', creditsAwarded: null, ownerId: null });
  assertEquals(getCalled(), null);
});

Deno.test('processReferral: happy path parses a valid RPC reply', async () => {
  const { db } = fakeDb({ data: { status: 'ok', reason: null, credits_awarded: 5, owner_id: 'user-A' } });
  const result: ReferralResult = await processReferral(db, 'CODE1', 'user-B');
  assertEquals(result, { status: 'ok', reason: null, creditsAwarded: 5, ownerId: 'user-A' });
});

Deno.test('processReferral: passes idempotency key through to the RPC call', async () => {
  const { db, getCalled } = fakeDb({ data: { status: 'ok', reason: null, credits_awarded: 5, owner_id: 'user-A' } });
  await processReferral(db, 'CODE1', 'user-B', { idempotencyKey: 'retry-key-1' });
  const called = getCalled() as { fn: string; args: Record<string, unknown> };
  assertEquals(called.fn, 'process_referral');
  assertEquals(called.args.p_idempotency_key, 'retry-key-1');
});

Deno.test('processReferral: throws on RPC-level error', async () => {
  const { db } = fakeDb({ error: { message: 'connection reset' } });
  await assertRejects(() => processReferral(db, 'CODE1', 'user-B'), Error, 'connection reset');
});

Deno.test('processReferral: throws MalformedReferralReplyError on a garbage RPC reply', async () => {
  const { db } = fakeDb({ data: 'not-json' });
  await assertRejects(() => processReferral(db, 'CODE1', 'user-B'), MalformedReferralReplyError);
});
