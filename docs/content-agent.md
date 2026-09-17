# Content drafts from completed bounties

`generateContent(bountyId)` and `generate_content(bountyId)` return
`{ tweet, thread, blog_post }` only after persistence succeeds. Importing the module
does not read environment variables, connect to Supabase, or start an HTTP server.
Running it as the Deno entry point starts the POST handler.

Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for runtime use. The existing
`bounty_executions` table must expose `execution_status` and the existing title,
description, reward, repository and PR columns; only `done` records are eligible.
The existing `outreach_sent` table stores the JSON content under the original
`content_agent` channel. Schema/deployment credentials are not included here.

Configure `GROQ_API_KEY` or `GEMINI_API_KEY`. Groq is selected when both are set;
otherwise Gemini is used. `GROQ_MODEL` and `GEMINI_MODEL` override model defaults
(`llama-3.3-70b-versatile`, `gemini-2.5-flash`). Account quotas/billing are configured
by the operator; this code makes no unlimited-free-use promise. Requests time out
after 30 seconds and failed/empty provider responses raise errors. No automatic
provider retries, social posting, or paid account setup are performed.

Every prompt includes the bounty's actual scope and PR context. Draft validation
requires one nonempty tweet and exactly five nonempty thread entries, each at most
280 Unicode code points, plus a roughly 300-word blog (250-350 whitespace-separated
words). This is not Twitter's weighted character algorithm. Invalid output fails
without storage, rather than silently truncating text. Generated factual accuracy
and originality still require review; distinct prompts do not prove uniqueness.

Failures reading/storing data propagate; the HTTP handler returns a generic error
without database/provider details. Retried successful jobs may create additional
draft rows: no uniqueness guarantee or event subscription is introduced here. The
existing completion-event caller must invoke the function. The host must retain its
authentication controls; the handler does not independently authenticate callers.

## Tests

Run `deno test tests/pricing.test.ts tests/content-agent.test.ts` (no runtime
environment, network, or listener permissions). Tests inject mock bounty storage
and model responses and verify valid output, per-bounty context, incomplete jobs,
bad output, persistence failure, import safety, and HTTP behavior. Deno may download
module dependencies during its initial dependency-resolution step. Production
database/provider integration and actual draft quality are not verified by these tests.
