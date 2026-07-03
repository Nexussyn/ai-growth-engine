/**
 * Referral Reward Loop — Issue #2
 * Awards 5 free credits per successful referral conversion.
 * Tracks events in system_events table.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CREDITS_PER_REFERRAL = 5;

export interface ReferralResult {
  status: 'ok' | 'invalid_code' | 'already_processed' | 'error';
  credits_awarded?: number;
  owner_id?: string;
  error?: string;
}

/**
 * Creates a new referral code for a user.
 */
export async function createReferralCode(ownerId: string, customCode?: string): Promise<{ code: string }> {
  const { data, error } = await db
    .from('referral_codes')
    .insert({
      owner_id: ownerId,
      code: customCode, // if not provided, DB default: substring(gen_random_uuid()::text, 1, 8)
    })
    .select('code')
    .single();

  if (error) throw new Error(`Failed to create referral code: ${error.message}`);
  return { code: data.code };
}

/**
 * Processes a referral: validates code, awards credits, logs event.
 * Idempotent — calling with same (code, new_user) twice returns 'already_processed'.
 */
export async function processReferral(referralCode: string, newUserId: string): Promise<ReferralResult> {
  try {
    // Call the PostgreSQL function for transactional safety
    const { data, error } = await db.rpc('process_referral', {
      p_code: referralCode,
      p_new_user_id: newUserId,
    });

    if (error) {
      return { status: 'error', error: error.message };
    }

    const result = data as ReferralResult;
    if (result.status === 'ok') {
      // Send notification to both users
      await sendReferralNotification(referralCode, newUserId, result.owner_id!);
    }

    return result;
  } catch (e) {
    return { status: 'error', error: String(e) };
  }
}

/**
 * Sends in-app notification to both referrer and referee.
 */
async function sendReferralNotification(code: string, newUserId: string, ownerId: string): Promise<void> {
  // Notify referrer
  await db.from('notifications').insert({
    user_id: ownerId,
    type: 'referral_conversion',
    title: 'Referral Reward!',
    body: `A new user joined using your referral code. You earned ${CREDITS_PER_REFERRAL} free credits!`,
  });

  // Notify new user
  await db.from('notifications').insert({
    user_id: newUserId,
    type: 'referral_welcome',
    title: 'Welcome!',
    body: `You were referred with code "${code}". Enjoy ${CREDITS_PER_REFERRAL} bonus credits to start!`,
  });
}

/**
 * Gets referral stats for a user.
 */
export async function getReferralStats(ownerId: string): Promise<{
  totalCodes: number;
  totalUses: number;
  totalCreditsAwarded: number;
}> {
  const { data, error } = await db
    .from('referral_codes')
    .select('uses, credits_awarded')
    .eq('owner_id', ownerId);

  if (error) throw new Error(`Failed to get referral stats: ${error.message}`);

  const totalUses = data.reduce((sum, r) => sum + (r.uses || 0), 0);
  const totalCreditsAwarded = data.reduce((sum, r) => sum + (r.credits_awarded || 0), 0);

  return {
    totalCodes: data.length,
    totalUses,
    totalCreditsAwarded,
  };
}

/**
 * Edge function entry point.
 * POST / with { action, referral_code, new_user_id, owner_id }
 */
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { action, referral_code, new_user_id, owner_id } = await req.json();

    switch (action) {
      case 'create_code': {
        if (!owner_id) {
          return new Response(JSON.stringify({ error: 'owner_id required' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
          });
        }
        const result = await createReferralCode(owner_id);
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      case 'process_referral': {
        if (!referral_code || !new_user_id) {
          return new Response(JSON.stringify({ error: 'referral_code and new_user_id required' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
          });
        }
        const result = await processReferral(referral_code, new_user_id);
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      case 'get_stats': {
        if (!owner_id) {
          return new Response(JSON.stringify({ error: 'owner_id required' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
          });
        }
        const stats = await getReferralStats(owner_id);
        return new Response(JSON.stringify({ ok: true, ...stats }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
});
