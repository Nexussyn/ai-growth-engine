import { strictEqual, deepStrictEqual, rejects } from 'node:assert/strict';
import { type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import * as agent from '../src/agents/content-agent.ts';

Deno.test('module exposes an import-safe injectable generator', () => {
  strictEqual(typeof agent.createContentAgent, 'function');
  strictEqual(agent.generate_content, agent.generateContent);
});

function fixture(writeError: unknown = null) {
  const rows: Record<string, unknown>[] = [];
  const prompts: string[] = [];
  const bountyQueries: { column: string; value: string }[] = [];
  const bounty = { title: 'Accessible navigation', description: 'Keyboard focus support', reward_amount: 5, repo_owner: 'example', repo_name: 'app', pr_number: 12 };
  const db = { from(table: string) {
    strictEqual(['bounty_executions', 'outreach_sent'].includes(table), true);
    return {
      select(_cols: string) {
        return { eq(column: string, value: string) {
          bountyQueries.push({ column, value: String(value) });
          return { maybeSingle() { return Promise.resolve({ data: bounty, error: null }); } };
        } };
      },
      insert(row: Record<string, unknown>) { rows.push(row); return Promise.resolve({ error: writeError }); },
    };
  } } as unknown as SupabaseClient;
  const outputs = ['🚀'.repeat(290), Array.from({ length: 5 }, (_, i) => `Part ${i} ${'x'.repeat(300)}`).join('---'), 'word '.repeat(300).trim()];
  const generate = agent.createContentAgent(db, (prompt) => { prompts.push(prompt); return Promise.resolve(outputs[prompts.length - 1]); });
  return { generate, rows, prompts, bountyQueries };
}

Deno.test('persists exactly the bounded content returned to caller', async () => {
  const f = fixture();
  const output = await f.generate('bounty-1');
  strictEqual(Array.from(output.tweet).length, 280);
  strictEqual(output.thread.length, 5);
  strictEqual(output.thread.every(t => Array.from(t).length <= 280), true);
  deepStrictEqual(JSON.parse(f.rows[0].content as string), output);
  strictEqual(f.prompts.every(p => p.includes('Accessible navigation')), true);
  // Query and write hygiene: bounty read filtered by id, exactly one insert tagged correctly.
  strictEqual(f.bountyQueries.length, 1);
  strictEqual(f.bountyQueries[0].column, 'id');
  strictEqual(f.bountyQueries[0].value, 'bounty-1');
  strictEqual(f.rows.length, 1);
  strictEqual(f.rows[0].bounty_id, 'bounty-1');
  strictEqual(f.rows[0].channel, 'content_agent');
});

Deno.test('does not report success when persistence fails', async () => {
  await rejects(fixture({ message: 'database unavailable' }).generate('bounty-1'), /persist/i);
});

Deno.test('missing configuration rejects instead of throwing synchronously', async () => {
  // In this test process SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not readable
  // (no --allow-env), so runtimeAgent() must surface the failure as a rejected
  // promise, not as a synchronous throw from generateContent().
  await rejects(agent.generateContent('bounty-1'));
});
