/**
 * Referral Reward Loop Engine — Issue #2
 * Implements referral reward loop awarding free credits on conversion.
 */

export interface ReferralConversion {
  referralCode: string;
  newUserId: string;
  convertedAt: Date;
}

export interface ReferralCodeRecord {
  id?: string;
  code: string;
  ownerId: string;
  uses: number;
  creditsAwarded: number;
  createdAt: Date;
}

export interface SystemEvent {
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface ReferralResult {
  status: 'ok' | 'already_processed' | 'invalid_code';
  creditsAwarded?: number;
  ownerId?: string;
  message?: string;
}

export interface ReferralStore {
  codes: Map<string, ReferralCodeRecord>;
  conversions: Set<string>; // key: ${code}:
  events: SystemEvent[];
}

/**
 * Creates an in-memory referral store for execution/testing.
 */
export function createReferralStore(): ReferralStore {
  return {
    codes: new Map(),
    conversions: new Set(),
    events: []
  };
}

/**
 * Registers a new referral code for an owner.
 */
export function registerReferralCode(
  store: ReferralStore,
  code: string,
  ownerId: string
): ReferralCodeRecord {
  const record: ReferralCodeRecord = {
    code,
    ownerId,
    uses: 0,
    creditsAwarded: 0,
    createdAt: new Date()
  };
  store.codes.set(code, record);
  return record;
}

/**
 * Generates an 8-character alphanumeric referral code for a user.
 */
export function generateReferralCode(ownerId: string): string {
  const raw = ${ownerId}--;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8).toUpperCase();
  return REF-;
}

/**
 * Processes a referral conversion.
 * - Idempotent: same (referralCode, newUserId) can't convert twice
 * - Adds credits (default 5) to referrer's balance
 * - Logs 'referral_conversion' event
 */
export function processReferral(
  referralCode: string,
  newUserId: string,
  store: ReferralStore,
  creditsPerReferral = 5
): ReferralResult {
  const key = ${referralCode}:;
  if (store.conversions.has(key)) {
    return { status: 'already_processed', message: 'Referral already converted for this user' };
  }

  const codeRecord = store.codes.get(referralCode);
  if (!codeRecord) {
    return { status: 'invalid_code', message: 'Referral code not found' };
  }

  // Prevent self-referral
  if (codeRecord.ownerId === newUserId) {
    return { status: 'invalid_code', message: 'Self-referral is not permitted' };
  }

  // Record conversion
  store.conversions.add(key);
  codeRecord.uses += 1;
  codeRecord.creditsAwarded += creditsPerReferral;

  // Log system event
  store.events.push({
    eventType: 'referral_conversion',
    payload: {
      code: referralCode,
      newUserId,
      credits: creditsPerReferral,
      ownerId: codeRecord.ownerId
    },
    createdAt: new Date()
  });

  return {
    status: 'ok',
    creditsAwarded: creditsPerReferral,
    ownerId: codeRecord.ownerId
  };
}

/**
 * Alias conforming to snake_case schema naming in acceptance criteria.
 */
export const process_referral = processReferral;
