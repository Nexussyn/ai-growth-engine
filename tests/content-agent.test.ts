import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';

function normalize(tweet: string, threadRaw: string, blog: string) {
  const thread = threadRaw.split('---').map(t => t.trim()).filter(Boolean);
  if (thread.length !== 5) throw new Error('LLM must return exactly 5 thread posts');
  if (!blog.trim()) throw new Error('LLM returned an empty blog post');
  return { tweet: tweet.trim().slice(0, 280), thread, blog_post: blog.trim() };
}

Deno.test('content output enforces tweet limit and five posts', () => {
  const out = normalize('x'.repeat(300), 'one---two---three---four---five', ' blog ');
  assertEquals(out.tweet.length, 280);
  assertEquals(out.thread.length, 5);
  assertEquals(out.blog_post, 'blog');
});

Deno.test('content output rejects incomplete thread', async () => {
  await assertRejects(() => Promise.resolve().then(() => normalize('tweet', 'one---two', 'blog')), Error, 'exactly 5');
});

Deno.test('content output rejects empty blog', async () => {
  await assertRejects(() => Promise.resolve().then(() => normalize('tweet', '1---2---3---4---5', ' ')), Error, 'empty blog');
});
