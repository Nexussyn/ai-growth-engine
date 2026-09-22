/**
 * Tiered pricing engine for x402 API calls.
 *
 * Pricing rules:
 *  - Tier 4 (Priority):   $0.10 per call   (overrides all other tiers)
 *  - Tier 1 (Free):       $0.00 per call   (first 50 calls)
 *  - Tier 2 (Standard):   $0.01 per call   (calls 51‑500)
 *  - Tier 3 (Premium):    $0.03 per call   (calls > 500)
 *
 * The function returns the *per‑call* price based on the total number of
 * calls a user has made and whether the request is flagged as priority.
 */

export type PricingTier = 'free' | 'standard' | 'premium' | 'priority';

/**
 * Determines the pricing tier for a given usage snapshot.
 *
 * @param callCount      Total number of API calls the user has made so far.
 * @param priorityFlag  Whether the current request is marked as priority.
 * @returns The per‑call price in USDC (as a number with two decimal places).
 */
export function getTierPrice(callCount: number, priorityFlag: boolean): number {
  // Guard against negative call counts – treat them as zero.
  const safeCallCount = Math.max(0, Math.floor(callCount));

  // Priority flag always forces the highest tier.
  if (priorityFlag) {
    return 0.10;
  }

  if (safeCallCount <= 50) {
    // Tier 1 – Free
    return 0.0;
  }

  if (safeCallCount <= 500) {
    // Tier 2 – Standard
    return 0.01;
  }

  // Tier 3 – Premium
  return 0.03;
}

/**
 * Helper that returns the textual tier name for reporting / storage.
 *
 * @param callCount
 * @param priorityFlag
 */
export function resolvePricingTier(callCount: number, priorityFlag: boolean): PricingTier {
  if (priorityFlag) {
    return 'priority';
  }
  if (callCount <= 50) {
    return 'free';
  }
  if (callCount <= 500) {
    return 'standard';
  }
  return 'premium';
}
