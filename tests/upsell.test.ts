import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UpsellEngine } from '../src/monetization/upsell';

describe('Upsell Trigger Engine (#3)', () => {
  it('triggers upsell prompt when user reaches 5th free call (50% threshold)', () => {
    const engine = new UpsellEngine();

    // Calls 1-4 should not trigger
    for (let i = 1; i <= 4; i++) {
      const evalResult = engine.evaluateFreeUsage('user_123', i, 10);
      assert.equal(evalResult.shouldPrompt, false);
      assert.equal(evalResult.headerValue, 'false');
    }

    // Call 5 should trigger
    const triggerResult = engine.evaluateFreeUsage('user_123', 5, 10);
    assert.equal(triggerResult.shouldPrompt, true);
    assert.equal(triggerResult.headerKey, 'X-Upsell-Prompt');
    assert.equal(triggerResult.headerValue, 'true');
    assert.ok(triggerResult.promptText);

    const record = engine.getTrigger('user_123');
    assert.ok(record);
    assert.equal(record.userId, 'user_123');
  });

  it('ensures trigger fires exactly once per threshold (idempotent)', () => {
    const engine = new UpsellEngine();

    const first = engine.evaluateFreeUsage('user_456', 5, 10);
    assert.equal(first.shouldPrompt, true);

    const second = engine.evaluateFreeUsage('user_456', 6, 10);
    assert.equal(second.shouldPrompt, false);
    assert.equal(second.headerValue, 'false');
  });
});
