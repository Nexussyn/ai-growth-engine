/**
 * Referral Reward Loop — Issue #2
 *
 * Provides programmatic access to the referral system.
 * Wraps the PostgreSQL functions defined in migrations/add_referral_system.sql.
 *
 * Features:
 *  - Create referral codes for users
 *  - Process referrals (idempotent, 5 credits per conversion)
 *  - Check referral stats for an owner
 *  - Validate referral codes
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

export interface ReferralResult {
  status: 'ok' | 'already_processed' | 'invalid_code';
  credits_awarded?: number;
  owner_id?: string;
  error?: string;
}

export interface ReferralStats {
  total_codes: number;
  total_conversions: number;
  total_credits_awarded: number;
  codes: (ReferralCode & { conversions_count: number })[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CREDITS_PER_REFERRAL = 5;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new referral code for the given owner.
 * Returns the generated code and its details.
 */
export async function createReferralCode(ownerId: string): Promise<ReferralCode> {
  if (!ownerId || typeof ownerId !== 'string') {
    throw new Error('ownerId is required and must be a string');
  }

  const { data, error } = await db
    .from('referral_codes')
    .insert({ owner_id: ownerId })
    .select('id, code, owner_id, uses, credits_awarded, created_at')
    .maybeSingle();

  if (error) throw new Error(`Failed to create referral code: ${error.message}`);
  if (!data) throw new Error('Referral code creation returned no data');

  return data as ReferralCode;
}

/**
 * Process a referral: award credits to the referrer when a new user signs up
 * and makes their first paid call.
 *
 * Idempotent — same referral_code + new_user_id pair cannot be used twice.
 */
export async function processReferral(
  referralCode: string,
  newUserId: string,
): Promise<ReferralResult> {
  if (!referralCode || typeof referralCode !== 'string') {
    return { status: 'invalid_code', error: 'referralCode must be a non-empty string' };
  }
  if (!newUserId || typeof newUserId !== 'string') {
    return { status: 'invalid_code', error: 'newUserId must be a non-empty string' };
  }

  // Call the PostgreSQL function via Supabase RPC
  const { data, error } = await db.rpc('process_referral', {
    p_code: referralCode,
    p_new_user_id: newUserId,
  });

  if (error) {
    // Handle known error cases
    if (error.message.includes('referral_codes_code_fkey') || error.message.includes('foreign key')) {
      return { status: 'invalid_code', error: 'Referral code does not exist' };
    }
    throw new Error(`Failed to process referral: ${error.message}`);
  }

  const result = data as ReferralResult;
  return result;
}

/**
 * Get referral statistics for a user (all codes they own and related conversions).
 */
export async function getReferralStats(ownerId: string): Promise<ReferralStats> {
  if (!ownerId || typeof ownerId !== 'string') {
    throw new Error('ownerId is required and must be a string');
  }

  // Fetch all codes owned by this user
  const { data: codes, error: codesError } = await db
    .from('referral_codes')
    .select('id, code, owner_id, uses, credits_awarded, created_at')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (codesError) throw new Error(`Failed to fetch referral codes: ${codesError.message}`);

  const typedCodes = (codes ?? []) as ReferralCode[];

  // Count conversions per code
  const codesWithConversions = await Promise.all(
    typedCodes.map(async (code) => {
      const { count, error: countError } = await db
        .from('referral_conversions')
        .select('*', { count: 'exact', head: true })
        .eq('referral_code', code.code);

      if (countError) throw new Error(`Failed to count conversions: ${countError.message}`);

      return {
        ...code,
        conversions_count: count ?? 0,
      };
    }),
  );

  const totalConversions = codesWithConversions.reduce((sum, c) => sum + c.conversions_count, 0);
  const totalCreditsAwarded = typedCodes.reduce((sum, c) => sum + c.credits_awarded, 0);

  return {
    total_codes: typedCodes.length,
    total_conversions: totalConversions,
    total_credits_awarded: totalCreditsAwarded,
    codes: codesWithConversions,
  };
}

/**
 * Validate that a referral code exists and has not been exhausted.
 * Returns the code's owner if valid, or an error reason.
 */
export async function validateReferralCode(
  code: string,
): Promise<{ valid: boolean; owner_id?: string; reason?: string }> {
  if (!code || typeof code !== 'string') {
    return { valid: false, reason: 'Code must be a non-empty string' };
  }

  const { data, error } = await db
    .from('referral_codes')
    .select('owner_id')
    .eq('code', code)
    .maybeSingle();

  if (error) throw new Error(`Failed to validate referral code: ${error.message}`);

  if (!data) {
    return { valid: false, reason: 'Referral code does not exist' };
  }

  return { valid: true, owner_id: data.owner_id };
}

/**
 * Given a referral code, return the number of credits this code has generated.
 */
export async function getCreditsAwarded(code: string): Promise<number> {
  const { data, error } = await db
    .from('referral_codes')
    .select('credits_awarded')
    .eq('code', code)
    .maybeSingle();

  if (error) throw new Error(`Failed to get credits awarded: ${error.message}`);
  return data?.credits_awarded ?? 0;
}

/**
 * Get all conversions for a specific referral code.
 */
export async function getConversions(
  code: string,
): Promise<ReferralConversion[]> {
  const { data, error } = await db
    .from('referral_conversions')
    .select('id, referral_code, new_user_id, converted_at')
    .eq('referral_code', code)
    .order('converted_at', { ascending: false });

  if (error) throw new Error(`Failed to get conversions: ${error.message}`);
  return (data ?? []) as ReferralConversion[];
}
