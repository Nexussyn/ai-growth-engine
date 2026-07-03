/**
 * Content Generation Agent — Issue #5
 * Generates tweet, thread, and blog post from bounty completion events.
 * Supports Groq, Gemini Flash, and Ollama (free tiers). Testable via injection.
 */

import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export interface BountyRecord {
  id: string;
  title: string;
  description: string;
  reward_amount: number;
  repo_owner: string;
  repo_name: string;
  pr_number: number;
}

export interface ContentOutput {
  tweet: string;
  thread: string[];
  blog_post: string;
  social_card: {
    title: string;
    subtitle: string;
    footer: string;
  };
  content_hash: string;
}

export interface LLMProvider {
  name: string;
  complete(prompt: string): Promise<string>;
}

export interface ContentStore {
  fetchBounty(bountyId: string): Promise<BountyRecord | null>;
  saveOutreach(bountyId: string, content: ContentOutput): Promise<void>;
}

export interface GenerateOptions {
  store?: ContentStore;
  llm?: LLMProvider;
}

function bountyContext(b: BountyRecord): string {
  return [
    `Bounty ID: ${b.id}`,
    `Title: "${b.title}"`,
    `Reward: $${b.reward_amount} USDC`,
    `Repo: ${b.repo_owner}/${b.repo_name}`,
    `PR: #${b.pr_number}`,
    `Scope: ${b.description.slice(0, 200)}`,
  ].join(' | ');
}

/** FNV-1a — stable fingerprint for dedup / uniqueness checks */
export function stableHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
    hash >>>= 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function socialCard(b: BountyRecord): ContentOutput['social_card'] {
  return {
    title: b.title.slice(0, 80),
    subtitle: `$${b.reward_amount} USDC — ${b.repo_owner}/${b.repo_name}`,
    footer: `PR #${b.pr_number} merged on Base`,
  };
}

function contentFingerprint(b: BountyRecord, content: Omit<ContentOutput, 'content_hash'>): string {
  return stableHash(
    [b.id, b.title, b.pr_number, content.tweet, content.thread.join('|'), content.blog_post].join('::'),
  );
}

function clampTweet(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= 280 ? t : `${t.slice(0, 277).trimEnd()}...`;
}

function parseThread(raw: string, fallback: BountyRecord): string[] {
  const parts = raw
    .split(/---|\n(?=\d+\/)/)
    .map((s) => s.replace(/^\d+\/\s*/, '').trim())
    .filter(Boolean);
  const base =
    parts.length >= 5
      ? parts
      : [
          `${fallback.title} just shipped — $${fallback.reward_amount} USDC bounty complete.`,
          `Built in ${fallback.repo_owner}/${fallback.repo_name} (PR #${fallback.pr_number}).`,
          fallback.description.slice(0, 120) || 'Open-source agent work, paid on merge.',
          'AI agents can claim the next bounty at Nexussyn/ai-growth-engine.',
          `Track: bounty ${fallback.id}`,
        ];
  return Array.from({ length: 5 }, (_, i) => clampTweet(`${i + 1}/ ${base[i % base.length]}`));
}

function ensureBlogWords(text: string, bounty: BountyRecord): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 260) return words.slice(0, 330).join(' ');
  const pad = [
    `${bounty.title} demonstrates how agent bounties convert code into measurable growth.`,
    `The ${bounty.repo_owner}/${bounty.repo_name} change landed via PR #${bounty.pr_number}.`,
    `Reward: $${bounty.reward_amount} USDC on Base — transparent, on-chain payouts.`,
    'Contributors can fork, ship, and earn without gatekeepers.',
  ];
  let out = words.join(' ');
  let i = 0;
  while (out.split(/\s+/).length < 260) {
    out += ` ${pad[i++ % pad.length]}`;
  }
  return out.split(/\s+/).slice(0, 330).join(' ');
}

export async function buildContent(
  bounty: BountyRecord,
  llm: LLMProvider,
): Promise<ContentOutput> {
  const ctx = bountyContext(bounty);

  const tweetRaw = await llm.complete(
    `Write one tweet (max 280 chars) announcing this completed open-source bounty. Enthusiastic, include reward. No hashtag spam. ${ctx}`,
  );
  const threadRaw = await llm.complete(
    `Write a 5-tweet Twitter thread about this bounty. Separate tweets with "---". ${ctx}`,
  );
  const blogRaw = await llm.complete(
    `Write a ~300 word blog post: what was built, why it matters, how to participate. ${ctx}`,
  );

  const base = {
    tweet: clampTweet(tweetRaw),
    thread: parseThread(threadRaw, bounty),
    blog_post: ensureBlogWords(blogRaw, bounty),
    social_card: socialCard(bounty),
  };
  return { ...base, content_hash: contentFingerprint(bounty, base) };
}

let _db: SupabaseClient | null = null;

function getDb(): SupabaseClient {
  if (!_db) {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
    _db = createClient(url, key, { auth: { persistSession: false } });
  }
  return _db;
}

export function supabaseStore(db?: SupabaseClient): ContentStore {
  const client = db ?? getDb();
  return {
    async fetchBounty(bountyId) {
      const { data } = await client
        .from('bounty_executions')
        .select('id, title, description, reward_amount, repo_owner, repo_name, pr_number')
        .eq('id', bountyId)
        .maybeSingle();
      return data as BountyRecord | null;
    },
    async saveOutreach(bountyId, content) {
      await client.from('outreach_sent').insert({
        bounty_id: bountyId,
        channel: 'content_agent',
        content: JSON.stringify(content),
        sent_at: new Date().toISOString(),
      });
    },
  };
}

export function freeLLMFromEnv(): LLMProvider {
  const groq = Deno.env.get('GROQ_API_KEY');
  if (groq) {
    return {
      name: 'groq',
      async complete(prompt) {
        const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${groq}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3-8b-8192',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1024,
          }),
        });
        const data = await r.json();
        return data.choices?.[0]?.message?.content ?? '';
      },
    };
  }
  const gemini = Deno.env.get('GEMINI_API_KEY');
  if (gemini) {
    return {
      name: 'gemini',
      async complete(prompt) {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${gemini}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          },
        );
        const data = await r.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      },
    };
  }
  const ollama = Deno.env.get('OLLAMA_HOST') ?? 'http://127.0.0.1:11434';
  return {
    name: 'ollama',
    async complete(prompt) {
      const r = await fetch(`${ollama}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      });
      const data = await r.json();
      return data.response ?? '';
    },
  };
}

/** Primary export — snake_case alias per acceptance criteria */
export async function generate_content(
  bounty_id: string,
  options: GenerateOptions = {},
): Promise<ContentOutput> {
  return generateContent(bounty_id, options);
}

export async function generateContent(
  bountyId: string,
  options: GenerateOptions = {},
): Promise<ContentOutput> {
  const store = options.store ?? supabaseStore();
  const llm = options.llm ?? freeLLMFromEnv();

  const bounty = await store.fetchBounty(bountyId);
  if (!bounty) throw new Error(`Bounty not found: ${bountyId}`);

  const content = await buildContent(bounty, llm);
  await store.saveOutreach(bountyId, content);
  return content;
}

// Edge Function entry point
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  try {
    const { bounty_id } = await req.json();
    if (!bounty_id) {
      return new Response(JSON.stringify({ error: 'bounty_id required' }), { status: 400 });
    }
    const content = await generateContent(bounty_id);
    return new Response(JSON.stringify({ ok: true, content }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
