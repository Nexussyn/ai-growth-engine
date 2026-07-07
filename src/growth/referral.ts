/**
 * Referral Reward Loop — Issue #2
 * Awards 5 free credits per successful referral conversion.
 *
 * When user A refers user B:
 *   1. User B signs up and makes their first paid call
 *   2. User A automatically receives 5 free credits
 *   3. Event is logged in `system_events` with type `referral_conversion`
 *   4. Both users see a notification
 *
 * Idempotent: the same referral code cannot be redeemed twice by the same
 * new user (enforced both at the DB level via a UNIQUE constraint on
 * (referral_code, new_user_id) and explicitly checked in code).
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const REFERRAL_CREDIT_AWARD = 5;

export interface ReferralResult {
  ok: boolean;
  alreadyProcessed: boolean;
  creditsAwarded: number;
  ownerId: string;
}

interface ReferralCodeRow {
  code: string;
  owner_id: string;
  uses: number;
  credits_awarded: number;
}

/**
 * Processes a referral conversion.
 *
 * @param referralCode The referral code used by the new user.
 * @param newUserId The id of the user who just converted (signed up + made first paid call).
 * @param client Optional injected Supabase client (used for testing). Defaults to a
 *               service-role client built from environment variables.
 */
export async function processReferral(
  referralCode: string,
  newUserId: string,
  client?: SupabaseClient
): Promise<ReferralResult> {
  if (!referralCode || !newUserId) {
    throw new Error('referralCode and newUserId are required');
  }

  const db = client ?? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 1. Look up the referral code
  const { data: referral, error: referralError } = await db
    .from('referral_codes')
    .select('code, owner_id, uses, credits_awarded')
    .eq('code', referralCode)
    .maybeSingle();

  if (referralError) throw new Error(`Failed to look up referral code: ${referralError.message}`);
  if (!referral) throw new Error(`Invalid referral code: ${referralCode}`);

  const row = referral as ReferralCodeRow;

  // Prevent self-referral
  if (row.owner_id === newUserId) {
    throw new Error('A user cannot redeem their own referral code');
  }

  // 2. Idempotency check — has this new user already redeemed this code?
  const { data: existingRedemption, error: existingError } = await db
    .from('referral_redemptions')
    .select('id')
    .eq('referral_code', referralCode)
    .eq('new_user_id', newUserId)
    .maybeSingle();

  if (existingError) throw new Error(`Failed to check existing redemption: ${existingError.message}`);

  if (existingRedemption) {
    return {
      ok: true,
      alreadyProcessed: true,
      creditsAwarded: 0,
      ownerId: row.owner_id
    };
  }

  // 3. Record the redemption first to guard against race conditions
  //    (unique constraint on referral_code + new_user_id enforces idempotency at the DB level too).
  const { error: insertRedemptionError } = await db
    .from('referral_redemptions')
    .insert({
      referral_code: referralCode,
      new_user_id: newUserId,
      credits_awarded: REFERRAL_CREDIT_AWARD
    });

  if (insertRedemptionError) {
    // If the unique constraint was violated, treat as already processed (idempotent).
    if (String(insertRedemptionError.message).toLowerCase().includes('unique')) {
      return {
        ok: true,
        alreadyProcessed: true,
        creditsAwarded: 0,
        ownerId: row.owner_id
      };
    }
    throw new Error(`Failed to record referral redemption: ${insertRedemptionError.message}`);
  }

  // 4. Award credits to the referrer
  const { data: existingCredits, error: creditsLookupError } = await db
    .from('user_credits')
    .select('balance')
    .eq('user_id', row.owner_id)
    .maybeSingle();

  if (creditsLookupError) throw new Error(`Failed to look up credits: ${creditsLookupError.message}`);

  const newBalance = (existingCredits?.balance ?? 0) + REFERRAL_CREDIT_AWARD;

  const { error: creditsUpsertError } = await db
    .from('user_credits')
    .upsert({
      user_id: row.owner_id,
      balance: newBalance,
      updated_at: new Date().toISOString()
    });

  if (creditsUpsertError) throw new Error(`Failed to award credits: ${creditsUpsertError.message}`);

  // 5. Update referral_codes stats
  const { error: updateCodeError } = await db
    .from('referral_codes')
    .update({
      uses: row.uses + 1,
      credits_awarded: row.credits_awarded + REFERRAL_CREDIT_AWARD,
      updated_at: new Date().toISOString()
    })
    .eq('code', referralCode);

  if (updateCodeError) throw new Error(`Failed to update referral code stats: ${updateCodeError.message}`);

  // 6. Log the conversion event
  const { error: eventError } = await db
    .from('system_events')
    .insert({
      event_type: 'referral_conversion',
      payload: {
        referral_code: referralCode,
        owner_id: row.owner_id,
        new_user_id: newUserId,
        credits_awarded: REFERRAL_CREDIT_AWARD
      }
    });

  if (eventError) throw new Error(`Failed to log referral_conversion event: ${eventError.message}`);

  // 7. Notify both users
  const { error: notifyError } = await db
    .from('notifications')
    .insert([
      {
        user_id: row.owner_id,
        type: 'referral_conversion',
        message: `You earned ${REFERRAL_CREDIT_AWARD} free credits from a successful referral!`
      },
      {
        user_id: newUserId,
        type: 'referral_welcome',
        message: `Welcome! You signed up using a referral code.`
      }
    ]);

  if (notifyError) throw new Error(`Failed to send notifications: ${notifyError.message}`);

  return {
    ok: true,
    alreadyProcessed: false,
    creditsAwarded: REFERRAL_CREDIT_AWARD,
    ownerId: row.owner_id
  };
}

// Edge Function entry point
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  try {
    const { referral_code, new_user_id } = await req.json();
    if (!referral_code || !new_user_id) {
      return new Response(JSON.stringify({ error: 'referral_code and new_user_id required' }), { status: 400 });
    }
    const result = await processReferral(referral_code, new_user_id);
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
