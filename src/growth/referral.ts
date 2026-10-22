/**
 * Referral Reward Loop — Issue #2
 * Awards 5 free credits per verified referral conversion, logs `referral_conversion`
 * in `system_events`, and generates notifications for both referrer and referred user.
 */

export const REFERRAL_REWARD_CREDITS = 5;
export const REFERRAL_EVENT_TYPE = 'referral_conversion';

export type ReferralStatus =
  | 'ok'
  | 'already_processed'
  | 'invalid_code'
  | 'self_referral'
  | 'invalid_input';

export interface ReferralCodeRecord {
  code: string;
  owner_id: string;
  uses: number;
  credits_awarded: number;
  created_at: string;
}

export interface SystemEventRecord {
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ReferralNotifications {
  referrer: string;
  referee: string;
}

export interface ReferralResult {
  status: ReferralStatus;
  credits_awarded: number;
  owner_id?: string;
  referrer_balance?: number;
  notifications?: ReferralNotifications;
}

export class ReferralStore {
  private codes = new Map<string, ReferralCodeRecord>();
  private conversions = new Map<string, { referral_code: string; new_user_id: string; converted_at: string }>();
  private userBalances = new Map<string, number>();
  private events: SystemEventRecord[] = [];

  createCode(ownerId: string, customCode?: string): ReferralCodeRecord {
    const cleanOwner = ownerId.trim();
    if (!cleanOwner) {
      throw new Error('owner_id is required');
    }
    const code = (customCode?.trim() || crypto.randomUUID().slice(0, 8)).toUpperCase();
    const existing = this.codes.get(code);
    if (existing) {
      return existing;
    }
    const record: ReferralCodeRecord = {
      code,
      owner_id: cleanOwner,
      uses: 0,
      credits_awarded: 0,
      created_at: new Date().toISOString(),
    };
    this.codes.set(code, record);
    if (!this.userBalances.has(cleanOwner)) {
      this.userBalances.set(cleanOwner, 0);
    }
    return record;
  }

  getCode(code: string): ReferralCodeRecord | undefined {
    return this.codes.get(code.trim().toUpperCase());
  }

  getReferrerBalance(userId: string): number {
    return this.userBalances.get(userId.trim()) ?? 0;
  }

  getSystemEvents(): SystemEventRecord[] {
    return [...this.events];
  }

  processReferral(referralCode: string, newUserId: string): ReferralResult {
    const codeKey = (referralCode ?? '').trim().toUpperCase();
    const refereeId = (newUserId ?? '').trim();

    if (!codeKey || !refereeId) {
      return { status: 'invalid_input', credits_awarded: 0 };
    }

    const codeRecord = this.codes.get(codeKey);
    if (!codeRecord) {
      return { status: 'invalid_code', credits_awarded: 0 };
    }

    if (codeRecord.owner_id === refereeId) {
      return { status: 'self_referral', credits_awarded: 0 };
    }

    // Idempotent check: a user can only convert once
    if (this.conversions.has(refereeId)) {
      return { status: 'already_processed', credits_awarded: 0 };
    }

    const now = new Date().toISOString();
    this.conversions.set(refereeId, {
      referral_code: codeKey,
      new_user_id: refereeId,
      converted_at: now,
    });

    codeRecord.uses += 1;
    codeRecord.credits_awarded += REFERRAL_REWARD_CREDITS;

    const updatedBalance = (this.userBalances.get(codeRecord.owner_id) ?? 0) + REFERRAL_REWARD_CREDITS;
    this.userBalances.set(codeRecord.owner_id, updatedBalance);

    this.events.push({
      event_type: REFERRAL_EVENT_TYPE,
      payload: {
        code: codeKey,
        referrer_id: codeRecord.owner_id,
        new_user: refereeId,
        credits: REFERRAL_REWARD_CREDITS,
        total_referrer_credits: updatedBalance,
      },
      created_at: now,
    });

    return {
      status: 'ok',
      credits_awarded: REFERRAL_REWARD_CREDITS,
      owner_id: codeRecord.owner_id,
      referrer_balance: updatedBalance,
      notifications: {
        referrer: `You earned ${REFERRAL_REWARD_CREDITS} free credits for referring user ${refereeId}!`,
        referee: `Your referral code ${codeKey} was applied! ${codeRecord.owner_id} earned ${REFERRAL_REWARD_CREDITS} free credits.`,
      },
    };
  }
}

export const defaultReferralStore = new ReferralStore();

export function create_referral_code(
  owner_id: string,
  custom_code?: string,
  store: ReferralStore = defaultReferralStore,
): ReferralCodeRecord {
  return store.createCode(owner_id, custom_code);
}

export function process_referral(
  referral_code: string,
  new_user_id: string,
  store: ReferralStore = defaultReferralStore,
): ReferralResult {
  return store.processReferral(referral_code, new_user_id);
}

export const processReferral = process_referral;
