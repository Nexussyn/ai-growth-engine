export interface ReferralCode {
  id: string;
  code: string;
  ownerId: string;
  uses: number;
  creditsAwarded: number;
  createdAt: Date;
}

export interface ReferralResult {
  status: 'ok' | 'already_processed' | 'invalid_code';
  creditsAwarded?: number;
  ownerId?: string;
}

export class ReferralEngine {
  private codes: Map<string, ReferralCode> = new Map();
  private conversions: Set<string> = new Set();
  private events: Array<{ type: string; payload: Record<string, any>; createdAt: Date }> = [];

  createCode(ownerId: string, customCode?: string): ReferralCode {
    const code = customCode || Math.random().toString(36).substring(2, 10).toUpperCase();
    const entry: ReferralCode = {
      id: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      code,
      ownerId,
      uses: 0,
      creditsAwarded: 0,
      createdAt: new Date(),
    };
    this.codes.set(code, entry);
    return entry;
  }

  processReferral(code: string, newUserId: string): ReferralResult {
    const conversionKey = `${code}:${newUserId}`;
    if (this.conversions.has(conversionKey)) {
      return { status: 'already_processed' };
    }

    const ref = this.codes.get(code);
    if (!ref) {
      return { status: 'invalid_code' };
    }

    const credits = 5;
    this.conversions.add(conversionKey);
    ref.uses += 1;
    ref.creditsAwarded += credits;

    this.events.push({
      type: 'referral_conversion',
      payload: {
        code,
        new_user: newUserId,
        credits,
        owner_id: ref.ownerId,
      },
      createdAt: new Date(),
    });

    return {
      status: 'ok',
      creditsAwarded: credits,
      ownerId: ref.ownerId,
    };
  }

  getEvents() {
    return this.events;
  }

  getCode(code: string): ReferralCode | undefined {
    return this.codes.get(code);
  }
}
