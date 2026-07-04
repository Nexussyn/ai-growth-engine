# Content Generation Agent (Issue #5)

When a bounty merges (`execution_status = done`), the content agent turns the outcome into outreach assets and optionally posts to X/Twitter.

## Outputs

| Field | Spec |
|-------|------|
| `tweet` | ≤280 characters |
| `thread` | Exactly 5 tweets, each ≤280 chars |
| `blog_post` | ~300 words (260–330 word band) |
| `social_card` | `{ title, subtitle, footer }` for OG/card renderers |
| `content_hash` | FNV-1a fingerprint for dedup / audit |

All payloads persist to `outreach_sent` with `channel = content_agent`.

## Quick start

```bash
# Secret-free CI / local verify
bash scripts/verify-content-agent.sh

# Generate for a bounty id (requires Supabase + LLM env)
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
export GROQ_API_KEY=...   # or GEMINI_API_KEY, or Ollama on localhost

deno run --allow-env --allow-net src/agents/content-agent.ts
# POST {"bounty_id":"your-uuid"} to the served endpoint
```

Programmatic:

```typescript
import { generate_content } from './src/agents/content-agent.ts';

const content = await generate_content('bounty-uuid');
console.log(content.tweet, content.thread, content.blog_post);
```

## LLM providers (free tier)

Priority chain: **Groq Llama 3** → **Gemini 1.5 Flash** → **Ollama** (`OLLAMA_HOST`, default `http://127.0.0.1:11434`).

Tests inject a mock `LLMProvider` — no API keys in CI.

## Post rhythm gate (reach > text uniqueness)

Text uniqueness is necessary but not sufficient for X reach. Posting on every merge creates a fixed-cadence signal that platforms throttle regardless of copy diversity.

The agent separates **generation** (always runs, always saved) from **auto-post** (gated):

| Gate | Default | Env override |
|------|---------|--------------|
| Min reward to tweet | $5 USDC | `post_rhythm.min_reward_usd` |
| Min hours since last tweet | 6h | `post_rhythm.min_hours_between` |

```typescript
import { shouldPostToTwitter } from './src/agents/content-agent.ts';

shouldPostToTwitter(bounty, {
  min_reward_usd: 5,
  min_hours_between: 6,
  last_post_at: '2026-07-04T01:00:00.000Z', // from outreach_sent
});
```

When auto-post succeeds, a row is written to `outreach_sent` with `channel = content_agent_twitter` so the next run reads cadence from the database.

### Twitter env

| Variable | Purpose |
|----------|---------|
| `TWITTER_BEARER_TOKEN` or `X_API_BEARER` | Bearer token for v2 POST /tweets |
| `TWITTER_AUTO_POST=0` | Disable auto-post; still generate + store |

## Testing

```bash
deno test --allow-env tests/content-agent.test.ts
```

Coverage:

- Output shape and limits
- `outreach_sent` persistence
- Per-bounty uniqueness + `content_hash`
- Snake_case `generate_content` alias
- Twitter skip/post + rhythm gate
- All five mock bounty fixtures (`tests/mock-bounty-fixtures.ts`)

Sample output: [`examples/content-agent-sample.json`](../examples/content-agent-sample.json).

## Acceptance criteria mapping

- [x] `generate_content(bounty_id)` → `{ tweet, thread, blog_post }` (+ social_card, content_hash)
- [x] Free LLM providers (Groq / Gemini / Ollama)
- [x] Content stored in `outreach_sent`
- [x] Unique per bounty (context includes id, title, PR, reward)
- [x] Tests with mock bounty data — no secrets

## Payment

On merge, USDC is sent to the wallet in the PR body. See [AGENT_INTEGRATION.md](./AGENT_INTEGRATION.md).
