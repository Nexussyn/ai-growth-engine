/**
 * Content Generation Agent
 *
 * Generates a tweet, a 5‑tweet thread and a short blog post for a completed bounty.
 * The generated content is stored in the `outreach_sent` table.
 *
 * Uses the free Groq Llama 3 model (or any OpenAI‑compatible endpoint) via HTTP.
 *
 * Environment variables:
 *   - GROQ_API_KEY          – API key for Groq
 *   - SUPABASE_URL          – Supabase project URL
 *   - SUPABASE_SERVICE_ROLE – Supabase service role key (allows server‑side writes)
 *
 * Optional (not required for the bounty):
 *   - TWITTER_BEARER_TOKEN  – If present, the agent could auto‑post to X.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Supabase client (server‑side)
const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE ?? '',
);

// ---------------------------------------------------------------------------
// Types
export interface GeneratedContent {
  tweet: string;
  thread: string; // newline‑separated tweets
  blog_post: string;
}

// ---------------------------------------------------------------------------
// Helper – call Groq (OpenAI compatible) LLM
async function callGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama3-70b-8192', // free tier model
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Groq API error: ${response.status} ${txt}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Empty response from LLM');
  }
  return content;
}

// ---------------------------------------------------------------------------
// Core function
export async function generate_content(bounty_id: number): Promise<GeneratedContent> {
  // 1️⃣ Fetch bounty details
  const { data: bounty, error } = await supabase
    .from('bounties')
    .select('id, title, scope, outcome, execution_status')
    .eq('id', bounty_id)
    .single();

  if (error) {
    throw new Error(`Failed to fetch bounty ${bounty_id}: ${error.message}`);
  }

  if (!bounty) {
    throw new Error(`Bounty ${bounty_id} not found`);
  }

  if (bounty.execution_status !== 'done') {
    throw new Error(`Bounty ${bounty_id} is not completed (status=${bounty.execution_status})`);
  }

  const { title, scope, outcome } = bounty as {
    title: string;
    scope: string;
    outcome: string;
  };

  // 2️⃣ Build prompts
  const tweetPrompt = `Write a concise, 280‑character (or fewer) tweet that announces the completion of a bounty titled "${title}". Include a brief mention of its scope ("${scope}") and the outcome ("${outcome}"). Use an enthusiastic tone.`;
  const threadPrompt = `Write a 5‑tweet thread (each tweet ≤ 280 characters) that expands on the bounty titled "${title}". The thread should cover:\n1️⃣ What the bounty was about (scope)\n2️⃣ Why it mattered\n3️⃣ The solution/outcome\n4️⃣ Key take‑aways\n5️⃣ A call‑to‑action or next steps.\nSeparate each tweet with a newline.`;
  const blogPrompt = `Write a short blog post (~300 words) about the bounty titled "${title}". Include:\n- A brief introduction of the problem (scope)\n- The solution/outcome\n- Why this matters for the community\n- Any interesting technical details\n- A concluding thought.\nMake it readable and engaging.`;

  // 3️⃣ Generate content via LLM
  const [tweet, thread, blog_post] = await Promise.all([
    callGroq(tweetPrompt),
    callGroq(threadPrompt),
    callGroq(blogPrompt),
  ]);

  // 4️⃣ Persist generated content
  const { error: insertError } = await supabase
    .from('outreach_sent')
    .insert({
      bounty_id,
      tweet,
      thread,
      blog_post,
    })
    .select();

  if (insertError) {
    throw new Error(`Failed to store generated content: ${insertError.message}`);
  }

  // 5️⃣ Return the generated payload
  return { tweet, thread, blog_post };
}

// ---------------------------------------------------------------------------
// Optional: expose a simple CLI for manual testing
if (require.main === module) {
  const id = Number(process.argv[2]);
  if (!id) {
    console.error('Usage: ts-node src/agents/content-agent.ts <bounty_id>');
    process.exit(1);
  }
  generate_content(id)
    .then((c) => console.log('Generated content:', c))
    .catch((e) => console.error(e));
}
