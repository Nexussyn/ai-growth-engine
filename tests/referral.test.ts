import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  ReferralService,
  REFERRAL_CREDIT_REWARD,
  type ReferralDb,
  type ReferralNotifier,
} from '../src/referrals/referral-service.ts';

// In-memory mock of the ReferralDb port: mirrors the SQL tables
// (referral_codes, referral_conversions, user_credits, system_events)
// including the UNIQUE(referral_code, new_user_id) backstop.
class MockReferralDb implements ReferralDb {
  codes = new Map<string, { ownerId: string; uses: number; creditsAwarded: number }>();
  conversions = new Set<string>(); // "code|user"
  balances = new Map<string, number>();
  events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];

  async findCodeOwner(code: string): Promise<string | null> {
    return this.codes.get(code)?.ownerId ?? null;
  }

  async hasConversion(code: string, newUserId: string): Promise<boolean> {
    return this.conversions.has(`${code}|${newUserId}`);
  }

  async recordConversion(code: string, newUserId: string): Promise<void> {
    const key = `${code}|${newUserId}`;
    if (this.conversions.has(key)) {
      // Mirrors the UNIQUE constraint / ON CONFLICT DO NOTHING backstop.
      return;
    }
    this.conversions.add(key);
  }

  async addCredits(userId: string, amount: number): Promise<number> {
    const balance = (this.balances.get(userId) ?? 0) + amount;
    this.balances.set(userId, balance);
    return balance;
  }

  async incrementCodeStats(code: string, credits: number): Promise<void> {
    const row = this.codes.get(code);
    if (row) {
      row.uses += 1;
      row.creditsAwarded += credits;
    }
  }

  async logEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
    this.events.push({ eventType, payload });
  }
}

class MockNotifier implements ReferralNotifier {
  referrerNotes: Array<{ ownerId: string; credits: number; newUserId: string }> = [];
  newUserNotes: Array<{ newUserId: string; referrerId: string }> = [];

  async notifyReferrer(ownerId: string, creditsAwarded: number, newUserId: string): Promise<void> {
    this.referrerNotes.push({ ownerId, credits: creditsAwarded, newUserId });
  }

  async notifyNewUser(newUserId: string, referrerId: string): Promise<void> {
    this.newUserNotes.push({ newUserId, referrerId });
  }
}

function setup() {
  const db = new MockReferralDb();
  const notifier = new MockNotifier();
  const service = new ReferralService(db, notifier);
  db.codes.set('ALICE123', { ownerId: 'user-alice', uses: 0, creditsAwarded: 0 });
  return { db, notifier, service };
}

Deno.test('happy path: referrer balance +5, code stats, event, both notified', async () => {
  const { db, notifier, service } = setup();

  const result = await service.processReferral('ALICE123', 'user-bob');

  assertEquals(result.status, 'ok');
  assertEquals(result.ownerId, 'user-alice');
  assertEquals(result.creditsAwarded, REFERRAL_CREDIT_REWARD);

  // Credits land on the referrer's real balance.
  assertEquals(db.balances.get('user-alice'), 5);

  // Code row rolls up uses + credits_awarded.
  assertEquals(db.codes.get('ALICE123')?.uses, 1);
  assertEquals(db.codes.get('ALICE123')?.creditsAwarded, 5);

  // referral_conversion logged in system_events.
  assertEquals(db.events.length, 1);
  assertEquals(db.events[0].eventType, 'referral_conversion');
  assertEquals(db.events[0].payload.code, 'ALICE123');
  assertEquals(db.events[0].payload.new_user, 'user-bob');
  assertEquals(db.events[0].payload.credits, 5);

  // Both users notified.
  assertEquals(notifier.referrerNotes.length, 1);
  assertEquals(notifier.referrerNotes[0].ownerId, 'user-alice');
  assertEquals(notifier.referrerNotes[0].credits, 5);
  assertEquals(notifier.newUserNotes.length, 1);
  assertEquals(notifier.newUserNotes[0].newUserId, 'user-bob');
});

Deno.test('duplicate: same referral by same user is rejected, no double credit', async () => {
  const { db, notifier, service } = setup();

  const first = await service.processReferral('ALICE123', 'user-bob');
  assertEquals(first.status, 'ok');

  const second = await service.processReferral('ALICE123', 'user-bob');
  assertEquals(second.status, 'already_processed');

  // Balance untouched by the duplicate attempt.
  assertEquals(db.balances.get('user-alice'), 5);
  // No second event, no second notifications.
  assertEquals(db.events.length, 1);
  assertEquals(notifier.referrerNotes.length, 1);
  assertEquals(notifier.newUserNotes.length, 1);
});

Deno.test('different new user with same code converts independently', async () => {
  const { db, service } = setup();

  await service.processReferral('ALICE123', 'user-bob');
  const result = await service.processReferral('ALICE123', 'user-carol');

  assertEquals(result.status, 'ok');
  assertEquals(db.balances.get('user-alice'), 10);
  assertEquals(db.codes.get('ALICE123')?.uses, 2);
  assertEquals(db.events.length, 2);
});

Deno.test('invalid code: nothing awarded, nothing logged', async () => {
  const { db, notifier, service } = setup();

  const result = await service.processReferral('NOPE0000', 'user-bob');

  assertEquals(result.status, 'invalid_code');
  assertEquals(db.balances.size, 0);
  assertEquals(db.events.length, 0);
  assertEquals(notifier.referrerNotes.length, 0);
  assertEquals(notifier.newUserNotes.length, 0);
});

Deno.test('self-referral: owner cannot earn from their own code', async () => {
  const { db, notifier, service } = setup();

  const result = await service.processReferral('ALICE123', 'user-alice');

  assertEquals(result.status, 'self_referral');
  assertEquals(db.balances.size, 0);
  assertEquals(db.events.length, 0);
  assertEquals(notifier.referrerNotes.length, 0);
  assertEquals(notifier.newUserNotes.length, 0);
});

Deno.test('generateCode: 8 chars from unambiguous alphabet', () => {
  const code = ReferralService.generateCode();
  assertEquals(code.length, 8);
  assertEquals(/^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/.test(code), true);
});
