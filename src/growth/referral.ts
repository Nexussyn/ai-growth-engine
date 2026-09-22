import { supabase } from '../db';

/**
 * Process a referral conversion.
 *
 * @param referralCode - The referral code used by the new user.
 * @param newUserId - The ID of the user who signed up using the referral code.
 *
 * @throws Error if the referral code is invalid or if any database operation fails.
 *
 * This function is idempotent: if the same referral code has already been used,
 * it will not award credits again.
 */
export async function process_referral(referralCode: string, newUserId: string): Promise<void> {
  // 1. Retrieve the referral code record
  const { data: codeRow, error: codeErr } = await supabase
    .from('referral_codes')
    .select('owner_id, uses')
    .eq('code', referralCode)
    .single();

  if (codeErr || !codeRow) {
    throw new Error(`Referral code "${referralCode}" not found`);
  }

  // 2. Idempotency check: if the code has already been used, exit early
  if (codeRow.uses > 0) {
    return;
  }

  const referrerId = codeRow.owner_id;

  // 3. Retrieve the referrer's current credit balance
  const { data: referrerRow, error: referrerErr } = await supabase
    .from('users')
    .select('credits')
    .eq('id', referrerId)
    .single();

  if (referrerErr || !referrerRow) {
    throw new Error(`Referrer with ID "${referrerId}" not found`);
  }

  const newCredits = (referrerRow.credits ?? 0) + 5;

  // 4. Update the referrer's credit balance
  const { error: updateErr } = await supabase
    .from('users')
    .update({ credits: newCredits })
    .eq('id', referrerId)
    .execute();

  if (updateErr) {
    throw new Error(`Failed to update credits for referrer "${referrerId}": ${updateErr.message}`);
  }

  // 5. Log the referral conversion event
  const eventPayload = {
    referrer_id: referrerId,
    new_user_id: newUserId,
    referral_code: referralCode,
    credits_awarded: 5,
  };

  const { error: insertErr } = await supabase
    .from('system_events')
    .insert([{ type: 'referral_conversion', payload: eventPayload }])
    .execute();

  if (insertErr) {
    throw new Error(`Failed to log referral event: ${insertErr.message}`);
  }

  // 6. Increment the usage count for the referral code
  const newUses = (codeRow.uses ?? 0) + 1;
  const { error: usesErr } = await supabase
    .from('referral_codes')
    .update({ uses: newUses })
    .eq('code', referralCode)
    .execute();

  if (usesErr) {
    throw new Error(`Failed to increment uses for referral code "${referralCode}": ${usesErr.message}`);
  }
}
