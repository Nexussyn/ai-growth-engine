import { createClient } from "jsr:@supabase/supabase-js@2";

export interface ContentOutput {
  tweet: string;
  thread: string[];
  blog_post: string;
}

export interface BountyRecord {
  id?: string;
  title: string;
  description?: string;
  outcome?: string;
  reward_amount?: number | string;
  repo_owner?: string;
  repo_name?: string;
  pr_number?: number | string;
}

interface ContentDeps {
  fetchBounty?: (bountyId: string) => Promise<BountyRecord | null>;
  generateText?: (prompt: string) => Promise<string>;
  storeContent?: (bountyId: string, content: ContentOutput) => Promise<void>;
  now?: () => Date;
}

async function callFreeLLM(prompt: string): Promise<string> {
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
  const OLLAMA_BASE_URL = Deno.env.get("OLLAMA_BASE_URL") ??
    "http://localhost:11434";

  if (GROQ_API_KEY) {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
      }),
    });
    if (!r.ok) throw new Error(`Groq request failed: ${r.status}`);
    const data = await r.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  if (GEMINI_API_KEY) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
    );
    if (!r.ok) throw new Error(`Gemini request failed: ${r.status}`);
    const data = await r.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  const r = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("OLLAMA_MODEL") ?? "llama3.1",
      prompt,
      stream: false,
    }),
  });
  if (!r.ok) {
    throw new Error(
      "No free LLM available. Set GROQ_API_KEY, GEMINI_API_KEY, or run local Ollama.",
    );
  }
  const data = await r.json();
  return data.response ?? "";
}

function getSupabaseClient() {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required outside tests.",
    );
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function fetchBountyFromSupabase(
  bountyId: string,
): Promise<BountyRecord | null> {
  const db = getSupabaseClient();
  const { data: bounty } = await db
    .from("bounty_executions")
    .select(
      "id, title, description, outcome, reward_amount, repo_owner, repo_name, pr_number",
    )
    .eq("id", bountyId)
    .maybeSingle();

  return bounty;
}

async function storeContentInSupabase(
  bountyId: string,
  content: ContentOutput,
): Promise<void> {
  const db = getSupabaseClient();
  const { error } = await db.from("outreach_sent").insert({
    bounty_id: bountyId,
    channel: "content_agent",
    content: JSON.stringify(content),
    sent_at: new Date().toISOString(),
  });
  if (error) throw error;
}

function normalizeTweet(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 280);
}

function normalizeThread(text: string): string[] {
  const parts = text
    .split(/\n?---+\n?|\n(?=\d[.)]\s)/)
    .map((tweet) => normalizeTweet(tweet.replace(/^\d[.)]\s*/, "")))
    .filter(Boolean);

  while (parts.length < 5) {
    parts.push(
      `Update ${
        parts.length + 1
      }: More builders can earn by turning open bounty outcomes into useful public proof.`,
    );
  }

  return parts.slice(0, 5);
}

function bountyContext(
  bountyId: string,
  bounty: BountyRecord,
  now: Date,
): string {
  const repo = bounty.repo_owner && bounty.repo_name
    ? `${bounty.repo_owner}/${bounty.repo_name}`
    : "unknown repo";
  const pr = bounty.pr_number ? `#${bounty.pr_number}` : "unlinked PR";
  return [
    `Unique content id: ${bountyId}-${now.toISOString()}`,
    `Bounty title: ${bounty.title}`,
    `Scope: ${bounty.description ?? "No scope provided"}`,
    `Outcome: ${
      bounty.outcome ?? "Completed bounty outcome pending final summary"
    }`,
    `Reward: $${bounty.reward_amount ?? "unknown"} USDC`,
    `Repo: ${repo}`,
    `PR: ${pr}`,
  ].join("\n");
}

export async function generate_content(
  bountyId: string,
  deps: ContentDeps = {},
): Promise<ContentOutput> {
  const fetchBounty = deps.fetchBounty ?? fetchBountyFromSupabase;
  const generateText = deps.generateText ?? callFreeLLM;
  const storeContent = deps.storeContent ?? storeContentInSupabase;
  const now = deps.now ?? (() => new Date());

  const bounty = await fetchBounty(bountyId);
  if (!bounty) throw new Error(`Bounty not found: ${bountyId}`);

  const ctx = bountyContext(bountyId, bounty, now());

  const tweet = await callLLM(
    `Write one original tweet under 280 characters announcing this completed AI bounty. Mention the reward and concrete outcome. No hashtag spam.\n\n${ctx}`,
    generateText,
  );

  const threadRaw = await callLLM(
    `Write exactly five original tweets as a thread. Separate each tweet with "---". Explain what shipped, why it matters, and how another agent can contribute.\n\n${ctx}`,
    generateText,
  );

  const blogPostRaw = await callLLM(
    `Write an original 300-word blog post about this completed open-source AI bounty. Include what was built, why it matters, and how others can participate. Professional but accessible tone.\n\n${ctx}`,
    generateText,
  );

  const content = {
    tweet: normalizeTweet(tweet),
    thread: normalizeThread(threadRaw),
    blog_post: blogPostRaw.trim(),
  };

  await storeContent(bountyId, content);
  return content;
}

async function callLLM(
  prompt: string,
  generateText: (prompt: string) => Promise<string>,
): Promise<string> {
  const text = await generateText(prompt);
  if (!text.trim()) throw new Error("LLM returned empty content");
  return text;
}

export const generateContent = generate_content;

if (import.meta.main) {
  Deno.serve(async (req: Request) => {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    try {
      const { bounty_id } = await req.json();
      if (!bounty_id) {
        return new Response(JSON.stringify({ error: "bounty_id required" }), {
          status: 400,
        });
      }

      const content = await generate_content(bounty_id);
      return new Response(JSON.stringify({ ok: true, content }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 500,
      });
    }
  });
}
