import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { generate_content, handleContentRequest, createOllamaGenerator, createSupabaseStore, type ContentOutput } from '../src/agents/content-agent.ts';

const bounty = { title: 'Fix duplicate rewards', scope: 'Serialize referral awards', outcome: 'Concurrent calls award five credits once', execution_status: 'done' };
const content: ContentOutput = {
  tweet: 'Duplicate rewards fixed: concurrent referrals now award credits once.',
  thread: ['The duplicate reward bug is fixed.', 'Concurrent referrals caused repeated awards.', 'The change serializes reward writes.', 'Tests cover competing callers.', 'Review the completed bounty and its tests.'],
  blog_post: Array(30).fill('Concurrent referral calls now award five credits once per user.').join(' '),
};

Deno.test('completed bounty context drives generation and identical validated content is saved', async () => {
  const saved: unknown[] = [];
  const parts: unknown[] = [];
  const result = await generate_content('bounty-1', {
    store: { load: async () => bounty, save: async (id, value) => { saved.push([id, value]); } },
    generate: async (prompt, part) => {
      parts.push(part);
      for (const value of [bounty.title, bounty.scope, bounty.outcome]) {
        assertEquals(prompt.includes(value), true);
      }
      return JSON.stringify(content);
    },
  });
  assertEquals(result, content);
  assertEquals(saved, [['bounty-1', result]]);
  assertEquals(parts, ['blog', 'social']);
});

Deno.test('missing or unfinished bounties do not generate or store content', async () => {
  for (const value of [null, { ...bounty, execution_status: 'running' }, { ...bounty, outcome: '' }]) {
    await assertRejects(() => generate_content('bounty-1', {
      store: { load: async () => value, save: async () => { throw new Error('unexpected save'); } },
      generate: async () => { throw new Error('unexpected generation'); },
    }));
  }
});

Deno.test('invalid model output is rejected before storage', async () => {
  for (const output of ['not json', JSON.stringify({ ...content, tweet: 'x'.repeat(281) }),
    JSON.stringify({ ...content, thread: content.thread.slice(0, 4) }),
    JSON.stringify({ ...content, thread: [...content.thread.slice(0, 4), 'x'.repeat(281)] }),
    JSON.stringify({ ...content, blog_post: 'Too short' })]) {
    let saved = false;
    await assertRejects(() => generate_content('bounty-1', {
      store: { load: async () => bounty, save: async () => { saved = true; } },
      generate: async () => output,
    }));
    assertEquals(saved, false);
  }
});

Deno.test('one invalid output is repaired with word count feedback and persisted once', async () => {
  let calls = 0;
  const saved: ContentOutput[] = [];
  const result = await generate_content('bounty-1', {
    store: { load: async () => bounty, save: async (_id, value) => { saved.push(value); } },
    generate: async (prompt) => {
      calls++;
      if (calls === 1) {
        return JSON.stringify({ ...content, blog_post: 'Too short' });
      }
      if (calls === 2) {
        assertEquals(prompt.includes('2 words'), true);
        assertEquals(prompt.includes('325 words'), true);
        assertEquals(prompt.includes('Too short'), false);
      }
      assertEquals(prompt.includes(bounty.outcome), true);
      return JSON.stringify(content);
    },
  });
  assertEquals(calls, 3);
  assertEquals(saved, [result]);
});

Deno.test('two invalid outputs stop after exactly two calls and never persist', async () => {
  let calls = 0;
  let saves = 0;
  await assertRejects(() => generate_content('bounty-1', {
    store: { load: async () => bounty, save: async () => { saves++; } },
    generate: async () => { calls++; return 'invalid json'; },
  }));
  assertEquals(calls, 2);
  assertEquals(saves, 0);
});

Deno.test('failed social repair does not regenerate the valid blog or save partial content', async () => {
  const parts: unknown[] = [];
  let saves = 0;
  await assertRejects(() => generate_content('bounty-1', {
    store: { load: async () => bounty, save: async () => { saves++; } },
    generate: async (_prompt, part) => {
      parts.push(part);
      return part === 'blog' ? JSON.stringify({ blog_post: content.blog_post }) : '{}';
    },
  }));
  assertEquals(parts, ['blog', 'social', 'social']);
  assertEquals(saves, 0);
});

Deno.test('storage and provider errors propagate instead of reporting success', async () => {
  let providerCalls = 0;
  let saveCalls = 0;
  const failure = async () => { throw new Error('unavailable'); };
  await assertRejects(() => generate_content('bounty-1', {
    store: { load: async () => bounty, save: async () => { saveCalls++; await failure(); } },
    generate: async () => { providerCalls++; return JSON.stringify(content); },
  }), Error, 'unavailable');
  assertEquals([providerCalls, saveCalls], [2, 1]);
  providerCalls = 0;
  saveCalls = 0;
  await assertRejects(() => generate_content('bounty-1', {
    store: { load: async () => bounty, save: async () => { saveCalls++; } },
    generate: async () => { providerCalls++; await failure(); return ''; },
  }), Error, 'unavailable');
  assertEquals([providerCalls, saveCalls], [1, 0]);
});

Deno.test('different bounty outcomes receive different model context rather than a fixed template', async () => {
  const tweets: string[] = [];
  for (const outcome of ['Prevented duplicate awards', 'Reduced checkout latency']) {
    const result = await generate_content(outcome, {
      store: { load: async () => ({ ...bounty, outcome }), save: async () => {} },
      generate: async (prompt) => {
        assertEquals(prompt.includes(outcome), true);
        return JSON.stringify({ ...content, tweet: outcome });
      },
    });
    tweets.push(result.tweet);
  }
  assertEquals(tweets, ['Prevented duplicate awards', 'Reduced checkout latency']);
});

Deno.test('HTTP entry point rejects invalid requests and returns persisted output', async () => {
  const dependencies = {
    store: { load: async () => bounty, save: async () => {} },
    generate: async () => JSON.stringify(content),
  };
  assertEquals((await handleContentRequest(new Request('http://localhost'))).status, 405);
  for (const body of ['not json', '{}', '{"bounty_id":42}']) {
    assertEquals((await handleContentRequest(new Request('http://localhost', { method: 'POST', body }))).status, 400);
  }
  const result = await handleContentRequest(new Request('http://localhost', {
    method: 'POST', body: JSON.stringify({ bounty_id: 'bounty-1' }),
  }), dependencies);
  assertEquals(await result.json(), { ok: true, content });
});

Deno.test('Ollama requests local nonstreaming JSON and checks HTTP errors', async () => {
  const generate = createOllamaGenerator('llama3.2', 'http://localhost:11434', async (url, init) => {
    assertEquals(String(url), 'http://localhost:11434/api/generate');
    const body = JSON.parse(String(init?.body));
    assertEquals([body.model, body.stream, body.think], ['llama3.2', false, false]);
    assertEquals(body.format.required, ['tweet', 'thread', 'blog_post']);
    assertEquals(body.format.properties.thread.maxItems, 5);
    assertEquals(body.format.properties.tweet.maxLength, undefined);
    assertEquals(body.options, { num_predict: 2200 });
    assertEquals(init?.signal instanceof AbortSignal, true);
    return Response.json({ response: JSON.stringify(content) });
  });
  assertEquals(await generate('prompt'), JSON.stringify(content));
  await assertRejects(() => createOllamaGenerator('llama3.2', 'http://localhost:11434', async () =>
    new Response('unavailable', { status: 503 }))('prompt'), Error, '503');
});

Deno.test('Ollama uses separate blog and social schemas without forcing sentence truncation', async () => {
  const required: string[][] = [];
  const generate = createOllamaGenerator('test-model', 'http://localhost:11434', async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    required.push(body.format.required);
    assertEquals(body.format.properties.tweet?.maxLength, undefined);
    return Response.json({ response: '{}' });
  });
  await generate('blog', 'blog');
  await generate('social', 'social');
  assertEquals(required, [['blog_post'], ['tweet', 'thread']]);
});

Deno.test('Supabase adapter loads completed context and checks persistence status', async () => {
  const store = createSupabaseStore('https://db.example', 'test-key', async (input, init) => {
    const url = new URL(String(input));
    if (init?.method === 'POST') {
      const row = JSON.parse(String(init.body));
      assertEquals(row.channel, 'content_agent');
      assertEquals(JSON.parse(row.content), content);
      return new Response(null, { status: 201 });
    }
    assertEquals(url.searchParams.get('id'), 'eq.bounty-1');
    assertEquals(url.pathname, '/rest/v1/bounty_tasks');
    assertEquals(url.searchParams.get('select'), 'title,scope,execution_status,pr_url');
    return Response.json([{ ...bounty, pr_url: 'https://github.com/example/repo/pull/3' }]);
  });
  assertEquals(await store.load('bounty-1'), {
    ...bounty, outcome: 'Completed bounty; pull request: https://github.com/example/repo/pull/3',
  });
  await store.save('bounty-1', content);
  const broken = createSupabaseStore('https://db.example', 'test-key', async () => new Response(null, { status: 500 }));
  await assertRejects(() => broken.load('bounty-1'), Error, '500');
  await assertRejects(() => broken.save('bounty-1', content), Error, '500');
  const missingPr = createSupabaseStore('https://db.example', 'test-key', async () => Response.json([bounty]));
  await assertRejects(() => missingPr.load('bounty-1'), Error, 'pull request URL');
});

Deno.test('Ollama timeout is configurable and bounded', async () => {
  for (const timeout of [0, -1, 600001, NaN, 1.5]) {
    await assertRejects(async () => createOllamaGenerator('model', undefined, undefined, timeout), Error, 'timeout');
  }
  const generate = createOllamaGenerator('model', undefined, async (_url, init) => {
    assertEquals(init?.signal?.aborted, false);
    return Response.json({ response: '{}' });
  }, 600000);
  assertEquals(await generate('prompt'), '{}');
});

Deno.test('overlong blog repair requests a shorter target while preserving strict validation', async () => {
  let calls = 0;
  let saves = 0;
  await generate_content('overlong', {
    store: { load: async () => bounty, save: async () => { saves++; } },
    generate: async (prompt) => {
      calls++;
      if (calls === 1) {
        return JSON.stringify({ blog_post: Array(350).fill('word').join(' ') });
      }
      if (calls === 2) {
        assertEquals(prompt.includes('350 words'), true);
        assertEquals(prompt.includes('275 words'), true);
      }
      return JSON.stringify(content);
    },
  });
  assertEquals([calls, saves], [3, 1]);
});
