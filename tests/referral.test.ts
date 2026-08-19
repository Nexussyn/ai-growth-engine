import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ReferralEngine } from '../src/growth/referral';

describe('Referral Engine (#2)', () => {
  it('awards 5 credits to referrer on successful conversion', () => {
    const engine = new ReferralEngine();
    const codeObj = engine.createCode('user_A', 'REF123');

    const res = engine.processReferral('REF123', 'user_B');
    assert.equal(res.status, 'ok');
    assert.equal(res.creditsAwarded, 5);
    assert.equal(res.ownerId, 'user_A');

    const updatedCode = engine.getCode('REF123');
    assert.equal(updatedCode?.uses, 1);
    assert.equal(updatedCode?.creditsAwarded, 5);

    const events = engine.getEvents();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'referral_conversion');
    assert.equal(events[0].payload.credits, 5);
  });

  it('prevents duplicate referrals from the same user (idempotency)', () => {
    const engine = new ReferralEngine();
    engine.createCode('user_A', 'REF123');

    const res1 = engine.processReferral('REF123', 'user_B');
    assert.equal(res1.status, 'ok');

    const res2 = engine.processReferral('REF123', 'user_B');
    assert.equal(res2.status, 'already_processed');

    const updatedCode = engine.getCode('REF123');
    assert.equal(updatedCode?.uses, 1);
    assert.equal(updatedCode?.creditsAwarded, 5);
  });

  it('returns invalid_code for non-existent referral code', () => {
    const engine = new ReferralEngine();
    const res = engine.processReferral('NON_EXISTENT', 'user_B');
    assert.equal(res.status, 'invalid_code');
  });
});
