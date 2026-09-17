/** Issue #3: claim the one-time threshold in the database before showing a prompt. */
export interface UpsellClient {
  rpc(name: string, args: { p_user_id: string; p_call_count: number }): PromiseLike<{
    data: unknown;
    error: unknown;
  }>;
}

export type UpsellVariant = 'A' | 'B';
export interface UpsellDecision {
  triggered: boolean;
  headers: Record<string, string>;
  prompt?: string;
  variant?: UpsellVariant;
}

export function getUpsellPrompt(callCount: number, variant: UpsellVariant): string {
  return variant === 'A'
    ? `You have used ${callCount} of your 10 free calls. Explore upgrade options to keep building.`
    : `${10 - callCount} free calls remain. Review the paid tiers before your next project.`;
}

/** The host supplies the authenticated user id and authoritative free-call count. */
export async function checkUpsell(
  db: UpsellClient,
  userId: string,
  callCount: number,
  variant: UpsellVariant = 'A',
): Promise<UpsellDecision> {
  if (!userId.trim() || !Number.isSafeInteger(callCount) || callCount < 0) {
    throw new TypeError('A nonempty user id and nonnegative integer call count are required');
  }
  if (variant !== 'A' && variant !== 'B') throw new TypeError('Unknown upsell variant');
  if (callCount !== 5) return { triggered: false, headers: {} };

  const { data, error } = await db.rpc('check_upsell_trigger', {
    p_user_id: userId, p_call_count: callCount,
  });
  if (error) throw new Error('Unable to claim upsell threshold');
  if (!data || typeof data !== 'object' || !('upsell' in data) || typeof data.upsell !== 'boolean') {
    throw new Error('Invalid upsell decision from database');
  }
  return data.upsell
    ? { triggered: true, headers: { 'X-Upsell-Prompt': 'true' }, prompt: getUpsellPrompt(callCount, variant), variant }
    : { triggered: false, headers: {} };
}

/** Wrap a handler without coupling it to a particular HTTP framework. */
export async function withUpsell(
  response: Response,
  db: UpsellClient,
  userId: string,
  callCount: number,
  variant: UpsellVariant = 'A',
): Promise<{ response: Response; decision: UpsellDecision }> {
  const decision = await checkUpsell(db, userId, callCount, variant);
  const headers = new Headers(response.headers);
  headers.delete('X-Upsell-Prompt');
  for (const [name, value] of Object.entries(decision.headers)) headers.set(name, value);
  return {
    response: new Response(response.body, { status: response.status, statusText: response.statusText, headers }),
    decision,
  };
}
