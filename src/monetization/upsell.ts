export interface UpsellContext {
  userId: string;
  currentTier: 'free' | 'starter' | 'pro' | 'enterprise';
  quotaLimit: number;
  quotaUsed: number;
  daysActive: number;
  attemptedFeature?: string;
}

export interface UpsellOffer {
  eligible: boolean;
  recommendedTier?: string;
  reason?: string;
  discountCode?: string;
  priority: 'low' | 'medium' | 'high';
}

export class UpsellEngine {
  private thresholdPercent: number;

  constructor(thresholdPercent: number = 80.0) {
    this.thresholdPercent = thresholdPercent;
  }

  public evaluateTrigger(context: UpsellContext): UpsellOffer {
    const usageRatio = (context.quotaUsed / context.quotaLimit) * 100;

    // Trigger Rule 1: Limit reached or nearing exhaustion
    if (usageRatio >= 100) {
      return {
        eligible: true,
        recommendedTier: this.getNextTier(context.currentTier),
        reason: 'QUOTA_EXHAUSTED',
        priority: 'high'
      };
    }

    if (usageRatio >= this.thresholdPercent) {
      return {
        eligible: true,
        recommendedTier: this.getNextTier(context.currentTier),
        reason: 'QUOTA_THRESHOLD_WARNING',
        priority: 'medium',
        discountCode: 'GROWTH20'
      };
    }

    // Trigger Rule 2: Attempted feature outside current tier
    if (context.attemptedFeature && context.currentTier === 'free') {
      return {
        eligible: true,
        recommendedTier: 'pro',
        reason: `LOCKED_FEATURE_${context.attemptedFeature.toUpperCase()}`,
        priority: 'medium'
      };
    }

    return {
      eligible: false,
      priority: 'low'
    };
  }

  private getNextTier(tier: UpsellContext['currentTier']): string {
    switch (tier) {
      case 'free':
        return 'starter';
      case 'starter':
        return 'pro';
      case 'pro':
        return 'enterprise';
      default:
        return 'enterprise';
    }
  }
}
