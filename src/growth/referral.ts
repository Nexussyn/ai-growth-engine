import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export interface ReferralResult {
  status: 'ok' | 'already_processed' | 'invalid_code';
  credits_awarded?: number;
  owner_id?: string;
}

/**
 * Processes a referral conversion.
 * Awards 5 free credits to the referrer on successful conversion of a new user.
 */
export async function processReferral(
  db: SupabaseClient,
  referralCode: string,
  newUserId: string
): Promise<ReferralResult> {
  try {
    // 1. Idempotency check: see if this new user has already been referred under this code
    const { data: existingConversion } = await db
      .from('referral_conversions')
      .select('id')
      .eq('referral_code', referralCode)
      .eq('new_user_id', newUserId)
      .maybeSingle();

    if (existingConversion) {
      return { status: 'already_processed' };
    }

    // 2. Fetch the owner_id of the referral code
    const { data: referralInfo } = await db
      .from('referral_codes')
      .select('owner_id, credits_awarded, uses')
      .eq('code', referralCode)
      .maybeSingle();

    if (!referralInfo) {
      return { status: 'invalid_code' };
    }

    // 3. Log the conversion
    await db
      .from('referral_conversions')
      .insert({
        referral_code: referralCode,
        new_user_id: newUserId
      });

    // 4. Award credits (credits = 5)
    const credits = 5;
    await db
      .from('referral_codes')
      .update({
        uses: (referralInfo.uses || 0) + 1,
        credits_awarded: (referralInfo.credits_awarded || 0) + credits
      })
      .eq('code', referralCode);

    // 5. Log event in system_events
    await db
      .from('system_events')
      .insert({
        event_type: 'referral_conversion',
        payload: {
          code: referralCode,
          new_user: newUserId,
          credits: credits
        }
      });

    return {
      status: 'ok',
      credits_awarded: credits,
      owner_id: referralInfo.owner_id
    };
  } catch (_e) {
    return { status: 'invalid_code' };
  }
}
