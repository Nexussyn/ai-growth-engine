export const REFERRAL_CREDIT_AWARD = 5;

export type ReferralStatus =
  | 'ok'
  | 'invalid_code'
  | 'already_processed'
  | 'self_referral';

export interface ReferralCodeRecord {
  code: string;
  owner_id: string;
}

export interface ReferralProcessResult {
  status: ReferralStatus;
  owner_id?: string;
  new_user_id?: string;
  credits_awarded?: number;
}

export interface ReferralRepository {
  findReferralCode(code: string): Promise<ReferralCodeRecord | null>;
  hasReferralConversion(code: string, newUserId: string): Promise<boolean>;
  recordReferralConversion(code: string, newUserId: string): Promise<void>;
  addReferralCredits(ownerId: string, credits: number): Promise<void>;
  logSystemEvent(eventType: string, payload: Record<string, unknown>): Promise<void>;
  notifyUser?(userId: string, message: string, metadata: Record<string, unknown>): Promise<void>;
}

function normalizeReferralCode(referralCode: string): string {
  return referralCode.trim().toUpperCase();
}

function assertNonEmpty(value: string, name: string): void {
  if (!value.trim()) {
    throw new RangeError(`${name} is required`);
  }
}

export async function process_referral(
  repository: ReferralRepository,
  referralCode: string,
  newUserId: string,
): Promise<ReferralProcessResult> {
  assertNonEmpty(referralCode, 'referralCode');
  assertNonEmpty(newUserId, 'newUserId');

  const code = normalizeReferralCode(referralCode);
  const record = await repository.findReferralCode(code);

  if (!record) {
    return { status: 'invalid_code', new_user_id: newUserId };
  }

  if (record.owner_id === newUserId) {
    return { status: 'self_referral', owner_id: record.owner_id, new_user_id: newUserId };
  }

  if (await repository.hasReferralConversion(code, newUserId)) {
    return {
      status: 'already_processed',
      owner_id: record.owner_id,
      new_user_id: newUserId,
    };
  }

  await repository.recordReferralConversion(code, newUserId);
  await repository.addReferralCredits(record.owner_id, REFERRAL_CREDIT_AWARD);
  await repository.logSystemEvent('referral_conversion', {
    referral_code: code,
    owner_id: record.owner_id,
    new_user_id: newUserId,
    credits_awarded: REFERRAL_CREDIT_AWARD,
  });

  if (repository.notifyUser) {
    await repository.notifyUser(record.owner_id, 'Referral converted: 5 credits added.', {
      referral_code: code,
      new_user_id: newUserId,
      credits_awarded: REFERRAL_CREDIT_AWARD,
    });
    await repository.notifyUser(newUserId, 'Referral accepted. Your first paid call unlocked a reward.', {
      referral_code: code,
      referrer_id: record.owner_id,
    });
  }

  return {
    status: 'ok',
    owner_id: record.owner_id,
    new_user_id: newUserId,
    credits_awarded: REFERRAL_CREDIT_AWARD,
  };
}

export const processReferral = process_referral;
