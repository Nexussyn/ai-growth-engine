/**
 * Calculates the price per API call based on the tiered pricing model.
 * 
 * Tiers:
 * - Tier 1 (Free): 0-50 calls -> $0.00
 * - Tier 2 (Standard): 51-500 calls -> $0.01
 * - Tier 3 (Premium): 500+ calls -> $0.03
 * - Tier 4 (Priority): Priority flagged -> $0.10
 * 
 * @param call_count The number of API calls made in the current period.
 * @param priority_flag Whether the call is flagged as priority.
 * @returns The price per call.
 */
export function get_tier_price(call_count: number, priority_flag: boolean): number {
  if (priority_flag) {
    return 0.10;
  }

  if (call_count <= 50) {
    return 0.00;
  }

  if (call_count <= 500) {
    return 0.01;
  }

  return 0.03;
}
