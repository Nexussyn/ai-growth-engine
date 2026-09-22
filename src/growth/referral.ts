/**
 * Referral credit RPC wrapper — Issue #2
 * Thin, validated wrapper around the process_referral() SQL function
 * (migrations/add_referral_credits.sql). Validates caller inputs before
 * spending a round-trip, and validates the RPC reply shape before trusting
 * it, so a malformed/partial reply surfaces as a typed error instead of
 * silently propagating undefined fields into billing logic.
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export type ReferralDenialReason =
  | 'INVALID_INPUT'
  | 'INVALID_CODE'
  | 'SELF_REFERRAL'
  | 'UNPAID'
  | 'DUPLICATE_CODE'
  | 'DUPLICATE_PAIR';

export type ReferralStatus = 'ok' | 'denied' | 'already_processed';

export interface ReferralResult {
  status: ReferralStatus;
  reason: ReferralDenialReason | null;
  creditsAwarded: number | null;
  ownerId: string | null;
}

const VALID_STATUSES: readonly ReferralStatus[] = ['ok', 'denied', 'already_processed'];
const VALID_REASONS: readonly ReferralDenialReason[] = [
  'INVALID_INPUT',
  'INVALID_CODE',
  'SELF_REFERRAL',
  'UNPAID',
  'DUPLICATE_CODE',
  'DUPLICATE_PAIR',
];

export class MalformedReferralReplyError extends Error {
  raw: unknown;
  constructor(detail: string, raw: unknown) {
    super(`process_referral returned a malformed reply: ${detail}`);
    this.name = 'MalformedReferralReplyError';
    this.raw = raw;
  }
}

/**
 * Parses and validates the raw JSONB reply from process_referral().
 * Exported standalone so it is unit-testable without a live DB client.
 */
export function parseReferralReply(raw: unknown): ReferralResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new MalformedReferralReplyError('expected a JSON object', raw);
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.status !== 'string' || !VALID_STATUSES.includes(obj.status as ReferralStatus)) {
    throw new MalformedReferralReplyError(`unexpected status ${JSON.stringify(obj.status)}`, raw);
  }
  const status = obj.status as ReferralStatus;

  let reason: ReferralDenialReason | null = null;
  if (obj.reason !== null && obj.reason !== undefined) {
    if (typeof obj.reason !== 'string' || !VALID_REASONS.includes(obj.reason as ReferralDenialReason)) {
      throw new MalformedReferralReplyError(`unexpected reason ${JSON.stringify(obj.reason)}`, raw);
    }
    reason = obj.reason as ReferralDenialReason;
  }

  if (status === 'ok' && reason !== null) {
    throw new MalformedReferralReplyError('status "ok" must not carry a denial reason', raw);
  }
  if (status !== 'ok' && reason === null) {
    throw new MalformedReferralReplyError(`status "${status}" is missing a reason`, raw);
  }

  let creditsAwarded: number | null = null;
  let ownerId: string | null = null;
  if (status === 'ok') {
    if (typeof obj.credits_awarded !== 'number') {
      throw new MalformedReferralReplyError('status "ok" is missing numeric credits_awarded', raw);
    }
    if (typeof obj.owner_id !== 'string') {
      throw new MalformedReferralReplyError('status "ok" is missing owner_id', raw);
    }
    creditsAwarded = obj.credits_awarded;
    ownerId = obj.owner_id;
  }

  return { status, reason, creditsAwarded, ownerId };
}

/** Validates caller inputs before a round-trip that would just be denied server-side. */
export function validateReferralInput(code: unknown, newUserId: unknown): ReferralDenialReason | null {
  if (typeof code !== 'string' || code.trim() === '') return 'INVALID_INPUT';
  if (typeof newUserId !== 'string' || newUserId.trim() === '') return 'INVALID_INPUT';
  return null;
}

export interface ProcessReferralOptions {
  /** Caller-supplied idempotency key. Passing the same key on retry replays the original result instead of re-evaluating. */
  idempotencyKey?: string;
}

export async function processReferral(
  db: SupabaseClient,
  code: string,
  newUserId: string,
  opts: ProcessReferralOptions = {},
): Promise<ReferralResult> {
  const inputError = validateReferralInput(code, newUserId);
  if (inputError) {
    return { status: 'denied', reason: inputError, creditsAwarded: null, ownerId: null };
  }

  const { data, error } = await db.rpc('process_referral', {
    p_code: code,
    p_new_user_id: newUserId,
    p_idempotency_key: opts.idempotencyKey ?? null,
  });

  if (error) {
    throw new Error(`process_referral RPC failed: ${error.message}`);
  }

  return parseReferralReply(data);
}

export function createReferralClient(url: string, serviceKey: string): SupabaseClient {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
