export const REFERRAL_CREDITS = 5;

export interface ReferralStore {
  findCode(code: string): Promise<{ ownerId: string } | null>;
  conversionExists(code: string, newUserId: string): Promise<boolean>;
  addCredits(userId: string, credits: number): Promise<void>;
  recordConversion(input: {
    code: string;
    newUserId: string;
    referrerId: string;
    credits: number;
  }): Promise<void>;
  incrementCodeUsage(code: string, credits: number): Promise<void>;
  recordEvent(input: {
    type: 'referral_conversion';
    referrerId: string;
    newUserId: string;
    code: string;
  }): Promise<void>;
}

export interface ReferralResult {
  converted: boolean;
  creditsAwarded: number;
  referrerId?: string;
}

/** Award exactly once for a new user/code pair. Store operations should run in one DB transaction. */
export async function processReferral(
  referralCode: string,
  newUserId: string,
  store: ReferralStore,
): Promise<ReferralResult> {
  const code = referralCode.trim();
  if (!code || !newUserId.trim()) return { converted: false, creditsAwarded: 0 };

  const referral = await store.findCode(code);
  if (!referral || referral.ownerId === newUserId) {
    return { converted: false, creditsAwarded: 0 };
  }
  if (await store.conversionExists(code, newUserId)) {
    return { converted: false, creditsAwarded: 0, referrerId: referral.ownerId };
  }

  await store.addCredits(referral.ownerId, REFERRAL_CREDITS);
  await store.recordConversion({
    code,
    newUserId,
    referrerId: referral.ownerId,
    credits: REFERRAL_CREDITS,
  });
  await store.incrementCodeUsage(code, REFERRAL_CREDITS);
  await store.recordEvent({
    type: 'referral_conversion',
    referrerId: referral.ownerId,
    newUserId,
    code,
  });
  return {
    converted: true,
    creditsAwarded: REFERRAL_CREDITS,
    referrerId: referral.ownerId,
  };
}
