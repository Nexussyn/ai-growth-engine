/**
 * Auto-upsell trigger after free-tier midpoint (issue #3).
 * Default free quota = 10 calls; midpoint trigger = 5th call.
 */

export const FREE_QUOTA = 10;
export const UPSELL_THRESHOLD = Math.ceil(FREE_QUOTA / 2); // 5

export type UpsellVariant = 'A' | 'B';

export interface UpsellPrompt {
  variant: UpsellVariant;
  text: string;
  headerValue: 'true';
}

export interface UpsellDecision {
  shouldTrigger: boolean;
  alreadyTriggered: boolean;
  prompt?: UpsellPrompt;
}

const PROMPTS: Record<UpsellVariant, string> = {
  A: 'You are halfway through free calls. Upgrade to Standard ($0.01/call) for uninterrupted access.',
  B: 'Power users convert here: unlock Priority routing after your free tier. Upgrade now?',
};

/**
 * Pure threshold check: trigger exactly when callCount hits UPSELL_THRESHOLD
 * and the user has not already been shown this trigger type.
 */
export function evaluateUpsellTrigger(input: {
  callCount: number;
  alreadyTriggered: boolean;
  variant?: UpsellVariant;
}): UpsellDecision {
  const variant = input.variant ?? 'A';
  if (input.alreadyTriggered) {
    return { shouldTrigger: false, alreadyTriggered: true };
  }
  if (input.callCount !== UPSELL_THRESHOLD) {
    return { shouldTrigger: false, alreadyTriggered: false };
  }
  return {
    shouldTrigger: true,
    alreadyTriggered: false,
    prompt: {
      variant,
      text: PROMPTS[variant],
      headerValue: 'true',
    },
  };
}

/**
 * Middleware-style helper: returns headers to attach when trigger fires.
 * Idempotent: callers pass whether DB already has a row for this user/type.
 */
export function buildUpsellHeaders(decision: UpsellDecision): Record<string, string> {
  if (!decision.shouldTrigger || !decision.prompt) return {};
  return {
    'X-Upsell-Prompt': decision.prompt.headerValue,
    'X-Upsell-Variant': decision.prompt.variant,
    'X-Upsell-Text': decision.prompt.text,
  };
}

/** SQL upsert shape for documenting insert path (no DB driver required). */
export function upsellInsertSql(userId: string, variant: UpsellVariant): string {
  return (
    `INSERT INTO upsell_triggers (user_id, trigger_type, prompt_variant, converted) ` +
    `VALUES ('${userId.replace(/'/g, "''")}', 'free_half_quota', '${variant}', FALSE) ` +
    `ON CONFLICT (user_id, trigger_type) DO NOTHING`
  );
}
