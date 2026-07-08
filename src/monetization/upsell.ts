/**
 * Auto-Upsell Trigger — Issue #3
 *
 * Triggers a contextual upgrade prompt when a user reaches 50% of their
 * free credit limit (5th free call out of 10).
 *
 * Features:
 *  - Middleware function that checks call count and sets trigger flag
 *  - Four A/B test-ready prompt variants
 *  - Idempotent — fires exactly once per threshold crossing
 *  - Tracks conversion events in upsell_triggers table
 *
 * SQL migration: migrations/add_upsell_triggers.sql
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UpsellTrigger {
  id: string;
  user_id: string;
  trigger_type: string;
  shown_at: string;
  converted: boolean;
}

export interface UpsellCheckResult {
  upsell: boolean;
  prompt?: string;
  trigger_type?: string;
  variant?: string;
}

export interface UpsellPrompt {
  text: string;
  variant: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FREE_CALL_LIMIT = 10;
const UPSELL_THRESHOLD = 5; // 50% of free calls
const TRIGGER_TYPE = 'free_limit_50pct';

// ---------------------------------------------------------------------------
// Prompt Variants (A/B test ready)
// ---------------------------------------------------------------------------

const PROMPT_VARIANTS: UpsellPrompt[] = [
  {
    variant: 'A',
    text: 'You have used 50% of your free calls. Upgrade for unlimited access — just $0.01/call after.',
  },
  {
    variant: 'B',
    text: "Half your free calls are gone! Don't stop now — go unlimited from $0.01/call.",
  },
  {
    variant: 'C',
    text: '🚀 You are halfway through your free trial. Upgrade now and get priority support + unlimited calls.',
  },
  {
    variant: 'D',
    text: 'Smart developers upgrade at 50%. Keep building without limits — pay only $0.01 per call.',
  },
];

/**
 * Select a prompt variant based on user_id for consistent A/B assignment.
 * Uses a simple hash to assign the same variant to the same user each time.
 */
function selectVariant(userId: string): UpsellPrompt {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = hash % PROMPT_VARIANTS.length;
  return PROMPT_VARIANTS[index];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if an upsell trigger should fire for a user at the given call count.
 *
 * Returns an UpsellCheckResult:
 *  - upsell: true if the threshold was crossed and trigger was recorded
 *  - prompt: the upsell message (only when upsell is true)
 *  - trigger_type: the type of trigger fired
 *  - variant: which A/B variant was shown
 *
 * Idempotent: the underlying SQL uses ON CONFLICT DO NOTHING so the trigger
 * fires exactly once per threshold crossing.
 */
export async function checkUpsellTrigger(
  userId: string,
  callCount: number,
): Promise<UpsellCheckResult> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('userId is required and must be a string');
  }
  if (!Number.isSafeInteger(callCount) || callCount < 0) {
    throw new Error('callCount must be a non-negative safe integer');
  }

  // Only trigger at the exact threshold
  if (callCount !== UPSELL_THRESHOLD) {
    return { upsell: false };
  }

  // Call the PostgreSQL function (defined in migration)
  const { data, error } = await db.rpc('check_upsell_trigger', {
    p_user_id: userId,
    p_call_count: callCount,
  });

  if (error) {
    throw new Error(`Failed to check upsell trigger: ${error.message}`);
  }

  const result = data as { upsell: boolean; prompt?: string };

  if (result.upsell) {
    const variant = selectVariant(userId);
    return {
      upsell: true,
      prompt: variant.text,
      trigger_type: TRIGGER_TYPE,
      variant: variant.variant,
    };
  }

  return { upsell: false };
}

/**
 * Generate an upsell middleware handler that can be used in API route handlers.
 *
 * Example usage:
 * ```ts
 * const middleware = createUpsellMiddleware();
 * const result = await middleware(userId, currentCallCount);
 * if (result.upsell) {
 *   // Set X-Upsell-Prompt header in response
 *   headers.set('X-Upsell-Prompt', 'true');
 *   headers.set('X-Upsell-Message', result.prompt);
 * }
 * ```
 */
export function createUpsellMiddleware() {
  return async (userId: string, callCount: number): Promise<UpsellCheckResult> => {
    return await checkUpsellTrigger(userId, callCount);
  };
}

/**
 * Mark an upsell trigger as converted (user upgraded to paid).
 */
export async function markUpsellConverted(
  userId: string,
  triggerType: string = TRIGGER_TYPE,
): Promise<boolean> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('userId is required and must be a string');
  }

  const { error } = await db
    .from('upsell_triggers')
    .update({ converted: true })
    .eq('user_id', userId)
    .eq('trigger_type', triggerType);

  if (error) throw new Error(`Failed to mark upsell converted: ${error.message}`);
  return true;
}

/**
 * Get upsell trigger history for a user.
 */
export async function getUpsellHistory(
  userId: string,
): Promise<UpsellTrigger[]> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('userId is required and must be a string');
  }

  const { data, error } = await db
    .from('upsell_triggers')
    .select('id, user_id, trigger_type, shown_at, converted')
    .eq('user_id', userId)
    .order('shown_at', { ascending: false });

  if (error) throw new Error(`Failed to get upsell history: ${error.message}`);
  return (data ?? []) as UpsellTrigger[];
}

/**
 * Get all available prompt variants for A/B testing analysis.
 */
export function getPromptVariants(): UpsellPrompt[] {
  return [...PROMPT_VARIANTS];
}

/**
 * Get the configured threshold for upsell triggers.
 */
export function getUpsellThreshold(): number {
  return UPSELL_THRESHOLD;
}

/**
 * Check whether a given call count is the upsell threshold.
 * Pure function, no side effects — useful for middleware routing.
 */
export function isUpsellThreshold(callCount: number): boolean {
  return callCount === UPSELL_THRESHOLD;
}
