import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkUpsell } from '../src/monetization/upsell.ts';

test('threshold filtering makes no database calls', async () => {
  const client = { rpc: async () => { throw new Error('unexpected call'); } };
  for (const count of [0, 1, 4, 6, 10]) {
    assert.deepEqual(await checkUpsell(client, 'user', count), { headers: {} });
  }
});

test('winning insert produces usage-specific prompt; duplicate produces no header', async () => {
  let calls = 0;
  const client = { rpc: async (name: string, args: unknown) => {
    assert.equal(name, 'check_upsell_trigger');
    assert.deepEqual(args, { p_user_id: 'user', p_call_count: 5 });
    return { data: { upsell: calls++ === 0 }, error: null };
  } };
  const first = await checkUpsell(client, 'user', 5, 'burst', 'B');
  assert.equal(first.headers['X-Upsell-Prompt'], 'true');
  assert.match(first.prompt!, /burst.*Compare plans/);
  assert.equal(first.variant, 'B');
  assert.deepEqual(await checkUpsell(client, 'user', 5), { headers: {} });
});

test('invalid inputs, persistence errors and malformed replies cannot claim success', async () => {
  const client = { rpc: async () => ({ data: { upsell: true }, error: null }) };
  for (const count of [-1, NaN, Infinity, 4.5, 2147483648]) {
    await assert.rejects(checkUpsell(client, 'user', count), TypeError);
  }
  await assert.rejects(checkUpsell(client, '', 5), TypeError);
  await assert.rejects(checkUpsell({ rpc: async () => ({ data: null, error: 'offline' }) }, 'u', 5), /persistence/);
  await assert.rejects(checkUpsell({ rpc: async () => ({ data: { upsell: 'true' }, error: null }) }, 'u', 5), /Invalid upsell RPC/);
  const result = await checkUpsell(client, 'u', 5);
  assert.match(result.prompt!, /5 of your 10.*View upgrade/);
});
