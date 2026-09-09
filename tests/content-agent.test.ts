import {
  assert,
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { generate_content } from "../src/agents/content-agent.ts";

Deno.test("generate_content returns tweet, thread, and blog post from mock bounty data", async () => {
  let storedBountyId = "";
  let storedContent: unknown = null;

  const result = await generate_content("bounty-123", {
    fetchBounty: async () => ({
      id: "bounty-123",
      title: "Content-generation agent",
      description: "Generate launch content when a bounty PR is merged.",
      outcome:
        "Added a tested content agent with mockable LLM and storage dependencies.",
      reward_amount: 5,
      repo_owner: "Nexussyn",
      repo_name: "ai-growth-engine",
      pr_number: 42,
    }),
    generateText: async (prompt) => {
      if (prompt.includes("one original tweet")) {
        return "A $5 USDC AI bounty shipped: a content agent now turns merged PR outcomes into tweet, thread, and blog content so more builders can see what changed.";
      }
      if (prompt.includes("exactly five original tweets")) {
        return [
          "1. A small AI bounty just shipped.",
          "2. The agent reads merged bounty outcomes.",
          "3. It creates a tweet, a thread, and a blog post.",
          "4. The outputs are saved for outreach.",
          "5. More agents can now show their work publicly.",
        ].join("\n---\n");
      }
      return "A content-generation agent now converts completed bounty events into useful public updates. It reads the bounty title, scope, result, reward, repository, and pull request, then produces short social copy and a longer blog-style summary. This matters because open AI work needs visible proof: every completed task becomes easier to understand, easier to share, and easier for another builder to evaluate. The implementation also keeps the generation layer separate from storage, so tests can use mock bounty data while production can store final outputs in outreach_sent. Other agents can participate by claiming open issues, shipping focused pull requests, and including their wallet address for payment after merge.";
    },
    storeContent: async (bountyId, content) => {
      storedBountyId = bountyId;
      storedContent = content;
    },
    now: () => new Date("2026-09-09T12:00:00.000Z"),
  });

  assert(result.tweet.length <= 280);
  assertEquals(result.thread.length, 5);
  assert(result.blog_post.includes("content-generation agent"));
  assertEquals(storedBountyId, "bounty-123");
  assertEquals(storedContent, result);
});

Deno.test("generate_content pads malformed thread output to five tweets", async () => {
  const result = await generate_content("bounty-short-thread", {
    fetchBounty: async () => ({
      title: "Short thread test",
      reward_amount: 5,
    }),
    generateText: async (prompt) => {
      if (prompt.includes("one original tweet")) return "Short bounty update.";
      if (prompt.includes("exactly five original tweets")) {
        return "Only one tweet came back.";
      }
      return "Blog post body.";
    },
    storeContent: async () => {},
  });

  assertEquals(result.thread.length, 5);
  assertEquals(result.thread[0], "Only one tweet came back.");
});

Deno.test("generate_content fails clearly when bounty does not exist", async () => {
  await assertRejects(
    () =>
      generate_content("missing-bounty", {
        fetchBounty: async () => null,
        generateText: async () => "unused",
        storeContent: async () => {},
      }),
    Error,
    "Bounty not found: missing-bounty",
  );
});
