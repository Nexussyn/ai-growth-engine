export interface BountyOutcome {
  id: string;
  title: string;
  scope: string;
  outcome: string;
  tags?: string[];
}

export interface GeneratedContent {
  tweet: string;
  thread: string[];
  blogPost: string;
}

export interface ContentRecord extends GeneratedContent {
  bountyId: string;
  sha256: string;
  createdAt: string;
}

export interface ContentStore {
  upsertOutreachSent(record: { bountyId: string; tweet: string; thread: string[]; blogPost: string; sha256: string }): Promise<void>;
}

export interface ContentOptions {
  store?: ContentStore;
  rng?: () => number;
}

export function stableHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
    hash >>>= 0;
  }
  return hash.toString(16);
}

function pick(seed: number): number {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

export function generate_content(outcome: BountyOutcome): GeneratedContent {
  const seed = stableHash(`${outcome.id}${outcome.title}${outcome.scope}${outcome.outcome}`);
  const hashtag = (outcome.tags && outcome.tags[0]) ? ` #${outcome.tags[0].replace(/\W+/g, '')}` : '';

  const tweetBase = `${outcome.title}: ${outcome.scope} shipped in ${outcome.outcome}.`;
  const tweet = `${tweetBase}${hashtag}`.slice(0, 280);

  const threadTone = seed && parseInt(seed, 16) % 3;
  const templates = [
    `1/ ${outcome.title} is now live.`,
    `Why it matters: ${outcome.scope}.`,
    `Outcome: ${outcome.outcome}.
\nThis is a concrete growth signal for the platform.`,
    `1-3 action items:\n- Deploy quickly\n- Measure impact\n- Iterate`,
  ];

  const thread = [
    `${templates[threadTone].replace(/\n/g, ' ')}`,
    `${templates[(threadTone + 1) % templates.length].replace(/\n/g, ' ')}`,
    `${templates[(threadTone + 2) % templates.length].replace(/\n/g, ' ')}`,
    `What changed and why it helps users: ${outcome.scope}.`,
    `Result: ${outcome.outcome}.`,
  ];

  const blogSeed = outcome.outcome.length + Math.floor(Number(stableHash(seed)).toString().length + 0);
  const altTone = pick(Number(seed));
  const intro = altTone < 0.33 ? 'What we changed' : altTone < 0.66 ? 'Why it worked' : 'How we measured it';
  const blogPost = [
    `# ${outcome.title}`,
    `${intro}: ${outcome.scope}`,
    '',
    `Execution detail:\n${outcome.outcome}`,
    `Tags: ${(outcome.tags ?? ['growth', 'bounty']).join(', ')}`,
    `
Potential next step: expand this pattern to the remaining bounty types and automate quality checks.`,
  ].join('\n\n');

  return {
    tweet: tweet.trim(),
    thread: thread.map((row) => row.trim()).filter(Boolean),
    blogPost: blogPost.trim(),
  };
}

export async function persistContent(store: ContentStore | undefined, record: Omit<ContentRecord, 'createdAt'>): Promise<ContentRecord> {
  const payload: ContentRecord = {
    ...record,
    createdAt: new Date().toISOString(),
  };

  if (store) {
    await store.upsertOutreachSent({
      bountyId: record.bountyId,
      tweet: record.tweet,
      thread: record.thread,
      blogPost: record.blogPost,
      sha256: record.sha256,
    });
  }

  return payload;
}

export async function generate_content_and_store(
  bounty: BountyOutcome,
  options: ContentOptions = {},
): Promise<ContentRecord> {
  const content = generate_content(bounty);
  const sha256 = stableHash(`${content.tweet}${content.thread.join('|')}${content.blogPost}`);

  return persistContent(options.store, {
    bountyId: bounty.id,
    tweet: content.tweet,
    thread: content.thread,
    blogPost: content.blogPost,
    sha256,
  });
}

export function ensureUniqueAcrossBounties(existing: string[], candidate: string): boolean {
  const normalized = candidate.toLowerCase().trim();
  return !existing.includes(normalized);
}
