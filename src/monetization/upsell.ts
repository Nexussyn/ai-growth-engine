/**
 * Upsell trigger logic.
 *
 * Fires a contextual upgrade prompt when a user crosses 50% of their free
 * credit limit (e.g. the 5th of 10 free calls). The trigger is idempotent:
 * it fires exactly once per threshold crossing, enforced by a UNIQUE
 * constraint on (user_id, trigger_type) plus an ON CONFLICT DO NOTHING insert.
 */

export const FREE_CALL_LIMIT = 10;
export const UPSELL_THRESHOLD = Math.floor(FREE_CALL_LIMIT / 2); // 5
export const UPSELL_TRIGGER_TYPE = "free_calls_50pct";
export const UPSELL_HEADER = "X-Upsell-Prompt";

/** Minimal DB interface so this module stays testable without a real driver. */
export interface UpsellDb {
  /**
   * Insert a trigger row. Must be idempotent: return true only if a new row
   * was actually inserted (i.e. the threshold was crossed for the first time).
   */
  insertTrigger(params: {
    userId: number | string;
    triggerType: string;
    metadata: Record<string, unknown>;
  }): Promise<boolean>;
}

export interface UpsellContext {
  userId: number | string;
  /** Number of free calls the user has made *including* the current one. */
  callCount: number;
  /** Optional usage pattern used to pick a prompt variant. */
  usagePattern?: UsagePattern;
}

export interface UsagePattern {
  /** Total calls made in the current billing period. */
  callsThisPeriod?: number;
  /** Average calls per day, if known. */
  avgCallsPerDay?: number;
  /** Feature/endpoint the user calls most, if known. */
  topFeature?: string;
}

export interface UpsellResult {
  /** Whether the upsell prompt should be shown on this response. */
  triggered: boolean;
  /** Prompt text to surface to the user (only when triggered). */
  prompt?: string;
  /** A/B variant identifier (only when triggered). */
  variant?: string;
  /** Headers to merge into the HTTP response. */
  headers: Record<string, string>;
}

/**
 * A/B test variants. Each variant is a function of the usage pattern so the
 * prompt text is contextual rather than generic.
 */
export interface UpsellVariant {
  id: string;
  /** Relative weight for A/B assignment. */
  weight: number;
  render(ctx: UpsellContext): string;
}

export const UPSELL_VARIANTS: UpsellVariant[] = [
  {
    id: "A",
    weight: 50,
    render(ctx) {
      const remaining = Math.max(FREE_CALL_LIMIT - ctx.callCount, 0);
      return (
        `You've used half of your free calls — ${remaining} left. ` +
        `Upgrade now to keep going without interruption.`
      );
    },
  },
  {
    id: "B",
    weight: 50,
    render(ctx) {
      const feature = ctx.usagePattern?.topFeature;
      const featureLine = feature
        ? `You're getting great value from ${feature}. `
        : "";
      return (
        `${featureLine}You're halfway through your free credits. ` +
        `Upgrade to unlock unlimited access and priority support.`
      );
    },
  },
];

/**
 * Deterministically pick a variant for a user so the same user always sees
 * the same variant (stable A/B assignment).
 */
export function pickVariant(userId: number | string): UpsellVariant {
  const totalWeight = UPSELL_VARIANTS.reduce((sum, v) => sum + v.weight, 0);
  const hash = stableHash(String(userId));
  let bucket = hash % totalWeight;
  for (const variant of UPSELL_VARIANTS) {
    if (bucket < variant.weight) return variant;
    bucket -= variant.weight;
  }
  return UPSELL_VARIANTS[0];
}

/** Small, dependency-free string hash (FNV-1a 32-bit). */
function stableHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Returns true when the given call count is exactly at the upsell threshold.
 * Crossing detection is done by the caller comparing previous vs current
 * count; this helper answers "is this the threshold call?".
 */
export function isUpsellThreshold(callCount: number): boolean {
  return callCount === UPSELL_THRESHOLD;
}

/**
 * Core middleware logic. Call this after incrementing the user's call count
 * for the current request.
 *
 * Idempotency: even if this is invoked multiple times for the same user at
 * the threshold, the DB insert is a no-op after the first time, so the
 * prompt is only surfaced once.
 */
export async function evaluateUpsell(
  db: UpsellDb,
  ctx: UpsellContext,
): Promise<UpsellResult> {
  const noTrigger: UpsellResult = { triggered: false, headers: {} };

  if (!isUpsellThreshold(ctx.callCount)) {
    return noTrigger;
  }

  const variant = pickVariant(ctx.userId);
  const prompt = variant.render(ctx);

  const inserted = await db.insertTrigger({
    userId: ctx.userId,
    triggerType: UPSELL_TRIGGER_TYPE,
    metadata: {
      variant: variant.id,
      callCount: ctx.callCount,
      usagePattern: ctx.usagePattern ?? {},
    },
  });

  // Already triggered previously — stay silent to keep it once-per-crossing.
  if (!inserted) {
    return noTrigger;
  }

  return {
    triggered: true,
    prompt,
    variant: variant.id,
    headers: {
      [UPSELL_HEADER]: "true",
      "X-Upsell-Variant": variant.id,
    },
  };
}

/**
 * Express-style middleware factory. Attaches the upsell result to
 * `res.locals.upsell` and sets response headers when triggered.
 *
 * Expects `req.user.id` and `req.freeCallCount` to be populated by upstream
 * auth / usage-tracking middleware.
 */
export function upsellMiddleware(db: UpsellDb) {
  return async function upsell(
    req: any,
    res: any,
    next: (err?: unknown) => void,
  ): Promise<void> {
    try {
      const userId = req?.user?.id;
      const callCount = req?.freeCallCount;

      if (userId == null || typeof callCount !== "number") {
        return next();
      }

      const result = await evaluateUpsell(db, {
        userId,
        callCount,
        usagePattern: req?.usagePattern,
      });

      res.locals = res.locals ?? {};
      res.locals.upsell = result;

      for (const [key, value] of Object.entries(result.headers)) {
        res.setHeader(key, value);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
