/**
 * Referral Reward Loop — Nexussyn ai-growth-engine
 * Issue #2: [AGENT-TASK] Implement referral reward loop — +20% conversion
 *
 * Design goals
 * ------------
 *  - Deterministic, pure state machine: `applyReferralEvent()` takes the current
 *    ledger plus an event and returns the next ledger. No hidden I/O, fully
 *    unit-testable, and trivially replayable from an event log.
 *  - Idempotent: every reward is keyed by `(referrerId, refereeId, kind)` so a
 *    duplicated webhook can never double-pay.
 *  - Two-sided incentives: the referrer earns a recurring share of the referee's
 *    paid revenue (a "loop", not a one-shot bonus), and the referee gets a
 *    first-invoice discount. Both are capped to protect margin.
 *  - Integer micro-USD arithmetic to avoid float drift on money.
 *  - Self-referral and cycles (A→B→A) are rejected.
 */

const MICRO = 1_000_000;

export interface ReferralConfig {
  /** Share of each referee payment credited to the referrer (0..1). */
  referrerShare: number;
  /** One-time discount applied to the referee's first invoice (0..1). */
  refereeDiscount: number;
  /** Maximum total micro-USD a single referrer can ever accrue. */
  referrerCapMicro: number;
  /** Number of billing periods the referrer keeps earning after signup. */
  rewardWindowPeriods: number;
}

export const DEFAULT_REFERRAL_CONFIG: ReferralConfig = {
  referrerShare: 0.2,
  refereeDiscount: 0.25,
  referrerCapMicro: 500 * MICRO,
  rewardWindowPeriods: 12,
};

export interface ReferralLink {
  referrerId: string;
  refereeId: string;
  /** Billing period index (0-based) in which the referee signed up. */
  signupPeriod: number;
}

export interface ReferralEvent {
  type: 'payment' | 'refund';
  refereeId: string;
  /** Gross paid amount in micro-USD. */
  amountMicro: number;
  /** Billing period index of this event. */
  period: number;
  /** Stable idempotency key (e.g. invoice id). */
  eventId: string;
}

export interface RewardEntry {
  referrerId: string;
  refereeId: string;
  eventId: string;
  amountMicro: number;
  period: number;
}

export interface ReferralLedger {
  links: Record<string, ReferralLink>; // refereeId -> link
  seenEvents: Record<string, true>; // idempotency guard
  rewards: RewardEntry[];
  accruedMicro: Record<string, number>; // referrerId -> total accrued
  refereeDiscountUsed: Record<string, true>;
}

export function emptyLedger(): ReferralLedger {
  return {
    links: {},
    seenEvents: {},
    rewards: [],
    accruedMicro: {},
    refereeDiscountUsed: {},
  };
}

/** Would linking `referrerId` -> `refereeId` create a cycle or self-referral? */
export function wouldCreateCycle(
  ledger: ReferralLedger,
  referrerId: string,
  refereeId: string,
): boolean {
  if (referrerId === refereeId) return true;
  // Walk up the existing chain from the referrer; if we reach the referee, it's a cycle.
  let cursor: string | undefined = referrerId;
  const guard = new Set<string>();
  while (cursor && !guard.has(cursor)) {
    guard.add(cursor);
    if (cursor === refereeId) return true;
    cursor = ledger.links[cursor]?.referrerId;
  }
  return false;
}

export function registerReferral(
  ledger: ReferralLedger,
  link: ReferralLink,
): ReferralLedger {
  if (wouldCreateCycle(ledger, link.referrerId, link.refereeId)) {
    throw new Error(
      `referral ${link.referrerId} -> ${link.refereeId} rejected: self-referral or cycle`,
    );
  }
  return { ...ledger, links: { ...ledger.links, [link.refereeId]: link } };
}

/**
 * Apply a payment/refund event and return the next ledger.
 * Idempotent on `event.eventId`.
 */
export function applyReferralEvent(
  ledger: ReferralLedger,
  event: ReferralEvent,
  config: ReferralConfig = DEFAULT_REFERRAL_CONFIG,
): ReferralLedger {
  if (ledger.seenEvents[event.eventId]) return ledger; // already processed
  if (!Number.isInteger(event.amountMicro) || event.amountMicro <= 0) {
    throw new Error(`amountMicro must be a positive integer, got ${event.amountMicro}`);
  }

  const link = ledger.links[event.refereeId];
  const seenEvents = { ...ledger.seenEvents, [event.eventId]: true as const };

  if (!link) {
    return { ...ledger, seenEvents };
  }

  const withinWindow =
    event.period >= link.signupPeriod &&
    event.period < link.signupPeriod + config.rewardWindowPeriods;

  let rewardMicro = 0;
  if (withinWindow) {
    const raw = Math.round(event.amountMicro * config.referrerShare);
    rewardMicro = event.type === 'refund' ? -raw : raw;
  }

  const accrued = ledger.accruedMicro[link.referrerId] ?? 0;
  // Clamp positive accrual to the cap; refunds may reduce below the cap.
  if (rewardMicro > 0) {
    rewardMicro = Math.min(rewardMicro, Math.max(0, config.referrerCapMicro - accrued));
  }

  const rewards = rewardMicro !== 0
    ? [
        ...ledger.rewards,
        {
          referrerId: link.referrerId,
          refereeId: event.refereeId,
          eventId: event.eventId,
          amountMicro: rewardMicro,
          period: event.period,
        },
      ]
    : ledger.rewards;

  return {
    ...ledger,
    seenEvents,
    rewards,
    accruedMicro: {
      ...ledger.accruedMicro,
      [link.referrerId]: accrued + rewardMicro,
    },
  };
}

/**
 * Compute the referee's discounted first invoice. Applies the discount at most
 * once per referee (idempotent across retries).
 */
export function applyRefereeDiscount(
  ledger: ReferralLedger,
  refereeId: string,
  invoiceMicro: number,
  config: ReferralConfig = DEFAULT_REFERRAL_CONFIG,
): { ledger: ReferralLedger; totalMicro: number } {
  if (!ledger.links[refereeId] || ledger.refereeDiscountUsed[refereeId]) {
    return { ledger, totalMicro: invoiceMicro };
  }
  const discount = Math.round(invoiceMicro * config.refereeDiscount);
  return {
    ledger: {
      ...ledger,
      refereeDiscountUsed: { ...ledger.refereeDiscountUsed, [refereeId]: true },
    },
    totalMicro: Math.max(0, invoiceMicro - discount),
  };
}

// ---------------------------------------------------------------------------
// Self-test (run with: npx tsx src/growth/referralRewardLoop.ts)
// ---------------------------------------------------------------------------
if (require.main === module) {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(`FAIL: ${msg}`);
    console.log(`  ok — ${msg}`);
  };

  console.log('referralRewardLoop self-test');
  let led = emptyLedger();
  led = registerReferral(led, { referrerId: 'alice', refereeId: 'bob', signupPeriod: 0 });

  // Bob pays $100 in period 0 -> Alice earns 20% = $20
  led = applyReferralEvent(led, { type: 'payment', refereeId: 'bob', amountMicro: 100 * MICRO, period: 0, eventId: 'inv_1' });
  assert(led.accruedMicro['alice'] === 20 * MICRO, 'alice accrues 20% of bob payment');

  // Duplicate webhook must not double-pay
  led = applyReferralEvent(led, { type: 'payment', refereeId: 'bob', amountMicro: 100 * MICRO, period: 0, eventId: 'inv_1' });
  assert(led.accruedMicro['alice'] === 20 * MICRO, 'duplicate eventId is idempotent');

  // Outside the reward window -> no reward
  led = applyReferralEvent(led, { type: 'payment', refereeId: 'bob', amountMicro: 100 * MICRO, period: 99, eventId: 'inv_old' });
  assert(led.accruedMicro['alice'] === 20 * MICRO, 'payment outside reward window earns nothing');

  // Refund claws back the share
  led = applyReferralEvent(led, { type: 'refund', refereeId: 'bob', amountMicro: 100 * MICRO, period: 0, eventId: 'ref_1' });
  assert(led.accruedMicro['alice'] === 0, 'refund claws back the referrer share');

  // Self-referral rejected
  let threw = false;
  try { registerReferral(led, { referrerId: 'carol', refereeId: 'carol', signupPeriod: 0 }); } catch { threw = true; }
  assert(threw, 'self-referral is rejected');

  // Cycle rejected
  led = registerReferral(led, { referrerId: 'bob', refereeId: 'carol', signupPeriod: 0 });
  threw = false;
  try { registerReferral(led, { referrerId: 'carol', refereeId: 'alice', signupPeriod: 0 }); } catch { threw = true; }
  assert(threw, 'referral cycle is rejected');

  // Referee discount applied once
  const d1 = applyRefereeDiscount(led, 'bob', 100 * MICRO);
  assert(d1.totalMicro === 75 * MICRO, 'referee gets 25% off first invoice');
  const d2 = applyRefereeDiscount(d1.ledger, 'bob', 100 * MICRO);
  assert(d2.totalMicro === 100 * MICRO, 'referee discount is applied only once');

  // Cap enforced
  let capped = emptyLedger();
  capped = registerReferral(capped, { referrerId: 'x', refereeId: 'y', signupPeriod: 0 });
  for (let i = 0; i < 100; i++) {
    capped = applyReferralEvent(capped, { type: 'payment', refereeId: 'y', amountMicro: 100 * MICRO, period: 0, eventId: `inv_${i}` });
  }
  assert(capped.accruedMicro['x'] === 500 * MICRO, 'referrer accrual is capped at $500');

  console.log('all assertions passed');
}
