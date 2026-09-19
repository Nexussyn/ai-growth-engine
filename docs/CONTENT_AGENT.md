# Content generation from completed bounties

`generate_content(bountyId, dependencies?)` returns `{tweet, thread, blog_post}` only after
validating and storing that exact object. `generateContent` remains an alias for existing callers.
Importing the module does not read secrets, contact services or start a server.

The agent requires the bounty's actual `title`, `scope`, `outcome` and
`execution_status = done`. Incomplete records fail before generation. It requests original
content grounded in those values from an LLM, with instructions not to invent results.
Output must contain a nonempty tweet of at most
280 JavaScript string units, exactly five nonempty tweets with the same limit, and a
270–330-word blog post. Invalid JSON or lengths fail before storage, without truncating or
silently fabricating replacement content. These checks validate format, not factual accuracy;
review generated drafts before publishing.

## Free local generation

Install [Ollama](https://ollama.com/download), pull a local model (for example `ollama pull qwen3.5:9b`),
and run its local service. Set `OLLAMA_MODEL` to that installed model. `OLLAMA_URL` defaults to
`http://localhost:11434`; no cloud API keys or paid fallback are used. The adapter uses
[`POST /api/generate`](https://github.com/ollama/ollama/blob/main/docs/api.md) with
an explicit JSON output schema, `stream: false` and `think: false`. Sampling settings come
from the selected local model rather than overriding its temperature. Do not configure a
remote paid endpoint or cloud model. The schema helps constrain structure and length;
application validation still checks the exact word count before storage.
Requests cap generation at 2,200 tokens and abort after 120 seconds by default. For slower
local hardware, set `OLLAMA_TIMEOUT_MS` to a positive integer up to 600000 (ten minutes per
request). The injected adapter accepts the same timeout as its fourth argument. A timeout or truncated
output is an error, not a successful stored record.

Generation first produces and validates the blog, then generates social summaries from the
original facts with the blog as a draft reference. The source takes precedence over generated text.
The prompt labels scope as requested work and instructs the model not to treat a completion
record with a PR link as proof of technical details or reviews. This is a generation instruction,
not automatic factual verification. Sparse records can still produce unsupported claims.
Each phase allows one fresh repair using the original facts and validation error (including
actual blog word count), without repeating an erroneous draft. Length repair targets 275 words
for an overlong draft or 325 for a short draft; the accepted range remains 270–330. A second validation failure
aborts without storage. Provider and storage errors do not trigger repair. There are at most
four bounded generation calls, with one save only after both phases pass. The social prompt
targets 220 characters to leave headroom; the application still enforces the 280-character limit.
Invalid JSON or lengths are never recorded as successful content. Length validation
is intentionally conservative for UTF-16 text and is not an implementation of X's weighted
URL/Unicode character rules. The optional social posting feature is not implemented.

## Deployment integration contract

The legacy agent queried `bounty_executions`, whose schema is absent from this repository.
The default adapter instead reads `bounty_tasks`, documented in `system/schema-public.md`.
This change does not claim to verify or migrate the production database. It uses:

- `bounty_tasks`: `id`, `title`, `scope`, `execution_status`, `pr_url`. A completed record must
  have `execution_status = done` and a GitHub pull-request URL. The outcome supplied to the
  model is the factual completion record and that URL, not an invented technical result.
  The URL is validated syntactically; the agent trusts the completion record and does not
  independently query GitHub merge status. It does not treat requested scope as proven results.
- `outreach_sent`: existing `bounty_id`, `channel`, `content`, `sent_at` fields. `content` stores
  the serialized validated output; `channel` is `content_agent`. Here `sent_at` records generation
  storage time, not evidence that anything was posted to a social network.

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (legacy service-role JWT). All lookup and
insert HTTP failures are checked. For richer actual outcomes, supply a `ContentStore`
implementation that loads the verified result and persists output to `outreach_sent`;
do not substitute a guessed outcome. The dependency interface also
supports testing without database or model credentials.

Run the module with Deno's environment and network permissions to start its existing POST
entry point, sending `{"bounty_id":"..."}` after the trusted completion event. The deployment
must wire that event and retain its existing authentication/access controls. This module does
not register a webhook or alter deployment authentication. Repeated requests generate another
content record; deduplication is not an acceptance requirement of issue #5.

## Verification

`deno test tests/` exercises mocked bounty records, incomplete and missing records, malformed
model output, per-bounty context, identical stored/returned content, storage/provider failures,
the local Ollama HTTP shape, Supabase REST calls and the request handler. Tests do not need
network/environment permissions or a paid service. Existing pricing tests remain included.
These tests establish local behavior; they do not demonstrate live production database access,
live completion-event wiring, social publication, payment or increased revenue.

Local generation was also exercised with the Apache-2.0 Qwen3.5-9B Q4_K_M model through
Ollama 0.34.2, using its native renderer/parser. The tested non-thinking profile follows the
[model card](https://huggingface.co/Qwen/Qwen3.5-9B): temperature 0.7, top_p 0.8, top_k 20,
min_p 0, presence_penalty 1.5 and repeat_penalty 1. The local model used num_ctx 4096,
24 GPU layers and a 600000-millisecond request timeout on an RTX 2060 with 6 GB VRAM.
A rich record built from verified local upsell implementation/test facts produced a 312-word
blog, an 81-character tweet and five tweets of 81–160 characters after one blog repair.
The exact returned object was saved once to an in-memory store. Other distinct records also
met the format limits, but sparse records produced unsupported details and require editorial
review. Even the richer draft referred to response metadata as request metadata, illustrating
why review remains necessary. Provide detailed verified outcomes through `ContentStore` for useful reporting;
these local trials do not establish reliable factual generation from a bare completion flag.

To reproduce the tested local profile, save this as `Modelfile` after pulling `qwen3.5:9b`:

```text
FROM qwen3.5:9b
PARAMETER num_ctx 4096
PARAMETER num_gpu 24
PARAMETER temperature 0.7
PARAMETER top_p 0.8
PARAMETER top_k 20
PARAMETER min_p 0
PARAMETER presence_penalty 1.5
PARAMETER repeat_penalty 1
```

Run `ollama create bounty-qwen35 -f Modelfile`, set `OLLAMA_MODEL=bounty-qwen35` and
`OLLAMA_TIMEOUT_MS=600000`, then use the entry point or injected store described above.
The GPU layer count is the tested hardware setting, not a requirement of the agent.
