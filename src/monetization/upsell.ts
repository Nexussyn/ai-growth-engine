export const DEFAULT_FREE_CALL_LIMIT = 10;
export const UPSELL_TRIGGER_TYPE = 'free_limit_50pct';
export const UPSELL_PROMPT_HEADER = 'X-Upsell-Prompt';
export const UPSELL_PROMPT_VARIANT_HEADER = 'X-Upsell-Prompt-Variant';

export interface UpsellInput {
  userId: string;
  callCount: number;
  freeCallLimit?: number;
}

export interface UpsellResult {
  showPrompt: boolean;
  triggerType: typeof UPSELL_TRIGGER_TYPE;
  prompt?: string;
  variant?: string;
  headers: Record<string, string>;
  reason: 'below_threshold' | 'above_threshold' | 'already_triggered' | 'triggered';
}

export interface UpsellStore {
  hasTrigger(userId: string, triggerType: string): Promise<boolean>;
  recordTrigger(userId: string, triggerType: string, metadata: Record<string, unknown>): Promise<void>;
  logSystemEvent?(eventType: string, payload: Record<string, unknown>): Promise<void>;
}

export const UPSELL_PROMPTS = [
  {
    variant: 'speed',
    text: 'You have used 50% of your free calls. Upgrade now to keep momentum without rate limits.',
  },
  {
    variant: 'value',
    text: 'Half your free calls are used. Upgrade for higher limits and predictable x402 access.',
  },
  {
    variant: 'developer',
    text: 'You are halfway through the free tier. Upgrade to keep production API calls flowing.',
  },
] as const;

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}

function promptIndex(userId: string, callCount: number): number {
  let hash = callCount;
  for (const char of userId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % UPSELL_PROMPTS.length;
}

export function upsellThreshold(freeCallLimit = DEFAULT_FREE_CALL_LIMIT): number {
  assertPositiveInteger(freeCallLimit, 'freeCallLimit');
  return Math.ceil(freeCallLimit * 0.5);
}

export async function evaluateUpsellTrigger(
  input: UpsellInput,
  store: UpsellStore,
): Promise<UpsellResult> {
  const userId = input.userId.trim();
  if (!userId) {
    throw new RangeError('userId is required');
  }
  assertPositiveInteger(input.callCount, 'callCount');

  const freeCallLimit = input.freeCallLimit ?? DEFAULT_FREE_CALL_LIMIT;
  const threshold = upsellThreshold(freeCallLimit);

  if (input.callCount < threshold) {
    return {
      showPrompt: false,
      triggerType: UPSELL_TRIGGER_TYPE,
      headers: {},
      reason: 'below_threshold',
    };
  }

  if (input.callCount > threshold) {
    return {
      showPrompt: false,
      triggerType: UPSELL_TRIGGER_TYPE,
      headers: {},
      reason: 'above_threshold',
    };
  }

  if (await store.hasTrigger(userId, UPSELL_TRIGGER_TYPE)) {
    return {
      showPrompt: false,
      triggerType: UPSELL_TRIGGER_TYPE,
      headers: {},
      reason: 'already_triggered',
    };
  }

  const selected = UPSELL_PROMPTS[promptIndex(userId, input.callCount)];
  const metadata = {
    call_count: input.callCount,
    free_call_limit: freeCallLimit,
    threshold,
    prompt_variant: selected.variant,
  };

  await store.recordTrigger(userId, UPSELL_TRIGGER_TYPE, metadata);
  await store.logSystemEvent?.('upsell_trigger_shown', {
    user_id: userId,
    trigger_type: UPSELL_TRIGGER_TYPE,
    ...metadata,
  });

  return {
    showPrompt: true,
    triggerType: UPSELL_TRIGGER_TYPE,
    prompt: selected.text,
    variant: selected.variant,
    headers: {
      [UPSELL_PROMPT_HEADER]: 'true',
      [UPSELL_PROMPT_VARIANT_HEADER]: selected.variant,
    },
    reason: 'triggered',
  };
}

export async function upsellMiddlewareDecision(
  userId: string,
  callCount: number,
  store: UpsellStore,
): Promise<UpsellResult> {
  return evaluateUpsellTrigger({ userId, callCount }, store);
}
