/**
 * Referral System — Issue #2
 * Client-side logic for the referral reward loop.
 * Calls the Supabase Edge Function that wraps process_referral().
 */

export interface ReferralResult {
  status: 'ok' | 'already_processed' | 'invalid_code';
  creditsAwarded?: number;
  message?: string;
}

const SUPABASE_FN_URL = Deno.env.get('SUPABASE_FN_URL') ?? 'https://kjtirbnxxymeumycrhqv.supabase.co/functions/v1';

/**
 * Generates a unique referral code for a user.
 */
export function generateReferralCode(userId: string): string {
  const hash = Array.from(userId).reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0);
  const hex = Math.abs(hash).toString(36).slice(0, 6).toUpperCase();
  return `NX-${hex}`;
}

/**
 * Processes a referral: validates code, awards credits, logs event.
 * Calls the backend process_referral function.
 */
export async function processReferral(
  code: string,
  newUserId: string,
): Promise<ReferralResult> {
  const res = await fetch(`${SUPABASE_FN_URL}/process-referral`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, new_user_id: newUserId }),
  });

  if (!res.ok) {
    throw new Error(`Referral processing failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    status: data.status,
    creditsAwarded: data.credits_awarded,
    message: data.status === 'ok'
      ? `You earned ${data.credits_awarded} free credits!`
      : data.status === 'already_processed'
        ? 'This referral has already been used.'
        : 'Invalid referral code.',
  };
}

/**
 * Returns the user's referral code.
 */
export async function getReferralCode(userId: string): Promise<string> {
  const res = await fetch(`${SUPABASE_FN_URL}/get-referral-code?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to fetch referral code');
  const data = await res.json();
  return data.code ?? generateReferralCode(userId);
}
