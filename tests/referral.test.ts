import { process_referral, DatabaseClient } from './referral';

// Mock Database Implementation for Unit Testing
class MockDatabase implements DatabaseClient {
  public referralCodes: Map<string, { owner_id: string; uses: number; credits_awarded: number }> = new Map();
  public referralConversions: Set<string> = new Set();
  public userCredits: Map<string, number> = new Map();
  public systemEvents: Array<{ type: string; user_id: string; metadata: any }> = [];
  public notifications: Array<{ user_id: string; title: string; message: string }> = [];

  async query(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
    if (sql.includes('SELECT code, owner_id FROM referral_codes')) {
      const code = params[0];
      if (this.referralCodes.has(code)) {
        return { rows: [this.referralCodes.get(code)] };
      }
      return { rows: [] };
    }

    if (sql.includes('SELECT id FROM referral_conversions')) {
      const refereeId = params[0];
      if (this.referralConversions.has(refereeId)) {
        return { rows: [{ id: 1 }] };
      }
      return { rows: [] };
    }

    if (sql.includes('INSERT INTO referral_conversions')) {
      const refereeId = params[2];
      this.referralConversions.add(refereeId);
      return { rows: [] };
    }

    if (sql.includes('UPDATE users SET credits')) {
      const amount = params[0];
      const userId = params[1];
      const current = this.userCredits.get(userId) || 0;
      this.userCredits.set(userId, current + amount);
      return { rows: [] };
    }

    if (sql.includes('INSERT INTO system_events')) {
      this.systemEvents.push({
        type: params[0],
        user_id: params[1],
        metadata: JSON.parse(params[2])
      });
      return { rows: [] };
    }

    if (sql.includes('INSERT INTO user_notifications')) {
      this.notifications.push({ user_id: params[0], title: 'Referral Bonus!', message: 'Msg' });
      this.notifications.push({ user_id: params[1], title: 'Welcome Bonus!', message: 'Msg' });
      return { rows: [] };
    }

    return { rows: [] };
  }
}

describe('Referral System Unit Tests', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
    db.referralCodes.set('REF123', { owner_id: 'user_referrer_1', uses: 0, credits_awarded: 0 });
    db.userCredits.set('user_referrer_1', 10);
  });

  test('Happy Path: Successfully awards 5 credits to referrer', async () => {
    const result = await process_referral(db, 'REF123', 'user_referee_99');

    expect(result.success).toBe(true);
    expect(result.creditsAwarded).toBe(5);
    expect(db.userCredits.get('user_referrer_1')).toBe(15);
    expect(db.systemEvents.length).toBe(1);
    expect(db.systemEvents[0].type).toBe('referral_conversion');
  });

  test('Idempotency: Prevents duplicate conversions for same user', async () => {
    // First conversion
    await process_referral(db, 'REF123', 'user_referee_99');
    
    // Attempt second conversion
    const secondResult = await process_referral(db, 'REF123', 'user_referee_99');

    expect(secondResult.success).toBe(false);
    expect(secondResult.message).toContain('already converted');
    expect(db.userCredits.get('user_referrer_1')).toBe(15); // Credits stay at 15, not 20
  });

  test('Self-Referral Prevention: Rejects user referring themselves', async () => {
    const result = await process_referral(db, 'REF123', 'user_referrer_1');

    expect(result.success).toBe(false);
    expect(result.message).toContain('cannot use their own referral code');
  });
});
