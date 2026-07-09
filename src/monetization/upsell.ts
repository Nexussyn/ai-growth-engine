/**
 * Upsell Trigger — Issue #3
 * Client-side logic for triggering contextual upgrade prompts.
 * Calls the Supabase Edge Function that wraps check_upsell_trigger().
 */

export interface UpsellResult {
  upsell: boolean;
  prompt?: string;
  promptVariant?: string;
}

const UPSELL_PROMPTS = [
  'You have used 50% of your free calls. Upgrade for unlimited access — just $0.01/call after.',
  'Half your free credits are gone! Unlock premium features starting at $0.01/call.',
  'You are 50% through your free tier. Upgrade now to keep the momentum going.',
  'Pro tip: Premium users get priority routing and faster responses. Upgrade today.',
  'You have earned 5+ completions! Power users upgrade to Standard tier for $0.01/call.',
];

const SUPABASE_FN_URL = Deno.env.get('SUPABASE_FN_URL') ?? 'https://kjtirbnxxymeumycrhqv.supabase.co/functions/v1';

/**
 * Checks if an upsell trigger should fire for this user.
 * Returns the prompt variant and trigger status.
 */
export async function checkUpsell(userId: string, callCount: number): Promise<UpsellResult> {
  const res = await fetch(`${SUPABASE_FN_URL}/check-upsell`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, call_count: callCount }),
  });

  if (!res.ok) {
    throw new Error(`Upsell check failed: ${res.status}`);
  }

  const data = await res.json();
  
  if (data.upsell) {
    // Pick a prompt variant based on user_id for A/B testing stability
    const variantIndex = Math.abs(hashString(userId)) % UPSELL_PROMPTS.length;
    const prompt = data.prompt ?? UPSELL_PROMPTS[variantIndex];
    return { upsell: true, prompt, promptVariant: `variant-${variantIndex}` };
  }

  return { upsell: false };
}

/**
 * Checks locally whether an upsell should fire (no API call).
 * Useful for middleware/edge checks.
 */
export function shouldShowUpsell(callCount: number): boolean {
  return callCount === 5; // 50% of 10 free calls
}

/**
 * Returns the A/B test prompt variant for a user.
 */
export function getPromptVariant(userId: string): string {
  const idx = Math.abs(hashString(userId)) % UPSELL_PROMPTS.length;
  return UPSELL_PROMPTS[idx];
}

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

/** All prompt variants for reference */
export const PROMPT_VARIANTS = UPSELL_PROMPTS;
