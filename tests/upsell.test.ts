// Run: deno test --allow-read --allow-env tests/upsell.test.ts
import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { PGlite } from 'npm:@electric-sql/pglite@0.5.8';
import { checkUpsell, withUpsell, type UpsellClient } from '../src/monetization/upsell.ts';

Deno.test('SQL and middleware: fifth call, retries, concurrent requests and migration reruns', async () => {
  const db = new PGlite();
  try {
    const migration = await Deno.readTextFile(new URL('../migrations/add_upsell_triggers.sql', import.meta.url));
    await db.exec(migration);
    const client: UpsellClient = {
      async rpc(_name, args) {
        const result = await db.query<{ result: unknown }>(
          'SELECT check_upsell_trigger($1, $2) AS result', [args.p_user_id, args.p_call_count],
        );
        return { data: result.rows[0].result, error: null };
      },
    };
    for (const callCount of [0, 4, 6, 10]) {
      assertEquals(await checkUpsell(client, { userId: 'boundary', callCount }), { upsell: false });
    }
    const first = await withUpsell(new Response('payload', { status: 201, headers: { 'X-Test': 'kept' } }), client,
      { userId: 'one', callCount: 5, usagePattern: 'burst', variant: 'B' });
    assertEquals(first.response.headers.get('X-Upsell-Prompt'), 'true');
    assertEquals(first.response.headers.get('X-Test'), 'kept');
    assertEquals(first.response.status, 201);
    assertEquals(await first.response.text(), 'payload');
    assertEquals(first.upsell.upsell && first.upsell.prompt,
      'Working through a burst of requests? Five free calls remain. Explore a plan for your next requests.');
    const retry = await withUpsell(new Response('retry'), client, { userId: 'one', callCount: 5 });
    assertEquals(retry.response.headers.has('X-Upsell-Prompt'), false);
    await db.exec(migration);
    assertEquals(await checkUpsell(client, { userId: 'one', callCount: 5 }), { upsell: false });
    const results = await Promise.all(Array.from({ length: 10 }, () =>
      checkUpsell(client, { userId: 'race', callCount: 5 })));
    assertEquals(results.filter(r => r.upsell).length, 1);
    const other = await checkUpsell(client, { userId: 'other', callCount: 5 });
    assertEquals(other.upsell && other.prompt,
      'Keep your workflow moving. You have used 5 of your 10 free calls. Review upgrade options.');
    const rows = await db.query('SELECT user_id, converted FROM upsell_triggers ORDER BY user_id');
    assertEquals(rows.rows, [
      { user_id: 'one', converted: false }, { user_id: 'other', converted: false },
      { user_id: 'race', converted: false },
    ]);
  } finally {
    await db.close();
  }
});

Deno.test('invalid input, failed calls and RPC errors do not advertise an upgrade', async () => {
  let calls = 0;
  const client: UpsellClient = { rpc() { calls++; return Promise.resolve({ data: null, error: 'unavailable' }); } };
  for (const context of [{ userId: '', callCount: 5 }, { userId: 'x', callCount: NaN }, { userId: 'x', callCount: -1 }]) {
    await assertRejects(() => checkUpsell(client, context), TypeError);
  }
  const response = new Response('failed', { status: 500 });
  assertEquals((await withUpsell(response, client, { userId: 'x', callCount: 5 })).response, response);
  assertEquals(calls, 0);
  await assertRejects(() => checkUpsell(client, { userId: 'x', callCount: 5 }), Error, 'Unable to record');
  await assertRejects(() => checkUpsell({ rpc: () => Promise.resolve({ data: {}, error: null }) },
    { userId: 'x', callCount: 5 }), Error, 'Invalid upsell');
});
