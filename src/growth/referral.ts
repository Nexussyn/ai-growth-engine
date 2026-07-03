/**
 * Referral System Engine — Issue #2
 * Awards 5 free credits per referral conversion.
 */
export interface ReferralCodeResponse {
  code: string;
  ownerId: string;
}

export interface ReferralConversionResult {
  status: 'ok' | 'already_processed' | 'invalid_code';
  creditsAwarded?: number;
  ownerId?: string;
}

export interface ReferralCode {
  code: string;
  ownerId: string;
  uses: number;
  creditsAwarded: number;
}

/**
 * In-memory store for referral data.
 * In production, this would be replaced by database queries.
 */
class ReferralStore {
  private codes: Map<string, ReferralCode> = new Map();

  createCode(ownerId: string): ReferralCode {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const entry: ReferralCode = { code, ownerId, uses: 0, creditsAwarded: 0 };
    this.codes.set(code, entry);
    return entry;
  }

  getCode(code: string): ReferralCode | undefined {
    return this.codes.get(code);
  }

  awardCredits(code: string): number {
    const entry = this.codes.get(code);
    if (!entry) return 0;
    entry.uses += 1;
    entry.creditsAwarded += 5;
    return 5;
  }
}

export const referralStore = new ReferralStore();

/**
 * Generates a new referral code for a user.
 */
export function generateReferralCode(ownerId: string): ReferralCodeResponse {
  const entry = referralStore.createCode(ownerId);
  return { code: entry.code, ownerId: entry.ownerId };
}

/**
 * Processes a referral: validates code, awards credits, logs conversion.
 * Idempotent — same code+user pair can only be processed once.
 */
export function processReferral(
  referralCode: string,
  newUserId: string,
  processedRefs: Set<string> = new Set()
): ReferralConversionResult {
  const key = `${referralCode}:${newUserId}`;
  
  // Idempotency check
  if (processedRefs.has(key)) {
    return { status: 'already_processed' };
  }

  const code = referralStore.getCode(referralCode);
  if (!code) {
    return { status: 'invalid_code' };
  }

  // Mark as processed
  processedRefs.add(key);

  // Award credits
  const credits = referralStore.awardCredits(referralCode);

  return {
    status: 'ok',
    creditsAwarded: credits,
    ownerId: code.ownerId,
  };
}
