export type PriceTier = 'free' | 'standard' | 'premium' | 'priority';

export interface TierPriceInput {
  callCount: number;
  priority?: boolean;
}

export interface TierPriceResult {
  tier: PriceTier;
  priceUsd: number;
}

const TIERS: ReadonlyArray<{ tier: PriceTier; priceUsd: number; min: number; max: number | null }> = [
  { tier: 'free', priceUsd: 0, min: 0, max: 50 },
  { tier: 'standard', priceUsd: 0.01, min: 51, max: 500 },
  { tier: 'premium', priceUsd: 0.03, min: 501, max: null },
];

export function getTierPrice(input: TierPriceInput): TierPriceResult {
  const callCount = Number(input.callCount);

  if (!Number.isInteger(callCount) || callCount < 0) {
    throw new Error('callCount must be a non-negative integer');
  }

  if (input.priority) {
    return { tier: 'priority', priceUsd: 0.1 };
  }

  for (const item of TIERS) {
    if (callCount >= item.min && (item.max === null || callCount <= item.max)) {
      return { tier: item.tier, priceUsd: item.priceUsd };
    }
  }

  return { tier: 'premium', priceUsd: 0.03 };
}

export function getTier(callCount: number, priority?: boolean): PriceTier {
  return getTierPrice({ callCount, priority }).tier;
}

export function getPrice(callCount: number, priority?: boolean): number {
  return getTierPrice({ callCount, priority }).priceUsd;
}
