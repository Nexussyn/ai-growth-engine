/**
 * Referral Reward Loop — Issue #2
 * Runtime TypeScript handler for referral code creation and processing.
 */

export interface ReferralCode {
  code: string;
  ownerId: string;
  uses: number;
  creditsAwarded: number;
  createdAt: string;
}

export interface ReferralResult {
  status: 'ok' | 'already_processed' | 'invalid_code' | 'error';
  creditsAwarded?: number;
  ownerId?: string;
  error?: string;
}

const REFERRAL_CREDITS = 5;

/**
 * Generate a unique referral code for a user.
 */
export function generateReferralCode(ownerId: string): string {
  const random = crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();
  return `${ownerId.substring(0, 4).toUpperCase()}-${random}`;
}

/**
 * Process a referral: validate code, prevent duplicates, award credits.
 * This is the runtime equivalent of the SQL process_referral function.
 * In production, this calls the Supabase edge function which runs the SQL.
 */
export async function processReferral(
  code: string,
  newUserId: string,
  supabaseUrl: string,
  serviceKey: string
): Promise<ReferralResult> {
  try {
    // In production, this would call the backend function
    // For now, we simulate the Supabase edge function call
    const response = await fetch(`${supabaseUrl}/functions/v1/process-referral`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ referral_code: code, new_user_id: newUserId }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { status: 'error', error: err };
    }

    return await response.json();
  } catch (e) {
    // Fallback: direct computation for testing / offline use
    return processReferralLocal(code, newUserId);
  }
}

// In-memory store for local testing
const localReferrals = new Map<string, Set<string>>();
const localCodes = new Map<string, { ownerId: string; uses: number; creditsAwarded: number }>();

/**
 * Local/offline version of process_referral for testing.
 */
export function processReferralLocal(
  code: string,
  newUserId: string
): ReferralResult {
  // Check if code exists
  if (!localCodes.has(code)) {
    return { status: 'invalid_code' };
  }

  const codeData = localCodes.get(code)!;

  // Idempotency check
  if (!localReferrals.has(code)) {
    localReferrals.set(code, new Set());
  }

  if (localReferrals.get(code)!.has(newUserId)) {
    return { status: 'already_processed' };
  }

  // Record conversion
  localReferrals.get(code)!.add(newUserId);
  codeData.uses += 1;
  codeData.creditsAwarded += REFERRAL_CREDITS;

  return {
    status: 'ok',
    creditsAwarded: REFERRAL_CREDITS,
    ownerId: codeData.ownerId,
  };
}

/**
 * Register a referral code in the local store (for testing).
 */
export function registerLocalCode(code: string, ownerId: string): void {
  localCodes.set(code, { ownerId, uses: 0, creditsAwarded: 0 });
  localReferrals.set(code, new Set());
}

/**
 * Get stats for a referral code (local).
 */
export function getLocalCodeStats(code: string): { uses: number; creditsAwarded: number } | null {
  const data = localCodes.get(code);
  if (!data) return null;
  return { uses: data.uses, creditsAwarded: data.creditsAwarded };
}

/**
 * Clear local referral store (for test isolation).
 */
export function clearLocalStore(): void {
  localCodes.clear();
  localReferrals.clear();
}
