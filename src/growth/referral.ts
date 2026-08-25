export interface ReferralCode {
  code: string;
  ownerId: string;
  uses: number;
  creditsAwarded: number;
  createdAt: string;
}

export interface ReferralConversion {
  id: string;
  referralCode: string;
  referrerId: string;
  referredUserId: string;
  creditsGranted: number;
  convertedAt: string;
}

export interface SystemEvent {
  id: string;
  eventType: string;
  userId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ReferralResult {
  success: boolean;
  creditsAwarded?: number;
  referrerId?: string;
  referredUserId?: string;
  error?: string;
}

export class ReferralEngine {
  private codes = new Map<string, ReferralCode>();
  private conversions = new Map<string, ReferralConversion>(); // Keyed by referredUserId
  private userCredits = new Map<string, number>();
  private systemEvents: SystemEvent[] = [];

  public createReferralCode(ownerId: string, customCode?: string): ReferralCode {
    const code = customCode || `ref_${ownerId.slice(0, 6)}_${Math.random().toString(36).slice(2, 6)}`;
    const record: ReferralCode = {
      code,
      ownerId,
      uses: 0,
      creditsAwarded: 0,
      createdAt: new Date().toISOString(),
    };
    this.codes.set(code, record);
    return record;
  }

  public getUserCredits(userId: string): number {
    return this.userCredits.get(userId) || 0;
  }

  public addCredits(userId: string, amount: number): void {
    const current = this.getUserCredits(userId);
    this.userCredits.set(userId, current + amount);
  }

  public getEvents(): SystemEvent[] {
    return [...this.systemEvents];
  }

  public processReferral(referralCode: string, newUserId: string): ReferralResult {
    const codeRecord = this.codes.get(referralCode);
    if (!codeRecord) {
      return { success: false, error: 'invalid_referral_code' };
    }

    if (codeRecord.ownerId === newUserId) {
      return { success: false, error: 'self_referral_forbidden' };
    }

    if (this.conversions.has(newUserId)) {
      return { success: false, error: 'referral_already_claimed' };
    }

    const creditsAwarded = 5;
    const now = new Date().toISOString();

    // 1. Record conversion
    const conversion: ReferralConversion = {
      id: `cnv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      referralCode,
      referrerId: codeRecord.ownerId,
      referredUserId: newUserId,
      creditsGranted: creditsAwarded,
      convertedAt: now,
    };
    this.conversions.set(newUserId, conversion);

    // 2. Update referral code metrics
    codeRecord.uses += 1;
    codeRecord.creditsAwarded += creditsAwarded;

    // 3. Award credits to referrer
    this.addCredits(codeRecord.ownerId, creditsAwarded);

    // 4. Log system event
    this.systemEvents.push({
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      eventType: 'referral_conversion',
      userId: codeRecord.ownerId,
      metadata: {
        referredUserId: newUserId,
        referralCode,
        creditsGranted: creditsAwarded,
      },
      createdAt: now,
    });

    return {
      success: true,
      creditsAwarded,
      referrerId: codeRecord.ownerId,
      referredUserId: newUserId,
    };
  }
}

export const defaultReferralEngine = new ReferralEngine();
