export interface BountyContentContext {
  id: string;
  title: string;
  reward_amount: number;
  repo_owner: string;
  repo_name: string;
  pr_number: number;
}

export interface ContentOutput {
  tweet: string;
  thread: string[];
  blog_post: string;
}

export type TextGenerator = (prompt: string) => Promise<string>;

function contextFor(bounty: BountyContentContext): string {
  return `Bounty ID: ${bounty.id} | Bounty: "${bounty.title}" | Reward: $${bounty.reward_amount} USDC | Repo: ${bounty.repo_owner}/${bounty.repo_name} | PR: #${bounty.pr_number}`;
}

export async function generateBountyContent(
  bounty: BountyContentContext,
  generate: TextGenerator,
): Promise<ContentOutput> {
  const context = contextFor(bounty);
  const tweet = await generate(
    `Write a single tweet (max 280 chars) announcing this completed open-source bounty. Be enthusiastic, include the reward amount and a call to action. No hashtag spam. Context: ${context}`,
  );
  const threadRaw = await generate(
    `Write exactly 5 tweets announcing this completed bounty and explaining why open AI bounties matter. Separate tweets with "---". Context: ${context}`,
  );
  const blogPost = await generate(
    `Write a 300-word blog post about this completed open-source AI bounty. Include: what was built, why it matters, and how others can participate. Professional but accessible tone. Context: ${context}`,
  );

  const thread = threadRaw
    .split('---')
    .map((item) => item.trim().slice(0, 280))
    .filter(Boolean)
    .slice(0, 5);

  if (thread.length !== 5) {
    throw new Error(`Expected 5 thread posts, received ${thread.length}`);
  }

  return {
    tweet: tweet.trim().slice(0, 280),
    thread,
    blog_post: blogPost.trim(),
  };
}
