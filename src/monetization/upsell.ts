/**
 * Upsell trigger logic.
 *
 * Fires a contextual upgrade prompt when a user reaches 50% of their free
 * credit limit (e.g. the 5th call out of 10). The trigger is idempotent:
 * it fires exactly once per threshold crossing per user.
 */

export const FREE_CALL_LIMIT = 10;
export const UPSELL_THRESHOLD = Math.floor(FREE_CALL_LIMIT / 2); // 5

export const UPSELL_HEADER = "X-Upsell-Prompt";

export type TriggerType = "half_free_credits";

export interface UpsellTriggerRecord {
  userId: number | string;
  triggerType: TriggerType;
  shownAt: Date;
  converted: boolean;
}

/**
 * Minimal persistence interface. Implementations may back this with
 * Postgres, an ORM, or an in-memory store for tests.
 */
export interface UpsellStore {
  /**
   * Attempts to insert a trigger row. Must be idempotent: returns `true`
   * only if a new row was created, `false` if one already existed for the
   * (userId, triggerType) pair.
   */
  insertTriggerIfAbsent(
    userId: number | string,
    triggerType: TriggerType,
  ): Promise<boolean>;
}

export interface UsageSnapshot {
  /** Number of free calls the user has made so far (inclusive of current). */
  freeCallsUsed: number;
  /** Optional: total free calls allowed. Defaults to FREE_CALL_LIMIT. */
  freeCallLimit?: number;
}

export interface UpsellDecision {
  /** Whether the upsell prompt should be shown on this response. */
  shouldPrompt: boolean;
  /** The trigger type that fired, if any. */
  triggerType?: TriggerType;
  /** Dynamically generated prompt text (A/B variant). */
  promptText?: string;
  /** A/B variant identifier for analytics. */
  variant?: "A" | "B";
}

/**
 * Determines whether the current call crosses the upsell threshold.
 * Pure function — no side effects.
 */
export function isThresholdCrossing(
  usage: UsageSnapshot,
  threshold: number = UPSELL_THRESHOLD,
): boolean {
  return usage.freeCallsUsed === threshold;
}

/**
 * Generates a contextual prompt based on the user's usage pattern.
 * Deterministic per user so the same user always sees the same variant
 * (stable A/B assignment).
 */
export function generatePrompt(
  userId: number | string,
  usage: UsageSnapshot,
): { text: string; variant: "A" | "B" } {
  const limit = usage.freeCallLimit ?? FREE_CALL_LIMIT;
  const remaining = Math.max(limit - usage.freeCallsUsed, 0);
  const variant = pickVariant(userId);

  if (variant === "A") {
    return {
      variant,
      text:
        `You've used half of your free calls (${usage.freeCallsUsed}/${limit}). ` +
        `Upgrade now to keep building without interruption — ${remaining} free calls left.`,
    };
  }

  return {
    variant,
    text:
      `Nice progress! You're at ${usage.freeCallsUsed}/${limit} free calls. ` +
      `Unlock unlimited usage and advanced features with a paid plan.`,
  };
}

function pickVariant(userId: number | string): "A" | "B" {
  const key = String(userId);
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2 === 0 ? "A" : "B";
}

/**
 * Evaluates usage and, if the threshold is crossed, records the trigger
 * (idempotently) and returns the prompt decision.
 */
export async function evaluateUpsell(
  store: UpsellStore,
  userId: number | string,
  usage: UsageSnapshot,
): Promise<UpsellDecision> {
  if (!isThresholdCrossing(usage)) {
    return { shouldPrompt: false };
  }

  const triggerType: TriggerType = "half_free_credits";
  const inserted = await store.insertTriggerIfAbsent(userId, triggerType);

  if (!inserted) {
    // Already fired for this user — do not double-trigger.
    return { shouldPrompt: false, triggerType };
  }

  const { text, variant } = generatePrompt(userId, usage);
  return {
    shouldPrompt: true,
    triggerType,
    promptText: text,
    variant,
  };
}

/**
 * Express-style middleware. Attaches the upsell decision to `res.locals`
 * and sets the `X-Upsell-Prompt` header when a prompt should be shown.
 *
 * Expects `req.user.id` and `req.usage` (UsageSnapshot) to be populated by
 * upstream middleware.
 */
export function upsellMiddleware(store: UpsellStore) {
  return async function upsell(
    req: any,
    res: any,
    next: (err?: unknown) => void,
  ): Promise<void> {
    try {
      const userId = req?.user?.id;
      const usage: UsageSnapshot | undefined = req?.usage;

      if (userId == null || usage == null) {
        return next();
      }

      const decision = await evaluateUpsell(store, userId, usage);

      res.locals = res.locals ?? {};
      res.locals.upsell = decision;

      if (decision.shouldPrompt) {
        res.setHeader(UPSELL_HEADER, "true");
        if (decision.variant) {
          res.setHeader("X-Upsell-Variant", decision.variant);
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
