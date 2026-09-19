/**
 * Auto-upsell trigger after 5th free call — Issue #3
 */

export const FREE_CALL_LIMIT = 10;
export const UPSELL_THRESHOLD = 5; // 50% of free limit
export const UPSELL_HEADER = 'X-Upsell-Prompt';

export type UpsellTriggerType = 'free_limit_50pct';
export type PromptVariant = 'A' | 'B';

export interface UpsellTriggerRow {
  user_id: string;
  trigger_type: UpsellTriggerType;
  shown_at?: string;
  converted: boolean;
  prompt_variant?: PromptVariant;
  call_count?: number;
}

export interface UpsellStore {
  hasTrigger(userId: string, triggerType: UpsellTriggerType): boolean;
  insertTrigger(row: UpsellTriggerRow): boolean; // false if already existed
  markConverted(userId: string, triggerType: UpsellTriggerType): void;
}

export interface UpsellResult {
  trigger: boolean;
  headers: Record<string, string>;
  triggerType?: UpsellTriggerType;
  promptVariant?: PromptVariant;
  promptText?: string;
}

const PROMPTS: Record<PromptVariant, string> = {
  A: 'You have used 50% of your free calls. Upgrade for unlimited access.',
  B: 'Halfway through your free credits — unlock Standard ($0.01) or Priority ($0.10) now.',
};

/** Deterministic A/B variant from user id. */
export function pickPromptVariant(userId: string): PromptVariant {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash + userId.charCodeAt(i) * (i + 1)) % 997;
  }
  return hash % 2 === 0 ? 'A' : 'B';
}

/**
 * Middleware-style check: fires exactly once when callCount hits the 5th free call.
 */
export function checkUpsell(
  store: UpsellStore,
  userId: string,
  callCount: number,
): UpsellResult {
  if (!Number.isInteger(callCount) || callCount < 0) {
    return { trigger: false, headers: {} };
  }

  if (callCount !== UPSELL_THRESHOLD) {
    return { trigger: false, headers: {} };
  }

  const triggerType: UpsellTriggerType = 'free_limit_50pct';
  if (store.hasTrigger(userId, triggerType)) {
    return { trigger: false, headers: {} };
  }

  const promptVariant = pickPromptVariant(userId);
  const inserted = store.insertTrigger({
    user_id: userId,
    trigger_type: triggerType,
    converted: false,
    prompt_variant: promptVariant,
    call_count: callCount,
  });

  if (!inserted) {
    return { trigger: false, headers: {} };
  }

  return {
    trigger: true,
    headers: { [UPSELL_HEADER]: 'true' },
    triggerType,
    promptVariant,
    promptText: PROMPTS[promptVariant],
  };
}

export function createMemoryUpsellStore(): UpsellStore & {
  rows: Map<string, UpsellTriggerRow>;
} {
  const rows = new Map<string, UpsellTriggerRow>();
  const key = (userId: string, t: UpsellTriggerType) => `${userId}::${t}`;
  return {
    rows,
    hasTrigger(userId, triggerType) {
      return rows.has(key(userId, triggerType));
    },
    insertTrigger(row) {
      const k = key(row.user_id, row.trigger_type);
      if (rows.has(k)) return false;
      rows.set(k, { ...row });
      return true;
    },
    markConverted(userId, triggerType) {
      const k = key(userId, triggerType);
      const row = rows.get(k);
      if (row) row.converted = true;
    },
  };
}
