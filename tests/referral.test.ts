import { ReferralSystem } from '../src/growth/referral';

// Mock DB Client
class MockDB {
  public data: any = {
    referral_codes: [{ code: 'NEXUS-123', owner_id: 'user-a', uses: 0, credits_awarded: 0 }],
    referral_uses: [],
    users: [{ id: 'user-a', credits: 0 }, { id: 'user-b', credits: 0 }],
    system_events: []
  };

  async query(sql: string, params: any[] = []): Promise<any> {
    if (sql.includes('SELECT owner_id')) {
      const found = this.data.referral_codes.find((c: any) => c.code === params[0]);
      return found ? [found] : [];
    }
    
    if (sql.includes('INSERT INTO referral_uses')) {
      const exists = this.data.referral_uses.find((u: any) => u.new_user_id === params[1]);
      if (exists) throw new Error('Unique constraint violation');
      this.data.referral_uses.push({ code: params[0], new_user_id: params[1], processed: true });
    }

    if (sql.includes('UPDATE referral_codes')) {
      const code = this.data.referral_codes.find((c: any) => c.code === params[0]);
      if (code) {
        code.uses += 1;
        code.credits_awarded += 5;
      }
    }

    if (sql.includes('UPDATE users')) {
      const user = this.data.users.find((u: any) => u.id === params[0]);
      if (user) {
        user.credits += 5;
      }
    }

    if (sql.includes('INSERT INTO system_events')) {
      this.data.system_events.push({ type: params[0], user_id: params[1], details: params[2] });
    }
    return [];
  }
}

async function runTests() {
  const db = new MockDB();
  const system = new ReferralSystem(db as any);

  console.log('Testing happy path...');
  const result1 = await system.process_referral('NEXUS-123', 'user-b');
  if (!result1) throw new Error('Happy path failed');
  
  const userA = db.data.users.find((u: any) => u.id === 'user-a');
  if (userA.credits !== 5) throw new Error('Credits not awarded');
  
  const event = db.data.system_events[0];
  if (event.type !== 'referral_conversion') throw new Error('Event not logged');
  
  console.log('Testing idempotency (duplicate prevention)...');
  const result2 = await system.process_referral('NEXUS-123', 'user-b');
  if (result2) throw new Error('Duplicate referral should have failed');
  if (userA.credits !== 5) throw new Error('Credits should not be awarded twice');

  console.log('Testing self-referral...');
  const result3 = await system.process_referral('NEXUS-123', 'user-a');
  if (result3) throw new Error('Self referral should fail');

  console.log('All tests passed!');
}

runTests().catch(console.error);
