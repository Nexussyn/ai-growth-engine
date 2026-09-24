export const REFERRAL_CREDIT_REWARD = 5;

export type ReferralStatus =
  | 'ok'
  | 'invalid_code'
  | 'already_processed'
  | 'self_referral';

export interface ReferralCode {
  code: string;
  ownerId: string;
}

export interface ReferralStore {
  transaction<T>(fn: (tx: ReferralStore) => Promise<T>): Promise<T>;
  getReferralCode(code: string): Promise<ReferralCode | null>;
  createConversion(code: string, newUserId: string): Promise<boolean>;
  addCredits(userId: string, credits: number): Promise<void>;
  incrementReferralStats(code: string, credits: number): Promise<void>;
  logEvent(type: string, payload: Record<string, unknown>): Promise<void>;
  notify(
    userId: string,
    kind: string,
    message: string,
    referralCode: string,
  ): Promise<void>;
}

export interface ReferralResult {
  status: ReferralStatus;
  creditsAwarded?: number;
  ownerId?: string;
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${field} is required`);
  return normalized;
}
export async function processReferral(
  referralCode: string,
  newUserId: string,
  store: ReferralStore,
): Promise<ReferralResult> {
  const code = required(referralCode, 'referralCode');
  const userId = required(newUserId, 'newUserId');

  return store.transaction(async (tx) => {
    const referral = await tx.getReferralCode(code);
    if (!referral) return { status: 'invalid_code' };

    if (referral.ownerId === userId) {
      return { status: 'self_referral' };
    }

    // This must be an atomic insert backed by a UNIQUE(code, user) constraint.
    // A pre-check alone is race-prone when two paid-call callbacks arrive together.
    const created = await tx.createConversion(code, userId);
    if (!created) return { status: 'already_processed' };
    await tx.addCredits(referral.ownerId, REFERRAL_CREDIT_REWARD);
    await tx.incrementReferralStats(code, REFERRAL_CREDIT_REWARD);

    await tx.logEvent('referral_conversion', {
      code,
      owner_id: referral.ownerId,
      new_user_id: userId,
      credits: REFERRAL_CREDIT_REWARD,
    });

    await tx.notify(
      referral.ownerId,
      'referral_reward',
      `Referral converted: +${REFERRAL_CREDIT_REWARD} free credits`,
      code,
    );
    await tx.notify(
      userId,
      'referral_conversion',
      'Your first paid call completed a referral conversion.',
      code,
    );

    return {
      status: 'ok',
      creditsAwarded: REFERRAL_CREDIT_REWARD,
      ownerId: referral.ownerId,
    };
  });
}
