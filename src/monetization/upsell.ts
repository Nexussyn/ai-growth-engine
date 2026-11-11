/**
 * Auto-Upsell Trigger Engine — Issue #3
 * Fires a contextual upgrade prompt when a user reaches 50% of their free credit limit
 * (5th call out of 10 free calls), sets `X-Upsell-Prompt: true`, and guarantees
 * idempotent single-fire behavior per user/trigger_type.
 */

export type UpsellVariant = 'variant_a_value' | 'variant_b_urgency';

export interface UpsellTriggerRecord {
  user_id: string;
  trigger_type: string;
  shown_at: string;
  converted: boolean;
  variant: UpsellVariant;
  prompt: string;
}

export interface UpsellEvaluationResult {
  upsell: boolean;
  headers: Record<string, string>;
  prompt?: string;
  variant?: UpsellVariant;
  record?: UpsellTriggerRecord;
}

export const FREE_CALL_LIMIT = 10;
export const UPSELL_THRESHOLD_CALL = 5; // 50% of 10 free calls
export const DEFAULT_TRIGGER_TYPE = 'free_limit_50pct';

export const UPSELL_PROMPT_VARIANTS: Record<UpsellVariant, (usagePattern?: string) => string> = {
  variant_a_value: (usagePattern = 'API') =>
    `You have used 50% of your free ${usagePattern} calls (5/${FREE_CALL_LIMIT}). Upgrade to Standard ($0.01/call) for uninterrupted high-throughput access.`,
  variant_b_urgency: (usagePattern = 'API') =>
    `Heads up: only 5 free ${usagePattern} calls remaining! Unlock unlimited scale and priority routing now.`,
};

export function selectUpsellVariant(userId: string): UpsellVariant {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return hash % 2 === 0 ? 'variant_a_value' : 'variant_b_urgency';
}

export class UpsellTriggerTracker {
  private readonly fired = new Map<string, UpsellTriggerRecord>();

  private makeKey(userId: string, triggerType: string): string {
    return `${userId}::${triggerType}`;
  }

  public evaluateCall(
    userId: string,
    callCount: number,
    usagePattern = 'API',
    triggerType: string = DEFAULT_TRIGGER_TYPE,
  ): UpsellEvaluationResult {
    if (!userId || callCount < UPSELL_THRESHOLD_CALL) {
      return { upsell: false, headers: {} };
    }

    const key = this.makeKey(userId, triggerType);
    // Idempotent check: never double-trigger once shown
    if (this.fired.has(key)) {
      return { upsell: false, headers: {} };
    }

    if (callCount !== UPSELL_THRESHOLD_CALL) {
      return { upsell: false, headers: {} };
    }

    const variant = selectUpsellVariant(userId);
    const prompt = UPSELL_PROMPT_VARIANTS[variant](usagePattern);
    const record: UpsellTriggerRecord = {
      user_id: userId,
      trigger_type: triggerType,
      shown_at: new Date().toISOString(),
      converted: false,
      variant,
      prompt,
    };
    this.fired.set(key, record);

    return {
      upsell: true,
      headers: { 'X-Upsell-Prompt': 'true' },
      prompt,
      variant,
      record,
    };
  }

  public markConverted(userId: string, triggerType: string = DEFAULT_TRIGGER_TYPE): boolean {
    const rec = this.fired.get(this.makeKey(userId, triggerType));
    if (!rec) {
      return false;
    }
    rec.converted = true;
    return true;
  }

  public getRecord(userId: string, triggerType: string = DEFAULT_TRIGGER_TYPE): UpsellTriggerRecord | undefined {
    return this.fired.get(this.makeKey(userId, triggerType));
  }
}

export function createUpsellMiddleware(tracker = new UpsellTriggerTracker()) {
  return function upsellMiddleware(req: {
    userId: string;
    callCount: number;
    usagePattern?: string;
  }): UpsellEvaluationResult {
    return tracker.evaluateCall(req.userId, req.callCount, req.usagePattern ?? 'API');
  };
}
