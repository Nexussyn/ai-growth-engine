/**
 * Auto-upsell trigger — Issue #3
 *
 * When a user crosses 50% of their free-call limit (e.g. their 5th free call
 * out of 10), record a row in `upsell_triggers` exactly once and signal that
 * the response should carry the `X-Upsell-Prompt` header with a dynamically
 * generated, A/B-test-ready prompt.
 *
 * Idempotency: the DB migration enforces UNIQUE(user_id, trigger_type) and
 * ships `record_upsell_trigger()` which returns TRUE only for a fresh insert
 * (INSERT ... ON CONFLICT DO NOTHING). The TS middleware mirrors that
 * contract through the `UpsellStore` interface, so both layers agree on
 * exactly-once semantics.
 */

/** Response header set to `true` on the call that fires the trigger. */
export const UPSELL_HEADER = 'X-Upsell-Prompt';

/** Trigger type fired at 50% of the free-call limit. */
export const TRIGGER_TYPE_FREE_LIMIT_50PCT = 'free_limit_50pct';

/** Default ratio of the free-call limit at which the trigger fires. */
export const DEFAULT_TRIGGER_RATIO = 0.5;

/** Coarse usage classification used to tailor the prompt text. */
export type UsagePattern = 'heavy' | 'standard' | 'light';

/** A/B test variant, deterministically assigned per user (sticky bucketing). */
export type UpsellVariant = 'A' | 'B';

/** Optional usage signals that feed prompt generation. */
export interface UsageStats {
  /** Calls in the last hour (recency signal). */
  callsInLastHour?: number;
  /** Average calls per day (volume signal). */
  avgCallsPerDay?: number;
}

/**
 * Persistence contract for upsell triggers.
 *
 * A Postgres implementation backs `recordTrigger` with
 * `SELECT record_upsell_trigger($1, $2)` from
 * migrations/add_upsell_trigger_helpers.sql and returns its boolean result;
 * `markConverted` backs to `SELECT mark_upsell_converted($1, $2)`.
 */
export interface UpsellStore {
  /** Has this user already triggered this trigger type? */
  wasTriggered(userId: string, triggerType: string): boolean;
  /**
   * Idempotently record a trigger. Returns TRUE only when a NEW row was
   * recorded (this call fired the trigger); FALSE means it already fired.
   */
  recordTrigger(userId: string, triggerType: string): boolean;
  /**
   * Mark a previously recorded trigger as converted (user upgraded after
   * seeing the prompt). Returns TRUE when a row was updated.
   */
  markConverted(userId: string, triggerType: string): boolean;
}

/** In-memory store for tests and single-process dev; NOT durable across restarts. */
export class InMemoryUpsellStore implements UpsellStore {
  private fired = new Set<string>();
  private converted = new Set<string>();

  private key(userId: string, triggerType: string): string {
    return `${userId}::${triggerType}`;
  }

  wasTriggered(userId: string, triggerType: string): boolean {
    return this.fired.has(this.key(userId, triggerType));
  }

  recordTrigger(userId: string, triggerType: string): boolean {
    const k = this.key(userId, triggerType);
    if (this.fired.has(k)) return false;
    this.fired.add(k);
    return true;
  }

  markConverted(userId: string, triggerType: string): boolean {
    const k = this.key(userId, triggerType);
    if (!this.fired.has(k)) return false;
    this.converted.add(k);
    return true;
  }

  /** Test helper: was this trigger marked converted? */
  wasConverted(userId: string, triggerType: string): boolean {
    return this.converted.has(this.key(userId, triggerType));
  }
}

/** Module-level fallback store; production deployments should pass their own. */
const defaultStore = new InMemoryUpsellStore();

/**
 * The free-call count at which the trigger fires: ceil(limit * ratio).
 * A 10-call limit at the default 0.5 ratio fires on the 5th free call.
 */
export function computeUpsellThreshold(
  freeCallLimit: number,
  triggerRatio: number = DEFAULT_TRIGGER_RATIO,
): number {
  if (!Number.isFinite(freeCallLimit) || freeCallLimit <= 0) {
    throw new RangeError('freeCallLimit must be a positive number');
  }
  if (!(triggerRatio > 0 && triggerRatio < 1)) {
    throw new RangeError('triggerRatio must be between 0 and 1 (exclusive)');
  }
  return Math.ceil(freeCallLimit * triggerRatio);
}

/**
 * Classify a user by usage signals. Heavy users get urgency-flavored copy,
 * light users get value-flavored copy.
 */
export function classifyUsage(stats?: UsageStats): UsagePattern {
  if (!stats) return 'standard';
  const hourly = stats.callsInLastHour ?? 0;
  const daily = stats.avgCallsPerDay ?? 0;
  if (hourly >= 10 || daily >= 50) return 'heavy';
  if (hourly <= 1 && daily <= 5) return 'light';
  return 'standard';
}

/**
 * Deterministic per-user variant assignment (sticky A/B bucketing).
 * A user always lands in the same variant, so experiments stay consistent.
 */
export function pickUpsellVariant(userId: string): UpsellVariant {
  let hash = 0;
  for (const ch of userId) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return hash % 2 === 0 ? 'A' : 'B';
}

type PromptTemplate = (used: number, limit: number, remaining: number) => string;

/**
 * A/B-ready prompt text, generated from the user's usage pattern.
 * Variant A = value framing ("never think about limits again").
 * Variant B = scarcity framing ("only N left").
 */
const PROMPT_TEMPLATES: Record<UpsellVariant, Record<UsagePattern, PromptTemplate>> = {
  A: {
    heavy: (used, limit) =>
      `You've burned through ${used} of ${limit} free calls and you're moving fast — upgrade for unlimited calls so you never hit a wall.`,
    standard: (used, limit) =>
      `You've used ${used} of ${limit} free calls. Upgrade for unlimited access — no per-call fees, ever.`,
    light: (used, limit) =>
      `You've used ${used} of ${limit} free calls. Upgrade once and never think about limits again.`,
  },
  B: {
    heavy: (_used, limit, remaining) =>
      `Only ${remaining} free calls left — at your pace that's minutes away. Go unlimited before you stop.`,
    standard: (used, limit, remaining) =>
      `Only ${remaining} free calls left (${used}/${limit} used). Upgrade for unlimited access.`,
    light: (_used, _limit, remaining) =>
      `${remaining} free calls remaining. Lock in unlimited access now and keep building.`,
  },
};

export interface BuildPromptOptions {
  userId: string;
  freeCallsUsed: number;
  freeCallLimit: number;
  usagePattern: UsagePattern;
  variant?: UpsellVariant;
}

/** Build the final prompt string for the firing trigger. */
export function buildUpsellPrompt(opts: BuildPromptOptions): string {
  const variant = opts.variant ?? pickUpsellVariant(opts.userId);
  const remaining = Math.max(0, opts.freeCallLimit - opts.freeCallsUsed);
  return PROMPT_TEMPLATES[variant][opts.usagePattern](
    opts.freeCallsUsed,
    opts.freeCallLimit,
    remaining,
  );
}

/** Middleware decision returned for every call. */
export interface UpsellDecision {
  /** When TRUE, set `X-Upsell-Prompt: true` on the response and show `prompt`. */
  upsell: boolean;
  /** Prompt text to show (null when the trigger does not fire). */
  prompt: string | null;
  /** A/B variant used for this prompt (null when the trigger does not fire). */
  variant: UpsellVariant | null;
  /** Trigger type recorded in upsell_triggers. */
  triggerType: string;
  /** Usage pattern the prompt was generated from. */
  usagePattern: UsagePattern;
  /** Human-readable explanation of the decision (debug/audit). */
  reason: string;
}

export interface CheckUpsellOptions {
  /** Persistence layer; defaults to the module in-memory store. */
  store?: UpsellStore;
  /** Usage signals for prompt generation. */
  usage?: UsageStats;
  /** Fraction of the free-call limit that fires the trigger (default 0.5). */
  triggerRatio?: number;
}

/**
 * Middleware: call after each free call completes with the user's updated
 * usage. Fires exactly once when `freeCallsUsed` reaches 50% of
 * `freeCallLimit`, records the trigger idempotently, and returns whether to
 * set the `X-Upsell-Prompt` header plus the prompt text.
 */
export function checkUpsellTrigger(
  userId: string,
  freeCallsUsed: number,
  freeCallLimit: number,
  options: CheckUpsellOptions = {},
): UpsellDecision {
  const store = options.store ?? defaultStore;
  const threshold = computeUpsellThreshold(freeCallLimit, options.triggerRatio);
  const usagePattern = classifyUsage(options.usage);

  const base = {
    triggerType: TRIGGER_TYPE_FREE_LIMIT_50PCT,
    usagePattern,
  };

  if (freeCallsUsed < threshold) {
    return {
      ...base,
      upsell: false,
      prompt: null,
      variant: null,
      reason: `below threshold: ${freeCallsUsed} used, fires at ${threshold}`,
    };
  }

  if (store.wasTriggered(userId, TRIGGER_TYPE_FREE_LIMIT_50PCT)) {
    return {
      ...base,
      upsell: false,
      prompt: null,
      variant: null,
      reason: 'trigger already fired for this user/threshold',
    };
  }

  // recordTrigger is the atomic exactly-once gate (SQL: ON CONFLICT DO NOTHING).
  const fired = store.recordTrigger(userId, TRIGGER_TYPE_FREE_LIMIT_50PCT);
  if (!fired) {
    return {
      ...base,
      upsell: false,
      prompt: null,
      variant: null,
      reason: 'trigger already recorded (concurrent firing)',
    };
  }

  const variant = pickUpsellVariant(userId);
  const prompt = buildUpsellPrompt({
    userId,
    freeCallsUsed,
    freeCallLimit,
    usagePattern,
    variant,
  });

  return {
    ...base,
    upsell: true,
    prompt,
    variant,
    reason: `threshold crossed: ${freeCallsUsed}/${freeCallLimit} >= ${threshold} (variant ${variant})`,
  };
}

/**
 * Record that a user converted after seeing the upsell prompt
 * (sets upsell_triggers.converted = TRUE). Returns TRUE if a row was updated.
 */
export function recordUpsellConversion(
  userId: string,
  store: UpsellStore = defaultStore,
  triggerType: string = TRIGGER_TYPE_FREE_LIMIT_50PCT,
): boolean {
  return store.markConverted(userId, triggerType);
}
