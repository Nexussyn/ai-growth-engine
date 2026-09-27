/**
 * Content Generation Agent — Issue #5
 * Generates a bounty-specific tweet, 5-post thread, and ~300-word blog post.
 * Stores one generated result per bounty/channel and is safe to retry.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  buildContext,
  clipTweet,
  splitThread,
  validateContent,
  type ContentOutput,
} from './content-utils.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') ?? '';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function callLLM(prompt: string): Promise<string> {
  if (GROQ_API_KEY) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.8,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) return text;
    }
  }

  if (GEMINI_API_KEY) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 1200 },
        }),
      },
    );

    if (response.ok) {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    }
  }

  throw new Error('No working LLM configured. Set GROQ_API_KEY or GEMINI_API_KEY.');
}

export async function generateContent(bountyId: string): Promise<ContentOutput> {
  // Idempotency: return the existing generated result if this bounty was already processed.
  const { data: existing } = await db
    .from('outreach_sent')
    .select('content')
    .eq('bounty_id', bountyId)
    .eq('channel', 'content_agent')
    .maybeSingle();

  if (existing?.content) {
    const parsed = typeof existing.content === 'string'
      ? JSON.parse(existing.content)
      : existing.content;
    validateContent(parsed);
    return parsed;
  }

  const { data: bounty, error } = await db
    .from('bounty_executions')
    .select('title, description, reward_amount, repo_owner, repo_name, pr_number')
    .eq('id', bountyId)
    .maybeSingle();

  if (error) throw new Error(`Failed to read bounty: ${error.message}`);
  if (!bounty) throw new Error(`Bounty not found: ${bountyId}`);

  const ctx = buildContext(bounty);

  const tweet = clipTweet(await callLLM(
    `Write one original tweet, maximum 280 characters, announcing this completed open-source bounty. Mention the concrete work and reward when available. Make it specific to this bounty, not a generic template. Do not invent results. Context: ${ctx}`,
  ));

  let thread: string[] = [];
  for (let attempt = 0; attempt < 2 && thread.length !== 5; attempt++) {
    const raw = await callLLM(
      `Write exactly 5 original tweets as a thread announcing this completed bounty. Each post must add new information. Separate posts with "---". Make the thread specific to the bounty context and do not invent facts. Context: ${ctx}`,
    );
    thread = splitThread(raw);
  }

  const blog_post = await callLLM(
    `Write an original approximately 300-word blog post about this completed open-source AI bounty. Cover what was built, the concrete problem it solves, and how contributors can participate. Stay grounded in the supplied context and do not invent outcomes. Context: ${ctx}`,
  );

  const output: ContentOutput = { tweet, thread, blog_post: blog_post.trim() };
  validateContent(output);

  const { error: insertError } = await db.from('outreach_sent').insert({
    bounty_id: bountyId,
    channel: 'content_agent',
    content: JSON.stringify(output),
    sent_at: new Date().toISOString(),
  });

  if (insertError) throw new Error(`Failed to store generated content: ${insertError.message}`);

  return output;
}

// Acceptance-criteria alias.
export const generate_content = generateContent;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { bounty_id } = await req.json();
    if (!bounty_id) {
      return new Response(JSON.stringify({ error: 'bounty_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const content = await generateContent(bounty_id);
    return new Response(JSON.stringify({ ok: true, content }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
