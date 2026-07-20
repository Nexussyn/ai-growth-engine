/**
 * Referral reward loop (issue #2).
 * User A refers B → B first paid call → A gets +5 free credits (once).
 */

export const REFERRAL_CREDITS = 5;

export interface ReferralCode {
  code: string;
  ownerId: string;
  uses: number;
  creditsAwarded: number;
}

export interface ProcessReferralInput {
  referralCode: string;
  newUserId: string;
  /** True when new user completed first paid call */
  firstPaidCall: boolean;
  /** Existing code record if any */
  codeRecord: ReferralCode | null;
  /** True if this newUserId already redeemed any referral */
  alreadyRedeemedByUser: boolean;
  /** True if this (code, newUserId) pair already processed */
  alreadyRedeemedPair: boolean;
}

export type ProcessReferralResult =
  | {
      ok: true;
      creditsGranted: number;
      event: { type: 'referral_conversion'; referrerId: string; refereeId: string; code: string; credits: number };
    }
  | { ok: false; reason: string };

export function generateReferralCode(ownerId: string, salt = ''): string {
  const base = `${ownerId}${salt}`.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'user';
  return `REF-${base.toUpperCase().slice(0, 10)}`;
}

/**
 * Pure process_referral: awards credits only after first paid call, once per user.
 */
export function processReferral(input: ProcessReferralInput): ProcessReferralResult {
  const code = input.referralCode.trim().toUpperCase();
  if (!code) return { ok: false, reason: 'empty_code' };
  if (!input.newUserId) return { ok: false, reason: 'missing_user' };
  if (!input.codeRecord || input.codeRecord.code.toUpperCase() !== code) {
    return { ok: false, reason: 'unknown_code' };
  }
  if (input.codeRecord.ownerId === input.newUserId) {
    return { ok: false, reason: 'self_referral' };
  }
  if (input.alreadyRedeemedByUser || input.alreadyRedeemedPair) {
    return { ok: false, reason: 'already_redeemed' };
  }
  if (!input.firstPaidCall) {
    return { ok: false, reason: 'awaiting_first_paid_call' };
  }

  return {
    ok: true,
    creditsGranted: REFERRAL_CREDITS,
    event: {
      type: 'referral_conversion',
      referrerId: input.codeRecord.ownerId,
      refereeId: input.newUserId,
      code,
      credits: REFERRAL_CREDITS,
    },
  };
}

export function applyCredits(balance: number, grant: number): number {
  return Math.max(0, balance) + Math.max(0, grant);
}
