/**
 * Upsell Trigger Middleware — Issue #3
 * Detects when a free-tier user reaches 50% of their free credit limit
 * (the 5th call out of 10 free calls) and records/returns an upsell
 * prompt exactly once per threshold crossing (idempotent).
 */

export const FREE_CALL_LIMIT = 10;
export const UPSELL_THRESHOLD = 5; // 50% of free limit
export const UPSELL_TRIGGER_TYPE = 'free_call_50pct';

export interface UpsellTriggerRow {
  user_id: string;
  trigger_type: string;
  shown_at: string;
  converted: boolean;
}

/**
 * Minimal DB client interface required by the middleware.
 * Compatible with a subset of the Supabase JS client's query builder,
 * so this can be wired up with `createClient(...)` in production or
 * with a lightweight mock in tests.
 */
export interface UpsellDbClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): {
          maybeSingle(): Promise<{ data: UpsellTriggerRow | null; error: unknown }>;
        };
      };
    };
    insert(row: Partial<UpsellTriggerRow>): Promise<{ data: unknown; error: unknown }>;
  };
}

/**
 * Prompt text variants for A/B testing.
 * Selection is deterministic per-user so the same user always sees the
 * same variant (avoids inconsistent UX across repeated calls).
 */
export const UPSELL_PROMPT_VARIANTS: readonly string[] = [
  "You've used 5 of your 10 free calls. Upgrade now to keep the momentum going — plans start at $0.01/call.",
  "Halfway there! 5/10 free calls used. Unlock unlimited calls with a paid plan today.",
  "Heads up: you're at 5/10 free calls. Upgrade anytime to avoid interruptions.",
];

/**
 * Deterministically picks a prompt variant based on the user id,
 * so A/B buckets are stable per-user.
 */
export function getUpsellPromptText(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  const idx = hash % UPSELL_PROMPT_VARIANTS.length;
  return UPSELL_PROMPT_VARIANTS[idx];
}

/**
 * Determines whether the given call count represents the exact
 * threshold-crossing call (the 5th free call).
 */
export function isUpsellThreshold(callCount: number): boolean {
  return callCount === UPSELL_THRESHOLD;
}

export interface UpsellCheckResult {
  shouldTrigger: boolean;
  headers: Record<string, string>;
  promptText: string | null;
}

/**
 * Middleware function: checks a user's current free call count and,
 * if it has just crossed the upsell threshold (5th call), inserts a
 * row into `upsell_triggers` and returns the header/prompt to attach
 * to the response.
 *
 * Idempotent: relies on the (user_id, trigger_type) uniqueness to
 * ensure the trigger is only ever recorded once. If a row already
 * exists for this user/trigger_type, no new row is inserted and
 * `shouldTrigger` is false.
 */
export async function checkUpsellTrigger(
  db: UpsellDbClient,
  userId: string,
  callCount: number
): Promise<UpsellCheckResult> {
  if (!isUpsellThreshold(callCount)) {
    return { shouldTrigger: false, headers: {}, promptText: null };
  }

  const { data: existing } = await db
    .from('upsell_triggers')
    .select('user_id, trigger_type, shown_at, converted')
    .eq('user_id', userId)
    .eq('trigger_type', UPSELL_TRIGGER_TYPE)
    .maybeSingle();

  if (existing) {
    // Already triggered for this user — do not double-trigger.
    return { shouldTrigger: false, headers: {}, promptText: null };
  }

  await db.from('upsell_triggers').insert({
    user_id: userId,
    trigger_type: UPSELL_TRIGGER_TYPE,
    shown_at: new Date().toISOString(),
    converted: false,
  });

  const promptText = getUpsellPromptText(userId);

  return {
    shouldTrigger: true,
    headers: { 'X-Upsell-Prompt': 'true' },
    promptText,
  };
}
