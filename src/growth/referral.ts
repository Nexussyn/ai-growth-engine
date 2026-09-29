/**
 * Referral Reward Loop — Issue #2
 * Awards 5 free credits per unique referral conversion and logs referral_conversion in system_events.
 */

export interface ReferralCodeRecord {
  code: string;
  owner_id: string;
  uses: number;
  credits_awarded: number;
}

export interface ReferralResult {
  status: 'ok' | 'already_processed' | 'invalid_code' | 'self_referral';
  credits_awarded?: number;
  owner_id?: string;
  notifications?: { referrer: string; referee: string };
}

export class InMemoryReferralStore {
  codes = new Map<string, ReferralCodeRecord>();
  conversions = new Set<string>();
  balances = new Map<string, number>();
  systemEvents: Array<{ event_type: string; payload: Record<string, unknown>; created_at: string }> = [];

  createCode(ownerId: string, code: string): ReferralCodeRecord {
    const rec: ReferralCodeRecord = { code, owner_id: ownerId, uses: 0, credits_awarded: 0 };
    this.codes.set(code, rec);
    return rec;
  }
}

export function process_referral(
  referral_code: string,
  new_user_id: string,
  store: InMemoryReferralStore
): ReferralResult {
  const rec = store.codes.get(referral_code);
  if (!rec) {
    return { status: 'invalid_code' };
  }
  if (rec.owner_id === new_user_id) {
    return { status: 'self_referral' };
  }

  const key = `${referral_code}:${new_user_id}`;
  if (store.conversions.has(key)) {
    return { status: 'already_processed' };
  }

  const credits = 5;
  store.conversions.add(key);
  rec.uses += 1;
  rec.credits_awarded += credits;
  store.balances.set(rec.owner_id, (store.balances.get(rec.owner_id) ?? 0) + credits);

  store.systemEvents.push({
    event_type: 'referral_conversion',
    payload: { code: referral_code, owner_id: rec.owner_id, new_user: new_user_id, credits },
    created_at: new Date().toISOString(),
  });

  return {
    status: 'ok',
    credits_awarded: credits,
    owner_id: rec.owner_id,
    notifications: {
      referrer: `You earned ${credits} free credits for referring ${new_user_id}!`,
      referee: `Welcome! Your referral code ${referral_code} has been activated.`,
    },
  };
}
