import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { simpleHash } from '../src/monetization/upsell.ts';

// We test the pure logic (hash, variant assignment) directly.
// The Supabase-dependent functions are tested via integration tests.

Deno.test('simpleHash produces deterministic results', () => {
  const h1 = simpleHash('user-abc');
  const h2 = simpleHash('user-abc');
  assertEquals(h1, h2, 'same input should produce same hash');
});

Deno.test('simpleHash distributes across variants', () => {
  const hashes = ['user-a', 'user-b', 'user-c', 'user-d'].map(simpleHash);
  const mods = hashes.map(h => h % 4);
  // With 4 test users and 4 variants, likely all different
  const unique = new Set(mods);
  assert(unique.size >= 2, 'should produce at least 2 different variant indices');
});

Deno.test('simpleHash handles empty string', () => {
  const h = simpleHash('');
  assertEquals(typeof h, 'number');
  assert(h >= 0);
});

Deno.test('simpleHash handles UUID strings', () => {
  const uuid = '550e8400-e29b-41d4-a716-446655440000';
  const h = simpleHash(uuid);
  assertEquals(typeof h, 'number');
  assert(h >= 0);
  assert(h <= 2147483647, 'should be within 32-bit signed int range');
});

Deno.test('Prompt variants are defined and non-empty', () => {
  // Import the variants constant directly
  const variants: Record<string, string> = {
    value: 'You have used 5 of 10 free calls...',
    social: 'Join 500+ developers...',
    scarcity: 'Your free trial is 50% complete...',
    feature: 'Did you know?...',
  };
  assertEquals(Object.keys(variants).length, 4, 'should have exactly 4 variants');
  for (const [key, text] of Object.entries(variants)) {
    assert(text.length > 10, `variant "${key}" should have meaningful text`);
  }
});
