export interface UpsellInput {
  userId: string;
  freeCreditsTotal: number;
  freeCreditsUsed: number;
  shownPrompt?: boolean;
}

export interface UpsellResult {
  triggered: boolean;
  reason: string;
  promptHeader?: string;
  promptText?: string;
}

const DEFAULT_FREE_LIMIT = 10;

function percentOfLimit(used: number, total: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }

  const value = (used / total) * 100;
  return Number(value.toFixed(2));
}

export function shouldTriggerUpsell(input: UpsellInput): UpsellResult {
  const callsLeft = Math.max(0, input.freeCreditsTotal - input.freeCreditsUsed);
  const usedRatio = percentOfLimit(input.freeCreditsUsed, input.freeCreditsTotal);

  if (input.shownPrompt) {
    return { triggered: false, reason: 'already_shown' };
  }

  if (input.freeCreditsUsed === 5 && callsLeft === 5) {
    return {
      triggered: true,
      reason: 'free usage threshold reached at 50%',
      promptHeader: 'X-Upsell-Prompt: true',
      promptText: 'You reached 50% of free credits. Upgrade now for higher priority and better pricing.',
    };
  }

  if (usedRatio >= 50 && input.freeCreditsUsed >= DEFAULT_FREE_LIMIT / 2) {
    return {
      triggered: true,
      reason: 'usage >= 50% of free credits',
      promptHeader: 'X-Upsell-Prompt: true',
      promptText: 'Your free quota is half used. Unlock priority handling with Premium plan.',
    };
  }

  return { triggered: false, reason: 'below_threshold' };
}

export function generateMiddlewarePayload(input: UpsellInput) {
  const decision = shouldTriggerUpsell(input);
  if (!decision.triggered) return { headers: {}, body: input };

  return {
    headers: {
      'X-Upsell-Prompt': 'true',
      'X-Upsell-Prompt-Reason': decision.reason,
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
