import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContentGenerator } from '../src/agents/content-core.ts';

const bounty = { title:'Fix pagination', description:'Return all pages; verified with a three-page fixture',
  execution_status:'done', reward_amount:5, repo_owner:'owner',repo_name:'repo',pr_number:10 };
const outputs = ['Pagination fixed', 'One\n---\nTwo\n---\nThree\n---\nFour\n---\nFive', Array(300).fill('word').join(' ')];

function fixture(overrides = {}) {
  const saved: unknown[] = [], prompts: string[] = [];
  let index = 0;
  const deps = {load:async () => ({...bounty}),generate:async (prompt: string) => {
    prompts.push(prompt); return outputs[index++];
  },save:async (id: string, content: unknown) => { saved.push({id,content: structuredClone(content)}); },...overrides};
  return { run:createContentGenerator(deps),saved,prompts };
}

test('stores exactly the validated result using title, scope and outcome context', async () => {
  const f = fixture();
  const result = await f.run('bounty-1');
  assert.deepEqual(f.saved,[{id:'bounty-1',content:result}]);
  assert.equal(result.thread.length,5);
  for (const p of f.prompts) { assert.ok(p.includes(bounty.description)); assert.ok(p.includes(bounty.title)); }
  const other = fixture({load:async () => ({...bounty,title:'Fix timeout',description:'Retry after transient error'})});
  await other.run('bounty-2');
  assert.notEqual(other.prompts[0],f.prompts[0]);
});

test('missing, incomplete, or failed bounty lookup never generates or saves', async () => {
  for (const load of [async () => null,async () => ({...bounty,execution_status:'running'}),
    async () => {throw new Error('lookup failed');}]) {
    const f=fixture({load}); await assert.rejects(f.run('bounty-1'));
    assert.equal(f.prompts.length,0); assert.equal(f.saved.length,0);
  }
  await assert.rejects(fixture().run(''),TypeError);
});

test('invalid model output is rejected before persistence without truncation', async () => {
  for (const bad of [ ['x'.repeat(281),outputs[1],outputs[2]],
    [outputs[0],'Only one tweet',outputs[2]], [outputs[0],outputs[1]+'\n---\nSix',outputs[2]],
    [outputs[0],outputs[1],'short blog'], ['',outputs[1],outputs[2]],
    [outputs[0],'x'.repeat(281)+'\n---\nTwo\n---\nThree\n---\nFour\n---\nFive',outputs[2]] ]) {
    let n=0; const f=fixture({generate:async () => bad[n++]});
    await assert.rejects(f.run('bounty-1')); assert.equal(f.saved.length,0);
  }
});

test('model and persistence errors propagate instead of reporting success', async () => {
  const failed=fixture({generate:async () => {throw new Error('provider unavailable');}});
  await assert.rejects(failed.run('bounty-1'),/provider unavailable/); assert.equal(failed.saved.length,0);
  await assert.rejects(fixture({save:async () => {throw new Error('insert failed');}}).run('bounty-1'),/insert failed/);
});
