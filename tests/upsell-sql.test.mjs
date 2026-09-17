import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('migration reruns and only a newly inserted trigger returns true', async () => {
  const db = new PGlite();
  try {
    const sql = await readFile(new URL('../migrations/add_upsell_triggers.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    const claim = async (user, count) => (await db.query(
      'SELECT check_upsell_trigger($1, $2) AS decision', [user, count],
    )).rows[0].decision.upsell;
    assert.equal(await claim('alice', 4), false);
    assert.equal(await claim('alice', 5), true);
    assert.equal(await claim('alice', 5), false);
    assert.equal(await claim('alice', 6), false);
    assert.equal(await claim('bob', 5), true);
    // Exercise requests queued together against real PostgreSQL semantics.
    assert.deepEqual(await Promise.all([claim('carol', 5), claim('carol', 5)]), [true, false]);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM upsell_triggers')).rows[0].n, 3);
    await db.exec(sql);
    assert.equal(await claim('alice', 5), false);
    await assert.rejects(claim('', 5));
    await assert.rejects(claim('dave', -1));
  } finally {
    await db.close();
  }
});
