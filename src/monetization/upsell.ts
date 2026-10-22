/**
 * Auto-Upsell Trigger Engine — Issue #3
 * Triggers a contextual upgrade prompt once when a user reaches 50% of their free credit limit
 * (e.g., 5th of 10 free calls), sets `X-Upsell-Prompt: true`, and supports A/B prompt variants.
 */

export const UPSELL_TRIGGER_TYPE = 'free_limit_50pct';
export const UPSELL_HEADER = 'X-Upsell-Prompt';
export const UPSELL_VARIANT_HEADER = 'X-Upsell-Variant';

export type UpsellVariant = 'A' | 'B';
export type UsagePattern = 'standard' | 'burst';

export interface UpsellTriggerRow {
  user_id: string;
  trigger_type: string;
  variant: UpsellVariant;
  shown_at: string;
  converted: boolean;
}

export interface UpsellCheckResult {
  upsell: boolean;
  variant?: UpsellVariant;
  prompt?: string;
  headers: Record<string, string>;
}

/**
 * Checks whether the current call count equals the 50% free-credit threshold (5 of 10 by default).
 */
export function isUpsellThreshold(callCount: number, freeLimit = 10): boolean {
  if (freeLimit <= 0 || callCount <= 0) return false;
  const threshold = Math.ceil(freeLimit / 2);
  return callCount === threshold;
}

/**
 * Deterministic A/B variant assignment per user ID.
 */
export function selectUpsellVariant(userId: string): UpsellVariant {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2 === 0 ? 'A' : 'B';
}

/**
 * Dynamically generates the upgrade prompt based on A/B variant and usage pattern.
 */
export function buildUpsellPrompt(
  variant: UpsellVariant,
  callCount: number,
  freeLimit = 10,
  pattern: UsagePattern = 'standard',
): string {
  const remaining = Math.max(0, freeLimit - callCount);
  if (pattern === 'burst') {
    return variant === 'A'
      ? `High-velocity usage detected: you have used ${callCount}/${freeLimit} free calls (${remaining} remaining). Upgrade to Priority for higher rate limits.`
      : `Burst workload at 50% free quota (${remaining} calls left). Unlock unlimited throughput with a paid tier.`;
  }
  return variant === 'A'
    ? `You have used 50% of your free calls (${remaining} remaining). Upgrade now for unlimited access.`
    : `Halfway through your free quota (${remaining} calls left). Unlock Pro for uninterrupted throughput.`;
}

export class UpsellTriggerStore {
  private triggers = new Map<string, UpsellTriggerRow>();

  private key(userId: string, triggerType: string): string {
    return `${userId.trim()}::${triggerType}`;
  }

  recordTrigger(
    userId: string,
    variant: UpsellVariant,
    triggerType = UPSELL_TRIGGER_TYPE,
  ): boolean {
    const cleanUser = userId.trim();
    if (!cleanUser) return false;
    const k = this.key(cleanUser, triggerType);
    if (this.triggers.has(k)) {
      return false;
    }
    this.triggers.set(k, {
      user_id: cleanUser,
      trigger_type: triggerType,
      variant,
      shown_at: new Date().toISOString(),
      converted: false,
    });
    return true;
  }

  markConverted(userId: string, triggerType = UPSELL_TRIGGER_TYPE): boolean {
    const row = this.triggers.get(this.key(userId, triggerType));
    if (!row) return false;
    row.converted = true;
    return true;
  }

  getTrigger(userId: string, triggerType = UPSELL_TRIGGER_TYPE): UpsellTriggerRow | undefined {
    return this.triggers.get(this.key(userId, triggerType));
  }
}

export const defaultUpsellStore = new UpsellTriggerStore();

/**
 * Evaluates call count and idempotently records an upsell trigger on the 5th free call.
 */
export function checkUpsellTrigger(
  userId: string,
  callCount: number,
  options: {
    freeLimit?: number;
    pattern?: UsagePattern;
    store?: UpsellTriggerStore;
  } = {},
): UpsellCheckResult {
  const { freeLimit = 10, pattern = 'standard', store = defaultUpsellStore } = options;
  const cleanUser = (userId ?? '').trim();

  if (!cleanUser || !isUpsellThreshold(callCount, freeLimit)) {
    return { upsell: false, headers: {} };
  }

  const variant = selectUpsellVariant(cleanUser);
  const inserted = store.recordTrigger(cleanUser, variant);

  if (!inserted) {
    return { upsell: false, headers: {} };
  }

  const prompt = buildUpsellPrompt(variant, callCount, freeLimit, pattern);
  return {
    upsell: true,
    variant,
    prompt,
    headers: {
      [UPSELL_HEADER]: 'true',
      [UPSELL_VARIANT_HEADER]: variant,
    },
  };
}

/**
 * Middleware helper that attaches `X-Upsell-Prompt: true` to a Fetch `Response` when triggered.
 */
export function applyUpsellMiddleware(
  response: Response,
  userId: string,
  callCount: number,
  options: {
    freeLimit?: number;
    pattern?: UsagePattern;
    store?: UpsellTriggerStore;
  } = {},
): { response: Response; result: UpsellCheckResult } {
  const result = checkUpsellTrigger(userId, callCount, options);
  if (!result.upsell) {
    return { response, result };
  }
  const headers = new Headers(response.headers);
  headers.set(UPSELL_HEADER, 'true');
  if (result.variant) {
    headers.set(UPSELL_VARIANT_HEADER, result.variant);
  }
  const wrapped = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  return { response: wrapped, result };
}
