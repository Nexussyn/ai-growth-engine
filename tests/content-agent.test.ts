/**
 * Unit tests for the Content Generation Agent.
 *
 * The tests mock:
 *   - Supabase client (fetching a bounty & inserting into outreach_sent)
 *   - fetch (the Groq LLM endpoint)
 *
 * The goal is to verify that:
 *   1. The function returns an object with tweet, thread, blog_post.
 *   2. The LLM is called three times with the correct prompts.
 *   3. The generated content is inserted into the outreach_sent table.
 */

import { generate_content, GeneratedContent } from '../src/agents/content-agent';

// ---------------------------------------------------------------------------
// Mock environment variables
process.env.GROQ_API_KEY = 'test-groq-key';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE = 'service-role-key';

// ---------------------------------------------------------------------------
// Mock Supabase client
jest.mock('@supabase/supabase-js', () => {
  const mockFrom = jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
  }));
  const mockCreateClient = jest.fn(() => ({
    from: mockFrom,
  }));
  return {
    createClient: mockCreateClient,
    SupabaseClient: jest.fn(),
  };
});

import { createClient } from '@supabase/supabase-js';

const mockBounty = {
  id: 42,
  title: 'AI‑Driven Content Generator',
  scope: 'Generate social media copy automatically',
  outcome: 'Successfully created a TS agent',
  execution_status: 'done',
};

let mockSelectSingleResolve: (value: any) => void;
let mockInsertResolve: (value: any) => void;

beforeAll(() => {
  // Configure the mocked Supabase chain
  const mockFrom = (createClient as jest.Mock).mock.results[0].value.from;
  mockFrom.mockImplementation(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(() => {
      return new Promise((resolve) => {
        mockSelectSingleResolve = resolve;
      });
    }),
    insert: jest.fn(() => {
      return new Promise((resolve) => {
        mockInsertResolve = resolve;
      });
    }),
  }));
});

// ---------------------------------------------------------------------------
// Mock fetch (Groq API)
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        choices: [{ message: { content: 'Mocked LLM response' } }],
      }),
  })
) as jest.Mock;

// ---------------------------------------------------------------------------

describe('generate_content', () => {
  it('generates and stores content for a completed bounty', async () => {
    // Resolve the bounty fetch promise
    const bountyPromise = Promise.resolve({ data: mockBounty, error: null });
    mockSelectSingleResolve(bountyPromise);

    // Resolve the insert promise (no error)
    mockInsertResolve({ error: null });

    const result: GeneratedContent = await generate_content(mockBounty.id);

    // Verify shape
    expect(result).toHaveProperty('tweet');
    expect(result).toHaveProperty('thread');
    expect(result).toHaveProperty('blog_post');

    // All three LLM calls should have been made
    expect(fetch).toHaveBeenCalledTimes(3);
    const calls = (fetch as jest.Mock).mock.calls.map((c) => c[0]);
    expect(calls[0]).toContain('api.groq.com');
    expect(calls[1]).toContain('api.groq.com');
    expect(calls[2]).toContain('api.groq.com');

    // Verify Supabase insert was called with correct payload
    const supabaseInstance = (createClient as jest.Mock).mock.results[0].value;
    const insertCall = supabaseInstance
      .from('outreach_sent')
      .insert.mock.calls[0][0];
    expect(insertCall).toMatchObject({
      bounty_id: mockBounty.id,
      tweet: 'Mocked LLM response',
      thread: 'Mocked LLM response',
      blog_post: 'Mocked LLM response',
    });
  });

  it('throws when bounty is not completed', async () => {
    const incompleteBounty = { ...mockBounty, execution_status: 'in_progress' };
    const bountyPromise = Promise.resolve({ data: incompleteBounty, error: null });
    mockSelectSingleResolve(bountyPromise);

    await expect(generate_content(incompleteBounty.id)).rejects.toThrow(
      /is not completed/
    );
  });
});
