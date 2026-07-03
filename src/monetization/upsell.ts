export interface UpsellInput {
  userId: string;
  freeCreditsTotal: number;
  freeCreditsUsed: number;
  shownPrompt?: boolean;
}

export interface UpsellResult {
  triggered: boolean;
  reason: string;
  variant?: 'priority' | 'savings';
  promptHeader?: string;
  promptText?: string;
}

export const UPSELL_HEADER_NAME = 'X-Upsell-Prompt';
export const UPSELL_REASON_HEADER_NAME = 'X-Upsell-Prompt-Reason';
export const UPSELL_VARIANT_HEADER_NAME = 'X-Upsell-Prompt-Variant';

const DEFAULT_FREE_LIMIT = 10;

function thresholdFor(total: number): number {
  if (!Number.isInteger(total) || total <= 0) return DEFAULT_FREE_LIMIT / 2;
  return Math.ceil(total / 2);
}

function promptVariantFor(userId: string): 'priority' | 'savings' {
  const sum = [...userId].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return sum % 2 === 0 ? 'priority' : 'savings';
}

function promptTextFor(variant: 'priority' | 'savings'): string {
  if (variant === 'priority') {
    return 'You reached 50% of free credits. Upgrade now for priority handling and fewer queue delays.';
  }
  return 'Your free quota is half used. Upgrade now to keep momentum before your remaining credits run out.';
}

export function shouldTriggerUpsell(input: UpsellInput): UpsellResult {
  const threshold = thresholdFor(input.freeCreditsTotal);

  if (input.shownPrompt) {
    return { triggered: false, reason: 'already_shown' };
  }

  if (input.freeCreditsUsed === threshold) {
    const variant = promptVariantFor(input.userId);
    return {
      triggered: true,
      reason: 'free usage threshold reached at 50%',
      variant,
      promptHeader: `${UPSELL_HEADER_NAME}: true`,
      promptText: promptTextFor(variant),
    };
  }

  return { triggered: false, reason: 'below_threshold' };
}

export function generateMiddlewarePayload(input: UpsellInput) {
  const decision = shouldTriggerUpsell(input);
  if (!decision.triggered) return { headers: {}, body: input };

  return {
    headers: {
      [UPSELL_HEADER_NAME]: 'true',
      [UPSELL_REASON_HEADER_NAME]: decision.reason,
      [UPSELL_VARIANT_HEADER_NAME]: decision.variant ?? 'priority',
    },
    body: {
      ...input,
      promptText: decision.promptText,
    },
  };
}

export class SimpleUpsellStore {
  constructor(private readonly shownUsers = new Set<string>()) {}

  async hasBeenShown(userId: string): Promise<boolean> {
    return this.shownUsers.has(userId);
  }

  async markAsShown(userId: string): Promise<void> {
    this.shownUsers.add(userId);
  }
}
