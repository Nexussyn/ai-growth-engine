import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { generate_content, db } from '../src/agents/content-agent.ts';

// Mock the db client for testing
const originalFrom = db.from;

Deno.test('generate_content generates content and saves it to outreach_sent', async () => {
  Deno.env.set('MOCK_LLM_FOR_TESTING', 'true');

  let insertedData: any = null;
  db.from = (table: string) => {
    if (table === 'bounty_executions') {
      return {
        select: () => ({
          eq: (field: string, val: string) => ({
            maybeSingle: async () => {
              if (val === 'test-123') {
                return {
                  data: {
                    title: 'Test Bounty',
                    description: 'A test bounty',
                    reward_amount: 100,
                    repo_owner: 'Nexussyn',
                    repo_name: 'ai-growth-engine',
                    pr_number: 42
                  },
                  error: null
                };
              }
              return { data: null, error: null };
            }
          })
        })
      } as any;
    }
    if (table === 'outreach_sent') {
      return {
        insert: async (data: any) => {
          insertedData = data;
          return { data, error: null };
        }
      } as any;
    }
    return originalFrom.call(db, table);
  };

  try {
    const content = await generate_content('test-123');

    // Assert content generation
    assertEquals(typeof content.tweet, 'string');
    assertEquals(Array.isArray(content.thread), true);
    assertEquals(typeof content.blog_post, 'string');

    // Assert outreach_sent insertion
    assertEquals(insertedData.bounty_id, 'test-123');
    assertEquals(insertedData.channel, 'content_agent');
    
    const parsedContent = JSON.parse(insertedData.content);
    assertEquals(parsedContent.tweet, content.tweet);
    assertEquals(parsedContent.thread, content.thread);
    assertEquals(parsedContent.blog_post, content.blog_post);
  } finally {
    db.from = originalFrom;
    Deno.env.delete('MOCK_LLM_FOR_TESTING');
  }
});

Deno.test('generate_content throws error for invalid bounty_id', async () => {
  Deno.env.set('MOCK_LLM_FOR_TESTING', 'true');

  db.from = (table: string) => {
    if (table === 'bounty_executions') {
      return {
        select: () => ({
          eq: (field: string, val: string) => ({
            maybeSingle: async () => {
              return { data: null, error: null };
            }
          })
        })
      } as any;
    }
    return originalFrom.call(db, table);
  };

  try {
    await assertRejects(
      () => generate_content('invalid-id'),
      Error,
      'Bounty not found: invalid-id'
    );
  } finally {
    db.from = originalFrom;
    Deno.env.delete('MOCK_LLM_FOR_TESTING');
  }
});
