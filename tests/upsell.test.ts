import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkUpsell, withUpsell, type UpsellClient } from '../src/monetization/upsell.ts';

test('only the fifth free call consults the database', async () => {
  let calls = 0;
  const db: UpsellClient = { rpc: async () => { calls++; return { data: { upsell: true }, error: null }; } };
  for (const count of [0, 1, 4, 6, 10, 11]) {
    assert.deepEqual(await checkUpsell(db, 'user', count), { triggered: false, headers: {} });
  }
  assert.equal(calls, 0);
  assert.equal((await checkUpsell(db, 'user', 5)).headers['X-Upsell-Prompt'], 'true');
  assert.equal(calls, 1);
});

test('database losing request does not show a second prompt', async () => {
  let first = true;
  const db: UpsellClient = { rpc: async (name, args) => {
    assert.equal(name, 'check_upsell_trigger');
    assert.deepEqual(args, { p_user_id: 'user', p_call_count: 5 });
    const upsell = first; first = false;
    return { data: { upsell }, error: null };
  } };
  const decisions = await Promise.all([checkUpsell(db, 'user', 5), checkUpsell(db, 'user', 5)]);
  assert.equal(decisions.filter(d => d.triggered).length, 1);
});

test('A/B prompts and middleware preserve response body/status/headers', async () => {
  const db: UpsellClient = { rpc: async () => ({ data: { upsell: true }, error: null }) };
  const a = await checkUpsell(db, 'a', 5, 'A');
  const { response, decision } = await withUpsell(new Response('payload', {
    status: 201, headers: { 'X-Existing': 'kept' },
  }), db, 'b', 5, 'B');
  assert.notEqual(a.prompt, decision.prompt);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('X-Existing'), 'kept');
  assert.equal(response.headers.get('X-Upsell-Prompt'), 'true');
  assert.equal(await response.text(), 'payload');
});

test('no prompt header survives a non-triggered decision', async () => {
  const db: UpsellClient = { rpc: async () => ({ data: { upsell: false }, error: null }) };
  const { response } = await withUpsell(new Response('ok', { headers: { 'X-Upsell-Prompt': 'true' } }), db, 'a', 5);
  assert.equal(response.headers.has('X-Upsell-Prompt'), false);
});

test('invalid counts and failed or malformed RPC responses fail explicitly', async () => {
  const unused: UpsellClient = { rpc: async () => { throw new Error('must not run'); } };
  for (const count of [-1, 0.5, NaN, Infinity]) await assert.rejects(checkUpsell(unused, 'user', count), TypeError);
  await assert.rejects(checkUpsell(unused, ' ', 5), TypeError);
  for (const result of [{ data: null, error: 'failed' }, { data: {}, error: null }, { data: { upsell: 'true' }, error: null }]) {
    await assert.rejects(checkUpsell({ rpc: async () => result }, 'user', 5));
  }
});
