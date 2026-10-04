// Referral reward loop (Issue #2).
//
// When user A refers user B and B signs up + makes their first paid call,
// A gets 5 free credits and both users are notified. This service mirrors
// the `process_referral(p_code, p_new_user_id)` SQL function so the same
// rules hold wherever the conversion is triggered from application code.

export const REFERRAL_CREDIT_REWARD = 5;
export const REFERRAL_CONVERSION_EVENT = 'referral_conversion';

export type ReferralStatus =
  | 'ok'
  | 'already_processed'
  | 'invalid_code'
  | 'self_referral';

export interface ReferralResult {
  status: ReferralStatus;
  ownerId?: string;
  creditsAwarded?: number;
}

// Minimal DB port. A real adapter (postgres client, etc.) implements this;
// tests use the in-memory mock in tests/referral.test.ts.
export interface ReferralDb {
  findCodeOwner(code: string): Promise<string | null>;
  hasConversion(code: string, newUserId: string): Promise<boolean>;
  recordConversion(code: string, newUserId: string): Promise<void>;
  addCredits(userId: string, amount: number): Promise<number>;
  incrementCodeStats(code: string, credits: number): Promise<void>;
  logEvent(eventType: string, payload: Record<string, unknown>): Promise<void>;
}

// Notification port — wire to email/push/etc. in production.
export interface ReferralNotifier {
  notifyReferrer(ownerId: string, creditsAwarded: number, newUserId: string): Promise<void>;
  notifyNewUser(newUserId: string, referrerId: string): Promise<void>;
}

export class ReferralService {
  private readonly db: ReferralDb;
  private readonly notifier: ReferralNotifier;

  constructor(db: ReferralDb, notifier: ReferralNotifier) {
    this.db = db;
    this.notifier = notifier;
  }

  async processReferral(
    referralCode: string,
    newUserId: string,
  ): Promise<ReferralResult> {
    // Idempotency: the same referral can't be used twice by the same user.
    if (await this.db.hasConversion(referralCode, newUserId)) {
      return { status: 'already_processed' };
    }

    const ownerId = await this.db.findCodeOwner(referralCode);
    if (ownerId === null) {
      return { status: 'invalid_code' };
    }

    // A user can't earn credits for referring themselves.
    if (ownerId === newUserId) {
      return { status: 'self_referral' };
    }

    // Record first — the unique (code, new_user) pair is the backstop
    // against double-processing across concurrent callers.
    await this.db.recordConversion(referralCode, newUserId);

    // Award the referrer's balance (creates the row if this is their
    // first credit).
    await this.db.addCredits(ownerId, REFERRAL_CREDIT_REWARD);

    // Roll up per-code stats.
    await this.db.incrementCodeStats(referralCode, REFERRAL_CREDIT_REWARD);

    // Log the conversion event.
    await this.db.logEvent(REFERRAL_CONVERSION_EVENT, {
      code: referralCode,
      owner_id: ownerId,
      new_user: newUserId,
      credits: REFERRAL_CREDIT_REWARD,
    });

    // Notify both users.
    await this.notifier.notifyReferrer(ownerId, REFERRAL_CREDIT_REWARD, newUserId);
    await this.notifier.notifyNewUser(newUserId, ownerId);

    return {
      status: 'ok',
      ownerId,
      creditsAwarded: REFERRAL_CREDIT_REWARD,
    };
  }

  // Create a fresh referral code row for a user. `persist` is supplied by
  // the adapter (INSERT INTO referral_codes ...).
  async createReferralCode(
    ownerId: string,
    persist: (code: string, ownerId: string) => Promise<void>,
  ): Promise<string> {
    const code = ReferralService.generateCode();
    await persist(code, ownerId);
    return code;
  }

  static generateCode(length = 8): string {
    const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'; // no 0/o/1/l/i
    let code = '';
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (const b of bytes) code += alphabet[b % alphabet.length];
    return code;
  }
}
