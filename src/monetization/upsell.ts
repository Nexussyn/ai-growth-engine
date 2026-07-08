export interface UpsellTriggerRecord {
  user_id: string;
  trigger_type: 'free_limit_50pct';
  shown_at: string;
  converted: boolean;
}

export interface UpsellResult {
  shouldTrigger: boolean;
  headers: Record<string, string>;
  prompt: string | null;
  trigger?: UpsellTriggerRecord;
}

const FREE_LIMIT = 10;
const THRESHOLD_CALL = 5;
const TRIGGER_TYPE = 'free_limit_50pct' as const;

const PROMPTS = [
  'You have used 50% of your free calls. Upgrade now to keep growth automation running without interruption.',
  'Half of your free calls are used. Upgrade to unlock more AI growth workflows before you hit the limit.',
  'You are halfway through the free tier. Upgrade for uninterrupted execution and higher usage limits.',
];

export function buildUpsellPrompt(userId: string, callCount: number): string {
  const index = Math.abs(hash(`${userId}:${callCount}`)) % PROMPTS.length;
  return PROMPTS[index];
}

export function shouldTriggerUpsell(callCount: number, alreadyTriggered: boolean): boolean {
  return callCount === THRESHOLD_CALL && !alreadyTriggered;
}

export function evaluateUpsellTrigger(input: {
  userId: string;
  callCount: number;
  alreadyTriggered?: boolean;
  now?: Date;
}): UpsellResult {
  const alreadyTriggered = input.alreadyTriggered ?? false;
  if (!shouldTriggerUpsell(input.callCount, alreadyTriggered)) {
    return { shouldTrigger: false, headers: {}, prompt: null };
  }

  const prompt = buildUpsellPrompt(input.userId, input.callCount);
  return {
    shouldTrigger: true,
    headers: {
      'X-Upsell-Prompt': 'true',
      'X-Upsell-Threshold': `${THRESHOLD_CALL}/${FREE_LIMIT}`,
    },
    prompt,
    trigger: {
      user_id: input.userId,
      trigger_type: TRIGGER_TYPE,
      shown_at: (input.now ?? new Date()).toISOString(),
      converted: false,
    },
  };
}

function hash(value: string): number {
  let total = 0;
  for (let i = 0; i < value.length; i += 1) {
    total = (total * 31 + value.charCodeAt(i)) | 0;
  }
  return total;
}
