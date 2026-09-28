import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { processReferral } from '../src/growth/referral.ts';

Deno.test('successful referral returns five awarded credits', async () => {
  const rpc={async processReferral(){return {status:'ok',credits_awarded:5,owner_id:'referrer-1'};}};
  assertEquals(await processReferral('ABC123','new-user',rpc),{processed:true,duplicate:false,creditsAwarded:5,ownerId:'referrer-1'});
});

Deno.test('duplicate referral is not awarded twice', async () => {
  let calls=0;
  const rpc={async processReferral(){calls++; return calls===1?{status:'ok',credits_awarded:5,owner_id:'referrer-1'}:{status:'already_processed'};}};
  assertEquals((await processReferral('ABC123','same-user',rpc)).creditsAwarded,5);
  assertEquals(await processReferral('ABC123','same-user',rpc),{processed:false,duplicate:true,creditsAwarded:0});
});

Deno.test('invalid code is rejected', async () => {
  const rpc={async processReferral(){return {status:'invalid_code'};}};
  await assertRejects(()=>processReferral('bad','user',rpc),Error,'Invalid referral code');
});
