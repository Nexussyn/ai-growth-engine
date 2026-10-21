import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { check_upsell_trigger, hashString } from '../src/monetization/upsell.ts';

Deno.test({
  name: 'Upsell fires at 5th call (50% threshold)',
  async fn() {
    const result = await check_upsell_trigger('user-1', 5);
    assertEquals(result.upsell, true);
    assertEquals(result.prompt !== null, true);
    assertEquals(result.trigger_type, 'free_limit_50pct');
  },
});

Deno.test({
  name: 'Upsell does NOT fire before 5th call',
  async fn() {
    const result = await check_upsell_trigger('user-2', 4);
    assertEquals(result.upsell, false);
    assertEquals(result.prompt, null);
  },
});

Deno.test({
  name: 'Upsell does NOT fire after 5th call',
  async fn() {
    const result = await check_upsell_trigger('user-3', 6);
    assertEquals(result.upsell, false);
    assertEquals(result.prompt, null);
  },
});

Deno.test({
  name: 'Idempotency: trigger fires exactly once per user',
  async fn() {
    const result1 = await check_upsell_trigger('user-4', 5);
    assertEquals(result1.upsell, true);
    const result2 = await check_upsell_trigger('user-4', 5);
    assertEquals(result2.upsell, false);
  },
});

Deno.test({
  name: 'A/B test: deterministic prompt assignment',
  fn() {
    const hash1 = hashString('user-a');
    const hash2 = hashString('user-b');
    assertEquals(hash1 !== hash2, true);
  },
});

Deno.test({
  name: 'A/B test: same user gets same hash consistently',
  fn() {
    const hash1 = hashString('user-x');
    const hash2 = hashString('user-x');
    assertEquals(hash1, hash2);
  },
});