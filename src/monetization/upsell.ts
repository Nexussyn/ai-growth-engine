/**
 * Auto-Upsell Trigger Middleware — Issue #3
 * Triggers contextual upgrade prompt on the 5th free call (50% of 10-call limit) exactly once per user.
 */

export interface UpsellTriggerRow {
  user_id: string;
  trigger_type: string;
  variant: 'A' | 'B';
  shown_at: string;
  converted: boolean;
}

export interface UpsellCheckResult {
  triggered: boolean;
  headers: Record<string, string>;
  prompt?: string;
  variant?: 'A' | 'B';
}

export const UPSELL_VARIANTS = {
  A: (usagePattern: string) =>
    `You have reached 50% of your free tier (5/10 calls) on ${usagePattern}. Upgrade now for unlimited x402 throughput.`,
  B: (usagePattern: string) =>
    `Halfway through your free credits! Unlock priority ${usagePattern} execution and save 25% with a Standard plan.`,
};

export class UpsellTriggerStore {
  rows = new Map<string, UpsellTriggerRow>();
}

export function evaluateUpsellMiddleware(
  userId: string,
  callCount: number,
  store: UpsellTriggerStore,
  usagePattern = 'API calls',
  freeLimit = 10
): UpsellCheckResult {
  const threshold = Math.floor(freeLimit * 0.5);
  const triggerKey = `${userId}:free_limit_50pct`;

  if (callCount !== threshold || store.rows.has(triggerKey)) {
    return { triggered: false, headers: {} };
  }

  const variant: 'A' | 'B' = userId.charCodeAt(0) % 2 === 0 ? 'A' : 'B';
  const prompt = UPSELL_VARIANTS[variant](usagePattern);

  store.rows.set(triggerKey, {
    user_id: userId,
    trigger_type: 'free_limit_50pct',
    variant,
    shown_at: new Date().toISOString(),
    converted: false,
  });

  return {
    triggered: true,
    headers: { 'X-Upsell-Prompt': 'true' },
    prompt,
    variant,
  };
}
