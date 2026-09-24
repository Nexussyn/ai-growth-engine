import test from 'node:test';
import assert from 'node:assert/strict';

import {
  processReferral,
  type ReferralCode,
  type ReferralStore,
} from '../src/growth/referral.ts';

class FakeStore implements ReferralStore {
  codes = new Map<string, ReferralCode>();
  conversions = new Set<string>();
  credits = new Map<string, number>();
  stats = new Map<string, { uses: number; credits: number }>();
  events: Array<{ type: string; payload: Record<string, unknown> }> = [];
  notifications: Array<{ userId: string; kind: string; message: string; code: string }> = [];

  async transaction<T>(fn: (tx: ReferralStore) => Promise<T>): Promise<T> {
    return fn(this);
  }

  async getReferralCode(code: string): Promise<ReferralCode | null> {
    return this.codes.get(code) ?? null;
  }
  async createConversion(code: string, newUserId: string): Promise<boolean> {
    const key = `${code}:${newUserId}`;
    if (this.conversions.has(key)) return false;
    this.conversions.add(key);
    return true;
  }

  async addCredits(userId: string, credits: number): Promise<void> {
    this.credits.set(userId, (this.credits.get(userId) ?? 0) + credits);
  }

  async incrementReferralStats(code: string, credits: number): Promise<void> {
    const current = this.stats.get(code) ?? { uses: 0, credits: 0 };
    this.stats.set(code, {
      uses: current.uses + 1,
      credits: current.credits + credits,
    });
  }

  async logEvent(type: string, payload: Record<string, unknown>): Promise<void> {
    this.events.push({ type, payload });
  }
  async notify(
    userId: string,
    kind: string,
    message: string,
    referralCode: string,
  ): Promise<void> {
    this.notifications.push({ userId, kind, message, code: referralCode });
  }
}

function seededStore(): FakeStore {
  const store = new FakeStore();
  store.codes.set('ALICE5', { code: 'ALICE5', ownerId: 'alice' });
  return store;
}

test('awards exactly five credits, logs the event, and notifies both users', async () => {
  const store = seededStore();

  const result = await processReferral('ALICE5', 'bob', store);

  assert.deepEqual(result, { status: 'ok', creditsAwarded: 5, ownerId: 'alice' });
  assert.equal(store.credits.get('alice'), 5);
  assert.deepEqual(store.stats.get('ALICE5'), { uses: 1, credits: 5 });
  assert.equal(store.events.length, 1);
  assert.equal(store.events[0].type, 'referral_conversion');
  assert.deepEqual(
    new Set(store.notifications.map((notification) => notification.userId)),
    new Set(['alice', 'bob']),
  );
});

test('duplicate conversion is idempotent and does not double-award', async () => {
  const store = seededStore();

  assert.equal((await processReferral('ALICE5', 'bob', store)).status, 'ok');
  assert.equal((await processReferral('ALICE5', 'bob', store)).status, 'already_processed');

  assert.equal(store.credits.get('alice'), 5);
  assert.deepEqual(store.stats.get('ALICE5'), { uses: 1, credits: 5 });
  assert.equal(store.events.length, 1);
  assert.equal(store.notifications.length, 2);
});
test('invalid referral codes fail closed without side effects', async () => {
  const store = seededStore();

  const result = await processReferral('MISSING', 'bob', store);

  assert.equal(result.status, 'invalid_code');
  assert.equal(store.conversions.size, 0);
  assert.equal(store.events.length, 0);
  assert.equal(store.notifications.length, 0);
});

test('self-referrals are rejected before conversion or reward', async () => {
  const store = seededStore();

  const result = await processReferral('ALICE5', 'alice', store);

  assert.equal(result.status, 'self_referral');
  assert.equal(store.conversions.size, 0);
  assert.equal(store.credits.get('alice'), undefined);
});

test('blank identifiers are rejected before touching the store', async () => {
  const store = seededStore();

  await assert.rejects(() => processReferral(' ', 'bob', store), TypeError);
  await assert.rejects(() => processReferral('ALICE5', '', store), TypeError);
  assert.equal(store.events.length, 0);
});
