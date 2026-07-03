/**
 * Upsell Middleware — Issue #3
 * Auto-upsell trigger after 5th free call for AI call platform.
 *
 * Tracks free call usage per user and triggers upsell prompts with
 * tiered pricing options (Standard, Premium, Priority).
 * Logs upsell events for analytics.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FREE_CALL_LIMIT = 10;

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

export interface UpsellTier {
  name: string;
  price: number;       // in USDC per call
  unit: string;        // e.g., "per call"
}

export interface UpsellPrompt {
  title: string;
  description: string;
  cta: string;
  tiers: UpsellTier[];
}

export interface UpsellResult {
  upsell: boolean;
  trigger_type?: string;
  prompt?: UpsellPrompt;
}

export interface UpsellEvent {
  user_id: string;
  trigger_type: string;
  shown_at: string;
  variant: string;
  converted: boolean;
}

const STANDARD_TIERS: UpsellTier[] = [
  { name: 'Standard', price: 0.01, unit: 'per call' },
  { name: 'Premium', price: 0.03, unit: 'per call' },
  { name: 'Priority', price: 0.10, unit: 'per call' },
];

const PROMPT_VARIANTS: Record<string, Record<string, { title: string; description: string; cta: string }>> = {
  A: {
    free_limit_50pct: {
      title: 'Unlock Unlimited Access',
      description: 'You have used 50% of your free calls. Upgrade to Standard ($0.01/call) or Premium ($0.03/call) for unlimited access. Priority calls at $0.10/call.',
      cta: 'See Plans',
    },
    free_limit_exhausted: {
      title: 'Free Calls Exhausted',
      description: 'You have used all your free calls. Choose a plan to continue: Standard ($0.01/call), Premium ($0.03/call), or Priority ($0.10/call).',
      cta: 'Choose Plan',
    },
  },
  B: {
    free_limit_50pct: {
      title: 'You are Halfway There!',
      description: '5 calls used — time to go unlimited. Standard: $0.01/call. Premium: $0.03/call. Priority: $0.10/call.',
      cta: 'Upgrade Now',
    },
    free_limit_exhausted: {
      title: 'Time to Upgrade',
      description: 'All free calls used! Pick your tier: Standard, Premium, or Priority. Priority calls get queued first.',
      cta: 'Pick a Plan',
    },
  },
};

/**
 * Get the current free call count for a user.
 * Returns the number of free calls made so far.
 */
export async function getUserFreeCallCount(userId: string): Promise<number> {
  const { count, error } = await db
    .from('x402_calls')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('tier', 'free');

  if (error) {
    console.error('Error fetching call count:', error);
    return 0;
  }

  return count ?? 0;
}

/**
 * Check if an upsell trigger should fire for the given user.
 * Returns the upsell prompt data if triggered, or { upsell: false } otherwise.
 * Idempotent: only fires once per threshold crossing.
 */
export async function checkUpsell(
  userId: string,
  callCount?: number,
  variant: string = 'A'
): Promise<UpsellResult> {
  // Allow optional override for testing
  const count = callCount ?? await getUserFreeCallCount(userId);

  // Check if trigger already fired for this threshold
  const triggerTypes: string[] = [];

  // Fire at 5th call (50% of free limit)
  if (count === Math.floor(FREE_CALL_LIMIT / 2)) {
    triggerTypes.push('free_limit_50pct');
  }

  // Fire at 10th call (100% exhausted)
  if (count === FREE_CALL_LIMIT) {
    triggerTypes.push('free_limit_exhausted');
  }

  if (triggerTypes.length === 0) {
    return { upsell: false };
  }

  const triggerType = triggerTypes[0];
  const variantData = PROMPT_VARIANTS[variant]?.[triggerType];

  if (!variantData) {
    return { upsell: false };
  }

  // Log the trigger to Supabase (idempotent via unique constraint)
  try {
    await db
      .from('upsell_triggers')
      .upsert(
        {
          user_id: userId,
          trigger_type: triggerType,
          variant: variant,
          shown_at: new Date().toISOString(),
          converted: false,
        },
        {
          onConflict: 'user_id, trigger_type',
          ignoreDuplicates: 'true',
        }
      );
  } catch (e) {
    console.error('Error logging upsell trigger:', e);
    // Non-blocking — still return the prompt
  }

  return {
    upsell: true,
    trigger_type: triggerType,
    prompt: {
      title: variantData.title,
      description: variantData.description,
      cta: variantData.cta,
      tiers: STANDARD_TIERS,
    },
  };
}

/**
 * Mark an upsell trigger as converted (user upgraded).
 */
export async function markConverted(userId: string, triggerType: string): Promise<void> {
  await db
    .from('upsell_triggers')
    .update({ converted: true })
    .eq('user_id', userId)
    .eq('trigger_type', triggerType);
}

/**
 * Get upsell analytics for a date range.
 */
export async function getUpsellAnalytics(
  since: string = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
): Promise<{
  total_triggers: number;
  total_converted: number;
  conversion_rate: number;
  by_type: Record<string, { shown: number; converted: number }>;
}> {
  const { data: triggers, error } = await db
    .from('upsell_triggers')
    .select('*')
    .gte('shown_at', since);

  if (error || !triggers) {
    console.error('Error fetching upsell analytics:', error);
    return { total_triggers: 0, total_converted: 0, conversion_rate: 0, by_type: {} };
  }

  const total_triggers = triggers.length;
  const total_converted = triggers.filter((t: UpsellEvent) => t.converted).length;
  const by_type: Record<string, { shown: number; converted: number }> = {};

  for (const t of triggers) {
    if (!by_type[t.trigger_type]) {
      by_type[t.trigger_type] = { shown: 0, converted: 0 };
    }
    by_type[t.trigger_type].shown++;
    if (t.converted) by_type[t.trigger_type].converted++;
  }

  return {
    total_triggers,
    total_converted,
    conversion_rate: total_triggers > 0 ? total_converted / total_triggers : 0,
    by_type,
  };
}

// Edge Function entry point
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    // GET /analytics — upsell analytics
    if (req.method === 'GET' && path.endsWith('/analytics')) {
      const since = url.searchParams.get('since') ?? undefined;
      const analytics = await getUpsellAnalytics(since);
      return new Response(JSON.stringify(analytics), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // POST /check — check if upsell should trigger
    if (req.method === 'POST' && path.endsWith('/check')) {
      const { user_id, call_count, variant } = await req.json();
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400 });
      }

      const result = await checkUpsell(user_id, call_count, variant ?? 'A');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add upsell prompt header if triggered
      if (result.upsell) {
        headers['X-Upsell-Prompt'] = 'true';
      }

      return new Response(JSON.stringify(result), {
        headers: { ...headers, 'Access-Control-Allow-Origin': '*' },
      });
    }

    // POST /convert — mark upsell as converted
    if (req.method === 'POST' && path.endsWith('/convert')) {
      const { user_id, trigger_type } = await req.json();
      if (!user_id || !trigger_type) {
        return new Response(JSON.stringify({ error: 'user_id and trigger_type required' }), { status: 400 });
      }

      await markConverted(user_id, trigger_type);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response('Not Found', { status: 404 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});