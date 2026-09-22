/** Call from a trusted backend after recording settled first-payment evidence. */
export interface ReferralClient {
  rpc(name: string, args: Record<string, string>): PromiseLike<{ data: unknown; error: unknown }>;
}
export type ReferralResult =
  | { status: 'ok'; credits_awarded: 5; owner_id: string }
  | { status: 'invalid_input' | 'invalid_code' | 'self_referral' | 'not_qualified' | 'already_processed' };

export async function process_referral(
  client: ReferralClient, referral_code: string, new_user_id: string,
): Promise<ReferralResult> {
  if (typeof referral_code !== 'string' || !referral_code.trim() ||
      typeof new_user_id !== 'string' || !new_user_id.trim()) {
    throw new TypeError('Referral code and authenticated user ID are required');
  }
  const { data, error } = await client.rpc('process_referral', {
    p_code: referral_code, p_new_user_id: new_user_id,
  });
  if (error) throw new Error('Referral processing failed', { cause: error });
  if (!data || typeof data !== 'object' || !('status' in data)) {
    throw new Error('Invalid referral response');
  }
  const result = data as Record<string, unknown>;
  if (result.status === 'ok' && result.credits_awarded === 5 &&
      typeof result.owner_id === 'string' && result.owner_id.length > 0) {
    return { status: 'ok', credits_awarded: 5, owner_id: result.owner_id };
  }
  const statuses = ['invalid_input','invalid_code','self_referral','not_qualified','already_processed'];
  if (typeof result.status === 'string' && statuses.includes(result.status)) {
    return { status: result.status } as ReferralResult;
  }
  throw new Error('Invalid referral response');
}
