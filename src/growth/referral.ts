/**
 * Referral Reward Loop (Issue #2)
 * Awards 5 free credits per verified referral conversion, logs system_events,
 * and records notifications for both referrer and referred user.
 */

export const REFERRAL_REWARD_CREDITS = 5;

export interface ReferralCodeRecord {
  code: string;
  owner_id: string;
  uses: number;
  credits_awarded: number;
  created_at: string;
}

export interface ReferralConversionRecord {
  referral_code: string;
  new_user_id: string;
  converted_at: string;
}

export interface ReferralEventPayload {
  code: string;
  referrer_id: string;
  new_user: string;
  credits: number;
}

export interface SystemEventRecord {
  event_type: 'referral_conversion';
  payload: ReferralEventPayload;
  created_at: string;
}

export interface ReferralNotification {
  user_id: string;
  notification_type: 'referral_reward' | 'referral_welcome';
  message: string;
  read: boolean;
  created_at: string;
}

export type ProcessReferralStatus =
  | 'ok'
  | 'already_processed'
  | 'invalid_code'
  | 'self_referral'
  | 'invalid_input'
  | 'awaiting_first_paid_call';

export interface ProcessReferralResult {
  status: ProcessReferralStatus;
  credits_awarded?: number;
  owner_id?: string;
  referrer_balance?: number;
  event?: SystemEventRecord;
  notifications?: ReferralNotification[];
}

export interface ReferralStore {
  codes: Map<string, ReferralCodeRecord>;
  conversions: Map<string, ReferralConversionRecord>;
  pendingReferrals: Map<string, string>;
  paidCallUsers: Set<string>;
  creditBalances: Map<string, number>;
  systemEvents: SystemEventRecord[];
  notifications: ReferralNotification[];
}

export interface ProcessReferralOptions {
  store?: ReferralStore;
  requireFirstPaidCall?: boolean;
}

export interface SupabaseRpcClient {
  rpc(
    fn: string,
    params: Record<string, unknown>,
  ): Promise<{ data: ProcessReferralResult | null; error: { message: string } | null }>;
}

/**
 * Creates an isolated in-memory referral store for state management or testing.
 */
export function createReferralStore(): ReferralStore {
  return {
    codes: new Map<string, ReferralCodeRecord>(),
    conversions: new Map<string, ReferralConversionRecord>(),
    pendingReferrals: new Map<string, string>(),
    paidCallUsers: new Set<string>(),
    creditBalances: new Map<string, number>(),
    systemEvents: [],
    notifications: [],
  };
}

let defaultStore: ReferralStore = createReferralStore();

/**
 * Resets the module default store.
 */
export function resetDefaultReferralStore(): void {
  defaultStore = createReferralStore();
}

function generateShortCode(store: ReferralStore): string {
  for (let attempt = 0; attempt < 16; attempt++) {
    const candidate = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    if (!store.codes.has(candidate)) {
      return candidate;
    }
  }
  throw new Error('Unable to generate unique referral code');
}

/**
 * Creates and registers a referral code for a referrer user.
 */
export function createReferralCode(
  ownerId: string,
  customCode?: string,
  store: ReferralStore = defaultStore,
): ReferralCodeRecord {
  const normalizedOwner = ownerId.trim();
  if (!normalizedOwner) {
    throw new Error('owner_id must not be empty');
  }

  const code = customCode !== undefined ? customCode.trim() : generateShortCode(store);
  if (!code) {
    throw new Error('referral code must not be empty');
  }
  if (store.codes.has(code)) {
    throw new Error(`Referral code already exists: ${code}`);
  }

  const record: ReferralCodeRecord = {
    code,
    owner_id: normalizedOwner,
    uses: 0,
    credits_awarded: 0,
    created_at: new Date().toISOString(),
  };
  store.codes.set(code, record);
  return { ...record };
}

/**
 * Associates a newly signed-up user with a referral code prior to their first paid call.
 */
export function registerReferredSignup(
  referralCode: string,
  newUserId: string,
  store: ReferralStore = defaultStore,
): boolean {
  const code = referralCode.trim();
  const userId = newUserId.trim();
  if (!code || !userId) {
    return false;
  }
  const codeRecord = store.codes.get(code);
  if (!codeRecord || codeRecord.owner_id === userId) {
    return false;
  }
  if (!store.pendingReferrals.has(userId)) {
    store.pendingReferrals.set(userId, code);
  }
  return true;
}

/**
 * Processes a referral conversion idempotently:
 * 1. Validates code and prevents self-referrals or duplicate conversions.
 * 2. Awards 5 free credits to the referrer balance and updates code stats.
 * 3. Appends a referral_conversion entry to system_events.
 * 4. Emits notifications for both referrer and referred user.
 */
export function process_referral(
  referral_code: string,
  new_user_id: string,
  options: ProcessReferralOptions = {},
): ProcessReferralResult {
  const store = options.store ?? defaultStore;
  const code = referral_code?.trim() ?? '';
  const newUserId = new_user_id?.trim() ?? '';

  if (!code || !newUserId) {
    return { status: 'invalid_input' };
  }

  const codeRecord = store.codes.get(code);
  if (!codeRecord) {
    return { status: 'invalid_code' };
  }

  if (codeRecord.owner_id === newUserId) {
    return { status: 'self_referral' };
  }

  if (options.requireFirstPaidCall && !store.paidCallUsers.has(newUserId)) {
    return { status: 'awaiting_first_paid_call' };
  }

  const conversionKey = `${code}::${newUserId}`;
  if (store.conversions.has(conversionKey)) {
    return { status: 'already_processed' };
  }

  const now = new Date().toISOString();
  store.conversions.set(conversionKey, {
    referral_code: code,
    new_user_id: newUserId,
    converted_at: now,
  });

  codeRecord.uses += 1;
  codeRecord.credits_awarded += REFERRAL_REWARD_CREDITS;

  const updatedBalance =
    (store.creditBalances.get(codeRecord.owner_id) ?? 0) + REFERRAL_REWARD_CREDITS;
  store.creditBalances.set(codeRecord.owner_id, updatedBalance);

  const event: SystemEventRecord = {
    event_type: 'referral_conversion',
    payload: {
      code,
      referrer_id: codeRecord.owner_id,
      new_user: newUserId,
      credits: REFERRAL_REWARD_CREDITS,
    },
    created_at: now,
  };
  store.systemEvents.push(event);

  const referrerNotification: ReferralNotification = {
    user_id: codeRecord.owner_id,
    notification_type: 'referral_reward',
    message: `Your referral converted: +${REFERRAL_REWARD_CREDITS} free credits added to your balance.`,
    read: false,
    created_at: now,
  };

  const refereeNotification: ReferralNotification = {
    user_id: newUserId,
    notification_type: 'referral_welcome',
    message: `Referral applied! Your referrer received ${REFERRAL_REWARD_CREDITS} free credits after your first paid call.`,
    read: false,
    created_at: now,
  };

  store.notifications.push(referrerNotification, refereeNotification);
  store.pendingReferrals.delete(newUserId);

  return {
    status: 'ok',
    credits_awarded: REFERRAL_REWARD_CREDITS,
    owner_id: codeRecord.owner_id,
    referrer_balance: updatedBalance,
    event,
    notifications: [referrerNotification, refereeNotification],
  };
}

export const processReferral = process_referral;

/**
 * Records a user's paid API call and triggers pending referral conversion on their first paid call.
 */
export function recordFirstPaidCall(
  userId: string,
  explicitReferralCode?: string,
  store: ReferralStore = defaultStore,
): ProcessReferralResult | null {
  const normalizedUser = userId.trim();
  if (!normalizedUser) {
    return { status: 'invalid_input' };
  }

  store.paidCallUsers.add(normalizedUser);
  const code = explicitReferralCode?.trim() || store.pendingReferrals.get(normalizedUser);
  if (!code) {
    return null;
  }

  return process_referral(code, normalizedUser, {
    store,
    requireFirstPaidCall: true,
  });
}

/**
 * Returns the current free credit balance for a user.
 */
export function getUserCredits(
  userId: string,
  store: ReferralStore = defaultStore,
): number {
  return store.creditBalances.get(userId.trim()) ?? 0;
}

/**
 * Returns a snapshot of a referral code record if it exists.
 */
export function getReferralCode(
  code: string,
  store: ReferralStore = defaultStore,
): ReferralCodeRecord | undefined {
  const rec = store.codes.get(code.trim());
  return rec ? { ...rec } : undefined;
}

/**
 * Returns notifications recorded for a specific user.
 */
export function getUserNotifications(
  userId: string,
  store: ReferralStore = defaultStore,
): ReferralNotification[] {
  const target = userId.trim();
  return store.notifications
    .filter((n) => n.user_id === target)
    .map((n) => ({ ...n }));
}

/**
 * Returns logged system_events entries.
 */
export function getSystemEvents(
  store: ReferralStore = defaultStore,
): SystemEventRecord[] {
  return store.systemEvents.map((e) => ({
    ...e,
    payload: { ...e.payload },
  }));
}

/**
 * Executes the PostgreSQL process_referral RPC via an injected Supabase client.
 */
export async function processReferralRpc(
  client: SupabaseRpcClient,
  referralCode: string,
  newUserId: string,
): Promise<ProcessReferralResult> {
  const code = referralCode.trim();
  const userId = newUserId.trim();
  if (!code || !userId) {
    return { status: 'invalid_input' };
  }

  const { data, error } = await client.rpc('process_referral', {
    p_code: code,
    p_new_user_id: userId,
  });

  if (error) {
    throw new Error(`process_referral RPC failed: ${error.message}`);
  }
  if (!data) {
    throw new Error('process_referral RPC returned empty response');
  }
  return data;
}
