declare const process: { env: Record<string, string | undefined> };

export interface BountyOutcome {
  id: string;
  title: string;
  scope: string;
  outcome: string;
  executionStatus?: string;
  tags?: string[];
}

export interface GeneratedContent {
  tweet: string;
  thread: string[];
  blog_post: string;
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
  store: ContentStore;
  llm?: FreeLLM;
  now?: () => Date;
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

  return {
    tweet: clampTweet(String(raw?.tweet ?? fallback.tweet)),
    thread: normalizeThread(Array.isArray(raw?.thread) ? raw.thread.map(String) : [], bounty),
    blog_post: ensureBlogLength(String(raw?.blog_post ?? fallback.blog_post), bounty),
    social_card: {
      title: String(social.title ?? fallback.social_card.title).slice(0, 72),
      subtitle: String(social.subtitle ?? fallback.social_card.subtitle).slice(0, 112),
      footer: String(social.footer ?? fallback.social_card.footer).slice(0, 80),
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

export async function createFreeLLMFromEnv(env: Record<string, string | undefined> = process.env): Promise<FreeLLM> {
  if (env.GROQ_API_KEY) {
    return {
      provider: 'groq',
      async generate(prompt: string) {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: env.GROQ_MODEL ?? 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
          }),
        });
        const json = await response.json();
        return String(json?.choices?.[0]?.message?.content ?? '');
      },
    };
  }

  if (env.GEMINI_API_KEY) {
    return {
      provider: 'gemini',
      async generate(prompt: string) {
        const model = env.GEMINI_MODEL ?? 'gemini-1.5-flash';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
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
      const baseUrl = env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: env.OLLAMA_MODEL ?? 'llama3.1',
          prompt,
          stream: false,
        }),
      });
      const json = await response.json();
      return String(json?.response ?? '');
    },
  };
}

export async function generate_content(bounty_id: string, options: ContentAgentOptions): Promise<GeneratedContent> {
  const bounty = await options.store.getBountyOutcome(bounty_id);
  if (!bounty) {
    throw new Error(`Bounty not found: ${bounty_id}`);
  }

  const llm = options.llm ?? await createFreeLLMFromEnv();
  let llmText = '';
  try {
    llmText = await llm.generate(buildPrompt(bounty));
  } catch {
    llmText = '';
  }

  const generated = normalizeGenerated(extractJsonBlock(llmText), bounty);
  const content_hash = stableHash(`${bounty.id}:${generated.tweet}:${generated.thread.join('|')}:${generated.blog_post}`);

  await options.store.upsertOutreachSent({
    ...generated,
    bounty_id,
    content_hash,
    llm_provider: llm.provider,
    created_at: (options.now ?? (() => new Date()))().toISOString(),
  });

  return generated;
}
