import { assertEquals, assertRejects, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { generateContent, generate_content, createHandler, type Bounty, type ContentDependencies, type ContentOutput } from '../src/agents/content-agent.ts';

const bounty: Bounty = {
  title: 'Repair duplicate upsell prompts', description: 'Use INSERT RETURNING to suppress duplicate notifications',
  reward_amount: 10, repo_owner: 'example', repo_name: 'growth', pr_number: 7, execution_status: 'done',
};
const blog = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ');
const thread = ['first', 'second', 'third', 'fourth', 'fifth'];
function fixture(record: Bounty | null = bounty, outputs = ['Finished a bounty', thread.join('---'), blog]) {
  const prompts: string[] = [];
  const saved: Array<{ id: string; content: ContentOutput }> = [];
  let index = 0;
  const deps: ContentDependencies = {
    loadBounty: async () => record,
    generate: async prompt => { prompts.push(prompt); return outputs[index++]; },
    saveContent: async (id, content) => { saved.push({ id, content }); },
  };
  return { deps, prompts, saved };
}

Deno.test('import requires no secrets/listener; both API names return the persisted output', async () => {
  assertEquals(generate_content, generateContent);
  const f = fixture();
  const result = await generate_content('bounty-1', f.deps);
  assertEquals(result, { tweet: 'Finished a bounty', thread, blog_post: blog });
  assertEquals(f.saved, [{ id: 'bounty-1', content: result }]);
  assertEquals(f.prompts.length, 3);
  for (const prompt of f.prompts) {
    assertStringIncludes(prompt, bounty.title);
    assertStringIncludes(prompt, bounty.description);
    assertStringIncludes(prompt, 'not instructions');
  }
});

Deno.test('different bounties supply different context instead of fixed template content', async () => {
  const a = fixture();
  const b = fixture({ ...bounty, title: 'Correct wallet links', description: 'Resolve wallet routes', pr_number: 9 }, ['Wallet routes repaired', thread.join('---'), blog]);
  const first = await generateContent('a', a.deps);
  const second = await generateContent('b', b.deps);
  assertEquals(first.tweet === second.tweet, false);
  assertEquals(a.prompts[0] === b.prompts[0], false);
  assertStringIncludes(b.prompts[0], 'Correct wallet links');
});

Deno.test('missing or unfinished bounties do not invoke LLM or persist', async () => {
  for (const record of [null, { ...bounty, execution_status: 'pending' }]) {
    const f = fixture(record);
    await assertRejects(() => generateContent('a', f.deps));
    assertEquals(f.prompts.length, 0);
    assertEquals(f.saved.length, 0);
  }
  await assertRejects(() => generateContent(' ', fixture().deps), TypeError);
});

Deno.test('invalid tweet, thread and blog output never reaches persistence', async () => {
  for (const output of [
    ['', thread.join('---'), blog],
    ['x'.repeat(281), thread.join('---'), blog],
    ['ok', 'one---two', blog],
    ['ok', [...thread, 'extra'].join('---'), blog],
    ['ok', ['x'.repeat(281), ...thread.slice(1)].join('---'), blog],
    ['ok', thread.join('---'), 'too short'],
  ]) {
    const f = fixture(bounty, output);
    await assertRejects(() => generateContent('a', f.deps));
    assertEquals(f.saved.length, 0);
  }
});

Deno.test('Unicode code points are not sliced into broken surrogate pairs', async () => {
  const text = '🦉'.repeat(280);
  const f = fixture(bounty, [text, thread.join('---'), blog]);
  assertEquals((await generateContent('a', f.deps)).tweet, text);
});

Deno.test('read, generation and persistence failures propagate instead of returning success', async () => {
  for (const phase of ['loadBounty', 'generate', 'saveContent'] as const) {
    const f = fixture();
    f.deps[phase] = (): Promise<never> => Promise.reject(new Error(`${phase} failed`));
    await assertRejects(() => generateContent('a', f.deps), Error, `${phase} failed`);
    assertEquals(f.saved.length, 0);
  }
});

Deno.test('handler rejects malformed inputs without invoking generation', async () => {
  let calls = 0;
  const handler = createHandler(async () => { calls++; throw new Error('unexpected'); });
  assertEquals((await handler(new Request('http://localhost'))).status, 405);
  for (const body of ['{', 'null', '{}', '{"bounty_id":1}', '{"bounty_id":" "}']) {
    assertEquals((await handler(new Request('http://localhost', { method: 'POST', body }))).status, 400);
  }
  assertEquals(calls, 0);
});

Deno.test('handler returns stored content and redacts operational errors', async () => {
  const f = fixture();
  const request = () => new Request('http://localhost', { method: 'POST', body: '{"bounty_id":"a"}' });
  const response = await createHandler(id => generateContent(id, f.deps))(request());
  assertEquals(response.status, 200);
  assertEquals((await response.json()).content, f.saved[0].content);
  const failed = await createHandler(() => Promise.reject(new Error('private database detail')))(request());
  assertEquals(failed.status, 500);
  assertEquals(await failed.json(), { error: 'Content generation failed' });
});
