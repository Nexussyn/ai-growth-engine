/**
 * Content Generation Agent — Issue #5
 * Generates tweet, thread, and blog post from a bounty completion event.
 * Uses Groq Llama (free tier: 6000 req/min) or Gemini Flash (free 1500/day).
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

export interface ContentOutput {
  tweet: string;        // 280 chars max
  thread: string[];     // 5 tweets
  blog_post: string;    // ~300 words
}

export interface BountyContext {
  title: string;
  reward_amount: number | string;
  repo_owner: string;
  repo_name: string;
  pr_number: number | string;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function createDbClient() {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
}

export function bountyContextLine(bounty: BountyContext): string {
  return `Bounty: "${bounty.title}" | Reward: $${bounty.reward_amount} USDC | Repo: ${bounty.repo_owner}/${bounty.repo_name} | PR: #${bounty.pr_number}`;
}

export function normalizeTweet(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 280);
}

export function normalizeThread(raw: string, context: BountyContext): string[] {
  const parsed = raw
    .split(/\n?---+\n?|\n(?=\d+[.)]\s+)/g)
    .map((item) => normalizeTweet(item.replace(/^\d+[.)]\s*/, '')))
    .filter(Boolean)
    .slice(0, 5);

  const fallbacks = [
    `Bounty completed: ${context.title}.`,
    `Repo: ${context.repo_owner}/${context.repo_name}, PR #${context.pr_number}.`,
    `Reward: $${context.reward_amount} USDC for focused open-source work.`,
    'AI-friendly bounties work best when scope, tests, and payout rules are clear.',
    'Want to contribute? Pick a focused issue, ship a small PR, and document validation.',
  ];

  while (parsed.length < 5) {
    parsed.push(normalizeTweet(fallbacks[parsed.length]));
  }

  return parsed;
}

async function callLLM(prompt: string): Promise<string> {
  const groqApiKey = Deno.env.get('GROQ_API_KEY') ?? '';
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? '';

  // Try Groq first (faster, higher free limit)
  if (groqApiKey) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024
      })
    });
    if (!r.ok) throw new Error(`Groq request failed: ${r.status}`);
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) return content;
  }

  // Fallback: Gemini Flash
  if (geminiApiKey) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!r.ok) throw new Error(`Gemini request failed: ${r.status}`);
    const data = await r.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (content) return content;
  }

  throw new Error('No LLM API key configured. Set GROQ_API_KEY or GEMINI_API_KEY.');
}

export async function generateContent(bountyId: string): Promise<ContentOutput> {
  const db = createDbClient();

  // Fetch bounty details
  const { data: bounty } = await db
    .from('bounty_executions')
    .select('title, description, reward_amount, repo_owner, repo_name, pr_number')
    .eq('id', bountyId)
    .maybeSingle();

  if (!bounty) throw new Error(`Bounty not found: ${bountyId}`);

  const ctx = bountyContextLine(bounty);

  // Generate tweet
  const tweet = normalizeTweet(await callLLM(
    `Write a single tweet (max 280 chars) announcing this completed open-source bounty. Be enthusiastic, include the reward amount and a call to action. No hashtag spam. Context: ${ctx}`
  ));

  // Generate thread
  const threadRaw = await callLLM(
    `Write a 5-tweet Twitter thread announcing this completed bounty and explaining why open AI bounties matter. Each tweet separated by "---". Context: ${ctx}`
  );
  const thread = normalizeThread(threadRaw, bounty);

  // Generate blog post
  const blog_post = (await callLLM(
    `Write a 300-word blog post about this completed open-source AI bounty. Include: what was built, why it matters, how others can participate. Professional but accessible tone. Context: ${ctx}`
  )).trim();

  // Store in outreach_sent
  const { error } = await db.from('outreach_sent').insert({
    bounty_id: bountyId,
    channel: 'content_agent',
    content: JSON.stringify({ tweet, thread, blog_post }),
    sent_at: new Date().toISOString()
  });
  if (error) throw error;

  return { tweet, thread, blog_post };
}

export function createContentAgentHandler() {
  return async (req: Request): Promise<Response> => {
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
  };
}

// Edge Function entry point
if (import.meta.main) {
  Deno.serve(createContentAgentHandler());
}
