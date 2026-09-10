/**
 * Auto-Upsell Trigger Engine — Issue #3
 * Triggers contextual upgrade prompts when users reach 50% of free credit limit (call #5).
 */

export interface UpsellTriggerRecord {
  id?: string;
  userId: string;
  triggerType: string;
  shownAt: Date;
  converted: boolean;
  variantId?: string;
}

export interface UpsellPromptVariant {
  id: string;
  headline: string;
  cta: string;
  discountText?: string;
}

export interface UpsellCheckResult {
  upsell: boolean;
  headerActive?: boolean;
  prompt?: string;
  variantId?: string;
  message?: string;
}

export interface UpsellStore {
  triggers: Map<string, UpsellTriggerRecord>; // key: ${userId}:
  callCounts: Map<string, number>;
}

export const UPSELL_PROMPT_VARIANTS: UpsellPromptVariant[] = [
  {
    id: 'variant_a_urgency',
    headline: 'You have reached 50% of your free credit limit. Upgrade to Pro for unlimited requests.',
    cta: 'Upgrade to Unlimited',
    discountText: '20% off annual plan'
  },
  {
    id: 'variant_b_value',
    headline: 'Enjoying the speed? Unlock priority routing and zero rate limits.',
    cta: 'Unlock Priority Tier',
    discountText: 'Starts at .01/call'
  },
  {
    id: 'variant_c_social_proof',
    headline: 'Over 1,000 teams use AI Growth Engine without limits. Don\'t let your pipeline pause.',
    cta: 'Keep Running',
    discountText: 'Instant activation'
  }
];

export function createUpsellStore(): UpsellStore {
  return {
    triggers: new Map(),
    callCounts: new Map()
  };
}

/**
 * Selects an A/B test variant deterministically based on user ID.
 */
export function getPromptVariant(userId: string, variants = UPSELL_PROMPT_VARIANTS): UpsellPromptVariant {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % variants.length;
  return variants[index];
}

/**
 * Checks call count threshold (5th free call out of 10) and triggers upsell prompt.
 * - Idempotent: fires strictly once per user for the 'free_limit_50pct' trigger.
 */
export function checkUpsellTrigger(
  userId: string,
  callCount: number,
  store: UpsellStore,
  threshold = 5,
  triggerType = 'free_limit_50pct'
): UpsellCheckResult {
  const key = ${userId}:;

  // Idempotency: if already triggered, do not fire again
  if (store.triggers.has(key)) {
    return { upsell: false, message: 'Already triggered for this threshold' };
  }

  // Check exact threshold (5th call = 50% limit)
  if (callCount === threshold) {
    const variant = getPromptVariant(userId);
    store.triggers.set(key, {
      userId,
      triggerType,
      shownAt: new Date(),
      converted: false,
      variantId: variant.id
    });

    return {
      upsell: true,
      headerActive: true,
      prompt: variant.headline,
      variantId: variant.id
    };
  }

  return { upsell: false };
}

/**
 * HTTP Middleware helper to evaluate calls and apply 'X-Upsell-Prompt: true' header.
 */
export function evaluateUpsellMiddleware(
  userId: string,
  store: UpsellStore,
  currentCallCount: number
): { headers: Record<string, string>; prompt?: string } {
  const result = checkUpsellTrigger(userId, currentCallCount, store);
  const headers: Record<string, string> = {};

  if (result.upsell && result.headerActive) {
    headers['X-Upsell-Prompt'] = 'true';
    headers['X-Upsell-Variant'] = result.variantId || 'default';
  }

  return { headers, prompt: result.prompt };
}
