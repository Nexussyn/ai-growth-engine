/**
 * src/monetization/upsell.ts
 *
 * Auto-upsell trigger — Issue #3
 *
 * Fires a contextual upgrade prompt when a free-tier user reaches 50%
 * of their free credit limit (5th of 10 free calls).
 *
 * Guarantees:
 *   - Trigger fires EXACTLY ONCE per threshold crossing (idempotent).
 *   - Response header `X-Upsell-Prompt: true` is set when triggered.
 *   - Prompt text is dynamically generated from usage pattern.
 *   - A/B test ready: variant selection is deterministic per user.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UpsellVariant = 'A' | 'B';

export interface UpsellTriggerResult {
  /** True if the upsell prompt should be shown on this response. */
  triggered: boolean;
  /** The prompt text to surface to the user (null if not triggered). */
  promptText: string | null;
  /** Which A/B variant was selected (null if not triggered). */
  variant: UpsellVariant | null;
  /** The header value to set on the HTTP response. */
  headerValue: string;
}

export interface UpsellContext {
  /** The user's unique identifier. */
  userId: string;
  /** Number of free calls the user has made so far (including this one). */
  freeCallCount: number;
  /** Total free calls available to the user (default 10). */
  freeCallLimit: number;
}

export interface UpsellConfig {
  /** Percentage of free limit at which to trigger (default 0.5 = 50%). */
  thresholdPercent: number;
  /** Total free calls in the tier (default 10). */
  freeCallLimit: number;
  /** Which A/B variant to use. 'auto' selects deterministically per user. */
  variant: UpsellVariant | 'auto';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default free call limit for the free tier. */
export const DEFAULT_FREE_CALL_LIMIT = 10;

/** Default threshold: 50% of free calls. */
export const DEFAULT_THRESHOLD_PERCENT = 0.5;

/** The trigger type stored in the DB. */
export const TRIGGER_TYPE_FREE_CREDIT_THRESHOLD = 'free_credit_threshold';

/** HTTP response header name. */
export const UPSELL_HEADER = 'X-Upsell-Prompt';

// ---------------------------------------------------------------------------
// A/B Test Prompt Variants
// ---------------------------------------------------------------------------

/**
 * Prompt text variants for A/B testing.
 * Each variant is a function of the usage context so the text is
 * dynamically generated based on the user's actual usage pattern.
 */
export const PROMPT_VARIANTS: Record<
  UpsellVariant,
  (ctx: UpsellContext) => string
> = {
  /**
   * Variant A — Urgency / scarcity framing.
   */
  A: (ctx) => {
    const remaining = ctx.freeCallLimit - ctx.freeCallCount;
    return (
      `You've used ${ctx.freeCallCount} of your ${ctx.freeCallLimit} free calls. ` +
      `Only ${remaining} left! Upgrade to Pro to unlock unlimited calls ` +
      `and keep your momentum going.`
    );
  },

  /**
   * Variant B — Value / benefit framing.
   */
  B: (ctx) => {
    const pctUsed = Math.round((ctx.freeCallCount / ctx.freeCallLimit) * 100);
    return (
      `You're ${pctUsed}% through your free tier — great progress! ` +
      `Switch to Pro now for unlimited calls, priority processing, ` +
      `and advanced analytics. Your first month is 50% off.`
    );
  },
};

// ---------------------------------------------------------------------------
// Core Logic
// ---------------------------------------------------------------------------

/**
 * Determine whether the upsell threshold has been crossed.
 *
 * The threshold is crossed when:
 *   freeCallCount >= ceil(freeCallLimit * thresholdPercent)
 *
 * For the default config (limit=10, threshold=0.5):
 *   ceil(10 * 0.5) = 5  →  triggers on the 5th call.
 *
 * @param ctx - The current usage context.
 * @param config - The upsell configuration.
 * @returns True if the threshold has been reached or exceeded.
 */
export function isThresholdCrossed(
  ctx: UpsellContext,
  config: UpsellConfig = defaultConfig()
): boolean {
  const limit = config.freeCallLimit;
  const threshold = Math.ceil(limit * config.thresholdPercent);
  return ctx.freeCallCount >= threshold;
}

/**
 * Select the A/B variant for a given user.
 *
 * Uses a deterministic hash of the user ID so the same user always
 * sees the same variant (important for A/B test validity).
 *
 * @param userId - The user's unique identifier.
 * @param config - The upsell configuration.
 * @returns The selected variant ('A' or 'B').
 */
export function selectVariant(
  userId: string,
  config: UpsellConfig = defaultConfig()
): UpsellVariant {
  if (config.variant !== 'auto') {
    return config.variant;
  }
  // Deterministic hash: sum of char codes mod 2
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash + userId.charCodeAt(i) * 31) & 0x7fffffff;
  }
  return hash % 2 === 0 ? 'A' : 'B';
}

/**
 * Generate the upsell prompt text for a given context and variant.
 *
 * @param ctx - The current usage context.
 * @param variant - Which A/B variant to use.
 * @returns The dynamically generated prompt text.
 */
export function generatePromptText(
  ctx: UpsellContext,
  variant: UpsellVariant
): string {
  const generator = PROMPT_VARIANTS[variant];
  return generator(ctx);
}

/**
 * Evaluate whether to trigger the upsell prompt for this request.
 *
 * This is the pure decision function — it does NOT perform any DB writes.
 * The caller is responsible for persisting the trigger (see
 * `persistUpsellTrigger`) and setting the response header.
 *
 * @param ctx - The current usage context.
 * @param config - The upsell configuration.
 * @param alreadyTriggered - Whether a trigger row already exists for this
 *   user + trigger_type (fetched from the DB by the caller).
 * @returns The upsell trigger result.
 */
export function evaluateUpsell(
  ctx: UpsellContext,
  config: UpsellConfig = defaultConfig(),
  alreadyTriggered: boolean = false
): UpsellTriggerResult {
  const thresholdCrossed = isThresholdCrossed(ctx, config);

  // Idempotency: if the threshold is crossed but we've already triggered,
  // do NOT trigger again.
  if (!thresholdCrossed || alreadyTriggered) {
    return {
      triggered: false,
      promptText: null,
      variant: null,
      headerValue: 'false',
    };
  }

  const variant = selectVariant(ctx.userId, config);
  const promptText = generatePromptText(ctx, variant);

  return {
    triggered: true,
    promptText,
    variant,
    headerValue: 'true',
  };
}

// ---------------------------------------------------------------------------
// Database Persistence (idempotent)
// ---------------------------------------------------------------------------

/**
 * Persist an upsell trigger row in the `upsell_triggers` table.
 *
 * Uses `ON CONFLICT (user_id, trigger_type) DO NOTHING` to guarantee
 * idempotency — if a row already exists for this user + trigger_type,
 * the insert is a no-op and the function returns `false`.
 *
 * @param db - A database client with a `query` method (e.g. pg Pool,
 *   Supabase client, or any compatible interface).
 * @param ctx - The current usage context.
 * @param variant - The A/B variant that was shown.
 * @returns `true` if a new row was inserted, `false` if one already existed.
 */
export async function persistUpsellTrigger(
  db: DatabaseClient,
  ctx: UpsellContext,
  variant: UpsellVariant
): Promise<boolean> {
  const usageSnapshot = `${ctx.freeCallCount}/${ctx.freeCallLimit} free calls`;

  const result = await db.query(
    `INSERT INTO upsell_triggers (user_id, trigger_type, usage_snapshot, variant)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, trigger_type) DO NOTHING
     RETURNING id`,
    [ctx.userId, TRIGGER_TYPE_FREE_CREDIT_THRESHOLD, usageSnapshot, variant]
  );

  // If a row was returned, the insert succeeded (new trigger).
  // If no rows, the conflict handler suppressed the insert (already triggered).
  return result.rows.length > 0;
}

/**
 * Check whether an upsell trigger already exists for a user.
 *
 * @param db - A database client with a `query` method.
 * @param userId - The user's unique identifier.
 * @param triggerType - The trigger type to check (default: free_credit_threshold).
 * @returns `true` if a trigger row already exists.
 */
export async function hasUpsellTrigger(
  db: DatabaseClient,
  userId: string,
  triggerType: string = TRIGGER_TYPE_FREE_CREDIT_THRESHOLD
): Promise<boolean> {
  const result = await db.query(
    `SELECT 1 FROM upsell_triggers
     WHERE user_id = $1 AND trigger_type = $2
     LIMIT 1`,
    [userId, triggerType]
  );
  return result.rows.length > 0;
}

/**
 * Mark an upsell trigger as converted (user upgraded to paid).
 *
 * @param db - A database client with a `query` method.
 * @param userId - The user's unique identifier.
 * @param triggerType - The trigger type (default: free_credit_threshold).
 * @returns `true` if a row was updated.
 */
export async function markUpsellConverted(
  db: DatabaseClient,
  userId: string,
  triggerType: string = TRIGGER_TYPE_FREE_CREDIT_THRESHOLD
): Promise<boolean> {
  const result = await db.query(
    `UPDATE upsell_triggers
     SET converted = TRUE, converted_at = now()
     WHERE user_id = $1 AND trigger_type = $2 AND converted = FALSE`,
    [userId, triggerType]
  );
  return result.rowCount > 0;
}

// ---------------------------------------------------------------------------
// Express Middleware
// ---------------------------------------------------------------------------

/**
 * Minimal interface for a database client (pg Pool, Supabase, etc.).
 */
export interface DatabaseClient {
  query(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: unknown[]; rowCount: number }>;
}

/**
 * Minimal Express-style request interface.
 */
export interface UpsellRequest {
  /** The authenticated user's ID (set by upstream auth middleware). */
  userId?: string;
  /** The user's current free call count (set by upstream call-counter middleware). */
  freeCallCount?: number;
  /** The user's free call limit (set by upstream tier middleware). */
  freeCallLimit?: number;
  /** The user's tier (e.g. 'free', 'pro'). */
  tier?: string;
  headers?: Record<string, string>;
}

/**
 * Minimal Express-style response interface.
 */
export interface UpsellResponse {
  setHeader(name: string, value: string): void;
  status(code: number): UpsellResponse;
  json(body: unknown): void;
}

/**
 * Express middleware that checks the user's free call count and, if the
 * upsell threshold has been crossed, sets the `X-Upsell-Prompt` header
 * and attaches the prompt text to the response.
 *
 * Usage:
 * 