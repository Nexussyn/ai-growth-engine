// Issue #5: Content-generation agent tests
import { assertEquals } from "jsr:@std/assert";
import { generateContent } from "../src/agents/content-agent.ts";

Deno.test("generateContent produces valid ContentOutput", async () => {
  // Mock bounty execution
  const result = await generateContent("test-bounty-001");
  assertEquals(typeof result.tweet, "string");
  assertEquals(result.tweet.length <= 280, true);
  assertEquals(Array.isArray(result.thread), true);
  assertEquals(result.thread.length <= 5, true);
  assertEquals(typeof result.blog_post, "string");
  assertEquals(result.blog_post.length > 100, true);
});
