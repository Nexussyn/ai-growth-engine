export interface UpsellClient {
  rpc(name: string, args: { p_user_id: string; p_call_count: number }): PromiseLike<{
    data: unknown;
    error: unknown;
  }>;
}

export interface UpsellContext {
  userId: string;
  callCount: number;
  usagePattern?: 'steady' | 'burst';
  variant?: 'A' | 'B';
}

/** Run after the fifth successful free call; the database owns deduplication. */
export async function checkUpsell(client: UpsellClient, context: UpsellContext) {
  if (!context.userId.trim() || !Number.isSafeInteger(context.callCount) || context.callCount < 0) {
    throw new TypeError('A user ID and a non-negative integer call count are required');
  }
  if (context.callCount !== 5) return { upsell: false as const };

  const { data, error } = await client.rpc('check_upsell_trigger', {
    p_user_id: context.userId,
    p_call_count: context.callCount,
  });
  if (error) throw new Error('Unable to record upsell trigger', { cause: error });
  if (!data || typeof data !== 'object' || !('upsell' in data) || typeof data.upsell !== 'boolean') {
    throw new Error('Invalid upsell trigger response');
  }
  if (!data.upsell) return { upsell: false as const };

  const variant = context.variant ?? 'A';
  const lead = context.usagePattern === 'burst'
    ? 'Working through a burst of requests?'
    : 'Keep your workflow moving.';
  const prompt = variant === 'A'
    ? `${lead} You have used 5 of your 10 free calls. Review upgrade options.`
    : `${lead} Five free calls remain. Explore a plan for your next requests.`;
  return { upsell: true as const, variant, prompt };
}

/** Middleware adapter: preserves the response body, status and existing headers. */
export async function withUpsell(response: Response, client: UpsellClient, context: UpsellContext) {
  if (!response.ok) return { response, upsell: { upsell: false as const } };
  const upsell = await checkUpsell(client, context);
  if (!upsell.upsell) return { response, upsell };
  const headers = new Headers(response.headers);
  headers.set('X-Upsell-Prompt', 'true');
  return {
    response: new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
    upsell,
  };
}
