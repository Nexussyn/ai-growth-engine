# Fifth-call upgrade prompt

Apply `migrations/add_upsell_triggers.sql` using the normal migration process.
It can be reapplied to an existing installation without clearing prior triggers.
The unique `(user_id, trigger_type)` row decides which request wins; a retry
returns `upsell: false`. No read-before-write check or process-local cache is
used.

After a successful free call and its usage-count commit, call the middleware:

```ts
import { applyUpsell } from "../src/monetization/upsell.ts";

// Read identity, plan and committed count from trusted server context, never
// from query parameters or client-supplied usage headers.
const response = await handleCall(request);
if (!response.ok) return response;
const usage = await recordSuccessfulCallAndReadUsage(authenticatedUser);
return await applyUpsell(response, {
  userId: authenticatedUser.id,
  callCount: usage.freeCalls,
  isFree: usage.isFree,
  pattern: usage.isBatch ? "batch" : "interactive",
}, supabase);
```

`supabase` is an existing server-side client with permission to invoke
`check_upsell_trigger`. No credentials or live service are included. This repo
has no HTTP server entry point to wire directly; the snippet shows the required
call site. Never expose arbitrary-user writes through an unauthenticated client.

The winning response keeps its body, status and existing headers, and adds:

- `X-Upsell-Prompt: true`
- `X-Upsell-Text`: an interactive or batch-specific message
- `X-Upsell-Variant: A` or `B`

Assignment is stable per user. A fourth argument can supply an existing A/B
experiment's variant. The prompt does not claim unlimited access or a measured
conversion improvement. If a browser reads these headers across origins, expose
them in the server's existing CORS policy. Personalized responses must not be
stored in a shared cache.

This implements the issue's **5 of 10** free-call policy. The separate pricing
module currently uses **50** free calls and is unchanged; choose the correct
product policy before integration. Paid calls, failures and other counts never
consume a trigger. Store errors or malformed RPC replies reject instead of
inventing a prompt; the application chooses its error/fallback policy.

The guarantee is at most one committed trigger for a user and trigger type, not
proof that the user saw a response. Network loss after the insert can lose the
prompt. A transaction rollback allows a subsequent attempt; migration reruns do
not reset the trigger. Recurring quota periods are outside this fixed policy.

## Verification

```sh
deno test --allow-read --allow-env tests/
deno fmt --check src/monetization/upsell.ts tests/upsell.test.ts
deno lint src/monetization/upsell.ts tests/upsell.test.ts
```

The regression test fails against the original migration on the second call.
PGlite executes the actual SQL, covering retries, queued parallel attempts,
rollback, distinct users, boundaries and migration reruns. PGlite serializes
queries; these tests do not simulate PostgreSQL's multi-connection scheduler.
Middleware tests also cover response preservation, A/B and usage patterns, paid
and failed calls, invalid counts and storage errors. Dependencies are pinned in
imports and `deno.lock`. There is no production deployment or paid API call.
