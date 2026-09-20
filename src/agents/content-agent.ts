/**
 * Content Generation Agent — Issue #5
 * Generates and records social content for a completed bounty.
 */

export interface ContentOutput {
  tweet: string;
  thread: string[];
  blog_post: string;
}

export interface BountyRecord {
  title: string;
  description?: string | null;
  reward_amount: number;
  repo_owner: string;
  repo_name: string;
  pr_number: number;
}

export interface ContentAgentDependencies {
  readBounty(bountyId: string): Promise<BountyRecord | null>;
  infer(prompt: string): Promise<string>;
  persist(bountyId: string, content: ContentOutput): Promise<void>;
}

const MIN_BLOG_WORDS = 250;
const MAX_BLOG_WORDS = 350;

function words(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function validateContent(value: unknown): ContentOutput {
  if (!value || typeof value !== "object") {
    throw new Error("Malformed LLM output: expected a JSON object");
  }

  const candidate = value as Record<string, unknown>;
  const tweet = typeof candidate.tweet === "string"
    ? candidate.tweet.trim()
    : "";
  const blog_post = typeof candidate.blog_post === "string"
    ? candidate.blog_post.trim()
    : "";
  const thread = Array.isArray(candidate.thread)
    ? candidate.thread.map((entry) =>
      typeof entry === "string" ? entry.trim() : ""
    )
    : [];

  if (!tweet || tweet.length > 280) {
    throw new Error(
      "Malformed LLM output: tweet must contain 1-280 characters",
    );
  }
  if (
    thread.length !== 5 || thread.some((entry) => !entry || entry.length > 280)
  ) {
    throw new Error(
      "Malformed LLM output: thread must contain exactly five tweets of 1-280 characters",
    );
  }
  const blogWords = words(blog_post);
  if (blogWords < MIN_BLOG_WORDS || blogWords > MAX_BLOG_WORDS) {
    throw new Error(
      `Malformed LLM output: blog_post must be approximately 300 words (${MIN_BLOG_WORDS}-${MAX_BLOG_WORDS})`,
    );
  }

  return { tweet, thread, blog_post };
}

function parseModelOutput(raw: string): ContentOutput {
  const normalized = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(
    /\s*```$/,
    "",
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new Error("Malformed LLM output: expected valid JSON");
  }
  return validateContent(parsed);
}

export function createContentAgent(dependencies: ContentAgentDependencies) {
  return async function generate(bountyId: string): Promise<ContentOutput> {
    const bounty = await dependencies.readBounty(bountyId);
    if (!bounty) throw new Error(`Bounty not found: ${bountyId}`);

    const scope =
      (typeof bounty.description === "string"
        ? bounty.description.trim()
        : "") ||
      "No additional scope was recorded.";
    const outcome =
      `Pull request #${bounty.pr_number} was completed in ${bounty.repo_owner}/${bounty.repo_name} for $${bounty.reward_amount} USDC.`;
    const prompt =
      `Create unique outreach content about a completed open-source bounty.

Title: ${bounty.title}
Scope: ${scope}
Outcome: ${outcome}

Return only JSON with this exact shape:
{"tweet":"1-280 characters","thread":["tweet 1","tweet 2","tweet 3","tweet 4","tweet 5"],"blog_post":"approximately 300 words"}

Every tweet must be at most 280 characters. The blog post must be 250-350 words. Explain what was built, why the outcome matters, and how others can participate. Do not invent results beyond the supplied title, scope, and outcome.`;

    const generated = parseModelOutput(await dependencies.infer(prompt));
    await dependencies.persist(bountyId, generated);
    return generated;
  };
}

async function callLLM(prompt: string): Promise<string> {
  const groqApiKey = Deno.env.get("GROQ_API_KEY") ?? "";
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY") ?? "";

  if (groqApiKey) {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: Deno.env.get("GROQ_MODEL")?.trim() || "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 1600,
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`Groq provider failed with HTTP ${response.status}`);
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Groq provider returned no content");
    }
    return content;
  }

  if (geminiApiKey) {
    const model = Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-2.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${
        encodeURIComponent(model)
      }:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`Gemini provider failed with HTTP ${response.status}`);
    }
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Gemini provider returned no content");
    }
    return content;
  }

  throw new Error(
    "No LLM API key configured. Set GROQ_API_KEY or GEMINI_API_KEY.",
  );
}

async function productionDependencies(): Promise<ContentAgentDependencies> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase configuration is missing");
  }
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const headers = {
    "apikey": serviceKey,
    "Authorization": `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
  return {
    async readBounty(bountyId) {
      const query = new URLSearchParams({
        select:
          "title,description,reward_amount,repo_owner,repo_name,pr_number",
        id: `eq.${bountyId}`,
        limit: "1",
      });
      const response = await fetch(
        `${baseUrl}/rest/v1/bounty_executions?${query}`,
        { headers },
      );
      if (!response.ok) {
        throw new Error(`Failed to read bounty: HTTP ${response.status}`);
      }
      const rows = await response.json();
      if (!Array.isArray(rows)) {
        throw new Error("Failed to read bounty: invalid response");
      }
      return (rows[0] as BountyRecord | undefined) ?? null;
    },
    infer: callLLM,
    async persist(bountyId, content) {
      const response = await fetch(`${baseUrl}/rest/v1/outreach_sent`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          bounty_id: bountyId,
          channel: "content_agent",
          content: JSON.stringify(content),
          sent_at: new Date().toISOString(),
        }),
      });
      if (!response.ok) {
        throw new Error(
          `Failed to persist generated content: HTTP ${response.status}`,
        );
      }
    },
  };
}

export async function generate_content(
  bountyId: string,
  dependencies?: ContentAgentDependencies,
): Promise<ContentOutput> {
  return createContentAgent(dependencies ?? await productionDependencies())(
    bountyId,
  );
}

/** Backwards-compatible camelCase entry point. */
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
      return Response.json({ ok: true, content });
    } catch (error) {
      return Response.json({ error: String(error) }, { status: 500 });
    }
  });
}
