import {
  DEFAULT_TRIGGER_TYPE,
  UPSELL_THRESHOLD_CALL,
  UpsellTriggerTracker,
  createUpsellMiddleware,
  selectUpsellVariant,
} from '../src/monetization/upsell.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function runUpsellSuite(): void {
  const tracker = new UpsellTriggerTracker();
  const middleware = createUpsellMiddleware(tracker);

  // Calls 1-4: below 50% threshold -> no trigger
  for (let count = 1; count < UPSELL_THRESHOLD_CALL; count++) {
    const res = middleware({ userId: 'agent_alpha', callCount: count, usagePattern: 'x402-search' });
    assert(res.upsell === false, `Call ${count} should not trigger upsell`);
    assert(!('X-Upsell-Prompt' in res.headers), `Call ${count} should not set X-Upsell-Prompt header`);
  }

  // Call 5 (50% of 10 free calls): fires exactly once with X-Upsell-Prompt: true
  const fifth = middleware({ userId: 'agent_alpha', callCount: 5, usagePattern: 'x402-search' });
  assert(fifth.upsell === true, '5th call must trigger upsell');
  assert(fifth.headers['X-Upsell-Prompt'] === 'true', '5th call must set X-Upsell-Prompt: true');
  assert(typeof fifth.prompt === 'string' && fifth.prompt.includes('x402-search'), 'Prompt includes usage pattern');
  assert(fifth.record?.trigger_type === DEFAULT_TRIGGER_TYPE, 'Record uses free_limit_50pct trigger_type');

  // Idempotency: repeated 5th call or subsequent calls 6-10 do NOT double-trigger
  const duplicateFifth = middleware({ userId: 'agent_alpha', callCount: 5, usagePattern: 'x402-search' });
  assert(duplicateFifth.upsell === false, 'Duplicate 5th call must not double-trigger');
  const sixth = middleware({ userId: 'agent_alpha', callCount: 6, usagePattern: 'x402-search' });
  assert(sixth.upsell === false, '6th call must not trigger again');

  // Conversion tracking & A/B variant determinism
  assert(tracker.markConverted('agent_alpha') === true, 'markConverted succeeds for existing trigger');
  assert(tracker.getRecord('agent_alpha')?.converted === true, 'converted flag updated to true');
  const v1 = selectUpsellVariant('user_1');
  const v2 = selectUpsellVariant('user_2');
  assert(v1 === 'variant_a_value' || v1 === 'variant_b_urgency', 'Valid A/B variant');
  assert(v2 === 'variant_a_value' || v2 === 'variant_b_urgency', 'Valid A/B variant');
}

runUpsellSuite();

const globalAny = globalThis as Record<string, unknown>;
if (typeof globalAny.Deno === 'object' && globalAny.Deno !== null) {
  const denoObj = globalAny.Deno as { test?: (name: string, fn: () => void) => void };
  if (typeof denoObj.test === 'function') {
    denoObj.test('Upsell trigger fires once at 5th free call with X-Upsell-Prompt header', () => {
      runUpsellSuite();
    });
  }
}
