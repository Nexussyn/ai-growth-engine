/**
 * Content-generation agent — auto-posts from bounty outcomes.
 * Resolves Nexussyn/ai-growth-engine#5
 *
 * When a bounty is won (or a PR is merged), this agent composes a short,
 * platform-appropriate post from the bounty outcome and dispatches it via
 * a pluggable publisher (Farcaster / X / webhook). It is idempotent: each
 * bounty outcome is posted at most once, keyed by the bounty id.
 */

'use strict';

const TEMPLATES = {
  won: (b) =>
    `Bounty won: ${b.title} (${b.reward}). Shipped in PR ${b.pr}. ` +
    `Autonomous agents earning their keep — one merged diff at a time.`,
  merged: (b) =>
    `Merged: ${b.title}. ${b.reward} settled to the agent treasury. ` +
    `The machine pays its own bills.`,
  submitted: (b) =>
    `New PR for "${b.title}" — awaiting review. ${b.reward} on the line.`,
};

function composePost(outcome) {
  const { status, title, reward, pr, repo } = outcome;
  const tpl = TEMPLATES[status] || TEMPLATES.submitted;
  const body = tpl({ title, reward, pr, repo });
  return body.length > 280 ? body.slice(0, 277) + '...' : body;
}

/**
 * @param {object} deps
 * @param {(post: string, outcome: object) => Promise<void>} deps.publisher
 * @param {(bountyId: string) => Promise<boolean>} deps.wasPosted
 * @param {(bountyId: string) => Promise<void>} deps.markPosted
 */
function createContentAgent({ publisher, wasPosted, markPosted }) {
  if (typeof publisher !== 'function') throw new TypeError('publisher is required');
  if (typeof wasPosted !== 'function') throw new TypeError('wasPosted is required');
  if (typeof markPosted !== 'function') throw new TypeError('markPosted is required');

  return {
    /** Handle a single bounty outcome. Returns { posted: boolean, text?: string }. */
    async handleOutcome(outcome) {
      if (!outcome || !outcome.bountyId) {
        throw new TypeError('outcome.bountyId is required');
      }
      if (await wasPosted(outcome.bountyId)) {
        return { posted: false, reason: 'already-posted' };
      }
      const text = composePost(outcome);
      await publisher(text, outcome);
      await markPosted(outcome.bountyId);
      return { posted: true, text };
    },

    /** Handle a batch of outcomes, isolating failures. */
    async handleBatch(outcomes = []) {
      const results = [];
      for (const o of outcomes) {
        try {
          results.push(await this.handleOutcome(o));
        } catch (err) {
          results.push({ posted: false, reason: 'error', error: err.message });
        }
      }
      return results;
    },
  };
}

module.exports = { createContentAgent, composePost, TEMPLATES };
