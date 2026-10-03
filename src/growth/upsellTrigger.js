/**
 * Auto-upsell trigger after the 5th free call — +25% revenue.
 * Resolves Nexussyn/ai-growth-engine#3
 *
 * Tracks per-user free-call usage. Once a user crosses the free-tier
 * threshold (default 5), the next request is decorated with an upsell
 * prompt and a checkout deep-link, and the event is emitted for analytics.
 * Usage state is injected (any KV/map with get/set) so this stays testable
 * and storage-agnostic.
 */

'use strict';

const FREE_CALL_LIMIT = 5;
const UPSELL_PLANS = [
  { id: 'pro-monthly', label: 'Pro — $19/mo', checkout: '/checkout?plan=pro-monthly' },
  { id: 'pro-yearly', label: 'Pro — $190/yr (2 months free)', checkout: '/checkout?plan=pro-yearly' },
];

function pickPlan(usage) {
  // Offer the annual plan to heavy users, monthly to lighter ones.
  return usage >= FREE_CALL_LIMIT * 3 ? UPSELL_PLANS[1] : UPSELL_PLANS[0];
}

/**
 * @param {object} deps
 * @param {{get:(k:string)=>Promise<number|undefined>, set:(k:string,v:number)=>Promise<void>}} deps.store
 * @param {(event: object) => Promise<void>} [deps.emit]
 * @param {number} [deps.limit]
 */
function createUpsellTrigger({ store, emit = async () => {}, limit = FREE_CALL_LIMIT }) {
  if (!store || typeof store.get !== 'function' || typeof store.set !== 'function') {
    throw new TypeError('store with get/set is required');
  }

  const key = (userId) => `free_calls:${userId}`;

  return {
    /**
     * Record a free call and decide whether to upsell on this request.
     * @returns {{ allowed: boolean, usage: number, upsell: null | {plan: object, message: string} }}
     */
    async onFreeCall(userId) {
      if (!userId) throw new TypeError('userId is required');
      const usage = (await store.get(key(userId))) || 0;
      const next = usage + 1;
      await store.set(key(userId), next);

      if (next <= limit) {
        return { allowed: true, usage: next, upsell: null };
      }

      const plan = pickPlan(next);
      const upsell = {
        plan,
        message:
          `You've used ${next} free calls (limit ${limit}). ` +
          `Upgrade to ${plan.label} to keep going — unlimited calls, priority queue.`,
      };
      await emit({ type: 'upsell_shown', userId, usage: next, planId: plan.id });
      return { allowed: true, usage: next, upsell };
    },

    /** Read current usage without incrementing (for dashboards / tests). */
    async getUsage(userId) {
      return (await store.get(key(userId))) || 0;
    },
  };
}

module.exports = { createUpsellTrigger, pickPlan, FREE_CALL_LIMIT, UPSELL_PLANS };
