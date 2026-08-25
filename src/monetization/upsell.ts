/**
 * Auto-upsell trigger engine — Issue #3
 * Fires once when a user reaches 50% of the free credit limit (5th of 10 free calls).
 * Sets `X-Upsell-Prompt: true` and returns an A/B prompt variant.
 */

export const FREE_CALL_LIMIT = 10;
export const UPSELL_THRESHOLD = Math.floor(FREE_CALL_LIMIT / 2); // 5th call
export const TRIGGER_TYPE = 'free_limit_50pct';

export type UpsellVariant = 'A' | 'B' | 'C';

export const UPSELL_PROMPTS: Record<UpsellVariant, string> = {
  A: 'You have used 50% of your free calls. Upgrade now for unlimited x402 access.',
  B: 'Halfway through your free tier — unlock Priority pricing and skip rate limits.',
  C: '5 free calls used. Convert to paid and keep building without interruption.',
};

export interface UpsellTriggerRecord {
  userId: string;
  triggerType: string;
  shownAt: string;
  converted: boolean;
  variant: UpsellVariant;
  prompt: string;
}

export interface UpsellCheckResult {
  triggered: boolean;
  alreadyShown: boolean;
  header: Record<string, string>;
  prompt: string | null;
  variant: UpsellVariant | null;
  record: UpsellTriggerRecord | null;
}

/** Deterministic A/B/C assignment from user id (stable across calls). */
export function pickVariant(userId: string): UpsellVariant {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  const keys = Object.keys(UPSELL_PROMPTS) as UpsellVariant[];
  return keys[hash % keys.length];
}

/** In-memory store mirroring UNIQUE(user_id, trigger_type). */
export class UpsellStore {
  private rows = new Map<string, UpsellTriggerRecord>();

  private key(userId: string, triggerType = TRIGGER_TYPE): string {
    return `${userId}::${triggerType}`;
  }

  get(userId: string, triggerType = TRIGGER_TYPE): UpsellTriggerRecord | undefined {
    return this.rows.get(this.key(userId, triggerType));
  }

  /** Insert-once semantics (idempotent). Returns existing row if present. */
  insertOnce(record: UpsellTriggerRecord): { inserted: boolean; record: UpsellTriggerRecord } {
    const k = this.key(record.userId, record.triggerType);
    const existing = this.rows.get(k);
    if (existing) return { inserted: false, record: existing };
    this.rows.set(k, record);
    return { inserted: true, record };
  }

  markConverted(userId: string, triggerType = TRIGGER_TYPE): boolean {
    const row = this.rows.get(this.key(userId, triggerType));
    if (!row) return false;
    row.converted = true;
    return true;
  }

  clear(): void {
    this.rows.clear();
  }
}

const defaultStore = new UpsellStore();

/**
 * Middleware-style check: at exactly the threshold call, insert trigger once
 * and attach response headers. Subsequent crossings are no-ops.
 */
export function checkUpsellTrigger(
  userId: string,
  callCount: number,
  store: UpsellStore = defaultStore,
): UpsellCheckResult {
  if (!userId || typeof callCount !== 'number' || callCount < 0) {
    return {
      triggered: false,
      alreadyShown: false,
      header: {},
      prompt: null,
      variant: null,
      record: null,
    };
  }

  const existing = store.get(userId);
  if (existing) {
    return {
      triggered: false,
      alreadyShown: true,
      header: {},
      prompt: null,
      variant: null,
      record: existing,
    };
  }

  if (callCount !== UPSELL_THRESHOLD) {
    return {
      triggered: false,
      alreadyShown: false,
      header: {},
      prompt: null,
      variant: null,
      record: null,
    };
  }

  const variant = pickVariant(userId);
  const prompt = UPSELL_PROMPTS[variant];
  const record: UpsellTriggerRecord = {
    userId,
    triggerType: TRIGGER_TYPE,
    shownAt: new Date().toISOString(),
    converted: false,
    variant,
    prompt,
  };
  const { inserted, record: saved } = store.insertOnce(record);

  if (!inserted) {
    return {
      triggered: false,
      alreadyShown: true,
      header: {},
      prompt: null,
      variant: null,
      record: saved,
    };
  }

  return {
    triggered: true,
    alreadyShown: false,
    header: {
      'X-Upsell-Prompt': 'true',
      'X-Upsell-Variant': variant,
      'X-Upsell-Trigger': TRIGGER_TYPE,
    },
    prompt,
    variant,
    record: saved,
  };
}

/** Apply upsell headers onto a mutable header map / Headers-like object. */
export function applyUpsellHeaders(
  headers: Record<string, string>,
  result: UpsellCheckResult,
): Record<string, string> {
  if (!result.triggered) return headers;
  return { ...headers, ...result.header };
}

export { defaultStore as upsellStore };
