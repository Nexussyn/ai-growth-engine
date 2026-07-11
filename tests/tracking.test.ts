import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { logConversion, getConversionStats } from '../src/landing/tracking.ts';

Deno.test('logConversion: returns event object', () => {
  // localStorage mock for testing
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    length: 0,
    clear: () => {},
    key: () => null,
  };

  const event = logConversion('metamask', true);
  assertEquals(event.wallet, 'metamask');
  assertEquals(event.mobile, true);
  assertEquals(event.converted, true);
  assert(typeof event.timestamp === 'number');

  const event2 = logConversion('coinbase', false);
  assertEquals(event2.wallet, 'coinbase');
  assertEquals(event2.mobile, false);
});

Deno.test('getConversionStats: returns stats', () => {
  const stats = getConversionStats();
  assert(typeof stats.mobile === 'number');
  assert(typeof stats.desktop === 'number');
  assert(typeof stats.total === 'number');
});
