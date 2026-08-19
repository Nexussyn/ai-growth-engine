export interface UpsellTrigger {
  userId: string;
  triggerType: string;
  shownAt: Date;
  converted: boolean;
  promptVariant: string;
}

export interface UpsellEvaluation {
  shouldPrompt: boolean;
  promptText?: string;
  promptVariant?: string;
  headerKey: string;
  headerValue: string;
}

export const UPSELL_PROMPT_VARIANTS: Record<string, string> = {
  VARIANT_A: "You've used 50% of your free credits! Upgrade to Pro today for 20% off high-volume batches.",
  VARIANT_B: "Enjoying the speed? Unlock unlimited parallel agent calls with our Pro Tier.",
};

export class UpsellEngine {
  private triggers: Map<string, UpsellTrigger> = new Map();

  evaluateFreeUsage(userId: string, currentCallCount: number, freeLimit: number = 10): UpsellEvaluation {
    const threshold = Math.floor(freeLimit * 0.5); // 5th call out of 10

    if (currentCallCount >= threshold) {
      const triggerKey = `${userId}:50_percent_free_limit`;
      if (!this.triggers.has(triggerKey)) {
        const variant = currentCallCount % 2 === 0 ? 'VARIANT_A' : 'VARIANT_B';
        const promptText = UPSELL_PROMPT_VARIANTS[variant];

        this.triggers.set(triggerKey, {
          userId,
          triggerType: '50_percent_free_limit',
          shownAt: new Date(),
          converted: false,
          promptVariant: variant,
        });

        return {
          shouldPrompt: true,
          promptText,
          promptVariant: variant,
          headerKey: 'X-Upsell-Prompt',
          headerValue: 'true',
        };
      }
    }

    return {
      shouldPrompt: false,
      headerKey: 'X-Upsell-Prompt',
      headerValue: 'false',
    };
  }

  getTrigger(userId: string): UpsellTrigger | undefined {
    return this.triggers.get(`${userId}:50_percent_free_limit`);
  }
}
