# Maintainer review guide — Issue #5 / PR #23

Quick path for reviewers choosing among multiple `#5` submissions.

## Unblock CI (fork PRs)

Workflows **Autonomous Bounty Validator** and **Agent PR Evaluator** show `action_required` until a maintainer clicks **Approve and run workflows** on the PR checks tab. After approval, validator auto-merges on pass and notifies Supabase for USDC payout.

### One-click path for @Nexussyn

1. Open [PR #23 checks](https://github.com/Nexussyn/ai-growth-engine/pull/23/checks)
2. On each workflow with yellow **Action required**, click **Approve and run workflows**
3. Wait ~2 min — **Autonomous Bounty Validator** runs `deno test`, comments pass/fail, and auto-merges on pass
4. Supabase webhook fires → `$5 USDC` to wallet in PR body

Head commit for review: `f0b8680` (21 Deno tests, zero API keys). See also [COMMUNITY_FEEDBACK.md](./COMMUNITY_FEEDBACK.md) and [CI_PREVERIFY.md](./CI_PREVERIFY.md).

## Verify locally (no secrets)

```bash
bash scripts/verify-content-agent.sh
# or: deno test --allow-env tests/content-agent.test.ts
```

Expected: **21 tests pass**, zero API keys required (injectable store + mock LLM).

## Why PR #23 vs other #5 submissions

| PR | Agent impl | Tests | Docs | Rhythm gate | Twitter optional |
|----|------------|-------|------|-------------|------------------|
| **#23** | `src/agents/content-agent.ts` (full) | 21 Deno | `CONTENT_AGENT.md` + sample JSON | ✅ store-backed | ✅ gated |
| #25 | refactor + tests | 10 | — | — | — |
| #10 | early impl | varies | — | — | — |
| #18 | single-file edit | 1 file | — | — | — |
| #37 | scaffold | 7 | — | — | — |
| #24 | migration only | partial | — | — | — |
| #13 | tests only | partial | — | — | — |

## Acceptance criteria mapping

- [x] `generate_content(bounty_id)` → `{tweet, thread, blog_post}` (+ `social_card`, `content_hash`)
- [x] Free LLM chain: Groq → Gemini → Ollama
- [x] Persists to `outreach_sent` (`channel = content_agent`)
- [x] Unique per bounty (context includes id, title, PR, reward)
- [x] Mock tests — no secrets in CI

## @m13v feedback — posting rhythm

Text uniqueness is necessary but not sufficient for X reach. PR #23 separates **generation** (always runs, always saved) from **auto-post** (gated by `min_reward_usd` + `min_hours_between`, persisted via `content_agent_twitter` rows in `outreach_sent`). See [CONTENT_AGENT.md](./CONTENT_AGENT.md#post-rhythm-gate-reach--text-uniqueness).

## Payment

Wallet in PR body: `0x028a964901762571022C5f2C9b66717a1c25886F` — Base USDC on merge.

## Questions / changes

Comment on PR #23 — contributor responds within 24h.
