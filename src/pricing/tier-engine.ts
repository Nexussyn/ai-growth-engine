export function getTierPrice(callCount: number, priorityFlag = false): TierResult {
  if (priorityFlag) {
    return { tier: 'priority', pricePerCall: 0.10, callsInTier: 1 };
  }
  if (callCount <= 50) {
    return { tier: 'free', pricePerCall: 0.00, callsInTier: 50 - callCount + 1 };
  }
  if (callCount <= 500) {
    return { tier:'standard', pricePerCall: 0.01, callsInTier: 500 - callCount + 1 };
  }
  return { tier: 'premium', pricePerCall: 0.03, callsInTier: Infinity };
}
