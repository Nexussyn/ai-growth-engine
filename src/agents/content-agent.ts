declare const Deno:
  | {
      env?: { get(name: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;
declare const process: { env?: Record<string, string | undefined> } | undefined;

type EnvSource = Record<string, string | undefined>;

export interface BountyOutcome {
  id: string;
  title: string;
  scope: string;
  outcome: string;
  executionStatus?: string;
  tags?: string[];
}

export interface ContentOutput {
  tweet: string;
  thread: string[];
  blog_post: string;
}

export interface GeneratedContent extends ContentOutput {
  social_card: {
    title: string;
    subtitle: string;
    footer: string;
  };
}

export interface OutreachRecord extends GeneratedContent {
  bounty_id: string;
  content_hash: string;
  llm_provider: string;
  created_at: string;
}

export interface ContentStore {
  getBountyOutcome(bountyId: string): Promise<BountyOutcome | null>;
  upsertOutreachSent(record: OutreachRecord): Promise<void>;
}

export interface FreeLLM {
  provider: 'groq' | 'gemini' | 'ollama' | 'mock';
  generate(prompt: string): Promise<string>;
}

export interface ContentAgentOptions {
  store?: ContentStore;
  llm?: FreeLLM;
  now?: () => Date;
  env?: EnvSource;
}

interface SupabaseClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<{ data: Record<string, unknown> | null; error?: Error | null }>;
      };
    };
    insert(row: Record<string, unknown>): Promise<{ error?: Error | null }>;
  };
}

function getRuntimeEnv(): EnvSource {
  return typeof process !== 'undefined' && process.env ? process.env : {};
}

function getEnv(name: string, env: EnvSource = getRuntimeEnv()): string | undefined {
  if (env[name]) return env[name];
  if (typeof Deno !== 'undefined' && Deno.env?.get) return Deno.env.get(name);
  return undefined;
}

export function stableHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
    hash >>>= 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function clampTweet(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 280) return normalized;
  return `${normalized.slice(0, 277).trimEnd()}...`;
}

function normalizeThread(lines: string[], fallback: BountyOutcome): string[] {
  const cleaned = lines.map((line) => line.replace(/^\d+\/?\s*/, '').trim()).filter(Boolean);
  const base = cleaned.length > 0 ? cleaned : [
    `${fallback.title} shipped from bounty work.`,
    `Scope: ${fallback.scope}`,
    `Outcome: ${fallback.outcome}`,
    'Impact is ready to be measured through the growth engine.',
    `Bounty id: ${fallback.id}`,
  ];

  return Array.from({ length: 5 }, (_, index) => clampTweet(`${index + 1}/ ${base[index % base.length]}`));
}

function ensureBlogLength(text: string, bounty: BountyOutcome): string {
  const base = text.trim() || `${bounty.title}\n\n${bounty.scope}\n\n${bounty.outcome}`;
  const filler = [
    `The completed bounty focused on ${bounty.scope}.`,
    `The implementation outcome was ${bounty.outcome}.`,
    'This gives the growth system a reusable signal that can be measured after merge.',
    'The next useful step is to compare conversion, reach, or agent throughput before and after the change.',
  ];

  const parts = [base];
  let cursor = 0;
  while (words(parts.join(' ')).length < 260) {
    parts.push(filler[cursor % filler.length]);
    cursor += 1;
  }

  return words(parts.join('\n\n')).slice(0, 330).join(' ');
}

function extractJsonBlock(text: string): Partial<GeneratedContent> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) return null;

  try {
    return JSON.parse(candidate) as Partial<GeneratedContent>;
  } catch {
    return null;
  }
}

function buildPrompt(bounty: BountyOutcome): string {
  return [
    'Generate unique outreach content for a completed open-source bounty.',
    'Return strict JSON with keys: tweet, thread, blog_post, social_card.',
    'tweet must be <= 280 chars.',
    'thread must be exactly 5 short tweet strings.',
    'blog_post should be around 300 words.',
    'social_card must include title, subtitle, footer.',
    `Bounty id: ${bounty.id}`,
    `Title: ${bounty.title}`,
    `Scope: ${bounty.scope}`,
    `Outcome: ${bounty.outcome}`,
  ].join('\n');
}

function fallbackContent(bounty: BountyOutcome): GeneratedContent {
  const fingerprint = stableHash(`${bounty.id}:${bounty.title}:${bounty.scope}:${bounty.outcome}`).slice(0, 6);
  const tweet = clampTweet(`${bounty.title} shipped: ${bounty.outcome}. Proof ${fingerprint}`);

  return {
    tweet,
    thread: normalizeThread([], bounty),
    blog_post: ensureBlogLength('', bounty),
    social_card: {
      title: bounty.title.slice(0, 72),
      subtitle: bounty.outcome.slice(0, 112),
      footer: `Bounty ${bounty.id} / ${fingerprint}`,
    },
  };
}

function normalizeGenerated(raw: Partial<GeneratedContent> | null, bounty: BountyOutcome): GeneratedContent {
  const fallback = fallbackContent(bounty);
  const social = raw?.social_card ?? fallback.social_card;
  const fingerprint = stableHash(`${bounty.id}:${bounty.title}:${bounty.outcome}`).slice(0, 6);
  const footerBase = String(social.footer ?? fallback.social_card.footer).slice(0, 68);

  return {
    tweet: clampTweet(String(raw?.tweet ?? fallback.tweet)),
    thread: normalizeThread(Array.isArray(raw?.thread) ? raw.thread.map(String) : [], bounty),
    blog_post: ensureBlogLength(String(raw?.blog_post ?? fallback.blog_post), bounty),
    social_card: {
      title: String(social.title ?? fallback.social_card.title).slice(0, 72),
      subtitle: String(social.subtitle ?? fallback.social_card.subtitle).slice(0, 112),
      footer: `${footerBase} / ${fingerprint}`.slice(0, 80),
    },
  };
}

export function createMockLLM(response?: string): FreeLLM {
  return {
    provider: 'mock',
    async generate() {
      return response ?? '';
    },
  };
}

export async function createFreeLLMFromEnv(env: EnvSource = getRuntimeEnv()): Promise<FreeLLM> {
  const groqKey = getEnv('GROQ_API_KEY', env);
  if (groqKey) {
    return {
      provider: 'groq',
      async generate(prompt: string) {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: getEnv('GROQ_MODEL', env) ?? 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
          }),
        });
        const json = await response.json();
        return String(json?.choices?.[0]?.message?.content ?? '');
      },
    };
  }

  const geminiKey = getEnv('GEMINI_API_KEY', env);
  if (geminiKey) {
    return {
      provider: 'gemini',
      async generate(prompt: string) {
        const model = getEnv('GEMINI_MODEL', env) ?? 'gemini-1.5-flash';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        const json = await response.json();
        return String(json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
      },
    };
  }

  return {
    provider: 'ollama',
    async generate(prompt: string) {
      const baseUrl = getEnv('OLLAMA_BASE_URL', env) ?? 'http://127.0.0.1:11434';
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: getEnv('OLLAMA_MODEL', env) ?? 'llama3.1',
          prompt,
          stream: false,
        }),
      });
      const json = await response.json();
      return String(json?.response ?? '');
    },
  };
}

async function createSupabaseStore(env: EnvSource = getRuntimeEnv()): Promise<ContentStore> {
  const supabaseUrl = getEnv('SUPABASE_URL', env);
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', env);
  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for runtime content generation');
  }

  const { createClient } = await import('jsr:@supabase/supabase-js@2');
  const createSupabaseClient = createClient as unknown as (
    url: string,
    key: string,
    options: { auth: { persistSession: boolean } },
  ) => SupabaseClient;
  const db = createSupabaseClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  return {
    async getBountyOutcome(bountyId: string) {
      const { data, error } = await db
        .from('bounty_executions')
        .select('title, description, outcome, execution_status, reward_amount, repo_owner, repo_name, pr_number')
        .eq('id', bountyId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const repo = `${String(data.repo_owner ?? '')}/${String(data.repo_name ?? '')}`.replace(/^\/|\/$/g, '');
      return {
        id: bountyId,
        title: String(data.title ?? `Bounty ${bountyId}`),
        scope: String(data.description ?? repo),
        outcome: String(data.outcome ?? `Completed PR #${String(data.pr_number ?? '')}`),
        executionStatus: String(data.execution_status ?? ''),
        tags: ['bounty', repo].filter(Boolean),
      };
    },

    async upsertOutreachSent(record: OutreachRecord) {
      const { error } = await db.from('outreach_sent').insert({
        bounty_id: record.bounty_id,
        channel: 'content_agent',
        content: JSON.stringify({
          tweet: record.tweet,
          thread: record.thread,
          blog_post: record.blog_post,
          social_card: record.social_card,
          content_hash: record.content_hash,
          llm_provider: record.llm_provider,
        }),
        sent_at: record.created_at,
      });
      if (error) throw error;
    },
  };
}

export async function generate_content(bounty_id: string, options: ContentAgentOptions = {}): Promise<GeneratedContent> {
  const store = options.store ?? await createSupabaseStore(options.env);
  const bounty = await store.getBountyOutcome(bounty_id);
  if (!bounty) {
    throw new Error(`Bounty not found: ${bounty_id}`);
  }

  const llm = options.llm ?? await createFreeLLMFromEnv(options.env);
  let llmText = '';
  try {
    llmText = await llm.generate(buildPrompt(bounty));
  } catch {
    llmText = '';
  }

  const generated = normalizeGenerated(extractJsonBlock(llmText), bounty);
  const content_hash = stableHash(`${bounty.id}:${generated.tweet}:${generated.thread.join('|')}:${generated.blog_post}:${generated.social_card.footer}`);

  await store.upsertOutreachSent({
    ...generated,
    bounty_id,
    content_hash,
    llm_provider: llm.provider,
    created_at: (options.now ?? (() => new Date()))().toISOString(),
  });

  return generated;
}

export async function generateContent(bountyId: string): Promise<ContentOutput> {
  return generate_content(bountyId);
}

const denoServe = typeof Deno !== 'undefined' ? Deno.serve : undefined;
const shouldStartServer = denoServe && (import.meta as ImportMeta & { main?: boolean }).main;

if (shouldStartServer && denoServe) {
  denoServe(async (req: Request) => {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    try {
      const { bounty_id } = await req.json();
      if (!bounty_id) return new Response(JSON.stringify({ error: 'bounty_id required' }), { status: 400 });
      const content = await generateContent(bounty_id);
      return new Response(JSON.stringify({ ok: true, content }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
    }
  });
}
