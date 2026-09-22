import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkUpsell } from '../src/monetization/upsell.ts';

// Optional local path permits an isolated test runtime outside this checkout.
const { PGlite } = await import(process.env.PGLITE_MODULE ?? '@electric-sql/pglite');
const migration = await readFile(new URL('../migrations/add_upsell_triggers.sql', import.meta.url), 'utf8');

test('real SQL: migration reruns, persisted duplicate, boundaries, rollback and middleware', async () => {
  const db = new PGlite();
  try {
    await db.exec(migration);
    await db.exec(migration);
    async function call(user: string | null, count: number | null) {
      const result = await db.query('SELECT check_upsell_trigger($1, $2) AS result', [user, count]);
      return result.rows[0].result;
    }
    for (const count of [0, 4, 6, 10]) {
      assert.equal((await call('boundary', count)).upsell, false);
    }
    assert.equal((await call('repeat', 5)).upsell, true);
    assert.equal((await call('repeat', 5)).upsell, false);
    // PGlite queues calls on one connection: this verifies overlapping callers,
    // not independent PostgreSQL backend/transaction scheduling.
    const attempts = await Promise.all(Array.from({ length: 8 }, () => call('overlap', 5)));
    assert.equal(attempts.filter(r => r.upsell).length, 1);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM upsell_triggers WHERE user_id='overlap'")).rows[0].n, 1);
    await db.exec('BEGIN');
    assert.equal((await call('rollback', 5)).upsell, true);
    await db.exec('ROLLBACK');
    assert.equal((await call('rollback', 5)).upsell, true);
    await assert.rejects(call(null, 5), /user ID/);
    await assert.rejects(call(' ', 5), /user ID/);
    await assert.rejects(call('invalid', -1), /nonnegative/);
    await assert.rejects(call('invalid', null), /nonnegative/);
    const client = { rpc: async (_name: string, args: { p_user_id: string; p_call_count: number }) => ({
      data: await call(args.p_user_id, args.p_call_count), error: null,
    }) };
    const first = await checkUpsell(client, 'middleware', 5);
    assert.equal(first.headers['X-Upsell-Prompt'], 'true');
    assert.deepEqual(await checkUpsell(client, 'middleware', 5), { headers: {} });
  } finally {
    await db.close();
  }
});
