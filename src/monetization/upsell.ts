/**
 * Auto-upsell Trigger — Issue #3
 * Fires contextual upgrade prompt when user reaches 50% of free credit limit.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

export interface UpsellResult {
  upsell: boolean;
  prompt: string | null;
  trigger_type: string | null;
}

/**
 * Check if an upsell trigger should fire for a user at a given call count.
 * Fires at 5th call (50% of 10 free calls).
 * Idempotent: fires exactly once per threshold crossing.
 */
export async function check_upsell_trigger(user_id: string, call_count: number): Promise<UpsellResult> {
  if (call_count !== 5) {
    return { upsell: false, prompt: null, trigger_type: null };
  }

  const { data: existing } = await db
    .from('upsell_triggers')
    .select('id')
    .eq('user_id', user_id)
    .eq('trigger_type', 'free_limit_50pct')
    .maybeSingle();

  if (existing) {
    return { upsell: false, prompt: null, trigger_type: null };
  }

  const { error: insertError } = await db
    .from('upsell_triggers')
    .insert({ user_id, trigger_type: 'free_limit_50pct' });

  if (insertError) {
    if (insertError.message?.includes('unique') || insertError.message?.includes('duplicate')) {
      return { upsell: false, prompt: null, trigger_type: null };
    }
    throw new Error(`Failed to log upsell trigger: ${insertError.message}`);
  }

  const prompts = [
    'You have used 50% of your free calls. Upgrade for unlimited access.',
    'Halfway through your free tier! Upgrade now and keep going without limits.',
    '5 of 10 free calls used. Unlock unlimited API access with a single upgrade.',
  ];

  const abIndex = hashString(user_id) % prompts.length;
  const prompt = prompts[abIndex];

  return { upsell: true, prompt, trigger_type: 'free_limit_50pct' };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export async function markConverted(user_id: string, trigger_type: string): Promise<void> {
  await db
    .from('upsell_triggers')
    .update({ converted: true })
    .eq('user_id', user_id)
    .eq('trigger_type', trigger_type);
}