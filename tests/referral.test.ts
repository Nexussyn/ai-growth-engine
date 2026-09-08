import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { processReferral } from '../src/growth/referral.ts';

function store() {
  const calls: string[] = [];
  let exists = false;
  return {
    calls,
    findCode: async () => ({ ownerId: 'referrer' }),
    conversionExists: async () => exists,
    addCredits: async (id: string, amount: number) => calls.push(`credits:${id}:${amount}`),
    recordConversion: async () => { exists = true; calls.push('conversion'); },
    incrementCodeUsage: async () => calls.push('usage'),
    recordEvent: async (event: { type: string }) => calls.push(`event:${event.type}`),
  };
}

Deno.test('awards five credits and records conversion', async () => {
  const s = store();
  assertEquals(await processReferral(' CODE ', 'new-user', s), {
    converted: true, creditsAwarded: 5, referrerId: 'referrer',
  });
  assertEquals(s.calls, ['credits:referrer:5', 'conversion', 'usage', 'event:referral_conversion']);
});

Deno.test('same referral is idempotent', async () => {
  const s = store();
  await processReferral('CODE', 'new-user', s);
  assertEquals((await processReferral('CODE', 'new-user', s)).converted, false);
  assertEquals(s.calls.filter((x) => x.startsWith('credits:')).length, 1);
});

Deno.test('rejects self-referral', async () => {
  const s = store();
  assertEquals((await processReferral('CODE', 'referrer', s)).converted, false);
  assertEquals(s.calls, []);
});
