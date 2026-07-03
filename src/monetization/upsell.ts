/**
 * Auto-Upsell Trigger — Issue #3
 * Triggers a contextual upgrade prompt when user reaches 50% of free credit limit.
 * Fires exactly once per threshold crossing. Idempotent.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const FREE_CALL_LIMIT = 10;
const UPSELL_THRESHOLD = 5; // 50% of free limit

export interface UpsellResult {
  shouldPrompt: boolean;
  promptVariant?: string;
  promptText?: string;
  triggerType: 'free_usage_threshold' | 'none';
}

/**
 * Prompt variants for A/B testing.
 * Each variant targets a different user psychology.
 */
const PROMPT_VARIANTS: Record<string, string> = {
  value: 'You have used 5 of 10 free calls. Upgrade now to unlock unlimited calls starting at just /usr/bin/bash.01/call — save 90% compared to pay-as-you-go.',
  social: 'Join 500+ developers who upgraded to get priority API access and faster response times. Continue with free credits?',
  scarcity: 'Your free trial is 50% complete. Premium users get 3x faster inference. Lock in the launch rate today.',
  feature: 'Did you know? Premium tier unlocks batch processing, custom rate limits, and dedicated support. Upgrade in 1 click.',
};

/**
 * Checks if a user has hit the upsell threshold.
 * Returns the upsell trigger info if threshold is met and not already triggered.
 */
export async function checkUpsellThreshold(
  userId: string,
  callCount: number
): Promise<UpsellResult> {
  // Only trigger at exactly the threshold (5th call), not above
  if (callCount !== UPSELL_THRESHOLD) {
    return { shouldPrompt: false, triggerType: 'none' };
  }

  // Check if trigger already exists for this user (idempotent)
  const { data: existing } = await db
    .from('upsell_triggers')
    .select('id')
    .eq('user_id', userId)
    .eq('trigger_type', 'free_usage_threshold')
    .maybeSingle();

  if (existing) {
    return { shouldPrompt: false, triggerType: 'none' };
  }

  // Select prompt variant based on user_id hash for consistent A/B assignment
  const variantKeys = Object.keys(PROMPT_VARIANTS);
  const variantIndex = simpleHash(userId) % variantKeys.length;
  const variant = variantKeys[variantIndex];

  // Record the trigger
  await db.from('upsell_triggers').insert({
    user_id: userId,
    trigger_type: 'free_usage_threshold',
    call_count_at_trigger: callCount,
    shown_at: new Date().toISOString(),
    prompt_variant: variant,
  });

  return {
    shouldPrompt: true,
    promptVariant: variant,
    promptText: PROMPT_VARIANTS[variant],
    triggerType: 'free_usage_threshold',
  };
}

/**
 * Simple string hash for deterministic A/B assignment.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Edge function entry point.
 * Expected body: { user_id: string, call_count: number }
 * Returns: X-Upsell-Prompt header in response + prompt data.
 */
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { user_id, call_count } = await req.json();
    if (!user_id || call_count === undefined) {
      return new Response(
        JSON.stringify({ error: 'user_id and call_count required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await checkUpsellThreshold(user_id, call_count);

    return new Response(
      JSON.stringify({ ok: true, ...result }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Upsell-Prompt': result.shouldPrompt ? 'true' : 'false',
        },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
