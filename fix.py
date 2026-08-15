```typescript
/**
 * Solution 1: Tiered Pricing Engine
 * File: solution_1.typescript
 * 
 * Implements a tiered pricing system for the x402 API calls.
 * Handles flat rates, volume tiers, and priority flags.
 */

// --- Configuration Constants ---
export const PRICING_CONFIG = {
  TIER_1_LIMIT: 50,            // First 50 calls = Free
  TIER_2_LIMIT: 500,           // 51-500 calls
  BASE_RATE_STANDARD: 0.01,    // $0.01/call
  BASE_RATE_PREMIUM: 0.03,     // $0.03/call
  RATE_PRIORITY: 0.10,         // $0.10/call (Tier 4)
} as const;

export type PricingTier = 
  | 'FREE' 
  | 'STANDARD' 
  | 'PREMIUM' 
  | 'PRIORITY';

export interface PricingResult {
  amount: number;
  currency: string;
  effectiveTier: PricingTier;
  breakdown: {
    flatRate: number;
    volumeRate: number;
  };
}

/**
 * Calculates the total price based on call count and priority flag.
 * 
 * Logic:
 * - Non-Priority:
 *   1-50 calls:   $0.00 (Marginal)
 *   51-500 calls: $0.01 (Marginal)
 *   501+ calls:   $0.03 (Marginal)
 * - Priority Flag:
 *   Flat $0.10/call (Overrides volume complexity)
 * 
 * @param callCount - The cumulative number of API calls made in this billing cycle.
 * @param priorityFlag - Indicates if the customer has Priority support.
 * @returns The total calculated price in USD.
 */
export const get_tier_price = (
  callCount: number,
  priorityFlag: boolean
): number => {
  // Guard clauses for edge cases
  if (callCount < 0) callCount = 0;
  
  // Apply Priority Override
  if (priorityFlag) {
    // If priority, we assume a flat high rate to incentivize heavy usage or flat fee.
    // Spec says "$0.10/call", so we apply that to the effective count.
    // We treat it as the "Marginal Step" logic but at a higher rate.
    return callCount * PRICING_CONFIG.RATE_PRIORITY;
  }

  // Standard Tier Logic
  const baseRate = PRICING_CONFIG.BASE_RATE_STANDARD;
  const premiumRate = PRICING_CONFIG.BASE_RATE_PREMIUM;

  let price = 0;

  // Tier 1 (Free): 1 to 50
  // We use a "Marginal Count" approach to handle the steps cleanly.
  let effectiveCount = callCount;
  
  // Tier 2 (Standard): 51 to 500
  if (effectiveCount > PRICING_CONFIG.TIER_1_LIMIT) {
    price += (effectiveCount - PRICING_CONFIG.TIER_1_LIMIT) * baseRate;
    // Now check for Tier 3 (Premium)
    
    // Tier 3 (Premium): 500+
    if (effectiveCount > PRICING_CONFIG.TIER_2_LIMIT) {
      // Calculate the volume specifically for the Premium tier
      // Note: This implements "Marginal Step" where the 501st call hits the higher rate
      price += (effectiveCount - PRICING_CONFIG.TIER_2_LIMIT) * premiumRate;
    }
  }

  // Return rounded to 2 decimals for currency precision
  return Math.round(price * 100) / 100;
};

/**
 * SQL Migration String to inject into the database.
 * Idempotent (uses IF NOT EXISTS or ON CONFLICT).
 */
export const MIGRATION_SQL = `
ALTER TABLE x402_api_invoices 
ADD COLUMN IF NOT EXISTS tier_name VARCHAR(20) DEFAULT 'STANDARD',
ADD COLUMN IF NOT EXISTS call_limit INTEGER DEFAULT 500;

-- Optional: Create a helper function to fetch dynamic tier rates
-- DROP FUNCTION IF EXISTS x402_get_dynamic_price;
-- CREATE FUNCTION x402_get_dynamic_price(count INT, is_priority BOOL) RETURNS NUMERIC AS $$
--   SELECT CASE 
--     WHEN is_priority THEN count * 0.10
--     WHEN count <= 50 THEN 0
--     WHEN count <= 500 THEN (count - 50) * 0.01
--     ELSE ((count - 50) * 0.01) + ((count - 500) * 0.03)
--   END;
-- $$ LANGUAGE SQL IMMUTABLE;
`;

/**
 * A specialized helper to fetch the base rate for a specific bucket.
 * Useful for database indexing or quick lookups.
 */
export const get_base_tier_rate = (count: number, baseRate: number = PRICING_CONFIG.BASE_RATE_STANDARD): number => {
  if (count <= PRICING_CONFIG.TIER_1_LIMIT) return 0.00;
  if (count <= PRICING_CONFIG.TIER_2_LIMIT) return baseRate;
  return PRICING_CONFIG.BASE_RATE_PREMIUM;
};

/**
 * Helper to determine the string tier name for display/reporting.
 */
export const get_tier_name = (callCount: number, priorityFlag: boolean): PricingTier => {
  if (priorityFlag) return 'PRIORITY';
  
  if (callCount <= PRICING_CONFIG.TIER_1_LIMIT) return 'FREE';
  if (callCount <= PRICING_CONFIG.TIER_2_LIMIT) return 'STANDARD';
  
  return 'PREMIUM';
};

// --- Exports for the "Single File" Experience ---

export type { PricingResult, PricingTier };
export type { PRICING_CONFIG }; // Type-safe config

// Helper for unit test assertions
export const calculatePrice = get_tier_price;

// Module default export for direct usage
export default get_tier_price;
```