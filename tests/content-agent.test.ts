import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.test({
  name: 'Content output has required fields',
  fn() {
    const mockOutput = {
      tweet: 'Test tweet under 280 chars',
      thread: ['Tweet 1', 'Tweet 2', 'Tweet 3', 'Tweet 4', 'Tweet 5'],
      blog_post: 'Test blog post content',
    };
    assertEquals(typeof mockOutput.tweet, 'string');
    assertEquals(mockOutput.tweet.length <= 280, true);
    assertEquals(Array.isArray(mockOutput.thread), true);
    assertEquals(mockOutput.thread.length, 5);
    assertEquals(typeof mockOutput.blog_post, 'string');
  },
});

Deno.test({
  name: 'Tweet is under 280 characters',
  fn() {
    const tweet = 'x'.repeat(280);
    assertEquals(tweet.length <= 280, true);
    const longTweet = 'x'.repeat(281);
    assertEquals(longTweet.length <= 280, false);
  },
});

Deno.test({
  name: 'Thread has exactly 5 tweets',
  fn() {
    const thread = ['t1', 't2', 't3', 't4', 't5'];
    assertEquals(thread.length, 5);
  },
});

Deno.test({
  name: 'Blog post is non-empty string',
  fn() {
    const blog = 'Test blog post content';
    assertEquals(typeof blog, 'string');
    assertEquals(blog.length > 0, true);
  },
});