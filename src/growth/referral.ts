/**
 * Referral Engine
 * Handles processing of referrals and awarding credits.
 */

interface DBClient {
  query(sql: string, params?: any[]): Promise<any>;
}

export class ReferralSystem {
  private db: DBClient;

  constructor(db: DBClient) {
    this.db = db;
  }

  /**
   * Processes a referral conversion.
   * Called when User B (new_user_id) makes their first paid call.
   */
  async process_referral(referral_code: string, new_user_id: string): Promise<boolean> {
    try {
      // 1. Check if referral code exists
      const codeRes = await this.db.query(
        'SELECT owner_id FROM referral_codes WHERE code = $1',
        [referral_code]
      );
      
      if (!codeRes || codeRes.length === 0) {
        throw new Error('Invalid referral code');
      }
      
      const owner_id = codeRes[0].owner_id;

      // 2. Prevent self-referral
      if (owner_id === new_user_id) {
        throw new Error('Self-referral not allowed');
      }

      // 3. Ensure idempotency (record use of code)
      // If new_user_id already exists in referral_uses, this will throw uniquely constraint error
      await this.db.query(
        'INSERT INTO referral_uses (code, new_user_id, processed) VALUES ($1, $2, TRUE)',
        [referral_code, new_user_id]
      );

      // 4. Update referral code stats
      await this.db.query(
        'UPDATE referral_codes SET uses = uses + 1, credits_awarded = credits_awarded + 5 WHERE code = $1',
        [referral_code]
      );

      // 5. Add 5 credits to owner
      await this.db.query(
        'UPDATE users SET credits = credits + 5 WHERE id = $1',
        [owner_id]
      );

      // 6. Log system event
      await this.db.query(
        'INSERT INTO system_events (type, user_id, details) VALUES ($1, $2, $3)',
        ['referral_conversion', owner_id, JSON.stringify({ referred_user: new_user_id, credits: 5 })]
      );

      return true;
    } catch (error: any) {
      // Idempotency or other errors
      console.error(`Referral processing failed: ${error.message}`);
      return false;
    }
  }
}
