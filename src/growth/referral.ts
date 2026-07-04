/**
 * Referral Reward Loop - Issue #2
 * Awards 5 free credits per successful referral conversion.
 */

export interface ReferralCode {
  code: string;
  ownerId: string;
  uses: number;
  creditsAwarded: number;
}

export interface ReferralConversion {
  referralCode: string;
  newUserUserId: string;
  convertedAt: string;
}

export function processReferral(
  refCode: string,
  newUserId: string,
  existingCodes: ReferralCode[],
  existingConversions: ReferralConversion[]
): { status: string; creditsAwarded?: number; ownerId?: string; error?: string } {
  const existingConversion = existingConversions.find(
    c => c.referralCode === refCode && c.newUserUserId === newUserId
  );
  if (existingConversion) {
    return { status: 'already_processed' };
  }

  const codeEntry = existingCodes.find(c => c.code === refCode);
  if (!codeEntry) {
    return { status: 'invalid_code', error: 'Referral code not found' };
  }

  const credits = 5;
  return {
    status: 'ok',
    creditsAwarded: credits,
    ownerId: codeEntry.ownerId
  };
}
