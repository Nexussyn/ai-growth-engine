import { UpsellEngine, UpsellContext } from '../src/monetization/upsell';

describe('UpsellEngine Trigger Logic', () => {
  let engine: UpsellEngine;

  beforeEach(() => {
    engine = new UpsellEngine(80.0);
  });

  test('should trigger high priority upsell when quota exhausted (100%)', () => {
    const context: UpsellContext = {
      userId: 'user_101',
      currentTier: 'free',
      quotaLimit: 1000,
      quotaUsed: 1000,
      daysActive: 5
    };

    const offer = engine.evaluateTrigger(context);
    expect(offer.eligible).toBe(true);
    expect(offer.recommendedTier).toBe('starter');
    expect(offer.reason).toBe('QUOTA_EXHAUSTED');
    expect(offer.priority).toBe('high');
  });

  test('should trigger medium priority upsell with discount when quota >= 80%', () => {
    const context: UpsellContext = {
      userId: 'user_102',
      currentTier: 'starter',
      quotaLimit: 1000,
      quotaUsed: 850,
      daysActive: 12
    };

    const offer = engine.evaluateTrigger(context);
    expect(offer.eligible).toBe(true);
    expect(offer.recommendedTier).toBe('pro');
    expect(offer.reason).toBe('QUOTA_THRESHOLD_WARNING');
    expect(offer.priority).toBe('medium');
    expect(offer.discountCode).toBe('GROWTH20');
  });

  test('should not trigger upsell when usage is under threshold', () => {
    const context: UpsellContext = {
      userId: 'user_103',
      currentTier: 'starter',
      quotaLimit: 1000,
      quotaUsed: 400,
      daysActive: 2
    };

    const offer = engine.evaluateTrigger(context);
    expect(offer.eligible).toBe(false);
    expect(offer.priority).toBe('low');
  });
});
