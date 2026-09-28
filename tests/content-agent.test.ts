import assert from 'node:assert/strict';
import test from 'node:test';

import { generateBountyContent } from '../src/agents/content-generator.ts';

const bounty = {
  id: 'bounty-5',
  title: 'Content generation agent',
  reward_amount: 5,
  repo_owner: 'Nexussyn',
  repo_name: 'ai-growth-engine',
  pr_number: 42,
};

test('generates the promised tweet, five-post thread, and blog output', async () => {
  const prompts: string[] = [];
  const responses = [
    `${'T'.repeat(300)} call to action`,
    ['one', 'two', 'three', 'four', 'five', 'ignored'].join('---'),
    'A useful 300-word-style blog post.',
  ];

  const content = await generateBountyContent(bounty, async (prompt) => {
    prompts.push(prompt);
    return responses[prompts.length - 1];
  });

  assert.equal(content.tweet.length, 280);
  assert.deepEqual(content.thread, ['one', 'two', 'three', 'four', 'five']);
  assert.equal(content.blog_post, 'A useful 300-word-style blog post.');
  assert.equal(prompts.length, 3);
  assert.ok(prompts.every((prompt) => prompt.includes('bounty-5')));
  assert.ok(prompts.every((prompt) => prompt.includes('$5 USDC')));
  assert.ok(prompts.every((prompt) => prompt.includes('Nexussyn/ai-growth-engine')));
});

test('rejects incomplete thread output instead of storing a broken result', async () => {
  const responses = ['tweet', 'one---two', 'blog'];
  let call = 0;

  await assert.rejects(
    generateBountyContent(bounty, async () => responses[call++]),
    /Expected 5 thread posts, received 2/,
  );
});
