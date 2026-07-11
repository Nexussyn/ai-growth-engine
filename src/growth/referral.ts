/**
 * Referral System — Issue #2
 * Handles referral code creation and processing
 */

export interface ReferralCode {
  code: string;
  owner_id: string;
  uses: number;
  credits_awarded: number;
  created_at: string;
}

export interface ReferralResult {
  status: 'ok' | 'already_processed' | 'invalid_code' | 'error';
  credits_awarded?: number;
  owner_id?: string;
  error?: string;
}

/**
 * Generates a random referral code (8 chars, alphanumeric uppercase)
 */
export function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I,O,0,1 to avoid confusion
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Validates a referral code format
 */
export function isValidCode(code: string): boolean {
  return /^[A-Z2-9]{8}$/.test(code);
}

/**
 * Calculates the referral reward based on tier
 * - Standard: 5 credits per referral
 * - Premium:  10 credits per referral (after 10 referrals)
 * - VIP:      15 credits per referral (after 50 referrals)
 */
export function calculateReward(totalReferrals: number): number {
  if (totalReferrals >= 50) return 15;
  if (totalReferrals >= 10) return 10;
  return 5;
}

/**
 * Formats a referral result for API response
 */
export function formatResult(result: ReferralResult): Record<string, unknown> {
  const base: Record<string, unknown> = { status: result.status };
  if (result.credits_awarded !== undefined) base.credits_awarded = result.credits_awarded;
  if (result.owner_id !== undefined) base.owner_id = result.owner_id;
  if (result.error !== undefined) base.error = result.error;
  return base;
}
