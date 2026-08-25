/**
 * Referral reward loop — Issue #2
 * When user B signs up with A's code and makes their first paid call,
 * A receives 5 free credits once (idempotent per code+new_user).
 */

export const REFERRAL_CREDITS = 5;
export const EVENT_TYPE = 'referral_conversion';

export interface ReferralCode {
  code: string;
  ownerId: string;
  uses: number;
  creditsAwarded: number;
  createdAt: string;
}

export interface ReferralConversion {
  referralCode: string;
  newUserId: string;
  convertedAt: string;
}

export interface SystemEvent {
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface Notification {
  userId: string;
  message: string;
  createdAt: string;
}

export type ProcessStatus =
  | 'ok'
  | 'already_processed'
  | 'invalid_code'
  | 'self_referral'
  | 'invalid_input';

export interface ProcessReferralResult {
  status: ProcessStatus;
  creditsAwarded?: number;
  ownerId?: string;
  event?: SystemEvent;
  notifications?: Notification[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/** In-memory mirror of referral_codes + referral_conversions + system_events. */
export class ReferralStore {
  codes = new Map<string, ReferralCode>();
  /** key = `${code}::${newUserId}` */
  conversions = new Map<string, ReferralConversion>();
  /** owner_id → free credit balance */
  balances = new Map<string, number>();
  events: SystemEvent[] = [];
  notifications: Notification[] = [];

  createCode(ownerId: string, code?: string): ReferralCode {
    if (!ownerId?.trim()) throw new Error('ownerId required');
    const raw = code?.trim() || crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const normalized = normalizeCode(raw);
    if (this.codes.has(normalized)) throw new Error('code already exists');
    const row: ReferralCode = {
      code: normalized,
      ownerId: ownerId.trim(),
      uses: 0,
      creditsAwarded: 0,
      createdAt: nowIso(),
    };
    this.codes.set(normalized, row);
    if (!this.balances.has(row.ownerId)) this.balances.set(row.ownerId, 0);
    return row;
  }

  getCode(code: string): ReferralCode | undefined {
    return this.codes.get(normalizeCode(code));
  }

  getBalance(userId: string): number {
    return this.balances.get(userId) ?? 0;
  }

  clear(): void {
    this.codes.clear();
    this.conversions.clear();
    this.balances.clear();
    this.events = [];
    this.notifications = [];
  }
}

const defaultStore = new ReferralStore();

/**
 * process_referral(referral_code, new_user_id)
 * Awards REFERRAL_CREDITS to the code owner on first paid conversion.
 * Idempotent: same (code, new_user) pair cannot convert twice.
 */
export function processReferral(
  referralCode: string,
  newUserId: string,
  store: ReferralStore = defaultStore,
): ProcessReferralResult {
  if (!referralCode?.trim() || !newUserId?.trim()) {
    return { status: 'invalid_input' };
  }

  const code = normalizeCode(referralCode);
  const userId = newUserId.trim();
  const row = store.codes.get(code);
  if (!row) return { status: 'invalid_code' };

  if (row.ownerId === userId) {
    return { status: 'self_referral' };
  }

  const convKey = `${code}::${userId}`;
  if (store.conversions.has(convKey)) {
    return { status: 'already_processed', ownerId: row.ownerId };
  }

  const convertedAt = nowIso();
  store.conversions.set(convKey, {
    referralCode: code,
    newUserId: userId,
    convertedAt,
  });

  row.uses += 1;
  row.creditsAwarded += REFERRAL_CREDITS;
  store.balances.set(row.ownerId, store.getBalance(row.ownerId) + REFERRAL_CREDITS);

  const event: SystemEvent = {
    eventType: EVENT_TYPE,
    payload: {
      code,
      new_user: userId,
      owner_id: row.ownerId,
      credits: REFERRAL_CREDITS,
    },
    createdAt: convertedAt,
  };
  store.events.push(event);

  const notifications: Notification[] = [
    {
      userId: row.ownerId,
      message: `Referral success: +${REFERRAL_CREDITS} free credits (code ${code}).`,
      createdAt: convertedAt,
    },
    {
      userId,
      message: `Welcome — you joined via referral ${code}.`,
      createdAt: convertedAt,
    },
  ];
  store.notifications.push(...notifications);

  return {
    status: 'ok',
    creditsAwarded: REFERRAL_CREDITS,
    ownerId: row.ownerId,
    event,
    notifications,
  };
}
