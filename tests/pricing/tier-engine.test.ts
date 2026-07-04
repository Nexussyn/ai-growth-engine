import { describe, it, expect } from 'vitest';
import { getTierPrice, calculateBatchCharge, estimateRevenueImpact } from '../../src/pricing/tier-engine';

describe('getTierPrice', () => {
  it('should return free tier for 0-50 calls', () => {
    const result = getTierPrice(1);
    expect(result.tier).toBe('free');
    expect(result.pricePerCall).toBe(0);
  });

  it('should return free tier at exactly 50 calls', () => {
    const result = getTierPrice(50);
    expect(result.tier).toBe('free');
    expect(result.pricePerCall).toBe(0);
  });

  it('should return standard tier for 51-500 calls', () => {
    const result = getTierPrice(51);
    expect(result.tier).toBe('standard');
    expect(result.pricePerCall).toBe(0.01);
  });

  it('should return standard tier at exactly 500 calls', () => {
    const result = getTierPrice(500);
    expect(result.tier).toBe('standard');
    expect(result.pricePerCall).toBe(0.01);
  });

  it('should return premium tier for 501+ calls', () => {
    const result = getTierPrice(501);
    expect(result.tier).toBe('premium');
    expect(result.pricePerCall).toBe(0.03);
  });

  it('should return premium tier for very high call counts', () => {
    const result = getTierPrice(9999);
    expect(result.tier).toBe('premium');
    expect(result.pricePerCall).toBe(0.03);
  });

  it('should return priority tier when isPriority is true', () => {
    const result = getTierPrice(1, true);
    expect(result.tier).toBe('priority');
    expect(result.pricePerCall).toBe(0.10);
  });

  it('should override free tier with priority', () => {
    const result = getTierPrice(5, true);
    expect(result.tier).toBe('priority');
    expect(result.pricePerCall).toBe(0.10);
  });

  it('should override premium tier with priority', () => {
    const result = getTierPrice(1000, true);
    expect(result.tier).toBe('priority');
    expect(result.pricePerCall).toBe(0.10);
  });
});

describe('calculateBatchCharge', () => {
  it('should calculate charge for 10 calls (all free)', () => {
    const charge = calculateBatchCharge(10, 0, 0);
    expect(charge).toBe(0);
  });

  it('should calculate charge for calls crossing into standard tier', () => {
    // 60 calls, starting at 0 -> 50 free + 10 at $0.01 = $0.10
    const charge = calculateBatchCharge(60, 0, 0);
    expect(charge).toBeCloseTo(0.10, 6);
  });

  it('should calculate charge including priority calls', () => {
    const charge = calculateBatchCharge(5, 2, 0);
    // 3 free calls + 2 priority calls at $0.10 = $0.20
    expect(charge).toBeCloseTo(0.20, 6);
  });

  it('should handle calls entirely in premium tier', () => {
    const charge = calculateBatchCharge(3, 0, 500);
    expect(charge).toBeCloseTo(0.09, 6); // 3 * $0.03
  });

  it('should return 0 for empty batch', () => {
    const charge = calculateBatchCharge(0);
    expect(charge).toBe(0);
  });
});

describe('estimateRevenueImpact', () => {
  it('should estimate ~+30% revenue impact for typical usage', () => {
    // Simulate 100 users: 10 free-only (5 calls), 80 standard (100 calls), 10 heavy (1000 calls)
    const distribution = Array(10).fill(5).concat(
      Array(80).fill(100),
      Array(10).fill(1000)
    );
    
    const impact = estimateRevenueImpact(distribution);
    expect(impact.flatRevenue).toBeGreaterThan(0);
    expect(impact.tieredRevenue).toBeGreaterThan(impact.flatRevenue);
    expect(Number(impact.increasePercent.replace(/[^0-9.]/g, ''))).toBeGreaterThan(25);
  });

  it('should show no increase for all-free users', () => {
    const distribution = Array(5).fill(10);
    const impact = estimateRevenueImpact(distribution);
    expect(impact.tieredRevenue).toBe(0);
    expect(impact.increasePercent).toBe('N/A');
  });
});
