/**
 * Referral Reward Loop — Issue #2
 * Awards 5 free credits to referrer when a referred user makes their first paid call.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

export interface ReferralResult {
  status: 'ok' | 'already_processed' | 'invalid_code';
  credits_awarded: number;
  owner_id: string | null;
  referral_code: string | null;
}

/**
 * Process a referral conversion when user B signs up and makes their first paid call.
 * Idempotent: same referral code + new_user_id cannot be processed twice.
 */
export async function process_referral(referral_code: string, new_user_id: string): Promise<ReferralResult> {
  // Idempotency check: has this referral already been processed?
  const { data: existing, error: checkError } = await db
    .from('referral_conversions')
    .select('id')
    .eq('referral_code', referral_code)
    .eq('new_user_id', new_user_id)
    .maybeSingle();

  if (existing) {
    return {
      status: 'already_processed',
      credits_awarded: 0,
      owner_id: null,
      referral_code: null,
    };
  }

  // Look up the referral code owner
  const { data: codeRow, error: codeError } = await db
    .from('referral_codes')
    .select('owner_id, credits_awarded, uses')
    .eq('code', referral_code)
    .maybeSingle();

  if (!codeRow) {
    return {
      status: 'invalid_code',
      credits_awarded: 0,
      owner_id: null,
      referral_code: null,
    };
  }

  const CREDITS_PER_REFERRAL = 5;

  // Log conversion (prevents race conditions via UNIQUE constraint)
  const { error: insertError } = await db
    .from('referral_conversions')
    .insert({ referral_code, new_user_id });

  if (insertError) {
    // Another process already inserted — treat as already processed
    if (insertError.message?.includes('unique') || insertError.message?.includes('duplicate')) {
      return {
        status: 'already_processed',
        credits_awarded: 0,
        owner_id: null,
        referral_code: null,
      };
    }
    throw new Error(`Failed to log referral conversion: ${insertError.message}`);
  }

  // Award credits to owner
  const { error: updateError } = await db
    .from('referral_codes')
    .update({
      uses: codeRow.uses + 1,
      credits_awarded: codeRow.credits_awarded + CREDITS_PER_REFERRAL,
    })
    .eq('code', referral_code);

  if (updateError) {
    throw new Error(`Failed to award referral credits: ${updateError.message}`);
  }

  // Log event in system_events
  const { error: eventError } = await db
    .from('system_events')
    .insert({
      event_type: 'referral_conversion',
      payload: {
        referral_code,
        new_user: new_user_id,
        credits: CREDITS_PER_REFERRAL,
      },
    });

  if (eventError) {
    // Non-fatal: credits were awarded, but event log failed
    console.error('Failed to log system event:', eventError.message);
  }

  return {
    status: 'ok',
    credits_awarded: CREDITS_PER_REFERRAL,
    owner_id: codeRow.owner_id,
    referral_code,
  };
}

/**
 * Generate a referral code for a user.
 */
export async function create_referral_code(owner_id: string): Promise<string> {
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();

  const { data, error } = await db
    .from('referral_codes')
    .insert({ owner_id })
    .select('code')
    .single();

  if (error) {
    throw new Error(`Failed to create referral code: ${error.message}`);
  }

  return data.code;
}