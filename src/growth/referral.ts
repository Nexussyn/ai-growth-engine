export interface ReferralRpc {
  processReferral(code: string, newUserId: string): Promise<{ status: string; credits_awarded?: number; owner_id?: string }>;
}
export interface ReferralResult {
  processed: boolean;
  duplicate: boolean;
  creditsAwarded: number;
  ownerId?: string;
}
export async function processReferral(
  referralCode: string,
  newUserId: string,
  rpc: ReferralRpc,
): Promise<ReferralResult> {
  const code = referralCode.trim();
  const user = newUserId.trim();
  if (!code || !user) throw new Error('referralCode and newUserId are required');
  const result = await rpc.processReferral(code, user);
  if (result.status === 'already_processed') return { processed:false, duplicate:true, creditsAwarded:0 };
  if (result.status === 'invalid_code') throw new Error('Invalid referral code');
  if (result.status !== 'ok') throw new Error(`Referral processing failed: ${result.status}`);
  return { processed:true, duplicate:false, creditsAwarded:result.credits_awarded ?? 0, ownerId:result.owner_id };
}
