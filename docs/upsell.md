# One-time upsell threshold

Apply `migrations/add_upsell_triggers.sql` before using the middleware. It can be
applied repeatedly without erasing existing decisions. A unique `(user_id,
trigger_type)` row makes the database the authority: only the request that inserts
the row receives `upsell: true`. Previously repeated calls at count 5 returned true
even when `ON CONFLICT DO NOTHING` inserted nothing.

The host API should supply its authenticated user ID and authoritative count of
completed free calls; never trust these values from a request body. Wrap a successful
handler response using `withUpsell(response, supabaseClient, userId, freeCallCount,
variant)` from `src/monetization/upsell.ts`. The returned `response` carries
`X-Upsell-Prompt: true` only for the winning request. The accompanying `decision`
contains the prompt and A/B variant for the host to include in its existing response
schema. Assign a stable A/B variant in the host. The helper does not rewrite bodies.

This targets the issue's fifth-of-ten-free-calls rule, independently of pricing's
50-call tier. It does not claim exactly-once delivery if a network response is lost
after the database claim; the claim is at-most-once. RPC failures propagate so the
host can apply its existing error policy. Do not rerun a business handler on failure.

No host endpoint is included in this repository, so this PR supplies the integration
helper rather than claiming it is deployed on the live API.

## Verification

With Node.js 24+, run `npm ci --ignore-scripts` and `npm run test:upsell`.
The SQL test uses in-memory PGlite PostgreSQL, requires no production credentials,
and checks repeated migration, duplicate requests, independent users, and row counts.
It does not simulate separate PostgreSQL sessions. Existing pricing tests remain
available via `deno test tests/pricing.test.ts`.
