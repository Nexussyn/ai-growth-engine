import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// 1. Set environment variables for the supabase client initialization FIRST
Deno.env.set('SUPABASE_URL', 'https://mock-supabase-url.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'mock-service-key');

// 2. Dynamically import generateContent AFTER environment variables are set
const { generateContent } = await import('../src/agents/content-agent.ts');

// We'll capture requests and customize responses dynamically in our mock fetch
let lastInsertedOutreach: any = null;
let llmCalls: string[] = [];

const originalFetch = globalThis.fetch;

function setupMockFetch(options: {
  groqKey?: string;
  geminiKey?: string;
  bountyExists?: boolean;
  groqResponse?: string;
  geminiResponse?: string;
}) {
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');

    // 1. Intercept Groq LLM API
    if (url.includes('api.groq.com')) {
      const body = JSON.parse(init?.body as string);
      const prompt = body.messages[0].content;
      llmCalls.push(`groq:${prompt}`);

      let content = options.groqResponse;
      if (content === undefined) {
        if (prompt.includes('single tweet')) {
          content = 'Tweet Content';
        } else if (prompt.includes('Twitter thread')) {
          content = 'Tweet 1\n---\nTweet 2\n---\nTweet 3\n---\nTweet 4\n---\nTweet 5';
        } else if (prompt.includes('blog post')) {
          content = 'Blog post content';
        } else {
          content = `Mock Groq: ${prompt}`;
        }
      }

      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: content
          }
        }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Intercept Gemini LLM API
    if (url.includes('generativelanguage.googleapis.com')) {
      const body = JSON.parse(init?.body as string);
      const prompt = body.contents[0].parts[0].text;
      llmCalls.push(`gemini:${prompt}`);

      let content = options.geminiResponse;
      if (content === undefined) {
        if (prompt.includes('single tweet')) {
          content = 'Gemini Tweet Content';
        } else if (prompt.includes('Twitter thread')) {
          content = 'Gemini Tweet 1\n---\nGemini Tweet 2\n---\nGemini Tweet 3\n---\nGemini Tweet 4\n---\nGemini Tweet 5';
        } else if (prompt.includes('blog post')) {
          content = 'Gemini Blog post content';
        } else {
          content = `Mock Gemini: ${prompt}`;
        }
      }

      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: content
            }]
          }
        }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Intercept Supabase Rest API
    if (url.includes('mock-supabase-url.supabase.co')) {
      if (url.includes('/rest/v1/bounty_executions')) {
        if (options.bountyExists) {
          return new Response(JSON.stringify({
            title: 'Mock Bounty Title',
            description: 'Mock Bounty Description',
            reward_amount: 150,
            repo_owner: 'Nexussyn',
            repo_name: 'ai-growth-engine',
            pr_number: 5
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Content-Range': '0-0/1'
            }
          });
        } else {
          // PGRST116 signals 0 rows returned for maybeSingle()
          return new Response(JSON.stringify({
            code: 'PGRST116',
            message: 'JSON object requested, multiple or no rows returned',
            details: 'The query returned 0 rows.'
          }), {
            status: 406,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      if (url.includes('/rest/v1/outreach_sent')) {
        if (method === 'POST') {
          lastInsertedOutreach = JSON.parse(init?.body as string);
          return new Response(JSON.stringify([{}]), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }

    return new Response('Not Found', { status: 404 });
  };
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
  lastInsertedOutreach = null;
  llmCalls = [];
}

Deno.test({
  name: "generateContent - Groq Success Flow",
  async fn() {
    Deno.env.set('GROQ_API_KEY', 'test-groq-key');
    Deno.env.set('GEMINI_API_KEY', 'test-gemini-key'); // Groq should take priority
    
    setupMockFetch({
      bountyExists: true,
    });

    try {
      const result = await generateContent('bounty-123');
      
      // Verify return object
      assertEquals(result.tweet, 'Tweet Content');
      assertEquals(result.thread, ['Tweet 1', 'Tweet 2', 'Tweet 3', 'Tweet 4', 'Tweet 5']);
      assertEquals(result.blog_post, 'Blog post content');
      
      // Verify Groq was called instead of Gemini
      assertEquals(llmCalls.every(c => c.startsWith('groq:')), true);
      assertEquals(llmCalls.length, 3);
      
      // Verify Supabase insert payload
      assertEquals(lastInsertedOutreach.bounty_id, 'bounty-123');
      assertEquals(lastInsertedOutreach.channel, 'content_agent');
      const content = JSON.parse(lastInsertedOutreach.content);
      assertEquals(content.tweet, 'Tweet Content');
      assertEquals(content.thread, ['Tweet 1', 'Tweet 2', 'Tweet 3', 'Tweet 4', 'Tweet 5']);
      assertEquals(content.blog_post, 'Blog post content');
    } finally {
      restoreFetch();
      Deno.env.delete('GROQ_API_KEY');
      Deno.env.delete('GEMINI_API_KEY');
    }
  }
});

Deno.test({
  name: "generateContent - Gemini Fallback Flow",
  async fn() {
    Deno.env.delete('GROQ_API_KEY');
    Deno.env.set('GEMINI_API_KEY', 'test-gemini-key');
    
    setupMockFetch({
      bountyExists: true,
    });

    try {
      const result = await generateContent('bounty-123');
      
      // Verify return object
      assertEquals(result.tweet, 'Gemini Tweet Content');
      assertEquals(result.thread, ['Gemini Tweet 1', 'Gemini Tweet 2', 'Gemini Tweet 3', 'Gemini Tweet 4', 'Gemini Tweet 5']);
      assertEquals(result.blog_post, 'Gemini Blog post content');
      
      // Verify Gemini was called
      assertEquals(llmCalls.every(c => c.startsWith('gemini:')), true);
      assertEquals(llmCalls.length, 3);
    } finally {
      restoreFetch();
      Deno.env.delete('GEMINI_API_KEY');
    }
  }
});

Deno.test({
  name: "generateContent - Error when no API keys set",
  async fn() {
    Deno.env.delete('GROQ_API_KEY');
    Deno.env.delete('GEMINI_API_KEY');
    
    setupMockFetch({
      bountyExists: true,
    });

    try {
      await assertRejects(
        async () => {
          await generateContent('bounty-123');
        },
        Error,
        'No LLM API key configured'
      );
    } finally {
      restoreFetch();
    }
  }
});

Deno.test({
  name: "generateContent - Error when bounty not found",
  async fn() {
    Deno.env.set('GROQ_API_KEY', 'test-groq-key');
    
    setupMockFetch({
      bountyExists: false,
    });

    try {
      await assertRejects(
        async () => {
          await generateContent('bounty-999');
        },
        Error,
        'Bounty not found: bounty-999'
      );
    } finally {
      restoreFetch();
      Deno.env.delete('GROQ_API_KEY');
    }
  }
});

Deno.test({
  name: "generateContent - Tweet truncation to 280 characters",
  async fn() {
    Deno.env.set('GROQ_API_KEY', 'test-groq-key');
    
    const superLongTweet = 'a'.repeat(300);
    setupMockFetch({
      bountyExists: true,
      groqResponse: superLongTweet,
    });

    try {
      const result = await generateContent('bounty-123');
      assertEquals(result.tweet.length, 280);
      assertEquals(result.tweet, 'a'.repeat(280));
    } finally {
      restoreFetch();
      Deno.env.delete('GROQ_API_KEY');
    }
  }
});
