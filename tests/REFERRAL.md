# Referral reward integration

This change implements issue #2's referral module. Main previously awarded
credits for an unpaid user or self-referral; it only incremented code statistics,
and had no application balance, notifications, TypeScript wrapper, or tests.

## Trusted backend integration

1. Apply `migrations/add_referral_system.sql` in a transaction. Existing users
   converted under multiple codes must be reconciled before the new unique index
   can be created. The migration does not delete records or award historical
   balances again. Existing historical awards require a separate reconciliation.
2. Only after verifying a settled first paid call, the billing worker inserts
   `referral_paid_users(user_id, first_payment_id)`. Never accept payment IDs or
   qualification assertions directly from an untrusted request. The table's
   uniqueness prevents one payment from qualifying several accounts.
3. Call `process_referral(client, referral_code, authenticated_user_id)` with a
   backend Supabase-compatible RPC client. SQL returns `not_qualified` before
   payment, and `already_processed` on replay, including a different code.
4. Use `referral_credit_balances.balance` as the referral credit source when
   integrating the application's usage billing. This is a module-owned balance;
   the public repository provides no host balance schema or billing worker.
5. The host UI/notification worker must read `referral_notifications` for each
   authenticated recipient. Rows for both parties commit atomically with credits
   and the event; IDs are stable for consumer deduplication. No external messages
   are sent by this module. Actual UI display needs the host integration.

Use a dedicated trusted backend database role and explicitly grant only required
function/table permissions. `process_referral` is invoker-rights and PUBLIC
execution is revoked. Do not grant browser/anonymous roles access to qualification,
credit, conversion, or notification writes. This repository does not publish the
deployment's existing role grants/RLS policies; review those before deployment.

The first accepted conversion wins. Self-referrals never earn credits. A failure
in any write rolls back all conversion effects. This module handles free service
credits only, not money transfers. Refund/reversal policy and notification UI
are host responsibilities; no live deployment or conversion increase is claimed.

## Validation

With Node supporting TypeScript stripping and an independently installed PGlite:

```powershell
$env:PGLITE_MODULE='file:///absolute/path/to/pglite/dist/index.js'
node --experimental-strip-types --test tests/referral.test.ts
```

Two test cases cover actual SQL migration replay, unpaid/self-referral guards,
five-credit balances, cross-code duplicates, event/notification recipients,
forced notification failure rollback, successful retry, and malformed RPC replies.
PGlite queues the overlapping attempts on a single connection; this is not a
multi-backend PostgreSQL concurrency test. Unique constraints and transactional
updates arbitrate duplicate writes on PostgreSQL. Production permissions, host
billing, and live notification delivery have not been exercised.
