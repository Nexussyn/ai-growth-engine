import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { checkUpsell, upsellVariant } from '../src/monetization/upsell.ts';

Deno.test('fires exactly at fifth free call', async () => {
  const seen = new Set<string>();
  const store = { async createTrigger(userId:string, type:string) {
    const key=`${userId}:${type}`; if(seen.has(key)) return false; seen.add(key); return true;
  }};
  assertEquals((await checkUpsell('user-1',4,store)).triggered,false);
  const fifth=await checkUpsell('user-1',5,store);
  assertEquals(fifth.triggered,true);
  assertEquals(fifth.headers['X-Upsell-Prompt'],'true');
  assertEquals((await checkUpsell('user-1',6,store)).triggered,false);
});

Deno.test('does not double-trigger same threshold', async () => {
  let inserted=false;
  const store={async createTrigger(){if(inserted)return false; inserted=true; return true;}};
  assertEquals((await checkUpsell('user-2',5,store)).triggered,true);
  assertEquals((await checkUpsell('user-2',5,store)).triggered,false);
});

Deno.test('A/B variant is deterministic per user', () => {
  assertEquals(upsellVariant('same-user'), upsellVariant('same-user'));
});
