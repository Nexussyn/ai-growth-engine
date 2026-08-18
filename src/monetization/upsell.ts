/**
 * Auto-Upsell Trigger — Issue #3
 * Contextual upgrade prompt triggered upon reaching 50% free call threshold
 */

export interface UpsellTrigger {
  userId: string;
  triggerType: 'midpoint_free_tier' | 'limit_reached';
  shownAt: Date;
  converted: boolean;
  variant: 'urgency' | 'value' | 'social_proof';
  promptText: string;
}

export interface UpsellDatabase {
  triggers: Map<string, UpsellTrigger>;
}

export function createUpsellDatabase(): UpsellDatabase {
  return {
    triggers: new Map()
  };
}

export const UPSELL_PROMPTS = {
  urgency: "You've used 5 of your 10 free calls! Upgrade now to avoid interruption.",
  value: "Unlock unlimited priority execution and lower latency by upgrading to Standard tier.",
  social_proof: "Join top AI agents processing thousands of daily API calls with zero rate-limits."
};

export function getUpsellPromptVariant(userId: string): { variant: 'urgency' | 'value' | 'social_proof'; text: string } {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const variants: Array<'urgency' | 'value' | 'social_proof'> = ['urgency', 'value', 'social_proof'];
  const variant = variants[hash % variants.length];
  return {
    variant,
    text: UPSELL_PROMPTS[variant]
  };
}

export function checkAndTriggerUpsell(
  userId: string,
  currentCallCount: number,
  db: UpsellDatabase,
  threshold = 5
): { shouldPrompt: boolean; headers: Record<string, string>; promptText?: string } {
  // Only trigger at threshold crossing
  if (currentCallCount < threshold) {
    return { shouldPrompt: false, headers: {} };
  }

  // Idempotency: verify if already triggered for this user & triggerType
  const triggerKey = `${userId}:midpoint_free_tier`;
  if (db.triggers.has(triggerKey)) {
    return { shouldPrompt: false, headers: {} };
  }

  const { variant, text } = getUpsellPromptVariant(userId);

  db.triggers.set(triggerKey, {
    userId,
    triggerType: 'midpoint_free_tier',
    shownAt: new Date(),
    converted: false,
    variant,
    promptText: text
  });

  return {
    shouldPrompt: true,
    headers: {
      'X-Upsell-Prompt': 'true',
      'X-Upsell-Variant': variant,
      'X-Upsell-Message': text
    },
    promptText: text
  };
}
