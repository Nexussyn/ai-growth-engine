/**
 * Upsell Trigger Engine — Issue #3
 * Triggers contextual upgrade prompt when user reaches 50% of free credit limit.
 */

export interface UpsellTrigger {
  userId: string;
  triggerType: string;
  shownAt: Date;
  converted: boolean;
}

export interface UpsellResult {
  upsell: boolean;
  prompt?: string;
  variant?: string;
}

export interface UpsellVariant {
  id: string;
  text: string;
}

/**
 * Upsell prompt variants (A/B test ready)
 */
export const UPSELL_VARIANTS: UpsellVariant[] = [
  { id: 'A', text: 'You have used 50% of your free calls. Upgrade for unlimited access.' },
  { id: 'B', text: 'Half your free credits gone! Unlock premium features now.' },
  { id: 'C', text: 'Maximize your productivity — upgrade before your free credits run out.' },
];

/**
 * In-memory store for upsell triggers.
 * In production, this would be backed by the upsell_triggers DB table.
 */
class UpsellStore {
  private triggers: Map<string, UpsellTrigger> = new Map();

  getKey(userId: string, triggerType: string): string {
    return `${userId}:${triggerType}`;
  }

  has(userId: string, triggerType: string): boolean {
    return this.triggers.has(this.getKey(userId, triggerType));
  }

  add(userId: string, triggerType: string): void {
    const key = this.getKey(userId, triggerType);
    if (!this.triggers.has(key)) {
      this.triggers.set(key, {
        userId,
        triggerType,
        shownAt: new Date(),
        converted: false,
      });
    }
  }

  markConverted(userId: string, triggerType: string): void {
    const key = this.getKey(userId, triggerType);
    const trigger = this.triggers.get(key);
    if (trigger) {
      trigger.converted = true;
    }
  }
}

export const upsellStore = new UpsellStore();

/**
 * Checks if an upsell trigger should fire based on call count.
 * Fires at 5th call (50% of 10 free calls), exactly once per threshold.
 *
 * @param userId - The user's identifier
 * @param callCount - Current call count for the user
 * @param freeLimit - Total free calls allowed (default: 10)
 * @returns UpsellResult with upsell flag and prompt
 */
export function checkUpsellTrigger(
  userId: string,
  callCount: number,
  freeLimit: number = 10
): UpsellResult {
  const threshold = Math.floor(freeLimit / 2); // 50% threshold
  const triggerType = 'free_limit_50pct';

  // Only fire at exactly the threshold crossing
  if (callCount !== threshold) {
    return { upsell: false };
  }

  // Idempotency: only fire once per threshold crossing
  if (upsellStore.has(userId, triggerType)) {
    return { upsell: false };
  }

  // Record the trigger
  upsellStore.add(userId, triggerType);

  // Pick a random prompt variant (A/B test)
  const variant = UPSELL_VARIANTS[Math.floor(Math.random() * UPSELL_VARIANTS.length)];

  return {
    upsell: true,
    prompt: variant.text,
    variant: variant.id,
  };
}

/**
 * Set X-Upsell-Prompt response header value.
 */
export function getUpsellHeaderValue(result: UpsellResult): string {
  return result.upsell ? 'true' : 'false';
}
