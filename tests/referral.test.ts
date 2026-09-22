import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { process_referral } from '../src/growth/referral.ts';

test('real SQL: qualification, balances, idempotency, notifications and rollback', async () => {
  if (!process.env.PGLITE_MODULE) throw new Error('Set PGLITE_MODULE to a local PGlite ESM module');
  const { PGlite } = await import(process.env.PGLITE_MODULE);
  const db = new PGlite();
  try {
    const sql = await readFile(new URL('../migrations/add_referral_system.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    await db.exec(`INSERT INTO referral_codes(code,owner_id) VALUES
      ('ALICE','alice'),('OTHER','other');
      INSERT INTO referral_paid_users(user_id,first_payment_id) VALUES
      ('bob','payment-bob'),('alice','payment-alice'),('carol','payment-carol');`);
    const client = { rpc: async (_name: string, args: Record<string,string>) => {
      const r = await db.query('SELECT process_referral($1,$2) result', [args.p_code,args.p_new_user_id]);
      return { data: r.rows[0].result, error: null };
    } };
    assert.deepEqual(await process_referral(client,'ALICE','unpaid'), {status:'not_qualified'});
    assert.deepEqual(await process_referral(client,'ALICE','alice'), {status:'self_referral'});
    assert.deepEqual(await process_referral(client,'MISSING','bob'), {status:'invalid_code'});
    assert.deepEqual(await process_referral(client,'ALICE','bob'),
      {status:'ok',credits_awarded:5,owner_id:'alice'});
    assert.deepEqual(await process_referral(client,'ALICE','bob'), {status:'already_processed'});
    assert.deepEqual(await process_referral(client,'OTHER','bob'), {status:'already_processed'});
    const balance = await db.query("SELECT balance::int FROM referral_credit_balances WHERE user_id='alice'");
    assert.equal(balance.rows[0].balance,5);
    const events = await db.query('SELECT event_type,payload FROM system_events');
    assert.equal(events.rows.length,1);
    assert.equal(events.rows[0].event_type,'referral_conversion');
    assert.equal(events.rows[0].payload.owner_id,'alice');
    const notices = await db.query('SELECT user_id FROM referral_notifications ORDER BY user_id');
    assert.deepEqual(notices.rows,[{user_id:'alice'},{user_id:'bob'}]);

    // A downstream write failure must roll back the conversion and balance.
    await db.exec(`CREATE FUNCTION reject_notice() RETURNS trigger AS $$ BEGIN
      RAISE EXCEPTION 'simulated notification failure'; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER reject_notice BEFORE INSERT ON referral_notifications
      FOR EACH ROW EXECUTE FUNCTION reject_notice();`);
    await assert.rejects(process_referral(client,'ALICE','carol'), /simulated notification failure/);
    assert.equal((await db.query("SELECT count(*)::int n FROM referral_conversions WHERE new_user_id='carol'")).rows[0].n,0);
    assert.equal((await db.query("SELECT balance::int FROM referral_credit_balances WHERE user_id='alice'")).rows[0].balance,5);
    await db.exec('DROP TRIGGER reject_notice ON referral_notifications');
    // PGlite queues these on one backend; this is NOT a multi-backend race test.
    const attempts = await Promise.all(Array.from({length:8}, () => process_referral(client,'ALICE','carol')));
    assert.equal(attempts.filter(r => r.status === 'ok').length,1);
    assert.equal((await db.query("SELECT balance::int FROM referral_credit_balances WHERE user_id='alice'")).rows[0].balance,10);
    assert.equal((await db.query('SELECT count(*)::int n FROM referral_notifications')).rows[0].n,4);
    assert.deepEqual((await db.query("SELECT uses,credits_awarded FROM referral_codes WHERE code='ALICE'")).rows,
      [{uses:2,credits_awarded:10}]);
  } finally { await db.close(); }
});

test('wrapper rejects missing identity, failed RPCs and malformed success', async () => {
  let calls = 0;
  const client = {rpc:async () => { calls++; return {data:{status:'ok'},error:null}; }};
  await assert.rejects(process_referral(client,'','bob'),TypeError);
  assert.equal(calls,0);
  await assert.rejects(process_referral(client,'A','bob'),/Invalid referral response/);
  await assert.rejects(process_referral({rpc:async () => ({data:null,error:'failure'})},'A','bob'),/processing failed/);
});
