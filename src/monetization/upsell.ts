/**
 * Auto-upsell trigger — Issue #3
 *
 * Fires a contextual upgrade prompt once, when a user crosses 50% of their
 * free-credit allowance (the 5th call of 10), and surfaces it on the response
 * as `X-Upsell-Prompt: true`.
 *
 * Design notes
 * ------------
 * - The trigger is *crossing-based*, not equality-based: it fires for any
 *   `callCount >= UPSELL_THRESHOLD`, so a client that skips from call 4 to
 *   call 6 still gets prompted. The previous SQL used `p_call_count = 5`,
 *   which silently missed that case.
 * - Idempotency is enforced by the store: `recordTrigger` returns `true` only
 *   for the insert that wins. The losing (already-triggered) caller gets
 *   `upsell: false` and no header, so the prompt is never shown twice.
 * - The prompt text is chosen from A/B variants by a deterministic hash of the
 *   user id, so a given user always sees the same arm (stable experiment) and
 *   the split stays ~50/50 without storing an assignment.
 */

/** Free calls granted per user. */
export const FREE_CALL_LIMIT = 10;

/** 50% of the free allowance — the point at which we prompt. */
export const UPSELL_THRESHOLD = Math.ceil(FREE_CALL_LIMIT / 2); // 5

/** Trigger type recorded in `upsell_triggers.trigger_type`. */
export const UPSELL_TRIGGER_TYPE = "free_limit_50pct";

/** Response header set when a prompt is emitted. */
export const UPSELL_HEADER = "X-Upsell-Prompt";

export type PromptVariant = "A" | "B";

/** A/B variants — both are "A/B test ready"; pick with {@link pickVariant}. */
export const PROMPT_VARIANTS: Record<PromptVariant, (callCount: number, limit: number) => string> = {
  A: (callCount, limit) =>
    `You've used ${callCount} of ${limit} free calls. Upgrade for unlimited access.`,
  B: (callCount, limit) =>
    `${callCount}/${limit} free calls used — keep the momentum going with unlimited access.`,
};

export interface UpsellDecision {
  /** Whether a prompt should be shown for this call. */
  upsell: boolean;
  triggerType: string;
  variant?: PromptVariant;
  prompt?: string;
}

/**
 * Persistence boundary. Implementations MUST make `recordTrigger` atomic and
 * return `true` only for the caller that actually inserted the row.
 */
export interface UpsellTriggerStore {
  hasTriggered(userId: string, triggerType: string): Promise<boolean>;
  recordTrigger(userId: string, triggerType: string): Promise<boolean>;
}

/** True when this call count has reached the 50%-of-free-allowance threshold. */
export function isUpsellThreshold(callCount: number): boolean {
  return Number.isFinite(callCount) && callCount >= UPSELL_THRESHOLD;
}

/**
 * Deterministically assign a user to an A/B arm. Stable per user, ~50/50
 * across users, and independent of call count.
 */
export function pickVariant(userId: string): PromptVariant {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return (hash & 1) === 0 ? "A" : "B";
}

/** Render the prompt text for a variant. */
export function buildPrompt(
  variant: PromptVariant,
  callCount: number,
  limit: number = FREE_CALL_LIMIT,
): string {
  return PROMPT_VARIANTS[variant](callCount, limit);
}

/**
 * Decide whether to emit an upsell prompt, and reserve the trigger exactly
 * once. Returns `upsell: false` for below-threshold calls and for repeat calls
 * after the trigger already fired.
 */
export async function evaluateUpsell(
  userId: string,
  callCount: number,
  store: UpsellTriggerStore,
): Promise<UpsellDecision> {
  if (!isUpsellThreshold(callCount)) {
    return { upsell: false, triggerType: UPSELL_TRIGGER_TYPE };
  }

  // Fast path: never re-prompt a user we have already triggered.
  if (await store.hasTriggered(userId, UPSELL_TRIGGER_TYPE)) {
    return { upsell: false, triggerType: UPSELL_TRIGGER_TYPE };
  }

  // Atomic reserve — only the winner of a concurrent race gets `true`.
  const won = await store.recordTrigger(userId, UPSELL_TRIGGER_TYPE);
  if (!won) {
    return { upsell: false, triggerType: UPSELL_TRIGGER_TYPE };
  }

  const variant = pickVariant(userId);
  return {
    upsell: true,
    triggerType: UPSELL_TRIGGER_TYPE,
    variant,
    prompt: buildPrompt(variant, callCount),
  };
}

/** Headers to merge into the response for a decision. */
export function upsellHeaders(decision: UpsellDecision): Record<string, string> {
  return decision.upsell ? { [UPSELL_HEADER]: "true" } : {};
}

/**
 * Middleware helper: run the upsell check and return a copy of `response`
 * carrying `X-Upsell-Prompt: true` when the trigger fires. On any store error
 * the response is returned untouched — a monetization prompt must never break
 * an API call.
 */
export async function applyUpsellMiddleware(
  response: Response,
  userId: string,
  callCount: number,
  store: UpsellTriggerStore,
): Promise<Response> {
  try {
    const decision = await evaluateUpsell(userId, callCount, store);
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(upsellHeaders(decision))) headers.set(k, v);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
}

/**
 * In-memory store, useful for tests and for single-process deployments.
 * The `Set` gives the same "first writer wins" semantics as the SQL
 * `INSERT ... ON CONFLICT DO NOTHING RETURNING id`.
 */
export function createMemoryUpsellStore(): UpsellTriggerStore {
  const seen = new Set<string>();
  const key = (u: string, t: string) => `${u}\u0000${t}`;
  return {
    hasTriggered: (u, t) => Promise.resolve(seen.has(key(u, t))),
    recordTrigger: (u, t) => {
      const k = key(u, t);
      if (seen.has(k)) return Promise.resolve(false);
      seen.add(k);
      return Promise.resolve(true);
    },
  };
}

/**
 * Store backed by Supabase. `recordTrigger` relies on the unique constraint
 * `(user_id, trigger_type)` and a `select()` of the inserted row: an empty
 * result means the row already existed, so this caller did not win.
 */
export function createSupabaseUpsellStore(
  // Structural type: avoids importing the Supabase SDK at module load, so the
  // pure logic above stays runnable offline (tests, edge functions).
  client: {
    from(table: string): {
      select(columns: string): {
        eq(c: string, v: unknown): { eq(c: string, v: unknown): { maybeSingle(): Promise<{ data: unknown }> } };
      };
      insert(row: Record<string, unknown>): {
        select(columns: string): { maybeSingle(): Promise<{ data: unknown }> };
      };
    };
  },
): UpsellTriggerStore {
  const table = "upsell_triggers";
  return {
    async hasTriggered(userId, triggerType) {
      const { data } = await client.from(table).select("id").eq("user_id", userId)
        .eq("trigger_type", triggerType).maybeSingle();
      return Boolean(data);
    },
    async recordTrigger(userId, triggerType) {
      const { data } = await client.from(table)
        .insert({ user_id: userId, trigger_type: triggerType })
        .select("id").maybeSingle();
      return Boolean(data);
    },
  };
}
