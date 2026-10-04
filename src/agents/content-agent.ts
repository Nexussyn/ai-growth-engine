/**
 * Content Generation Agent — Issue #5
 * Generates tweet, thread, and blog post from a bounty completion event.
 * Uses Groq Llama (free tier: 6000 req/min) or Gemini Flash (free 1500/day).
 *
 * Secrets (GROQ_API_KEY, GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 * are read from environment variables at call time — nothing is hardcoded.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

export interface ContentOutput {
  tweet: string;        // 280 chars max
  thread: string[];     // 5 tweets
  blog_post: string;    // ~300 words
}

// ---------------------------------------------------------------------------
// LLM layer: Groq first, Gemini Flash fallback. The test seam below lets tests
// inject a mock without touching real APIs.
// ---------------------------------------------------------------------------

type LLMFn = (prompt: string) => Promise<string>;

let llmOverride: LLMFn | null = null;

/** Test-only seam: replace the LLM layer with a mock. Never call in production. */
export function __setLLM(fn: LLMFn | null): void {
  llmOverride = fn;
}

async function callLLM(prompt: string): Promise<string> {
  if (llmOverride) return llmOverride(prompt);

  const groqKey = Deno.env.get('GROQ_API_KEY') ?? '';
  if (groqKey) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024
      })
    });
    const data = await r.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  const geminiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
  if (geminiKey) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await r.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  throw new Error('No LLM API key configured. Set GROQ_API_KEY or GEMINI_API_KEY.');
}

// ---------------------------------------------------------------------------
// DB layer. The Supabase client is created lazily so importing this module
// (e.g. from tests) has no side effects and needs no env vars.
// ---------------------------------------------------------------------------

type DbClient = { from: (table: string) => any };

let dbOverride: DbClient | null = null;

/** Test-only seam: inject a mock DB client. Never call in production. */
export function __setDb(mock: DbClient | null): void {
  dbOverride = mock;
}

function getDb(): DbClient {
  if (dbOverride) return dbOverride;
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

export async function generateContent(bountyId: string): Promise<ContentOutput> {
  // Fetch bounty details
  const { data: bounty } = await getDb()
    .from('bounty_executions')
    .select('title, description, reward_amount, repo_owner, repo_name, pr_number')
    .eq('id', bountyId)
    .maybeSingle();

  if (!bounty) throw new Error(`Bounty not found: ${bountyId}`);

  const ctx = `Bounty: "${bounty.title}" | Reward: $${bounty.reward_amount} USDC | Repo: ${bounty.repo_owner}/${bounty.repo_name} | PR: #${bounty.pr_number}`;

  // Generate tweet
  const tweet = await callLLM(
    `Write a single tweet (max 280 chars) announcing this completed open-source bounty. Be enthusiastic, include the reward amount and a call to action. No hashtag spam. Context: ${ctx}`
  );

  // Generate thread
  const threadRaw = await callLLM(
    `Write a 5-tweet Twitter thread announcing this completed bounty and explaining why open AI bounties matter. Each tweet separated by "---". Context: ${ctx}`
  );
  const thread = threadRaw.split('---').map(t => t.trim()).filter(Boolean).slice(0, 5);

  // Generate blog post
  const blog_post = await callLLM(
    `Write a 300-word blog post about this completed open-source AI bounty. Include: what was built, why it matters, how others can participate. Professional but accessible tone. Context: ${ctx}`
  );

  // Store in outreach_sent
  await getDb().from('outreach_sent').insert({
    bounty_id: bountyId,
    channel: 'content_agent',
    content: JSON.stringify({ tweet, thread, blog_post }),
    sent_at: new Date().toISOString()
  });

  return { tweet: tweet.slice(0, 280), thread, blog_post };
}

// Edge Function entry point — only runs when deployed as the entry module,
// so importing generateContent from tests does not bind a port.
if (import.meta.main) {
  Deno.serve(async (req: Request) => {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    try {
      const { bounty_id } = await req.json();
      if (!bounty_id) return new Response(JSON.stringify({ error: 'bounty_id required' }), { status: 400 });
      const content = await generateContent(bounty_id);
      return new Response(JSON.stringify({ ok: true, content }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
  });
}
