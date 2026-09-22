/** Call with an authenticated user's server-side usage count, never client input. */
export interface UpsellRpc {
  rpc(name: string, args: { p_user_id: string; p_call_count: number }): Promise<{
    data: unknown;
    error: unknown;
  }>;
}

export interface UpsellResult {
  headers: Record<string, string>;
  prompt?: string;
  variant?: 'A' | 'B';
}

/** Database uniqueness, rather than an in-memory flag, arbitrates retries. */
export async function checkUpsell(
  client: UpsellRpc,
  userId: string,
  callCount: number,
  usage: 'steady' | 'burst' = 'steady',
  variant: 'A' | 'B' = 'A',
): Promise<UpsellResult> {
  if (typeof userId !== 'string' || !userId.trim() ||
      !Number.isInteger(callCount) || callCount < 0 || callCount > 2147483647 ||
      !['steady', 'burst'].includes(usage) || !['A', 'B'].includes(variant)) {
    throw new TypeError('Invalid upsell input');
  }
  if (callCount !== 5) return { headers: {} };
  const { data, error } = await client.rpc('check_upsell_trigger', {
    p_user_id: userId, p_call_count: callCount,
  });
  if (error) throw new Error('Upsell persistence failed', { cause: error });
  if (!data || typeof data !== 'object' || !('upsell' in data) ||
      typeof data.upsell !== 'boolean') {
    throw new Error('Invalid upsell RPC response');
  }
  if (!data.upsell) return { headers: {} };
  const introduction = usage === 'burst'
    ? 'Your recent burst has used 5 of 10 free calls.'
    : 'You have used 5 of your 10 free calls.';
  return {
    headers: { 'X-Upsell-Prompt': 'true' },
    prompt: `${introduction} ${variant === 'A' ? 'View upgrade options.' : 'Compare plans before your next project.'}`,
    variant,
  };
}
