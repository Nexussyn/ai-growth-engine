/**
 * Referral reward loop — Issue #2
 * Awards 5 free credits per successful referral conversion (idempotent).
 */

export const REFERRAL_CREDITS = 5;

export type ReferralStatus = 'ok' | 'already_processed' | 'invalid_code' | 'self_referral';

export interface ReferralCodeRecord {
  code: string;
  owner_id: string;
  uses: number;
  credits_awarded: number;
}

export interface ReferralConversion {
  referral_code: string;
  new_user_id: string;
}

export interface SystemEvent {
  event_type: string;
  payload: Record<string, unknown>;
}

export interface Notification {
  user_id: string;
  type: string;
  title: string;
  body: string;
}

export interface ReferralStore {
  getCode(code: string): ReferralCodeRecord | undefined;
  hasConversion(code: string, newUserId: string): boolean;
  insertConversion(row: ReferralConversion): void;
  awardCredits(code: string, credits: number): void;
  logEvent(event: SystemEvent): void;
  notify(n: Notification): void;
}

export interface ProcessReferralResult {
  status: ReferralStatus;
  credits_awarded?: number;
  owner_id?: string;
}

/**
 * process_referral(referral_code, new_user_id)
 * Matches issue #2 acceptance criteria naming.
 */
export function process_referral(
  store: ReferralStore,
  referral_code: string,
  new_user_id: string,
): ProcessReferralResult {
  const code = referral_code.trim();
  const user = new_user_id.trim();
  if (!code || !user) {
    return { status: 'invalid_code' };
  }

  const record = store.getCode(code);
  if (!record) {
    return { status: 'invalid_code' };
  }
  if (record.owner_id === user) {
    return { status: 'self_referral' };
  }
  if (store.hasConversion(code, user)) {
    return { status: 'already_processed' };
  }

  store.insertConversion({ referral_code: code, new_user_id: user });
  store.awardCredits(code, REFERRAL_CREDITS);
  store.logEvent({
    event_type: 'referral_conversion',
    payload: { code, new_user: user, credits: REFERRAL_CREDITS, owner_id: record.owner_id },
  });
  store.notify({
    user_id: record.owner_id,
    type: 'referral_reward',
    title: 'Referral reward',
    body: `You earned ${REFERRAL_CREDITS} free credits from a referral.`,
  });
  store.notify({
    user_id: user,
    type: 'referral_welcome',
    title: 'Welcome via referral',
    body: 'Your referral code was applied successfully.',
  });

  return { status: 'ok', credits_awarded: REFERRAL_CREDITS, owner_id: record.owner_id };
}

/** CamelCase alias. */
export function processReferral(
  store: ReferralStore,
  referralCode: string,
  newUserId: string,
): ProcessReferralResult {
  return process_referral(store, referralCode, newUserId);
}

/** In-memory store for unit tests. */
export function createMemoryReferralStore(
  seed: ReferralCodeRecord[] = [],
): ReferralStore & {
  codes: Map<string, ReferralCodeRecord>;
  conversions: Set<string>;
  events: SystemEvent[];
  notifications: Notification[];
} {
  const codes = new Map(seed.map((c) => [c.code, { ...c }]));
  const conversions = new Set<string>();
  const events: SystemEvent[] = [];
  const notifications: Notification[] = [];
  const key = (code: string, user: string) => `${code}::${user}`;

  return {
    codes,
    conversions,
    events,
    notifications,
    getCode(code) {
      return codes.get(code);
    },
    hasConversion(code, newUserId) {
      return conversions.has(key(code, newUserId));
    },
    insertConversion(row) {
      conversions.add(key(row.referral_code, row.new_user_id));
    },
    awardCredits(code, credits) {
      const rec = codes.get(code);
      if (!rec) return;
      rec.uses += 1;
      rec.credits_awarded += credits;
    },
    logEvent(event) {
      events.push(event);
    },
    notify(n) {
      notifications.push(n);
    },
  };
}
