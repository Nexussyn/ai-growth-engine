export interface UpsellTrigger {
  id: string;
  userId: string;
  triggerType: string;
  variant: 'urgency' | 'value';
  promptMessage: string;
  shownAt: string;
  converted: boolean;
  convertedAt?: string | null;
}

export interface UpsellEvaluation {
  shouldTrigger: boolean;
  headerFlag?: boolean;
  variant?: 'urgency' | 'value';
  promptMessage?: string;
  triggerRecord?: UpsellTrigger;
}

export const UPSELL_VARIANTS = {
  urgency: {
    variant: 'urgency' as const,
    message: "You've used 50% of your free credits! Upgrade to Pro now to ensure uninterrupted AI workflows.",
  },
  value: {
    variant: 'value' as const,
    message: "Loving the results? Unlock unlimited priority calls and 3x faster response times with Pro.",
  },
};

export class UpsellEngine {
  private userCallCounts = new Map<string, number>();
  private triggers = new Map<string, UpsellTrigger>(); // Keyed by `${userId}:${triggerType}`
  private freeCallLimit = 10;
  private thresholdRatio = 0.5; // 50% threshold = 5 calls

  public recordCall(userId: string): number {
    const current = this.userCallCounts.get(userId) || 0;
    const updated = current + 1;
    this.userCallCounts.set(userId, updated);
    return updated;
  }

  public getCallCount(userId: string): number {
    return this.userCallCounts.get(userId) || 0;
  }

  public evaluateUpsell(userId: string, preferredVariant?: 'urgency' | 'value'): UpsellEvaluation {
    const callCount = this.getCallCount(userId);
    const triggerThreshold = Math.floor(this.freeCallLimit * this.thresholdRatio); // 5 calls
    const triggerKey = `${userId}:free_limit_50`;

    // Only trigger if exactly at or past threshold AND hasn't been triggered before
    if (callCount >= triggerThreshold && !this.triggers.has(triggerKey)) {
      // Deterministic A/B variant selection if not explicitly specified
      const variantKey = preferredVariant || (userId.charCodeAt(userId.length - 1) % 2 === 0 ? 'urgency' : 'value');
      const selectedPrompt = UPSELL_VARIANTS[variantKey];

      const record: UpsellTrigger = {
        id: `upsell_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId,
        triggerType: 'free_limit_50',
        variant: selectedPrompt.variant,
        promptMessage: selectedPrompt.message,
        shownAt: new Date().toISOString(),
        converted: false,
        convertedAt: null,
      };

      this.triggers.set(triggerKey, record);

      return {
        shouldTrigger: true,
        headerFlag: true,
        variant: record.variant,
        promptMessage: record.promptMessage,
        triggerRecord: record,
      };
    }

    return { shouldTrigger: false, headerFlag: false };
  }

  public markConversion(userId: string, triggerType = 'free_limit_50'): boolean {
    const triggerKey = `${userId}:${triggerType}`;
    const record = this.triggers.get(triggerKey);
    if (record && !record.converted) {
      record.converted = true;
      record.convertedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  public getTrigger(userId: string, triggerType = 'free_limit_50'): UpsellTrigger | undefined {
    return this.triggers.get(`${userId}:${triggerType}`);
  }
}

export const defaultUpsellEngine = new UpsellEngine();
