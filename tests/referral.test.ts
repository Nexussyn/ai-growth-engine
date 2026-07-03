import assert from 'node:assert/strict';
import { createInMemoryReferralStore, processReferral, process_referral } from '../src/growth/referral';

async function run() {
  const store = createInMemoryReferralStore();

  // seed code
  store.__debug.codes.set('alpha', {
    code: 'alpha',
    ownerId: 'user-owner',
    uses: 0,
    creditsAwarded: 0,
    usedBy: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const first = await processReferral(store, {
    referralCode: 'alpha',
    newUserId: 'user-new',
    outcomeId: 'b1',
  });

  assert.equal(first.status, 'awarded');
  assert.equal(first.creditsAwarded, 5);
  assert.equal(store.__debug.balances.get('user-owner'), 5);
  assert.equal(store.__debug.systemEvents.length, 1);
  assert.equal(store.__debug.systemEvents[0].eventType, 'referral_conversion');
  assert.equal(store.__debug.systemEvents[0].payload.newUserId, 'user-new');
  assert.equal(store.__debug.notifications.length, 2);

  const second = await processReferral(store, {
    referralCode: 'alpha',
    newUserId: 'user-new',
    outcomeId: 'b2',
  });

  assert.equal(second.status, 'already_used');

  const aliasStore = createInMemoryReferralStore();
  aliasStore.__debug.codes.set('beta', {
    code: 'beta',
    ownerId: 'user-owner-2',
    uses: 0,
    creditsAwarded: 0,
    usedBy: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const alias = await process_referral(aliasStore, 'beta', 'user-new-2');

  assert.equal(alias.status, 'awarded');
  assert.equal(aliasStore.__debug.balances.get('user-owner-2'), 5);

  const self = await processReferral(store, {
    referralCode: 'alpha',
    newUserId: 'user-owner',
    outcomeId: 'b3',
  });

  assert.equal(self.status, 'self_referral');

  const invalid = await processReferral(store, {
    referralCode: 'missing',
    newUserId: 'user-x',
    outcomeId: 'b4',
  });

  assert.equal(invalid.status, 'invalid_code');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
