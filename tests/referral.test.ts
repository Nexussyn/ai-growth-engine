import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  process_referral,
  REFERRAL_CREDIT_AWARD,
  type ReferralCodeRecord,
  type ReferralRepository,
} from '../src/growth/referral.ts';

class FakeReferralRepository implements ReferralRepository {
  codes = new Map<string, ReferralCodeRecord>();
  conversions = new Set<string>();
  credits = new Map<string, number>();
  events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  notifications: Array<{ userId: string; message: string; metadata: Record<string, unknown> }> = [];

  addCode(code: string, ownerId: string): void {
    this.codes.set(code, { code, owner_id: ownerId });
  }

  async findReferralCode(code: string): Promise<ReferralCodeRecord | null> {
    return this.codes.get(code) ?? null;
  }

  async hasReferralConversion(code: string, newUserId: string): Promise<boolean> {
    return this.conversions.has(`${code}:${newUserId}`);
  }

  async recordReferralConversion(code: string, newUserId: string): Promise<void> {
    this.conversions.add(`${code}:${newUserId}`);
  }

  async addReferralCredits(ownerId: string, credits: number): Promise<void> {
    this.credits.set(ownerId, (this.credits.get(ownerId) ?? 0) + credits);
  }

  async logSystemEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
    this.events.push({ eventType, payload });
  }

  async notifyUser(userId: string, message: string, metadata: Record<string, unknown>): Promise<void> {
    this.notifications.push({ userId, message, metadata });
  }
}

Deno.test('process_referral awards credits and logs conversion event', async () => {
  const repo = new FakeReferralRepository();
  repo.addCode('ABCD1234', 'user-a');

  const result = await process_referral(repo, ' abcd1234 ', 'user-b');

  assertEquals(result.status, 'ok');
  assertEquals(result.credits_awarded, REFERRAL_CREDIT_AWARD);
  assertEquals(repo.credits.get('user-a'), REFERRAL_CREDIT_AWARD);
  assertEquals(repo.conversions.has('ABCD1234:user-b'), true);
  assertEquals(repo.events[0].eventType, 'referral_conversion');
  assertEquals(repo.events[0].payload.referral_code, 'ABCD1234');
});

Deno.test('process_referral prevents duplicate awards', async () => {
  const repo = new FakeReferralRepository();
  repo.addCode('ABCD1234', 'user-a');

  await process_referral(repo, 'ABCD1234', 'user-b');
  const duplicate = await process_referral(repo, 'ABCD1234', 'user-b');

  assertEquals(duplicate.status, 'already_processed');
  assertEquals(repo.credits.get('user-a'), REFERRAL_CREDIT_AWARD);
  assertEquals(repo.events.length, 1);
});

Deno.test('process_referral rejects self referrals', async () => {
  const repo = new FakeReferralRepository();
  repo.addCode('ABCD1234', 'user-a');

  const result = await process_referral(repo, 'ABCD1234', 'user-a');

  assertEquals(result.status, 'self_referral');
  assertEquals(repo.credits.get('user-a'), undefined);
  assertEquals(repo.events.length, 0);
});

Deno.test('process_referral reports invalid referral code', async () => {
  const repo = new FakeReferralRepository();

  const result = await process_referral(repo, 'missing', 'user-b');

  assertEquals(result.status, 'invalid_code');
  assertEquals(repo.events.length, 0);
});

Deno.test('process_referral emits notifications for both users', async () => {
  const repo = new FakeReferralRepository();
  repo.addCode('ABCD1234', 'user-a');

  await process_referral(repo, 'ABCD1234', 'user-b');

  assertEquals(repo.notifications.length, 2);
  assertEquals(repo.notifications[0].userId, 'user-a');
  assertEquals(repo.notifications[1].userId, 'user-b');
});
