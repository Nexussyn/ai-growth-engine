# Verification and integration

`checkUpsell` is a response-middleware helper. Call it after recording the authenticated user's fifth free call, pass the server-side user ID/count, then merge its returned headers into the response and present its prompt if provided. The caller may choose A/B experiment assignment and steady/burst usage classification. Never trust those identity/count values from an unauthenticated request.

Apply `migrations/add_upsell_triggers.sql` using your normal migration process. It preserves the existing unique `(user_id, trigger_type)` constraint. `GET DIAGNOSTICS ROW_COUNT` makes a conflicting insertion return `upsell=false`, instead of repeating a success response.

Local verification with Node 22+ (TypeScript stripping) and PGlite 0.5.8:

```sh
npm install --no-save @electric-sql/pglite@0.5.8
node --experimental-strip-types --test tests/upsell.test.ts tests/upsell-db.test.ts
```

Four tests pass, including actual PostgreSQL SQL executed locally in PGlite: migration rerun, fifth-call boundaries, repeated calls, overlapping queued callers, rollback and retry, invalid inputs, plus RPC-to-middleware integration. The original migration was independently reproduced returning `upsell=true` twice for one user's fifth call.

PGlite serializes its connection; the overlapping-caller test is not a multi-backend PostgreSQL concurrency test. Unique-index arbitration is provided by PostgreSQL. No production database, revenue measurement, or production deployment was performed. Existing Deno pricing tests were not run; pricing files are unchanged.

Delivery is at most once per stored user/type: if a response is lost after commit, retry cannot promise display. This preserves the existing one-time lifetime trigger; billing-period resets are outside this issue. No unlimited-plan promise is made in the generated text.
