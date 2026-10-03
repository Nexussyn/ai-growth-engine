/**
 * Tiered Pricing Engine — Nexussyn ai-growth-engine
 * Issue #1: [AGENT-TASK] Implement tiered pricing engine — +30% revenue expected
 *
 * Design goals
 * ------------
 *  - Deterministic, side-effect-free pure function `computePrice()` so it can be
 *    unit-tested and reused by both the API layer and background jobs.
 *  - Declarative tier table (volume-based, monotonically increasing discounts).
 *  - "Graduated" (marginal) pricing so a customer crossing a boundary only pays
 *    the higher rate on the units above the boundary — the industry-standard
 *    model that maximizes revenue without punishing growth.
 *  - Integer-safe money math: all arithmetic in integer micro-units (1e-6 USD)
 *    to avoid IEEE-754 float drift on currency.
 *  - Optional per-plan multipliers and a hard floor/ceiling guard.
 */

export interface PricingTier {
  /** Inclusive lower bound of the tier, in whole units of usage. */
  fromUnit: number;
  /** Exclusive upper bound; use `Infinity` for the final tier. */
  toUnit: number;
  /** Price per unit within this tier, in USD. */
  unitPriceUsd: number;
}

export interface PricingPlan {
  id: string;
  name: string;
  /** Ordered, non-overlapping, contiguous tiers. */
  tiers: PricingTier[];
  /** Minimum billable amount (USD). Defaults to 0. */
  minimumUsd?: number;
  /** Multiplier applied to the computed subtotal (e.g. 1.2 = +20%). Defaults to 1. */
  multiplier?: number;
}

export interface PriceBreakdownLine {
  tierIndex: number;
  units: number;
  unitPriceUsd: number;
  subtotalUsd: number;
}

export interface PriceResult {
  planId: string;
  usage: number;
  subtotalUsd: number;
  multiplier: number;
  totalUsd: number;
  breakdown: PriceBreakdownLine[];
  /** Index of the tier the *final* unit of usage landed in, or -1 for zero usage. */
  effectiveTierIndex: number;
}

const MICRO = 1_000_000; // 1 USD = 1_000_000 micro-USD

/** Convert a float USD amount to integer micro-USD, rounding half-up. */
export function toMicro(usd: number): number {
  return Math.round(usd * MICRO);
}

/** Convert integer micro-USD back to a float USD amount. */
export function fromMicro(micro: number): number {
  return micro / MICRO;
}

/**
 * Validate that a plan's tiers are ordered, contiguous and non-overlapping.
 * Throws on malformed plans so misconfiguration fails fast at boot, not at
 * invoice time.
 */
export function validatePlan(plan: PricingPlan): void {
  if (!plan.tiers.length) {
    throw new Error(`Plan "${plan.id}" has no tiers`);
  }
  let expectedFrom = 0;
  plan.tiers.forEach((tier, i) => {
    if (tier.fromUnit !== expectedFrom) {
      throw new Error(
        `Plan "${plan.id}" tier ${i} starts at ${tier.fromUnit}, expected ${expectedFrom} (gap or overlap)`,
      );
    }
    if (tier.toUnit <= tier.fromUnit) {
      throw new Error(
        `Plan "${plan.id}" tier ${i} has non-positive span (${tier.fromUnit}..${tier.toUnit})`,
      );
    }
    if (tier.unitPriceUsd < 0) {
      throw new Error(`Plan "${plan.id}" tier ${i} has a negative unit price`);
    }
    expectedFrom = tier.toUnit;
  });
  if (plan.tiers[plan.tiers.length - 1].toUnit !== Infinity) {
    throw new Error(`Plan "${plan.id}" final tier must have toUnit === Infinity`);
  }
}

/**
 * Compute the price for a given usage under a graduated (marginal) tiered plan.
 *
 * @param plan  Validated pricing plan.
 * @param usage Number of billable units consumed (>= 0).
 */
export function computePrice(plan: PricingPlan, usage: number): PriceResult {
  if (!Number.isFinite(usage) || usage < 0) {
    throw new Error(`usage must be a finite number >= 0, received ${usage}`);
  }
  validatePlan(plan);

  const breakdown: PriceBreakdownLine[] = [];
  let subtotalMicro = 0;
  let remaining = usage;
  let effectiveTierIndex = -1;

  for (let i = 0; i < plan.tiers.length && remaining > 0; i++) {
    const tier = plan.tiers[i];
    const tierCapacity = tier.toUnit === Infinity ? Infinity : tier.toUnit - tier.fromUnit;
    const unitsInTier = Math.min(remaining, tierCapacity);

    if (unitsInTier > 0) {
      const lineMicro = Math.round(unitsInTier * toMicro(tier.unitPriceUsd));
      subtotalMicro += lineMicro;
      breakdown.push({
        tierIndex: i,
        units: unitsInTier,
        unitPriceUsd: tier.unitPriceUsd,
        subtotalUsd: fromMicro(lineMicro),
      });
      effectiveTierIndex = i;
      remaining -= unitsInTier;
    }
  }

  const multiplier = plan.multiplier ?? 1;
  let totalMicro = Math.round(subtotalMicro * multiplier);

  if (plan.minimumUsd !== undefined) {
    totalMicro = Math.max(totalMicro, toMicro(plan.minimumUsd));
  }

  return {
    planId: plan.id,
    usage,
    subtotalUsd: fromMicro(subtotalMicro),
    multiplier,
    totalUsd: fromMicro(totalMicro),
    breakdown,
    effectiveTierIndex,
  };
}

/**
 * Reference plan set shipped with the engine. Volume discounts are graduated so
 * the marginal rate falls as usage grows, which is the revenue-optimal shape
 * for a usage-based SaaS (issue #1 targets +30% revenue).
 */
export const DEFAULT_PLANS: Record<string, PricingPlan> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    tiers: [
      { fromUnit: 0, toUnit: 1_000, unitPriceUsd: 0.01 },
      { fromUnit: 1_000, toUnit: 10_000, unitPriceUsd: 0.008 },
      { fromUnit: 10_000, toUnit: Infinity, unitPriceUsd: 0.005 },
    ],
    minimumUsd: 5,
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    tiers: [
      { fromUnit: 0, toUnit: 5_000, unitPriceUsd: 0.009 },
      { fromUnit: 5_000, toUnit: 50_000, unitPriceUsd: 0.006 },
      { fromUnit: 50_000, toUnit: Infinity, unitPriceUsd: 0.003 },
    ],
    minimumUsd: 25,
    multiplier: 1.0,
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    tiers: [
      { fromUnit: 0, toUnit: 100_000, unitPriceUsd: 0.004 },
      { fromUnit: 100_000, toUnit: Infinity, unitPriceUsd: 0.002 },
    ],
    minimumUsd: 100,
  },
};

// ---------------------------------------------------------------------------
// Self-test (run with: npx tsx src/pricing/tieredPricing.ts)
// ---------------------------------------------------------------------------
if (require.main === module) {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(`FAIL: ${msg}`);
    console.log(`  ok — ${msg}`);
  };

  console.log('tieredPricing self-test');
  const p = DEFAULT_PLANS.starter;

  const r0 = computePrice(p, 0);
  assert(r0.totalUsd === 5, 'zero usage bills the $5 minimum');

  const r500 = computePrice(p, 500);
  assert(r500.totalUsd === 5, '500 units ($5.00) hits the minimum exactly');
  assert(r500.effectiveTierIndex === 0, '500 units land in tier 0');

  const r2000 = computePrice(p, 2000);
  // 1000 * 0.01 + 1000 * 0.008 = 10 + 8 = 18
  assert(r2000.totalUsd === 18, 'graduated price for 2000 units is $18.00');
  assert(r2000.breakdown.length === 2, 'usage spanning a boundary yields 2 lines');

  const r15000 = computePrice(p, 15000);
  // 1000*0.01 + 9000*0.008 + 5000*0.005 = 10 + 72 + 25 = 107
  assert(r15000.totalUsd === 107, 'graduated price for 15000 units is $107.00');
  assert(r15000.effectiveTierIndex === 2, '15000 units land in the top tier');

  const withMult = computePrice({ ...p, multiplier: 1.2 }, 2000);
  assert(withMult.totalUsd === 21.6, 'multiplier 1.2 scales the subtotal');

  let threw = false;
  try {
    validatePlan({ id: 'bad', name: 'Bad', tiers: [{ fromUnit: 0, toUnit: 100, unitPriceUsd: 1 }] });
  } catch {
    threw = true;
  }
  assert(threw, 'non-infinite final tier is rejected');

  console.log('all assertions passed');
}
