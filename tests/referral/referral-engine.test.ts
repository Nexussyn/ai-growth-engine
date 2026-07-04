import { describe, it, expect } from 'vitest';
import { validateReferralCode, calculateConversionRate, estimateKFactor, predictRevenueImpact } from '../../src/referral/referral-engine';

describe('validateReferralCode', () => {
  it('should accept valid 8-char alphanumeric code', () => {
    expect(validateReferralCode('ABC123DE')).toBe(true);
  });

  it('should reject codes with lowercase', () => {
    expect(validateReferralCode('abc123de')).toBe(false);
  });

  it('should reject too short codes', () => {
    expect(validateReferralCode('ABC')).toBe(false);
  });

  it('should reject codes with special characters', () => {
    expect(validateReferralCode('ABC-123!')).toBe(false);
  });
});

describe('calculateConversionRate', () => {
  it('should return 0 with no codes', () => {
    expect(calculateConversionRate(0, 0)).toBe(0);
  });

  it('should calculate basic conversion rate', () => {
    expect(calculateConversionRate(100, 25)).toBe(0.25);
  });

  it('should handle 100% conversion', () => {
    expect(calculateConversionRate(10, 10)).toBe(1);
  });
});

describe('predictRevenueImpact', () => {
  it('should predict positive ROI', () => {
    const impact = predictRevenueImpact({
      currentUsers: 1000,
      referralConversionRate: 0.2,
      averageRevenuePerUser: 10,
      freeCallCost: 0.01,
    });
    expect(impact.newUsersPerPeriod).toBeGreaterThan(0);
    expect(impact.netGain).toBeGreaterThan(0);
  });

  it('should handle zero users', () => {
    const impact = predictRevenueImpact({
      currentUsers: 0,
      referralConversionRate: 0.2,
      averageRevenuePerUser: 10,
      freeCallCost: 0.01,
    });
    expect(impact.newUsersPerPeriod).toBe(0);
  });
});
