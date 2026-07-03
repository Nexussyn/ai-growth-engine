export interface ReferralCodeRow {
  code: string;
  ownerId: string;
  uses: number;
  creditsAwarded: number;
  usedBy: string[];
}

export interface ReferralStore {
  getReferralCode(code: string): Promise<ReferralCodeRow | null>;
  markReferralUsed(code: string, newUserId: string, creditsAwarded: number): Promise<void>;
  addCredits(userId: string, amount: number): Promise<void>;
  hasConversion(code: string, newUserId: string): Promise<boolean>;
  logReferralConversion(code: string, newUserId: string, details: { outcomeId: string }): Promise<void>;
  notifyUser(userId: string, message: string): Promise<void>;
}

export interface ProcessReferralInput {
  referralCode: string;
  newUserId: string;
  convertedAt?: string;
  rewardCredits?: number;
  outcomeId?: string;
}

export interface ProcessReferralResult {
  status: 'awarded' | 'already_used' | 'invalid_code' | 'self_referral' | 'error';
  creditsAwarded: number;
  message: string;
}

const DEFAULT_REWARD_CREDITS = 5;

function normalizeCode(value: string): string {
  return value.trim().toLowerCase();
}

export async function processReferral(
  store: ReferralStore,
  input: ProcessReferralInput,
): Promise<ProcessReferralResult> {
  const rewardCredits = input.rewardCredits ?? DEFAULT_REWARD_CREDITS;
  const code = normalizeCode(input.referralCode);

  if (!code) {
    return { status: 'invalid_code', creditsAwarded: 0, message: 'Referral code is empty.' };
  }

  const existing = await store.getReferralCode(code);
  if (!existing) {
    return { status: 'invalid_code', creditsAwarded: 0, message: 'Referral code not found.' };
  }

  if (existing.ownerId === input.newUserId) {
    return { status: 'self_referral', creditsAwarded: 0, message: 'Cannot use own referral code.' };
  }

  const alreadyUsed = await store.hasConversion(code, input.newUserId);
  if (alreadyUsed) {
    return {
      status: 'already_used',
      creditsAwarded: 0,
      message: 'Referral already converted for this user.',
    };
  }

  try {
    await store.markReferralUsed(code, input.newUserId, rewardCredits);
    await store.addCredits(existing.ownerId, rewardCredits);
    await store.logReferralConversion(code, input.newUserId, { outcomeId: input.outcomeId ?? '' });

    await store.notifyUser(existing.ownerId, 'Referral converted: +5 free credits added');
    await store.notifyUser(input.newUserId, 'Welcome bonus granted by successful referral');

    return {
      status: 'awarded',
      creditsAwarded: rewardCredits,
      message: 'Referral applied and credits awarded.',
    };
  } catch (error) {
    return {
      status: 'error',
      creditsAwarded: 0,
      message: `Referral processing failed: ${String((error as Error)?.message ?? error)}`,
    };
  }
}

export function createInMemoryReferralStore() {
  const codes = new Map<string, ReferralCodeRow & { createdAt?: string; updatedAt?: string }>();
  const conversions = new Set<string>();
  const balances = new Map<string, number>();
  const notifications: Array<{ userId: string; message: string }> = [];

  return {
    async getReferralCode(code: string): Promise<ReferralCodeRow | null> {
      return codes.get(code) ?? null;
    },
    async markReferralUsed(code: string, newUserId: string, creditsAwarded: number): Promise<void> {
      const row = codes.get(code);
      if (!row) return;
      row.uses += 1;
      row.creditsAwarded += creditsAwarded;
      row.usedBy.push(newUserId);
      row.updatedAt = new Date().toISOString();
      codes.set(code, row);
    },
    async addCredits(userId: string, amount: number): Promise<void> {
      balances.set(userId, (balances.get(userId) ?? 0) + amount);
    },
    async hasConversion(code: string, newUserId: string): Promise<boolean> {
      return conversions.has(`${code}:${newUserId}`);
    },
    async logReferralConversion(code: string, newUserId: string, _details: { outcomeId: string }): Promise<void> {
      conversions.add(`${code}:${newUserId}`);
    },
    async notifyUser(userId: string, message: string): Promise<void> {
      notifications.push({ userId, message });
    },
    __debug: {
      codes,
      conversions,
      balances,
      notifications,
    },
  } as any;
}
