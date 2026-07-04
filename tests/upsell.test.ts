import {
  shouldTriggerUpsell,
  getUpsellVariant,
  buildUpsellHeader,
  processUpsell,
} from '../src/monetization/upsell';

function testNoTriggerBeforeThreshold() {
  const result = shouldTriggerUpsell(3, false);
  console.assert(!result.shouldTrigger, 'Should not trigger at call 3');
  console.log('PASS: No trigger before threshold');
}

function testTriggerAtThreshold() {
  const result = shouldTriggerUpsell(5, false);
  console.assert(result.shouldTrigger, 'Should trigger at call 5');
  console.log('PASS: Trigger at threshold (call 5)');
}

function testTriggerAfterThreshold() {
  const result = shouldTriggerUpsell(7, false);
  console.assert(result.shouldTrigger, 'Should trigger at call 7');
  console.log('PASS: Trigger after threshold (call 7)');
}

function testNoDoubleTrigger() {
  const result = shouldTriggerUpsell(5, true);
  console.assert(!result.shouldTrigger, 'Should not trigger if already shown');
  console.log('PASS: No double trigger');
}

function testUpsellVariantStructure() {
  const variant = getUpsellVariant();
  console.assert(typeof variant.id === 'string', 'Variant should have id');
  console.assert(typeof variant.title === 'string', 'Variant should have title');
  console.assert(typeof variant.body === 'string', 'Variant should have body');
  console.assert(typeof variant.cta === 'string', 'Variant should have cta');
  console.log('PASS: Upsell variant has correct structure');
}

function testUpsellVariantRandomness() {
  const ids = new Set<string>();
  for (let i = 0; i < 20; i++) {
    ids.add(getUpsellVariant().id);
  }
  console.assert(ids.size > 0, 'Should get at least one variant');
  console.log('PASS: Upsell variants are selectable');
}

function testUpsellHeaderFormat() {
  const header = buildUpsellHeader('a');
  console.assert(header === 'true; variant=a', `Unexpected header: ${header}`);
  console.log('PASS: Upsell header format correct');
}

function testProcessUpsellNoTrigger() {
  const result = processUpsell('user_1', 3, false);
  console.assert(!result.trigger.shouldTrigger, 'Should not trigger');
  console.assert(result.header === undefined, 'No header when not triggered');
  console.log('PASS: Process upsell skips when below threshold');
}

function testProcessUpsellAtThreshold() {
  const result = processUpsell('user_1', 5, false);
  console.assert(result.trigger.shouldTrigger, 'Should trigger');
  console.assert(result.header !== undefined, 'Should have header');
  console.assert(result.variant !== undefined, 'Should have variant');
  console.assert(result.sql !== undefined, 'Should have SQL');
  console.assert(result.sql!.includes('user_1'), `SQL should reference user: ${result.sql}`);
  console.log('PASS: Process upsell generates full payload at threshold');
}

function testProcessUpsellNoDouble() {
  const result = processUpsell('user_1', 5, true);
  console.assert(!result.trigger.shouldTrigger, 'Should not trigger again');
  console.log('PASS: Process upsell prevents double trigger');
}

console.log('Running upsell system tests...\n');
testNoTriggerBeforeThreshold();
testTriggerAtThreshold();
testTriggerAfterThreshold();
testNoDoubleTrigger();
testUpsellVariantStructure();
testUpsellVariantRandomness();
testUpsellHeaderFormat();
testProcessUpsellNoTrigger();
testProcessUpsellAtThreshold();
testProcessUpsellNoDouble();
console.log('\nAll tests passed!');
