/**
 * Referral Reward Loop — Issue #2
 * Awards credits to referrers upon successful referral conversions
 */

export interface ReferralCode {
  id: string;
  code: string;
  ownerId: string;
  uses: number;
  creditsAwarded: number;
  createdAt: Date;
}

export interface ReferralConversionResult {
  status: 'ok' | 'already_processed' | 'invalid_code';
  creditsAwarded?: number;
  ownerId?: string;
}

export interface MockDatabase {
  referralCodes: Map<string, { ownerId: string; uses: number; creditsAwarded: number }>;
  conversions: Set<string>;
  systemEvents: Array<{ type: string; payload: Record<string, unknown>; timestamp: Date }>;
}

export function createMockDatabase(): MockDatabase {
  return {
    referralCodes: new Map(),
    conversions: new Set(),
    systemEvents: []
  };
}

export function generateReferralCode(ownerId: string, customCode?: string, db?: MockDatabase): string {
  const code = customCode || `ref_${ownerId.slice(0, 4)}_${Math.random().toString(36).substring(2, 6)}`;
  if (db) {
    db.referralCodes.set(code, { ownerId, uses: 0, creditsAwarded: 0 });
  }
  return code;
}

export function processReferral(
  code: string,
  newUserId: string,
  db: MockDatabase,
  creditsPerConversion = 5
): ReferralConversionResult {
  const conversionKey = `${code}:${newUserId}`;

  // 1. Check idempotency
  if (db.conversions.has(conversionKey)) {
    return { status: 'already_processed' };
  }

  // 2. Validate referral code
  const referralEntry = db.referralCodes.get(code);
  if (!referralEntry) {
    return { status: 'invalid_code' };
  }

  // 3. Prevent self-referral
  if (referralEntry.ownerId === newUserId) {
    return { status: 'already_processed' };
  }

  // 4. Record conversion
  db.conversions.add(conversionKey);
  referralEntry.uses += 1;
  referralEntry.creditsAwarded += creditsPerConversion;

  // 5. Emit system event
  db.systemEvents.push({
    type: 'referral_conversion',
    payload: {
      code,
      newUserId,
      ownerId: referralEntry.ownerId,
      creditsAwarded: creditsPerConversion
    },
    timestamp: new Date()
  });

  return {
    status: 'ok',
    creditsAwarded: creditsPerConversion,
    ownerId: referralEntry.ownerId
  };
}
