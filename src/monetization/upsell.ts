/**
 * Upsell Trigger — Issue #3
 *
 * Fires a contextual upgrade prompt when a free user crosses 50% of their free
 * credit limit (call 5 of 10) and records it exactly once per crossing.
 *
 * The SQL side lives in `migrations/add_upsell_triggers.sql`
 * (`upsell_triggers` table + `check_upsell_trigger`), whose UNIQUE(user_id,
 * trigger_type) constraint is what makes the trigger idempotent.
 */

export const FREE_CALL_LIMIT = 10;
export const UPSELL_THRESHOLD = Math.ceil(FREE_CALL_LIMIT * 0.5); // 5th call = 50%
export const TRIGGER_TYPE = 'free_limit_50pct';

export type UpsellVariant = 'A' | 'B';

export interface UsagePattern {
  callCount: number;
  freeCallLimit?: number;
  /** Stable per-user id; drives deterministic A/B assignment. */
  userId?: string;
  /** Optional signals used to pick the prompt copy. */
  lastEndpoint?: string;
  avgLatencyMs?: number;
  errorRate?: number;
}

export interface UpsellDecision {
  upsell: boolean;
  triggerType: string | null;
  variant: UpsellVariant | null;
  prompt: string | null;
  headers: Record<string, string>;
}

/** True only on the exact crossing of the threshold (never before/after). */
export function shouldTriggerUpsell(callCount: number, freeCallLimit = FREE_CALL_LIMIT): boolean {
  if (!Number.isFinite(callCount) || callCount < 0) return false;
  return Math.floor(callCount) === Math.ceil(freeCallLimit * 0.5);
}

/** Deterministic FNV-1a hash so a user always sees the same variant. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function pickVariant(userId = ''): UpsellVariant {
  return hashString(userId) % 2 === 0 ? 'A' : 'B';
}

export function generateUpsellPrompt(usage: UsagePattern): { variant: UpsellVariant; prompt: string } {
  const freeCallLimit = usage.freeCallLimit ?? FREE_CALL_LIMIT;
  const remaining = Math.max(0, freeCallLimit - usage.callCount);
  const variant = pickVariant(usage.userId ?? '');
  const usedPct = Math.round((usage.callCount / freeCallLimit) * 100);

  if (variant === 'A') {
    return {
      variant,
      prompt: `You've used ${usedPct}% of your free calls (${usage.callCount}/${freeCallLimit}). Upgrade for unlimited access.`,
    };
  }

  const context = usage.lastEndpoint ? ` on ${usage.lastEndpoint}` : '';
  return {
    variant,
    prompt: `Halfway through your free calls${context} — ${remaining} left. Upgrade now to keep building without limits.`,
  };
}

/** Returns the header the HTTP layer must echo, per the issue's scope. */
export function buildUpsellHeaders(decision: UpsellDecision): Record<string, string> {
  return decision.upsell ? { 'X-Upsell-Prompt': 'true' } : {};
}

/**
 * Pure decision function: no I/O. The caller persists the trigger separately so
 * this stays trivially testable.
 */
export function decideUpsell(usage: UsagePattern): UpsellDecision {
  const freeCallLimit = usage.freeCallLimit ?? FREE_CALL_LIMIT;
  if (!shouldTriggerUpsell(usage.callCount, freeCallLimit)) {
    return { upsell: false, triggerType: null, variant: null, prompt: null, headers: {} };
  }
  const { variant, prompt } = generateUpsellPrompt(usage);
  return { upsell: true, triggerType: TRIGGER_TYPE, variant, prompt, headers: { 'X-Upsell-Prompt': 'true' } };
}

export interface TriggerStore {
  /** Inserts once; resolves `true` when a new row was created. */
  insertTrigger(userId: string, triggerType: string): Promise<boolean> | boolean;
}

/**
 * Persists the trigger idempotently. The UNIQUE(user_id, trigger_type)
 * constraint makes concurrent crossings collapse into a single row.
 */
export async function recordUpsellTrigger(
  store: TriggerStore,
  userId: string,
  triggerType: string = TRIGGER_TYPE,
): Promise<{ inserted: boolean }> {
  const inserted = await store.insertTrigger(userId, triggerType);
  return { inserted: Boolean(inserted) };
}

export interface UpsellRequest {
  userId: string;
  callCount: number;
  freeCallLimit?: number;
  lastEndpoint?: string;
}

export interface UpsellMiddlewareOptions {
  store: TriggerStore;
  freeCallLimit?: number;
}

/**
 * Express-compatible middleware. On the threshold crossing it records the
 * trigger (once) and sets `X-Upsell-Prompt: true` on the response.
 */
export function createUpsellMiddleware({ store, freeCallLimit = FREE_CALL_LIMIT }: UpsellMiddlewareOptions) {
  return async function upsellMiddleware(req: any, res: any, next?: (err?: unknown) => void): Promise<void> {
    try {
      const usage: UsagePattern = {
        userId: String(req?.userId ?? req?.user?.id ?? 'anonymous'),
        callCount: Number(req?.callCount ?? req?.user?.callCount ?? 0),
        freeCallLimit,
        lastEndpoint: req?.path ?? req?.url,
      };
      const decision = decideUpsell(usage);
      if (decision.upsell) {
        const { inserted } = await recordUpsellTrigger(store, usage.userId as string);
        if (inserted) {
          for (const [key, value] of Object.entries(decision.headers)) res?.setHeader?.(key, value);
          (res as any).locals = { ...((res as any).locals ?? {}), upsell: decision };
        }
      }
      if (typeof next === 'function') next();
    } catch (error) {
      if (typeof next === 'function') next(error);
      else throw error;
    }
  };
}
