/**
 * Content Generation Agent — Issue #5
 * Generates tweet, thread, and blog post from a bounty completion event.
 * Uses the deployment-configured Groq or Gemini model.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createContentGenerator } from './content-core.ts';
export type { ContentOutput } from './content-core.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') ?? '';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function callLLM(prompt: string): Promise<string> {
  // The deployment chooses a currently supported model and account quota.
  if (GROQ_API_KEY) {
    const model = Deno.env.get('GROQ_MODEL');
    if (!model) throw new Error('GROQ_MODEL required');
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024
      })
    });
    if (!r.ok) throw new Error('LLM provider request failed');
    const data = await r.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  // Fallback: Gemini Flash
  if (GEMINI_API_KEY) {
    const model = Deno.env.get('GEMINI_MODEL');
    if (!model) throw new Error('GEMINI_MODEL required');
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!r.ok) throw new Error('LLM provider request failed');
    const data = await r.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  throw new Error('No LLM API key configured. Set GROQ_API_KEY or GEMINI_API_KEY.');
}

export const generateContent = createContentGenerator({
  async load(id) {
    const { data, error } = await db.from('bounty_executions')
      .select('title, description, execution_status, reward_amount, repo_owner, repo_name, pr_number')
      .eq('id', id).maybeSingle();
    if (error) throw new Error('Bounty lookup failed');
    return data;
  },
  generate: callLLM,
  async save(id, content) {
    const { error } = await db.from('outreach_sent').insert({
      bounty_id: id, channel: 'content_agent', content: JSON.stringify(content),
      sent_at: new Date().toISOString(),
    });
    if (error) throw new Error('Content persistence failed');
  },
});
export const generate_content = generateContent;
// Edge Function entry point
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
    return new Response(JSON.stringify({ error: 'Content generation failed' }), { status: 500 });
  }
});
