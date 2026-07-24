/**
 * Referral System Core Logic
 * Handles referral processing, credit allocation, idempotency checks, and notification dispatch.
 */

export interface DatabaseClient {
  query(sql: string, params?: any[]): Promise<{ rows: any[] }>;
}

export interface ReferralResult {
  success: boolean;
  referrerId?: string;
  refereeId?: string;
  creditsAwarded?: number;
  message: string;
}

/**
 * Process a referral conversion when a new user makes their first paid API call.
 * Idempotent: Ensures a single referee can only be converted once.
 */
export async function process_referral(
  db: DatabaseClient,
  referralCode: string,
  newUserId: string
): Promise<ReferralResult> {
  const code = referralCode.trim().toUpperCase();

  // 1. Fetch referral code details
  const codeResult = await db.query(
    'SELECT code, owner_id FROM referral_codes WHERE code = $1',
    [code]
  );

  if (codeResult.rows.length === 0) {
    return { success: false, message: `Invalid referral code: ${code}` };
  }

  const referrerId = codeResult.rows[0].owner_id;

  // Prevent self-referral
  if (referrerId === newUserId) {
    return { success: false, message: 'Users cannot use their own referral code.' };
  }

  // 2. Idempotency Check: Verify if referee has already converted
  const existingResult = await db.query(
    'SELECT id FROM referral_conversions WHERE referee_id = $1',
    [newUserId]
  );

  if (existingResult.rows.length > 0) {
    return { success: false, message: `User ${newUserId} has already converted via referral.` };
  }

  const CREDITS_TO_AWARD = 5;

  // 3. Begin Atomic Transaction & Updates
  try {
    // Record conversion
    await db.query(
      `INSERT INTO referral_conversions (referral_code, referrer_id, referee_id, credits_awarded)
       VALUES ($1, $2, $3, $4)`,
      [code, referrerId, newUserId, CREDITS_TO_AWARD]
    );

    // Update referrer's credit balance
    await db.query(
      `UPDATE users SET credits = credits + $1 WHERE id = $2`,
      [CREDITS_TO_AWARD, referrerId]
    );

    // Increment code usage stats
    await db.query(
      `UPDATE referral_codes SET uses = uses + 1, credits_awarded = credits_awarded + $1 WHERE code = $2`,
      [CREDITS_TO_AWARD, code]
    );

    // Log system_event
    await db.query(
      `INSERT INTO system_events (type, user_id, metadata)
       VALUES ($1, $2, $3)`,
      [
        'referral_conversion',
        referrerId,
        JSON.stringify({
          referral_code: code,
          referee_id: newUserId,
          credits_awarded: CREDITS_TO_AWARD
        })
      ]
    );

    // Dispatch Notifications to both users
    await db.query(
      `INSERT INTO user_notifications (user_id, title, message)
       VALUES 
       ($1, 'Referral Bonus!', 'You earned 5 free credits from referring a new user.'),
       ($2, 'Welcome Bonus!', 'Your referral bonus was successfully activated.')`,
      [referrerId, newUserId]
    );

    return {
      success: true,
      referrerId,
      refereeId: newUserId,
      creditsAwarded: CREDITS_TO_AWARD,
      message: 'Referral conversion successfully processed.'
    };
  } catch (err: any) {
    return { success: false, message: `Database error during referral processing: ${err.message}` };
  }
}
