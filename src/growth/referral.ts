/**
 * Referral System — Issue #2
 * Implements referral reward loop with idempotent processing
 */

export interface ReferralResult {
  status: 'ok' | 'already_processed' | 'invalid_code';
  credits_awarded?: number;
  owner_id?: string;
}

export interface ReferralCode {
  id: string;
  code: string;
  owner_id: string;
  uses: number;
  credits_awarded: number;
  created_at: string;
}

export interface ReferralConversion {
  id: string;
  referral_code: string;
  new_user_id: string;
  converted_at: string;
}

export function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function createReferralCodeSQL(ownerId: string): { sql: string; code: string } {
  const code = generateReferralCode();
  return {
    sql: `INSERT INTO referral_codes (code, owner_id) VALUES ('${code}', '${ownerId}');`,
    code,
  };
}

export function validateReferralInput(
  referralCode: string,
  newUserId: string,
  existingCodes: ReferralCode[],
  existingConversions: ReferralConversion[]
): { valid: boolean; error?: string } {
  if (!referralCode || referralCode.length !== 8) {
    return { valid: false, error: 'Invalid referral code format' };
  }
  if (!newUserId || newUserId.trim().length === 0) {
    return { valid: false, error: 'New user ID is required' };
  }
  const codeRecord = existingCodes.find(c => c.code === referralCode);
  if (!codeRecord) {
    return { valid: false, error: 'Referral code not found' };
  }
  const alreadyConverted = existingConversions.find(
    c => c.referral_code === referralCode && c.new_user_id === newUserId
  );
  if (alreadyConverted) {
    return { valid: false, error: 'This referral has already been processed for this user' };
  }
  return { valid: true };
}

export function buildReferralNotifications(
  referrerUserId: string,
  newUserId: string,
  creditsAwarded: number
): Array<{ userId: string; type: string; message: string }> {
  return [
    {
      userId: referrerUserId,
      type: 'referral_credit',
      message: `You earned ${creditsAwarded} free credits from a successful referral!`,
    },
    {
      userId: newUserId,
      type: 'referral_welcome',
      message: 'Welcome! You were referred by a friend. Enjoy your first call!',
    },
  ];
}

export function buildReferralEventSQL(
  referralCode: string,
  newUserId: string,
  creditsAwarded: number,
  ownerId: string
): string {
  const payload = JSON.stringify({
    code: referralCode,
    new_user: newUserId,
    credits: creditsAwarded,
    owner_id: ownerId,
  });
  return `INSERT INTO system_events (event_type, payload, created_at)
VALUES ('referral_conversion', '${payload.replace(/'/g, "''")}'::jsonb, NOW());`;
}
