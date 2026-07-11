/**
 * Upsell Prompt Variants — Issue #3
 * A/B test ready prompt templates for the 50% free limit trigger
 */

export type UpsellTone = 'friendly' | 'urgent' | 'value';

export interface UpsellPrompt {
  variant: string;
  tone: UpsellTone;
  title: string;
  body: string;
  cta: string;
}

const PROMPTS: UpsellPrompt[] = [
  {
    variant: 'A',
    tone: 'friendly',
    title: 'Loving the service?',
    body: "You've used half your free calls. Upgrade to keep going without limits.",
    cta: 'Go Unlimited',
  },
  {
    variant: 'B',
    tone: 'urgent',
    title: '5 calls remaining',
    body: 'Your free tier is 50% used. Don\'t lose access — upgrade now.',
    cta: 'Upgrade Now',
  },
  {
    variant: 'C',
    tone: 'value',
    title: 'Unlock full power',
    body: 'Free calls are 50% used. For less than a coffee, get 10x the capacity.',
    cta: 'See Plans',
  },
];

/**
 * Returns a prompt variant for the given user context
 * - Rotates variants evenly for A/B/C testing
 * - Uses user_id hash for consistent variant assignment
 */
export function getPrompt(userId: string): UpsellPrompt {
  const idx = Math.abs(hashCode(userId)) % PROMPTS.length;
  return PROMPTS[idx];
}

/**
 * Returns all variants for reporting
 */
export function getAllVariants(): UpsellPrompt[] {
  return [...PROMPTS];
}

/**
 * Simple string hash for deterministic variant assignment
 */
function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const chr = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash;
}

/**
 * Formats the upsell response payload
 */
export function formatUpsellResponse(
  triggered: boolean,
  userId?: string,
): Record<string, unknown> {
  if (!triggered) {
    return { upsell: false, 'X-Upsell-Prompt': 'false' };
  }
  const prompt = getPrompt(userId || 'anonymous');
  return {
    upsell: true,
    'X-Upsell-Prompt': 'true',
    prompt: {
      title: prompt.title,
      body: prompt.body,
      cta: prompt.cta,
      variant: prompt.variant,
    },
  };
}
