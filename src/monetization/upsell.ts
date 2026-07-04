/**
 * Auto-Upsell Trigger — Issue #3
 * Triggers contextual upgrade prompt when user reaches 5th free call (50% of limit)
 */

export interface UpsellTrigger {
  user_id: string;
  trigger_type: 'free_call_threshold';
  shown_at: string;
  converted: boolean;
}

export interface UpsellEvent {
  userId: string;
  callCount: number;
  threshold: number;
  shouldTrigger: boolean;
}

const FREE_CALL_LIMIT = 10;
const TRIGGER_THRESHOLD = 5; // 50% of free limit

const UPSELL_VARIANTS = [
  {
    id: 'a',
    title: 'Unlock Premium — Get 3x More Calls',
    body: 'You\'ve used 50% of your free credits. Upgrade now for unlimited calls and priority routing.',
    cta: 'Upgrade to Pro',
  },
  {
    id: 'b',
    title: 'Love the Speed? Go Unlimited',
    body: 'You\'re hitting your free cap fast. Premium plans start at just $10/mo — no more counting calls.',
    cta: 'See Plans',
  },
];

/**
 * Determines whether the upsell trigger should fire.
 * The trigger fires exactly once per threshold crossing.
 *
 * @param callCount - Current call count for this user (1-indexed)
 * @param alreadyTriggered - Whether the upsell has already been shown
 * @returns Object with shouldTrigger flag
 */
export function shouldTriggerUpsell(
  callCount: number,
  alreadyTriggered: boolean
): UpsellEvent {
  if (alreadyTriggered) {
    return { userId: '', callCount, threshold: TRIGGER_THRESHOLD, shouldTrigger: false };
  }
  const shouldTrigger = callCount >= TRIGGER_THRESHOLD;
  return { userId: '', callCount, threshold: TRIGGER_THRESHOLD, shouldTrigger };
}

/**
 * Returns a random upsell text variant (A/B test ready).
 */
export function getUpsellVariant(): { id: string; title: string; body: string; cta: string } {
  const idx = Math.floor(Math.random() * UPSELL_VARIANTS.length);
  return { ...UPSELL_VARIANTS[idx] };
}

/**
 * Generates the X-Upsell-Prompt header value.
 */
export function buildUpsellHeader(variantId: string): string {
  return `true; variant=${variantId}`;
}

/**
 * Generates SQL to insert an upsell trigger record.
 */
export function buildUpsellTriggerSQL(
  userId: string,
  triggerType: string,
  variantId: string
): string {
  return `INSERT INTO upsell_triggers (user_id, trigger_type, shown_at, converted)
VALUES ('${userId}', '${triggerType}', NOW(), false)
ON CONFLICT (user_id, trigger_type) DO NOTHING;`;
}

/**
 * Checks if a user has already been upsold and returns SQL.
 */
export function checkExistingUpsellSQL(userId: string): string {
  return `SELECT id FROM upsell_triggers WHERE user_id = '${userId}' AND trigger_type = 'free_call_threshold' LIMIT 1;`;
}

/**
 * Processes the upsell flow: checks threshold, generates prompt, logs trigger.
 */
export function processUpsell(
  userId: string,
  callCount: number,
  alreadyTriggered: boolean
): {
  trigger: UpsellEvent;
  header?: string;
  variant?: { id: string; title: string; body: string; cta: string };
  sql?: string;
} {
  const trigger = shouldTriggerUpsell(callCount, alreadyTriggered);

  if (!trigger.shouldTrigger) {
    return { trigger };
  }

  const variant = getUpsellVariant();
  const header = buildUpsellHeader(variant.id);
  const sql = buildUpsellTriggerSQL(userId, 'free_call_threshold', variant.id);

  return { trigger, header, variant, sql };
}
