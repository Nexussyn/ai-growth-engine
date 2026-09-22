# Referral credits — abuse-resistance notes & integration guide

Closes #2. This closes the bug where `process_referral()` on `main` awards 5
credits for **any** conversion row, including unpaid signups and
self-referrals, and only ever mutates `referral_codes`' aggregate counters
(no per-user balance, no notification, no record of denied attempts).

## What changed

`migrations/add_referral_credits.sql` is additive — it does not drop, rename,
or alter the shape of any existing table or column — and replaces
`process_referral()` with a version whose first two parameters are unchanged
(a third, `p_idempotency_key`, defaults to `NULL`), so existing two-argument
callers keep working unmodified.

New tables, all owned by this module:

| Table | Purpose |
|---|---|
| `referral_qualifying_payments` | Host-owned evidence. One row per user, written by the **host's billing worker** the moment that user's first payment settles. `process_referral()` never infers payment on its own — absence of a row here is treated as unpaid. |
| `referral_credit_balances` | Atomic per-user credit balance (`balance >= 0`, `CHECK` enforced). |
| `referral_recipients` | One row per user ever successfully referred, `referred_user_id` as primary key. Enforces duplicate prevention **across different codes** — a user can only ever be credited to one referrer, once. |
| `referral_notifications` | Durable notification rows for both the referrer and the referred user. |
| `referral_events` | Append-only audit trail of every award **and** every denial, keyed by an optional `idempotency_key`. |

## Denial-reason taxonomy

`process_referral()` no longer silently no-ops. It always returns one of:

```jsonc
{ "status": "ok", "reason": null, "credits_awarded": 5, "owner_id": "..." }
{ "status": "denied", "reason": "INVALID_INPUT" }   // empty/null code or user id
{ "status": "denied", "reason": "INVALID_CODE" }    // code does not exist
{ "status": "denied", "reason": "SELF_REFERRAL" }   // owner_id == new_user_id
{ "status": "denied", "reason": "UNPAID" }          // no row in referral_qualifying_payments
{ "status": "denied", "reason": "DUPLICATE_PAIR" }  // user already credited under a different code
{ "status": "already_processed", "reason": "DUPLICATE_CODE" } // exact (code, user) replay
```

Every one of these — award or denial — is also written to `referral_events`
(`status`, `reason`, full `result` JSONB). Point host-side alerting at rows
where `reason IN ('UNPAID', 'SELF_REFERRAL', 'DUPLICATE_PAIR')` clustering on
one `new_user_id` or IP/device — that pattern is what abuse looks like: many
denied attempts against paid-gated rewards. `status = 'ok'` volume vs. denied
volume over time is the honest signal for whether the referral loop is being
gamed.

## Idempotency

`process_referral(p_code, p_new_user_id, p_idempotency_key)` accepts an
optional key. If a row with that key already exists in `referral_events`,
the stored `result` is returned verbatim without re-evaluating anything — a
retried call (flaky billing worker, network retry, duplicate webhook
delivery) can never double-award. If the underlying call fails part-way
(for example the notification insert raises), the entire function
invocation rolls back as a unit — including the `referral_events` row — so
the idempotency key is free for a genuine retry to succeed fresh. This
relies on Postgres's normal transaction semantics for a single function
call; no manual savepoint/rollback logic was added or is needed.

## Integration limits — what the host still has to do

This module is additive and inert until the host calls it. Nothing here
changes existing behavior on merge by itself.

1. **Billing worker → `referral_qualifying_payments`.** The host must insert
   `(user_id, first_payment_at, source)` the moment a user's *first* payment
   settles (webhook handler, payment-confirmation job — wherever "paid" is
   decided today). Until that write happens, every referral for that user is
   denied as `UNPAID`. This repo has no billing worker or payments table, so
   that integration point could not be built or tested here.
2. **Call site.** Wherever the host currently calls the old
   `process_referral(code, new_user_id)` two-argument RPC (typically at
   signup, or when the first-payment webhook fires), switch to
   `processReferral(db, code, newUserId, { idempotencyKey })` from
   `src/growth/referral.ts`, generating the idempotency key from the
   triggering event's own id (e.g. the payment webhook's event id) so
   webhook retries are naturally deduped.
3. **Notification UI.** Query `referral_notifications WHERE user_id = $1
   AND read_at IS NULL ORDER BY created_at DESC` for the recipient's unread
   notifications; mark `read_at = NOW()` on display. This repo has no
   notification UI, so only the durable rows are provided.
4. **Credit consumption.** `referral_credit_balances.balance` is additive
   only — this migration never decrements it. Billing/usage code that
   currently checks a user's credit balance needs to also read and decrement
   this table when applying referral credits to a call.
5. **Reconciliation.** Existing `referral_conversions` rows written by the
   old, buggy function (including any unpaid/self-referral/duplicate awards
   already on `main`) are not touched or reconciled by this migration — no
   historical balance is fabricated. If the host wants those balances
   corrected, that is a separate, explicit backfill decision, not something
   this PR does silently.

## What was actually validated, and how

Two independent validation passes were run for this submission (see the
"Evidence" section of the PR description for exact commands/output):

1. **`tests/referral.test.ts`** contains 23 Deno unit tests against
   `src/growth/referral.ts` covering: valid `ok`/`denied`/`already_processed`
   reply parsing, every denial-reason value, rejection of malformed RPC
   replies (non-object, missing `status`, unknown `status`/`reason`,
   `ok` status carrying a reason, `ok` status missing `credits_awarded` or
   `owner_id`, non-numeric `credits_awarded`), empty/non-string input
   rejection, and `processReferral()`'s wiring (input short-circuits before
   the RPC call, idempotency key passthrough, RPC-error propagation).
   **Caveat:** the `deno` binary is not installed in the validation
   sandbox this submission was built in, so `deno test`/`deno check`/
   `deno lint` were not actually executed here — only manually inspected
   for consistency with `referral.ts`'s reply-shape contract. Run
   `deno test tests/referral.test.ts && deno check tests/referral.test.ts
   src/growth/referral.ts && deno lint tests/referral.test.ts
   src/growth/referral.ts` in an environment with Deno installed before
   merging, and treat that as outstanding verification, not a fact already
   established by this PR.
2. **A local Node + PGlite 0.5.8 harness** (not part of this PR's file list
   — a throwaway validation script) applied
   `migrations/add_referral_system.sql` followed by
   `migrations/add_referral_credits.sql` against an in-memory Postgres and
   ran 23 scenario assertions directly against the SQL function: migration
   replay, unpaid guard, self-referral guard, happy-path award (balance,
   `referral_codes` stats, `system_events`, both notification rows,
   `referral_events` audit row), same-code duplicate, cross-code duplicate,
   invalid code, rollback on a simulated notification-write failure (trigger
   raises on insert; verified no balance/conversion/event row survives), and
   retry-after-rollback plus idempotency replay (both proving exactly one
   award, never two). Two further assertions in the same harness applied
   **only** the unmodified `add_referral_system.sql` (the current `main`
   `process_referral(code, new_user_id)`, two-argument form, no credits
   migration layered on top) and called it directly: an unpaid user and a
   self-referral both returned `{"status":"ok","credits_awarded":5}` and
   incremented `referral_codes.credits_awarded`, reproducing issue #2
   against the current code before this migration is applied. 25 assertions
   passed in total.

**Not tested, and not claimed:** multi-backend PostgreSQL concurrency
(PGlite is single-process; overlapping calls in the harness are serialized
by one backend, not proof against real MVCC/lock contention under
concurrent load), production role/grant configuration, and live
notification-UI rendering. No conversion-rate increase is claimed — only
that the specific unpaid/self-referral/duplicate-award bugs in #2 are
closed.
