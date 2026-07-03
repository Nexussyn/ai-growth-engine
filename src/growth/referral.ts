/**
 * Referral Reward Loop — Issue #2
 * Generates unique referral links/codes, tracks signups from referrals,
 * rewards referrer with free calls, and tracks conversion metrics.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

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

export interface ProcessReferralResult {
  status: 'ok' | 'already_processed' | 'invalid_code';
  credits_awarded?: number;
  owner_id?: string;
}

export interface ReferralMetrics {
  total_codes: number;
  total_conversions: number;
  total_credits_awarded: number;
  conversion_rate: number;
  top_referrers: Array<{
    owner_id: string;
    conversions: number;
    credits_earned: number;
  }>;
}

/**
 * Generate a unique referral code for a user.
 * Creates a referral_codes record and returns the generated code.
 */
export async function generateReferralCode(ownerId: string): Promise<ReferralCode> {
  // Check if user already has a code
  const { data: existing } = await db
    .from('referral_codes')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (existing) {
    return existing as ReferralCode;
  }

  // Generate new code
  const { data, error } = await db
    .from('referral_codes')
    .insert({
      owner_id: ownerId,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create referral code: ${error.message}`);
  return data as ReferralCode;
}

/**
 * Get a user's referral link URL.
 */
export function getReferralLink(code: string, baseUrl = 'https://ai-growth.vercel.app'): string {
  return `${baseUrl}/signup?ref=${code}`;
}

/**
 * Process a referral when a new user signs up using a referral code.
 * Awards 5 free credits to the referrer.
 * Idempotent — same referral code + new_user_id pair can only be processed once.
 */
export async function processReferral(
  referralCode: string,
  newUserId: string
): Promise<ProcessReferralResult> {
  const CREDITS_PER_REFERRAL = 5;

  // Idempotency check — same referral can't be used twice by same user
  const { data: existing } = await db
    .from('referral_conversions')
    .select('id')
    .eq('referral_code', referralCode)
    .eq('new_user_id', newUserId)
    .maybeSingle();

  if (existing) {
    return { status: 'already_processed' };
  }

  // Look up the referral code
  const { data: codeRecord, error: codeError } = await db
    .from('referral_codes')
    .select('owner_id')
    .eq('code', referralCode)
    .maybeSingle();

  if (codeError) throw new Error(`Database error: ${codeError.message}`);
  if (!codeRecord) {
    return { status: 'invalid_code' };
  }

  const ownerId = codeRecord.owner_id;

  // Log conversion
  const { error: conversionError } = await db
    .from('referral_conversions')
    .insert({
      referral_code: referralCode,
      new_user_id: newUserId,
    });

  if (conversionError) throw new Error(`Failed to log conversion: ${conversionError.message}`);

  // Award credits to referrer
  const { error: updateError } = await db
    .from('referral_codes')
    .update({
      uses: db.rpc('increment', { x: 1 }),
      credits_awarded: db.rpc('increment', { x: CREDITS_PER_REFERRAL }),
    })
    .eq('code', referralCode);

  if (updateError) throw new Error(`Failed to award credits: ${updateError.message}`);

  // Log event in system_events
  const { error: eventError } = await db
    .from('system_events')
    .insert({
      event_type: 'referral_conversion',
      payload: {
        code: referralCode,
        new_user: newUserId,
        credits: CREDITS_PER_REFERRAL,
      },
    });

  if (eventError) throw new Error(`Failed to log event: ${eventError.message}`);

  return {
    status: 'ok',
    credits_awarded: CREDITS_PER_REFERRAL,
    owner_id: ownerId,
  };
}

/**
 * Get referral metrics for the entire system.
 */
export async function getReferralMetrics(): Promise<ReferralMetrics> {
  const { data: codes, error: codesError } = await db
    .from('referral_codes')
    .select('*');

  if (codesError) throw new Error(`Failed to fetch codes: ${codesError.message}`);

  const { data: conversions, error: convError } = await db
    .from('referral_conversions')
    .select('*');

  if (convError) throw new Error(`Failed to fetch conversions: ${convError.message}`);

  const totalCodes = (codes ?? []).length;
  const totalConversions = (conversions ?? []).length;
  const totalCreditsAwarded = (codes ?? []).reduce(
    (sum, c: ReferralCode) => sum + c.credits_awarded,
    0
  );

  // Calculate top referrers
  const referrerMap = new Map<string, { conversions: number; credits_earned: number }>();
  for (const conv of conversions ?? []) {
    const codeRecord = (codes ?? []).find(
      (c: ReferralCode) => c.code === conv.referral_code
    );
    if (codeRecord) {
      const existing = referrerMap.get(codeRecord.owner_id) ?? {
        conversions: 0,
        credits_earned: 0,
      };
      existing.conversions += 1;
      existing.credits_earned += 5; // 5 credits per conversion
      referrerMap.set(codeRecord.owner_id, existing);
    }
  }

  const topReferrers = Array.from(referrerMap.entries())
    .map(([owner_id, data]) => ({ owner_id, ...data }))
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 10);

  return {
    total_codes: totalCodes,
    total_conversions: totalConversions,
    total_credits_awarded: totalCreditsAwarded,
    conversion_rate: totalCodes > 0 ? totalConversions / totalCodes : 0,
    top_referrers: topReferrers,
  };
}

// Edge Function entry point
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const { action, ...params } = await req.json();

    switch (action) {
      case 'generate_code': {
        const { owner_id } = params;
        if (!owner_id) {
          return new Response(JSON.stringify({ error: 'owner_id required' }), { status: 400 });
        }
        const code = await generateReferralCode(owner_id);
        return new Response(
          JSON.stringify({
            ok: true,
            referral_code: code,
            referral_link: getReferralLink(code.code),
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      case 'process_referral': {
        const { code, new_user_id } = params;
        if (!code || !new_user_id) {
          return new Response(
            JSON.stringify({ error: 'code and new_user_id required' }),
            { status: 400 }
          );
        }
        const result = await processReferral(code, new_user_id);
        return new Response(JSON.stringify({ ok: true, result }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'get_metrics': {
        const metrics = await getReferralMetrics();
        return new Response(JSON.stringify({ ok: true, metrics }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
        });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});