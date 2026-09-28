export const FREE_CALL_LIMIT = 10;
export const UPSELL_THRESHOLD = 5;

export interface UpsellStore {
  createTrigger(userId: string, triggerType: string): Promise<boolean>;
}

export interface UpsellResult {
  triggered: boolean;
  headers: Record<string, string>;
  prompt?: string;
  variant?: 'A' | 'B';
}

export function upsellVariant(userId: string): 'A' | 'B' {
  let hash = 0;
  for (const c of userId) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0;
  return Math.abs(hash) % 2 === 0 ? 'A' : 'B';
}

export function upsellPrompt(variant: 'A' | 'B', callCount: number): string {
  const remaining = Math.max(0, FREE_CALL_LIMIT - callCount);
  return variant === 'A'
    ? `You have ${remaining} free calls left. Upgrade for uninterrupted access.`
    : `You're halfway through your free calls. Upgrade now to keep going without limits.`;
}

export async function checkUpsell(
  userId: string,
  callCount: number,
  store: UpsellStore,
): Promise<UpsellResult> {
  if (callCount !== UPSELL_THRESHOLD) return { triggered: false, headers: {} };

  const inserted = await store.createTrigger(userId, 'free_limit_50pct');
  if (!inserted) return { triggered: false, headers: {} };

  const variant = upsellVariant(userId);
  return {
    triggered: true,
    headers: { 'X-Upsell-Prompt': 'true' },
    prompt: upsellPrompt(variant, callCount),
    variant,
  };
}
