export function get_tier_price(call_count: number, priority_flag: boolean): number {
  if (priority_flag) {
    return 0.10; // Tier 4 (Priority)
  }
  if (call_count <= 50) {
    return 0.00; // Tier 1 (Free)
  } else if (call_count <= 500) {
    return 0.01; // Tier 2 (Standard)
  } else {
    return 0.03; // Tier 3 (Premium)
  }
}
