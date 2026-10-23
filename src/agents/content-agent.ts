/**
 * Content Generation Agent — Issue #5 & #195
 * Generates a 280-char tweet, 5-tweet thread, and ~300-word blog post
 * from completed bounty outcomes (`execution_status = done`), validates
 * draft bounds, persists to `outreach_sent`, and optionally posts to X/Twitter.
 */

export interface ContentOutput {
  tweet: string;
  thread: string[];
  blog_post: string;
}

export interface BountyRecord {
  id: string;
  title: string;
  description?: string | null;
  scope?: string | null;
  outcome?: string | null;
  execution_status?: string | null;
  reward_amount?: number | string | null;
  repo_owner?: string | null;
  repo_name?: string | null;
  pr_number?: number | string | null;
}

export interface ContentAgentDeps {
  db?: {
    getBounty(bountyId: string): Promise<BountyRecord | null>;
    insertOutreach(row: {
      bounty_id: string;
      channel: string;
      content: string;
      sent_at: string;
    }): Promise<void>;
  };
  fetchFn?: typeof fetch;
  env?: Record<string, string | undefined>;
}

function readEnv(key: string, customEnv?: Record<string, string | undefined>): string {
  if (customEnv && key in customEnv) {
    return (customEnv[key] ?? '').trim();
  }
  const g = globalThis as Record<string, unknown>;
  if (g.Deno && typeof (g.Deno as { env?: { get?: (k: string) => string | undefined } }).env?.get === 'function') {
    return ((g.Deno as { env: { get: (k: string) => string | undefined } }).env.get(key) ?? '').trim();
  }
  if (typeof process !== 'undefined' && process.env) {
    return (process.env[key] ?? '').trim();
  }
  return '';
}

export function validateDraft(output: ContentOutput): ContentOutput {
  const tweet = output.tweet.trim();
  if (!tweet || [...tweet].length > 280) {
    throw new Error(`Invalid tweet length: ${[...tweet].length} (must be 1..280 characters)`);
  }

  const thread = output.thread.map((t) => t.trim()).filter(Boolean);
  if (thread.length !== 5) {
    throw new Error(`Invalid thread length: expected 5 tweets, got ${thread.length}`);
  }
  for (const [idx, item] of thread.entries()) {
    if ([...item].length > 280) {
      throw new Error(`Thread tweet #${idx + 1} exceeds 280 characters`);
    }
  }
  if (new Set(thread.map((t) => t.toLowerCase())).size !== 5) {
    throw new Error('Thread tweets must be 5 distinct items');
  }

  const blog_post = output.blog_post.trim();
  const wordCount = blog_post.split(/\s+/).filter(Boolean).length;
  if (wordCount < 200 || wordCount > 450) {
    throw new Error(`Blog post word count ${wordCount} out of target 300-word range (200..450)`);
  }

  return { tweet, thread, blog_post };
}

export async function callLLM(
  prompt: string,
  deps: Pick<ContentAgentDeps, 'fetchFn' | 'env'> = {}
): Promise<string> {
  const fetchImpl = deps.fetchFn ?? fetch;
  const groqKey = readEnv('GROQ_API_KEY', deps.env);
  const groqModel = readEnv('GROQ_MODEL', deps.env) || 'llama-3.1-8b-instant';
  const geminiKey = readEnv('GEMINI_API_KEY', deps.env);
  const geminiModel = readEnv('GEMINI_MODEL', deps.env) || 'gemini-1.5-flash';
  const ollamaUrl = readEnv('OLLAMA_URL', deps.env) || 'http://127.0.0.1:11434';
  const ollamaModel = readEnv('OLLAMA_MODEL', deps.env);

  const errors: string[] = [];

  if (groqKey) {
    try {
      const r = await fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1024,
        }),
      });
      if (!r.ok) throw new Error(`Groq HTTP ${r.status}`);
      const data = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content?.trim() ?? '';
      if (!text) throw new Error('Groq returned empty content');
      return text;
    } catch (err) {
      errors.push(`groq: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (geminiKey) {
    try {
      const r = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      if (!r.ok) throw new Error(`Gemini HTTP ${r.status}`);
      const data = (await r.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
      if (!text) throw new Error('Gemini returned empty content');
      return text;
    } catch (err) {
      errors.push(`gemini: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (ollamaModel) {
    try {
      const r = await fetchImpl(`${ollamaUrl.replace(/\/+$/, '')}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: ollamaModel, prompt, stream: false }),
      });
      if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
      const data = (await r.json()) as { response?: string };
      const text = data.response?.trim() ?? '';
      if (!text) throw new Error('Ollama returned empty response');
      return text;
    } catch (err) {
      errors.push(`ollama: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(
    errors.length > 0
      ? `All configured LLM providers failed (${errors.join('; ')})`
      : 'No LLM provider configured. Set GROQ_API_KEY, GEMINI_API_KEY, or OLLAMA_MODEL.'
  );
}

export async function generateContent(
  bountyId: string,
  deps: ContentAgentDeps = {}
): Promise<ContentOutput> {
  if (!bountyId || !bountyId.trim()) {
    throw new Error('bounty_id is required');
  }

  if (!deps.db) {
    throw new Error('Database adapter required');
  }

  const bounty = await deps.db.getBounty(bountyId);
  if (!bounty) {
    throw new Error(`Bounty not found: ${bountyId}`);
  }
  if (bounty.execution_status && bounty.execution_status !== 'done') {
    throw new Error(`Bounty ${bountyId} is not completed (status=${bounty.execution_status})`);
  }

  const scope = bounty.scope ?? bounty.description ?? 'Open-source improvement';
  const outcome = bounty.outcome ?? `PR #${bounty.pr_number ?? 'merged'} in ${bounty.repo_owner ?? 'org'}/${bounty.repo_name ?? 'repo'}`;
  const ctx = `Bounty ID: ${bountyId} | Title: "${bounty.title}" | Scope: "${scope}" | Outcome: "${outcome}" | Reward: $${bounty.reward_amount ?? 0} USDC`;

  const tweet = await callLLM(
    `Write a single tweet (max 280 chars) announcing this completed open-source bounty. Include the specific title, outcome, and reward amount. Context: ${ctx}`,
    deps
  );

  const threadRaw = await callLLM(
    `Write a 5-tweet Twitter thread announcing this completed bounty and explaining its technical scope and outcome. Separate each of the 5 tweets with "---". Context: ${ctx}`,
    deps
  );
  const thread = threadRaw
    .split('---')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 5);

  const blog_post = await callLLM(
    `Write a 300-word blog post (250 to 350 words) about this completed open-source AI bounty. Cover what was built, the technical scope, and the verified outcome. Context: ${ctx}`,
    deps
  );

  const validated = validateDraft({ tweet, thread, blog_post });

  await deps.db.insertOutreach({
    bounty_id: bountyId,
    channel: 'content_agent',
    content: JSON.stringify(validated),
    sent_at: new Date().toISOString(),
  });

  const twitterBearer = readEnv('TWITTER_BEARER_TOKEN', deps.env);
  if (twitterBearer) {
    const fetchImpl = deps.fetchFn ?? fetch;
    await fetchImpl('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${twitterBearer}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: validated.tweet }),
    });
  }

  return validated;
}

export const generate_content = generateContent;
