/**
 * Referral Reward Loop — Issue #2
 *
 * Awards 5 free credits per successful referral conversion.
 * Events are logged in system_events table.
 *
 * Branch: agent/hermes/issue-2
 * Wallet: 0xda23d3678e06351A030d760674619bE0E58757ab
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const CREDITS_PER_REFERRAL = 5;

// ─── Types ───────────────────────────────────────────────────────────

export interface ReferralResult {
  status: 'ok' | 'invalid_code' | 'already_processed' | 'error' | 'self_referral_blocked';
  credits_awarded?: number;
  owner_id?: string;
  error?: string;
}

export interface ReferralCodeInfo {
  code: string;
  uses: number;
  credits_awarded: number;
  created_at: string;
}

export interface ReferralStats {
  codes: ReferralCodeInfo[];
  total_uses: number;
  total_credits_awarded: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Creates a new referral code for a user.
 * If customCode is omitted, the DB generates an 8-char random code.
 */
export async function createReferralCode(
  ownerId: string,
  customCode?: string,
): Promise<{ code: string }> {
  const { data, error } = await db
    .from('referral_codes')
    .insert({
      owner_id: ownerId,
      ...(customCode ? { code: customCode } : {}),
    })
    .select('code')
    .single();

  if (error) {
    throw new Error(`Failed to create referral code: ${error.message}`);
  }
  return { code: data.code };
}

/**
 * Processes a referral via the existing PostgreSQL function.
 * Idempotent — calling with the same (code, new_user) returns 'already_processed'.
 */
export async function processReferral(
  code: string,
  newUserId: string,
): Promise<ReferralResult> {
  try {
    const { data, error } = await db.rpc('process_referral', {
      p_code: code,
      p_new_user_id: newUserId,
    });

    if (error) {
      // Handle known error codes from the DB function
      const msg = error.message.toLowerCase();
      if (msg.includes('self_referral')) {
        return { status: 'self_referral_blocked', error: error.message };
      }
      return { status: 'error', error: error.message };
    }

    return data as ReferralResult;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: 'error', error: msg };
  }
}

/**
 * Returns referral stats for a given owner.
 */
export async function getReferralStats(ownerId: string): Promise<ReferralStats> {
  const { data, error } = await db
    .from('referral_codes')
    .select('code, uses, credits_awarded, created_at')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch referral stats: ${error.message}`);
  }

  const codes = (data ?? []) as ReferralCodeInfo[];
  const total_uses = codes.reduce((sum, c) => sum + c.uses, 0);
  const total_credits_awarded = codes.reduce((sum, c) => sum + c.credits_awarded, 0);

  return { codes, total_uses, total_credits_awarded };
}

/**
 * Returns all referral codes for a user (for display / sharing).
 */
export async function getReferralCodes(ownerId: string): Promise<ReferralCodeInfo[]> {
  const { data, error } = await db
    .from('referral_codes')
    .select('code, uses, credits_awarded, created_at')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch referral codes: ${error.message}`);
  }
  return (data ?? []) as ReferralCodeInfo[];
}