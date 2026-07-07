import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  bountyContextLine,
  generate_content,
  generateContent,
  normalizeSocialCard,
  normalizeThread,
  normalizeTweet,
  type BountyContext,
} from '../src/agents/content-agent.ts';

const context: BountyContext = {
  title: 'Add pricing tests',
  reward_amount: 15,
  repo_owner: 'Nexussyn',
  repo_name: 'ai-growth-engine',
  pr_number: 50,
};

Deno.test('bountyContextLine includes reward and repository details', () => {
  assertEquals(
    bountyContextLine(context),
    'Bounty: "Add pricing tests" | Reward: $15 USDC | Repo: Nexussyn/ai-growth-engine | PR: #50',
  );
});

Deno.test('normalizeTweet collapses whitespace and enforces 280 characters', () => {
  const long = `  ${'x'.repeat(300)}  `;

  assertEquals(normalizeTweet('hello\n\nworld'), 'hello world');
  assertEquals(normalizeTweet(long).length, 280);
});

Deno.test('normalizeSocialCard collapses whitespace and enforces compact card copy', () => {
  const long = `  ${'card '.repeat(60)}  `;

  assertEquals(normalizeSocialCard('ship\nproof\nfast'), 'ship proof fast');
  assertEquals(normalizeSocialCard(long).length, 160);
});

Deno.test('normalizeThread parses separators and returns five tweets', () => {
  const thread = normalizeThread('one---two---three', context);

  assertEquals(thread.length, 5);
  assertEquals(thread[0], 'one');
  assertEquals(thread[1], 'two');
  assertEquals(thread[2], 'three');
  assertEquals(thread[3].includes('$15 USDC'), true);
});

Deno.test('normalizeThread handles numbered LLM output', () => {
  const thread = normalizeThread('1. First update\n2. Second update\n3. Third update\n4. Fourth update\n5. Fifth update', context);

  assertEquals(thread.length, 5);
  assertEquals(thread[0], 'First update');
  assertEquals(thread[4], 'Fifth update');
});

Deno.test('generate_content exports the issue acceptance entry point', () => {
  assertEquals(generate_content, generateContent);
});
