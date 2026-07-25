/**
 * Auto-Upsell Trigger System — Issue #3
 * Triggers contextual upgrade prompts when users reach 50% of their free credit limit.
 * Idempotent: fires exactly once per threshold per user.
 */

export interface DatabaseClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface UpsellResult {
  triggered: boolean;
  prompt?: string;
  variant?: 'A' | 'B';
  triggerType?: string;
}

/** A/B test prompt variants */
const PROMPT_VARIANTS = {
  A: "You've used 50% of your free calls. Upgrade now for unlimited access and priority support — plans start at $5/mo.",
  B: "Halfway through your free tier! Power users save 40% with our Pro plan. Upgrade before your calls run out.",
} as const;

/**
 * Deterministic A/B variant selection based on user_id hash.
 * Consistent: same user always sees the same variant.
 */
export function selectVariant(userId: string): 'A' | 'B' {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2 === 0 ? 'A' : 'B';
}

/**
 * Middleware-compatible function that checks if a user has crossed the
 * 50% free-call threshold (5 out of 10) and triggers an upsell prompt.
 *
 * Idempotent: uses INSERT ... ON CONFLICT DO NOTHING to ensure the
 * trigger fires exactly once per user per trigger_type.
 *
 * @param db - Database client
 * @param userId - The user making the API call
 * @param callCount - The user's current total call count (after this call)
 * @returns UpsellResult indicating whether a prompt was triggered
 */
export async function checkUpsellTrigger(
  db: DatabaseClient,
  userId: string,
  callCount: number,
): Promise<UpsellResult> {
  const FREE_LIMIT = 10;
  const THRESHOLD = Math.floor(FREE_LIMIT / 2); // 5

  // Only trigger at exactly the threshold call
  if (callCount !== THRESHOLD) {
    return { triggered: false };
  }

  const triggerType = 'free_limit_50pct';

  // Idempotent insert — ON CONFLICT prevents double-trigger
  const result = await db.query(
    `INSERT INTO upsell_triggers (user_id, trigger_type)
     VALUES ($1, $2)
     ON CONFLICT (user_id, trigger_type) DO NOTHING
     RETURNING id`,
    [userId, triggerType],
  );

  // If no row returned, the trigger already fired for this user
  if (result.rows.length === 0) {
    return { triggered: false };
  }

  const variant = selectVariant(userId);

  // Log to system_events
  await db.query(
    `INSERT INTO system_events (type, user_id, metadata)
     VALUES ($1, $2, $3)`,
    [
      'upsell_trigger_fired',
      userId,
      JSON.stringify({ trigger_type: triggerType, variant, call_count: callCount }),
    ],
  );

  return {
    triggered: true,
    prompt: PROMPT_VARIANTS[variant],
    variant,
    triggerType,
  };
}

/**
 * Express/Hono-style middleware factory.
 * Attaches X-Upsell-Prompt header to responses when threshold is crossed.
 *
 * Usage:
 *   app.use(upsellMiddleware(db, getUserCallCount));
 */
export function upsellMiddleware(
  db: DatabaseClient,
  getCallCount: (userId: string) => Promise<number>,
) {
  return async (req: { userId?: string }, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    const userId = req.userId;
    if (!userId) {
      next();
      return;
    }

    const callCount = await getCallCount(userId);
    const result = await checkUpsellTrigger(db, userId, callCount);

    if (result.triggered && result.prompt) {
      res.setHeader('X-Upsell-Prompt', 'true');
      res.setHeader('X-Upsell-Text', result.prompt);
      res.setHeader('X-Upsell-Variant', result.variant!);
    }

    next();
  };
}
