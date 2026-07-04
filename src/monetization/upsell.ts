export const FREE_CALL_LIMIT = 10;
export const UPSELL_THRESHOLD_CALL = 5;
export const UPSELL_TRIGGER_TYPE = "free_limit_50pct";
export const UPSELL_HEADER = "X-Upsell-Prompt";

export interface UsageSnapshot {
  userId: string;
  freeCallCount: number;
  alreadyTriggered?: boolean;
}

export interface UpsellEvaluation {
  shouldTrigger: boolean;
  triggerType: string;
  prompt?: string;
  headers: Record<string, string>;
}

export interface UpsellTriggerRow {
  user_id: string;
  trigger_type: string;
  shown_at: string;
  converted: boolean;
  prompt_variant: string;
}

export function shouldTriggerUpsell(snapshot: UsageSnapshot): boolean {
  if (!snapshot.userId.trim()) return false;
  if (snapshot.alreadyTriggered) return false;
  return snapshot.freeCallCount >= UPSELL_THRESHOLD_CALL;
}

export function buildUpsellPrompt(callCount: number): string {
  const remaining = Math.max(FREE_CALL_LIMIT - callCount, 0);

  if (remaining === 0) {
    return "You used all free calls. Upgrade now to keep agents running without interruption.";
  }

  return `You have ${remaining} free calls left. Upgrade now for unlimited agent execution and priority routing.`;
}

export function evaluateUpsell(snapshot: UsageSnapshot): UpsellEvaluation {
  if (!shouldTriggerUpsell(snapshot)) {
    return {
      shouldTrigger: false,
      triggerType: UPSELL_TRIGGER_TYPE,
      headers: {},
    };
  }

  return {
    shouldTrigger: true,
    triggerType: UPSELL_TRIGGER_TYPE,
    prompt: buildUpsellPrompt(snapshot.freeCallCount),
    headers: {
      [UPSELL_HEADER]: "true",
      "X-Upsell-Trigger-Type": UPSELL_TRIGGER_TYPE,
    },
  };
}

export function createUpsellTriggerRow(
  snapshot: UsageSnapshot,
  now = new Date(),
): UpsellTriggerRow | undefined {
  const evaluation = evaluateUpsell(snapshot);
  if (!evaluation.shouldTrigger) return undefined;

  return {
    user_id: snapshot.userId,
    trigger_type: evaluation.triggerType,
    shown_at: now.toISOString(),
    converted: false,
    prompt_variant: evaluation.prompt ?? buildUpsellPrompt(snapshot.freeCallCount),
  };
}

export function attachUpsellHeaders(response: Response, evaluation: UpsellEvaluation): Response {
  if (!evaluation.shouldTrigger) return response;

  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(evaluation.headers)) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
