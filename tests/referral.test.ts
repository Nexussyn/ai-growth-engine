import assert from 'node:assert/strict';
import { createInMemoryReferralStore, processReferral } from '../src/growth/referral';

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

  const second = await processReferral(store, {
    referralCode: 'alpha',
    newUserId: 'user-new',
    outcomeId: 'b2',
  });

  assert.equal(second.status, 'already_used');

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
