import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildContext,
  clipTweet,
  splitThread,
  validateContent,
} from '../src/agents/content-utils.ts';

Deno.test('content agent clips tweets to 280 characters', () => {
  assertEquals(clipTweet('x'.repeat(400)).length, 280);
});

Deno.test('content agent parses a five-post thread', () => {
  const thread = splitThread('one\n---\ntwo\n---\nthree\n---\nfour\n---\nfive');
  assertEquals(thread, ['one', 'two', 'three', 'four', 'five']);
});

Deno.test('content agent validates exactly five unique thread posts', () => {
  const valid = {
    tweet: 'A unique bounty announcement.',
    thread: ['one', 'two', 'three', 'four', 'five'],
    blog_post: 'A longer, unique article about the completed bounty.',
  };
  validateContent(valid);
});

Deno.test('content agent rejects duplicate generated outputs', () => {
  assertThrows(() => validateContent({
    tweet: 'same',
    thread: ['one', 'two', 'three', 'four', 'five'],
    blog_post: 'same',
  }));
});

Deno.test('content context includes bounty-specific fields', () => {
  const context = buildContext({
    title: 'Content agent',
    description: 'Generate outreach from completed bounty events',
    reward_amount: 5,
    repo_owner: 'Nexussyn',
    repo_name: 'ai-growth-engine',
    pr_number: 42,
  });

  assertEquals(
    context,
    'Bounty: "Content agent" | Scope: Generate outreach from completed bounty events | Reward: $5 USDC | Repo: Nexussyn/ai-growth-engine | PR: #42',
  );
});
