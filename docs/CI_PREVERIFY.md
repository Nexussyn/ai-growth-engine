# CI pre-verify — PR #23 (issue #5)

Local run matching **Autonomous Bounty Validator** `deno test` step.

| Field | Value |
|-------|-------|
| Date | 2026-07-04T09:56 UTC |
| Head | `862b688` |
| Deno | 2.9.1 (stable) |
| Command | `deno test --allow-env tests/content-agent.test.ts` |
| Result | **21 passed, 0 failed** (68ms) |
| Secrets | None (injectable store + mock LLM) |

## Test output

```
running 21 tests from ./tests/content-agent.test.ts
generateContent returns tweet, thread, blog_post ... ok
generateContent stores payload in outreach_sent ... ok
generateContent throws when bounty missing ... ok
content is unique per bounty id even with identical LLM output ... ok
thread parser normalizes fewer than 5 LLM segments ... ok
content_hash differs per bounty id with identical LLM output ... ok
stableHash is deterministic ... ok
generate_content snake_case alias matches generateContent ... ok
postToTwitterIfConfigured skips when poster is null ... ok
postToTwitterIfConfigured posts tweet and thread segments ... ok
shouldPostToTwitter blocks low-reward bounties ... ok
shouldPostToTwitter enforces min hours between posts ... ok
postToTwitterIfConfigured skips when rhythm gate blocks ... ok
resolvePostRhythm reads last_post_at from store ... ok
postToTwitterIfConfigured records twitter cadence in store ... ok
postToTwitterIfConfigured blocks when store shows recent tweet ... ok
fixture bounty-tiered-pricing produces valid outreach ... ok
fixture bounty-referral-loop produces valid outreach ... ok
fixture bounty-content-agent produces valid outreach ... ok
fixture bounty-mobile-landing produces valid outreach ... ok
fixture bounty-upsell-trigger produces valid outreach ... ok

ok | 21 passed | 0 failed (68ms)
```

## Maintainer action

Fork CI is blocked until **Approve and run workflows** on [PR checks](https://github.com/Nexussyn/ai-growth-engine/pull/23/checks). After approval, validator auto-merges and triggers Supabase payout.

Wallet: `0x028a964901762571022C5f2C9b66717a1c25886F`
