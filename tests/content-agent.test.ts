import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  BountyRecord,
  ContentAgentDependencies,
  ContentOutput,
  generate_content,
  generateContent,
} from "../src/agents/content-agent.ts";

const bounty: BountyRecord = {
  title: "Add signed release notes",
  description:
    "Generate release notes from merged changes and include verification links.",
  reward_amount: 5,
  repo_owner: "example",
  repo_name: "growth-engine",
  pr_number: 42,
};

function blog(wordCount = 300): string {
  return Array.from({ length: wordCount }, (_, index) => `word${index + 1}`)
    .join(" ");
}

function validContent(): ContentOutput {
  return {
    tweet:
      "Signed release notes now connect merged work to verifiable results.",
    thread: ["One", "Two", "Three", "Four", "Five"],
    blog_post: blog(),
  };
}

function dependencies(
  overrides: Partial<ContentAgentDependencies> = {},
): ContentAgentDependencies {
  return {
    readBounty: async () => bounty,
    infer: async () => JSON.stringify(validContent()),
    persist: async () => {},
    ...overrides,
  };
}

Deno.test("generate_content uses bounty title, scope, and outcome then persists the returned validated content", async () => {
  let prompt = "";
  let persisted: { id: string; content: ContentOutput } | undefined;
  const deps = dependencies({
    infer: (value) => {
      prompt = value;
      return Promise.resolve(
        `\`\`\`json\n${JSON.stringify(validContent())}\n\`\`\``,
      );
    },
    persist: (id, content) => {
      persisted = { id, content };
      return Promise.resolve();
    },
  });

  const result = await generate_content("bounty-123", deps);

  assertStringIncludes(prompt, bounty.title);
  assertStringIncludes(prompt, bounty.description!);
  assertStringIncludes(prompt, "Pull request #42 was completed");
  assertEquals(persisted, { id: "bounty-123", content: result });
  assert(result.tweet.length <= 280);
  assertEquals(result.thread.length, 5);
  assert(result.thread.every((entry) => entry.length <= 280));
  assertEquals(result.blog_post.split(/\s+/).length, 300);
  assertEquals(await generateContent("bounty-123", deps), result);
});

Deno.test("missing bounty is surfaced and inference is not called", async () => {
  let inferred = false;
  await assertRejects(
    () =>
      generate_content(
        "missing",
        dependencies({
          readBounty: async () => null,
          infer: async () => {
            inferred = true;
            return "{}";
          },
        }),
      ),
    Error,
    "Bounty not found: missing",
  );
  assertEquals(inferred, false);
});

Deno.test("bounty read failure is surfaced and inference is not called", async () => {
  let inferred = false;
  await assertRejects(
    () =>
      generate_content(
        "bounty-123",
        dependencies({
          readBounty: async () => {
            throw new Error("database read failed");
          },
          infer: async () => {
            inferred = true;
            return "{}";
          },
        }),
      ),
    Error,
    "database read failed",
  );
  assertEquals(inferred, false);
});

Deno.test("malformed model output is rejected before persistence", async () => {
  let persisted = false;
  const malformed = {
    ...validContent(),
    tweet: "x".repeat(281),
    thread: ["only one"],
  };
  await assertRejects(
    () =>
      generate_content(
        "bounty-123",
        dependencies({
          infer: async () => JSON.stringify(malformed),
          persist: async () => {
            persisted = true;
          },
        }),
      ),
    Error,
    "tweet must contain 1-280 characters",
  );
  assertEquals(persisted, false);
});

Deno.test("provider failure is surfaced and does not persist", async () => {
  let persisted = false;
  await assertRejects(
    () =>
      generate_content(
        "bounty-123",
        dependencies({
          infer: async () => {
            throw new Error("provider unavailable");
          },
          persist: async () => {
            persisted = true;
          },
        }),
      ),
    Error,
    "provider unavailable",
  );
  assertEquals(persisted, false);
});

Deno.test("persistence failure is surfaced after validation", async () => {
  await assertRejects(
    () =>
      generate_content(
        "bounty-123",
        dependencies({
          persist: async () => {
            throw new Error("database insert failed");
          },
        }),
      ),
    Error,
    "database insert failed",
  );
});

Deno.test("approximately 300 words and every thread length are enforced", async () => {
  await assertRejects(
    () =>
      generate_content(
        "bounty-123",
        dependencies({
          infer: async () =>
            JSON.stringify({ ...validContent(), blog_post: blog(249) }),
        }),
      ),
    Error,
    "blog_post must be approximately 300 words",
  );

  const longThread = validContent();
  longThread.thread[3] = "x".repeat(281);
  await assertRejects(
    () =>
      generate_content(
        "bounty-123",
        dependencies({
          infer: async () => JSON.stringify(longThread),
        }),
      ),
    Error,
    "thread must contain exactly five tweets",
  );
});

Deno.test("null, missing and empty descriptions use the documented scope fallback", async () => {
  for (const description of [null, undefined, "   "]) {
    let prompt = "";
    const row: BountyRecord = { ...bounty, description };
    if (description === undefined) delete row.description;
    await generate_content(
      "bounty-123",
      dependencies({
        readBounty: async () => row,
        infer: async (value) => {
          prompt = value;
          return JSON.stringify(validContent());
        },
      }),
    );
    assertStringIncludes(prompt, "Scope: No additional scope was recorded.");
    assertStringIncludes(prompt, bounty.title);
  }
});

const productionEnvNames = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GROQ_API_KEY",
  "GEMINI_API_KEY",
  "GROQ_MODEL",
  "GEMINI_MODEL",
] as const;

async function withProductionMocks(
  environment: Record<string, string>,
  fetchMock: typeof fetch,
  run: () => Promise<void>,
) {
  const previous = productionEnvNames.map((name) =>
    [name, Deno.env.get(name)] as const
  );
  const previousFetch = globalThis.fetch;
  try {
    for (const name of productionEnvNames) {
      if (environment[name] === undefined) Deno.env.delete(name);
      else Deno.env.set(name, environment[name]);
    }
    globalThis.fetch = fetchMock;
    await run();
  } finally {
    globalThis.fetch = previousFetch;
    for (const [name, value] of previous) {
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
}

Deno.test("production provider defaults and overrides generate and persist through mocked REST", async () => {
  for (const provider of ["groq", "gemini"]) {
    for (const override of [undefined, "fixture-model"]) {
      const expectedModel = override ??
        (provider === "groq" ? "llama-3.1-8b-instant" : "gemini-2.5-flash");
      const environment: Record<string, string> = {
        SUPABASE_URL: "https://database.example.test/",
        SUPABASE_SERVICE_ROLE_KEY: "fixture-database-key",
        [provider === "groq" ? "GROQ_API_KEY" : "GEMINI_API_KEY"]:
          "fixture-provider-key",
      };
      if (override) {
        environment[provider === "groq" ? "GROQ_MODEL" : "GEMINI_MODEL"] =
          override;
      }
      const calls: string[] = [];
      let stored: Record<string, unknown> | undefined;
      const mockFetch: typeof fetch = async (input, init) => {
        const url = new URL(
          input instanceof Request ? input.url : String(input),
        );
        const headers = new Headers(init?.headers);
        assertEquals(url.toString().includes("fixture-provider-key"), false);
        if (url.hostname === "database.example.test") {
          assertEquals(headers.get("apikey"), "fixture-database-key");
          assertEquals(
            headers.get("authorization"),
            "Bearer fixture-database-key",
          );
          if (url.pathname === "/rest/v1/bounty_executions") {
            calls.push("read");
            assertEquals(init?.method ?? "GET", "GET");
            assertEquals(url.searchParams.get("id"), "eq.bounty-123");
            assertEquals(url.searchParams.get("limit"), "1");
            assertStringIncludes(
              url.searchParams.get("select") ?? "",
              "description",
            );
            return Response.json([bounty]);
          }
          if (url.pathname === "/rest/v1/outreach_sent") {
            calls.push("persist");
            assertEquals(init?.method, "POST");
            stored = JSON.parse(String(init?.body));
            return new Response(null, { status: 201 });
          }
        }
        const requestBody = JSON.parse(String(init?.body));
        assertEquals(init?.method, "POST");
        assertEquals(headers.get("content-type"), "application/json");
        assertEquals(headers.get("apikey"), null);
        calls.push("infer");
        if (provider === "groq") {
          assertEquals(
            url.toString(),
            "https://api.groq.com/openai/v1/chat/completions",
          );
          assertEquals(
            headers.get("authorization"),
            "Bearer fixture-provider-key",
          );
          assertEquals(requestBody.model, expectedModel);
          assertEquals(requestBody.response_format, { type: "json_object" });
          assertStringIncludes(
            requestBody.messages[0].content,
            bounty.description!,
          );
          return Response.json({
            choices: [{ message: { content: JSON.stringify(validContent()) } }],
          });
        }
        assertEquals(
          url.toString(),
          `https://generativelanguage.googleapis.com/v1beta/models/${expectedModel}:generateContent`,
        );
        assertEquals(headers.get("x-goog-api-key"), "fixture-provider-key");
        assertEquals(headers.get("authorization"), null);
        assertEquals(
          requestBody.generationConfig.responseMimeType,
          "application/json",
        );
        assertStringIncludes(
          requestBody.contents[0].parts[0].text,
          bounty.description!,
        );
        return Response.json({
          candidates: [{
            content: { parts: [{ text: JSON.stringify(validContent()) }] },
          }],
        });
      };
      await withProductionMocks(environment, mockFetch, async () => {
        const result = await generate_content("bounty-123");
        assertEquals(calls, ["read", "infer", "persist"]);
        assertEquals(stored?.bounty_id, "bounty-123");
        assertEquals(stored?.channel, "content_agent");
        assertEquals(JSON.parse(String(stored?.content)), result);
        assert(Number.isFinite(Date.parse(String(stored?.sent_at))));
      });
    }
  }
});

Deno.test("production HTTP failures stop the pipeline and surface the failing adapter", async () => {
  for (const failure of ["read", "infer", "persist"]) {
    const calls: string[] = [];
    const mockFetch: typeof fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      let stage: string;
      if (
        url.hostname === "database.example.test" &&
        url.pathname === "/rest/v1/bounty_executions"
      ) stage = "read";
      else if (
        url.toString() === "https://api.groq.com/openai/v1/chat/completions"
      ) stage = "infer";
      else if (
        url.hostname === "database.example.test" &&
        url.pathname === "/rest/v1/outreach_sent"
      ) stage = "persist";
      else throw new Error("Unexpected mocked request");
      calls.push(stage);
      if (stage === failure) {
        return new Response("fixture failure", { status: 503 });
      }
      if (stage === "read") return Response.json([bounty]);
      if (stage === "infer") {
        return Response.json({
          choices: [{ message: { content: JSON.stringify(validContent()) } }],
        });
      }
      return new Response(null, { status: 201 });
    };
    await withProductionMocks(
      {
        SUPABASE_URL: "https://database.example.test",
        SUPABASE_SERVICE_ROLE_KEY: "fixture-database-key",
        GROQ_API_KEY: "fixture-provider-key",
      },
      mockFetch,
      async () => {
        const message = failure === "read"
          ? "Failed to read bounty: HTTP 503"
          : failure === "infer"
          ? "Groq provider failed with HTTP 503"
          : "Failed to persist generated content: HTTP 503";
        await assertRejects(
          () => generate_content("bounty-123"),
          Error,
          message,
        );
        const expected = ["read", "infer", "persist"];
        assertEquals(calls, expected.slice(0, expected.indexOf(failure) + 1));
      },
    );
  }
});
