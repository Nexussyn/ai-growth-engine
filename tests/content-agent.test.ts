import assert from 'node:assert/strict';
import { generate_content, generate_content_and_store, ensureUniqueAcrossBounties } from '../src/agents/content-agent';

const outcomeA = {
  id: 'bounty-a',
  title: 'Auto-ops scaling',
  scope: 'Add referral telemetry for conversion events',
  outcome: 'Increased onboarding conversion and reduced manual review time',
  tags: ['growth', 'bounty'],
};

const outcomeB = {
  id: 'bounty-b',
  title: 'Auto-ops scaling',
  scope: 'Add referral telemetry for conversion events',
  outcome: 'Increased onboarding conversion and reduced manual review time',
  tags: ['growth', 'bounty'],
};

const contentA = generate_content(outcomeA);
const contentA2 = generate_content(outcomeA);
const contentB = generate_content(outcomeB);

assert.equal(contentA.tweet.length <= 280, true);
assert.equal(contentA.thread.length, 5);
assert.ok(contentA.blogPost.length > 30);
assert.equal(contentA.thread[0].length > 5, true);
assert.equal(contentA.tweet === contentA2.tweet, true);
assert.equal(Array.isArray(contentA.thread), true);

const unique = ensureUniqueAcrossBounties([
  contentA.tweet.toLowerCase(),
], contentB.tweet);

assert.equal(unique, contentA.tweet.toLowerCase() !== contentB.tweet.toLowerCase() || outcomeA.id !== outcomeB.id);

let stored: any = null;
const store = {
  async upsertOutreachSent(row: any) {
    stored = row;
  },
};

generate_content_and_store(outcomeA, { store }).then((result) => {
  assert.equal(result.bountyId, outcomeA.id);
  assert.ok(stored);
  assert.equal(stored.sha256.length > 0, true);
  console.log('content agent test passed');
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
