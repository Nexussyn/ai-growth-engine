/**
 * Auto-Upsell Trigger Middleware — Issue #3
 * Detects when user hits 50% of free calls (5th call out of 10)
 * Sets X-Upsell-Prompt header and generates dynamic prompt variants
 * Handles idempotent triggers with race condition safety
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

export interface UpsellContext {
  userId: string;
  callCount: number;
  remainingCalls: number;
  tier: string;
}

export interface UpsellResponse {
  triggered: boolean;
  promptVariant?: string;
  promptText?: string;
  headersToSet: Record<string, string>;
}

export const PROMPT_VARIANTS = {
  a: {
    id: 'variant_a_scarcity',
    text: 'You\'ve used 50% of your free calls! 🔥 Upgrade now to unlock unlimited access.',
    cta: 'Upgrade to Pro',
    description: 'Scarcity-focused messaging'
  },
  b: {
    id: 'variant_b_value',
    text: 'Half your free calls gone! 📊 Pro users get 10x more. Upgrade for $9.99/month.',
    cta: 'See Pricing',
    description: 'ROI-focused messaging'
  },
  c: {
    id: 'variant_c_social',
    text: '50% of free calls used. 🚀 Join 10,000+ upgraded to Pro for unlimited access.',
    cta: 'Become Pro',
    description: 'Social proof-focused messaging'
  },
  d: {
    id: 'variant_d_ease',
    text: 'Only 5 calls left. Upgrade instantly—no hassle, instant access.',
    cta: 'Continue Unlimited',
    description: 'Friction minimization approach'
  },
  e: {
    id: 'variant_e_progress',
    text: 'Great job! You\'ve used 50% of your quota. Upgrade and unlock full power.',
    cta: 'Unlock Full Power',
    description: 'Progress/achievement-focused messaging'
  }
};

export function selectPromptVariant(userId: string, determineByUserId = false) {
  const variants = Object.values(PROMPT_VARIANTS);
  if (determineByUserId) {
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return variants[hash % variants.length];
  }
  return variants[Math.floor(Math.random() * variants.length)];
}

export async function checkUpsellTrigger(context: UpsellContext): Promise<UpsellResponse> {
  const { userId, callCount, remainingCalls, tier } = context;

  const shouldTrigger = callCount === 5 && tier === 'free' && remainingCalls === 5;

  if (!shouldTrigger) {
    return { triggered: false, headersToSet: {} };
  }

  try {
    const { error } = await db
      .from('upsell_triggers')
      .insert({
        user_id: userId,
        trigger_type: 'free_limit_50pct',
        shown_at: new Date().toISOString(),
        converted: false
      })
      .select()
      .maybeSingle();

    if (error && error.code === '23505') {
      return { triggered: false, headersToSet: { 'X-Upsell-Already-Shown': 'true' } };
    }

    if (error) {
      console.error('Upsell trigger DB error:', error);
      return { triggered: false, headersToSet: { 'X-Upsell-Error': 'database_error' } };
    }

    const variant = selectPromptVariant(userId, true);

    return {
      triggered: true,
      promptVariant: variant.id,
      promptText: variant.text,
      headersToSet: {
        'X-Upsell-Prompt': 'true',
        'X-Upsell-Variant': variant.id,
        'X-Upsell-CTA': variant.cta
      }
    };
  } catch (err) {
    console.error('Upsell check failed:', err);
    return { triggered: false, headersToSet: { 'X-Upsell-Error': 'unexpected_error' } };
  }
}

export async function markUpsellConverted(userId: string, variantId: string): Promise<boolean> {
  try {
    const { error } = await db
      .from('upsell_triggers')
      .update({
        converted: true,
        converted_at: new Date().toISOString(),
        variant_clicked: variantId
      })
      .eq('user_id', userId)
      .eq('trigger_type', 'free_limit_50pct');

    return !error;
  } catch (err) {
    console.error('Mark converted failed:', err);
    return false;
  }
}

export function createUpsellMiddleware() {
  return async (req: Request, userId: string, callCount: number): Promise<UpsellResponse> => {
    const totalFreeCalls = 10;
    const remainingCalls = Math.max(0, totalFreeCalls - callCount);
    const tier = callCount <= totalFreeCalls ? 'free' : 'paid';

    return checkUpsellTrigger({ userId, callCount, remainingCalls, tier });
  };
}
