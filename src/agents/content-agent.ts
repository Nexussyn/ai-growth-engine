/**
 * Content Generation Agent — Issue #5
 * Generates tweet, thread, and blog post from a bounty completion event.
 * Uses Groq Llama (free tier: 6000 req/min) or Gemini Flash (free 1500/day).
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  generateBountyContent,
  type ContentOutput,
} from './content-generator.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') ?? '';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function callLLM(prompt: string): Promise<string> {
  // Try Groq first (faster, higher free limit)
  if (GROQ_API_KEY) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024
      })
    });
    const data = await r.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  // Fallback: Gemini Flash
  if (GEMINI_API_KEY) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await r.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  throw new Error('No LLM API key configured. Set GROQ_API_KEY or GEMINI_API_KEY.');
}

export async function generateContent(bountyId: string): Promise<ContentOutput> {
  // Fetch bounty details
  const { data: bounty } = await db
    .from('bounty_executions')
    .select('title, description, reward_amount, repo_owner, repo_name, pr_number')
    .eq('id', bountyId)
    .maybeSingle();

  if (!bounty) throw new Error(`Bounty not found: ${bountyId}`);

  const content = await generateBountyContent({ id: bountyId, ...bounty }, callLLM);

  // Store in outreach_sent
  const { error } = await db.from('outreach_sent').insert({
    bounty_id: bountyId,
    channel: 'content_agent',
    content: JSON.stringify(content),
    sent_at: new Date().toISOString()
  });
  if (error) throw new Error(`Failed to store generated content: ${error.message}`);

  return content;
}

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
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
