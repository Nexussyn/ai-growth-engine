/**
 * Referral Reward Loop — Issue #2
 * Implements referral tracking, 5-credit award loop, and conversion event logging.
 */

export interface ReferralCode {
  id?: string;
  code: string;
  ownerId: string;
  uses: number;
  creditsAwarded: number;
  createdAt?: Date;
}

export interface ReferralConversion {
  id?: string;
  referralCode: string;
  newUserId: string;
  convertedAt?: Date;
}

export interface SystemEvent {
  eventType: string;
  payload: Record<string, unknown>;
  createdAt?: Date;
}

export interface ProcessReferralResult {
  status: 'ok' | 'invalid_code' | 'already_processed' | 'cannot_refer_self';
  creditsAwarded?: number;
  ownerId?: string;
}

export class ReferralEngine {
  private codes: Map<string, ReferralCode> = new Map();
  private conversions: Set<string> = new Set();
  public events: SystemEvent[] = [];

  constructor(initialCodes: ReferralCode[] = []) {
    for (const c of initialCodes) {
      this.codes.set(c.code, { ...c });
    }
  }

  public registerCode(code: string, ownerId: string): ReferralCode {
    const entry: ReferralCode = {
      code,
      ownerId,
      uses: 0,
      creditsAwarded: 0,
      createdAt: new Date(),
    };
    this.codes.set(code, entry);
    return entry;
  }

  public getCode(code: string): ReferralCode | undefined {
    return this.codes.get(code);
  }

  /**
   * Process a referral code conversion for a new user.
   * - Awards 5 free credits to the referrer
   * - Increments uses count
   * - Logs referral_conversion event in system_events
   * - Ensures idempotency (duplicate prevention)
   */
  public processReferral(code: string, newUserId: string): ProcessReferralResult {
    // 1. Idempotency check: same code + new_user pair
    const conversionKey = `${code}:${newUserId}`;
    if (this.conversions.has(conversionKey)) {
      return { status: 'already_processed' };
    }

    // 2. Validate referral code existence
    const referral = this.codes.get(code);
    if (!referral) {
      return { status: 'invalid_code' };
    }

    // 3. Self-referral prevention
    if (referral.ownerId === newUserId) {
      return { status: 'cannot_refer_self' };
    }

    // 4. Record conversion
    this.conversions.add(conversionKey);

    // 5. Award 5 credits to owner & increment uses
    const creditsToAward = 5;
    referral.uses += 1;
    referral.creditsAwarded += creditsToAward;

    // 6. Record system event
    this.events.push({
      eventType: 'referral_conversion',
      payload: {
        code,
        new_user: newUserId,
        credits: creditsToAward,
      },
      createdAt: new Date(),
    });

    return {
      status: 'ok',
      creditsAwarded: creditsToAward,
      ownerId: referral.ownerId,
    };
  }
}
