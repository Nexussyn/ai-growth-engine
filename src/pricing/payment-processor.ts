/**
 * Payment Processor — Integrates tiered pricing into x402 payment flow
 * Uses the tier engine to calculate costs and applies tier metadata to payments
 */

import { getTierPrice, type Tier, type TierResult } from './tier-engine.ts';

export interface PaymentRequest {
  userId: string;
  callCount: number;
  priorityFlag: boolean;
  numCalls: number;
}

export interface PaymentResult {
  tier: Tier;
  totalCost: number;
  pricePerCall: number;
  callsInTier: number;
  remainingFree: number;
  breakdown: TierResult[];
}

/**
 * Process a payment request by determining the tier, calculating cost,
 * and returning full breakdown.
 */
export function processPayment(req: PaymentRequest): PaymentResult {
  const breakdown: TierResult[] = [];
  let remainingCalls = req.numCalls;
  let currentCount = req.callCount;

  while (remainingCalls > 0) {
    const result = getTierPrice(currentCount, req.priorityFlag);
    const callsThisTier = Math.min(result.callsInTier, remainingCalls);
    const tierResult: TierResult = {
      tier: result.tier,
      pricePerCall: result.pricePerCall,
      callsInTier: callsThisTier,
    };
    breakdown.push(tierResult);
    currentCount += callsThisTier;
    remainingCalls -= callsThisTier;
  }

  const totalCost = breakdown.reduce((sum, t) => sum + t.pricePerCall * t.callsInTier, 0);
  const firstTier = breakdown[0];

  // Calculate remaining free calls
  const freeCallsUsed = Math.min(req.callCount, 50);
  const remainingFree = Math.max(0, 50 - freeCallsUsed);

  return {
    tier: firstTier.tier,
    totalCost: Math.round(totalCost * 1e6) / 1e6,
    pricePerCall: firstTier.pricePerCall,
    callsInTier: firstTier.callsInTier,
    remainingFree,
    breakdown,
  };
}

/**
 * Apply tier metadata to a Supabase x402_call record (for DB insertion).
 */
export function buildTierMetadata(req: PaymentRequest): Record<string, unknown> {
  const result = processPayment(req);
  return {
    tier: result.tier,
    price_per_call: result.pricePerCall,
    total_cost: result.totalCost,
    calls_in_tier: result.callsInTier,
    breakdown: result.breakdown,
    remaining_free: result.remainingFree,
    priority_flag: req.priorityFlag,
  };
}

/**
 * Determine the human-readable prompt for the tier a user is in.
 */
export function getTierPrompt(tier: Tier): string {
  switch (tier) {
    case 'free':
      return 'You are on the Free tier — enjoy your first 50 calls at no cost.';
    case 'standard':
      return 'You are on the Standard tier ($0.01/call). Upgrade to Premium for unlimited access.';
    case 'premium':
      return 'You are on the Premium tier — unlimited calls at $0.03 each.';
    case 'priority':
      return 'Priority mode active — your calls are expedited at $0.10/call.';
  }
}
