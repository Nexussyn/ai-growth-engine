import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.test('generateContent returns valid tweet', async () => {
  const mod = await import('../src/agents/content-agent.ts');
  const mockSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({
            data: {
              id: 'test-1',
              title: 'Test Bounty',
              description: 'A test bounty for content generation',
              reward_amount: 5,
              repo_owner: 'Nexussyn',
              repo_name: 'ai-growth-engine',
              pr_number: 1,
            },
            error: null,
          }),
        }),
      }),
    }),
  };

  try {
    const result = await mod.generateContent('test-1');
    assertEquals(typeof result.tweet, 'string');
    assertEquals(result.tweet.length <= 280, true);
    assertEquals(Array.isArray(result.thread), true);
    assertEquals(result.thread.length <= 5, true);
    assertEquals(typeof result.blog_post, 'string');
    assertStringIncludes(result.blog_post, '');
  } catch (e) {
    // If no LLM API key, skip actual generation
    if (e instanceof Error && e.message.includes('No LLM API key')) {
      console.log('Skipping test: No LLM API key configured');
    } else {
      throw e;
    }
  }
});
