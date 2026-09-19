export interface UpsellContext {
  userId: string;
  callCount: number;
  usagePattern?: 'occasional' | 'frequent';
  variant?: 'A' | 'B';
}

export type UpsellRpc = (
  name: 'check_upsell_trigger',
  args: { p_user_id: string; p_call_count: number },
) => PromiseLike<{ data: { upsell: boolean } | null; error: unknown }>;

export async function applyUpsell(response: Response, context: UpsellContext, rpc: UpsellRpc): Promise<Response> {
  if (context.callCount !== 5) {
    return response;
  }

  try {
    const { data, error } = await rpc('check_upsell_trigger', {
      p_user_id: context.userId,
      p_call_count: context.callCount,
    });
    if (error || data?.upsell !== true) {
      return response;
    }
  } catch {
    return response;
  }

  const variant = context.variant ?? 'A';
  const frequent = context.usagePattern === 'frequent';
  const prompt = variant === 'A'
    ? `You have used 5 of 10 free calls. ${frequent
      ? 'Upgrade to keep your frequent workflows running.'
      : 'Upgrade when you need more room to explore.'}`
    : `${frequent ? 'Keep your frequent workflows running' : 'Make more room to explore'}: ` +
      'explore an upgrade with 5 free calls remaining.';
  const headers = new Headers(response.headers);
  headers.set('X-Upsell-Prompt', 'true');
  headers.set('X-Upsell-Message', prompt);
  headers.set('X-Upsell-Variant', variant);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
