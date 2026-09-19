# Fifth-call upsell

Apply `migrations/add_upsell_triggers.sql` to install or update the trigger RPC.
The existing unique `(user_id, trigger_type)` constraint arbitrates concurrent
requests; only the call that inserts a row returns `upsell: true`.

Call the middleware after successfully recording a free call, before returning
the API response. Supply the authenticated user ID and the updated free-call
count from trusted server-side accounting, not request parameters. This implements
issue #3's fifth-of-ten threshold; it does not change the separate pricing engine.

```ts
import { applyUpsell } from '../src/monetization/upsell.ts';

return await applyUpsell(response, {
  userId,
  callCount,
  usagePattern: 'frequent',
  variant: 'B',
}, (name, args) => supabase.rpc(name, args));
```

The host supplies `usagePattern` (`occasional` or `frequent`) and an optional
experiment assignment (`A` or `B`). Defaults are occasional usage and variant A.
Both variants have usage-specific text. The response includes
`X-Upsell-Prompt: true`, `X-Upsell-Message`, and `X-Upsell-Variant` only when the
RPC reports a newly inserted trigger. Existing status, headers and body stream
are preserved. Return the middleware's response and leave its body unread until
the HTTP server sends it. RPC failures leave the original response unchanged.

The database stores one trigger per user and trigger type. There is no billing
cycle reset in the current schema. The deployed API handler is not part of this
repository; its owner must wire this helper into that handler.

## Tests

```sh
deno test tests
psql -X -v ON_ERROR_STOP=1 -d upsell_test_database -f tests/upsell.sql
```

Use a local disposable PostgreSQL database. The SQL regression creates an
isolated schema inside a transaction and rolls it back. It checks the fourth,
fifth and sixth calls, repeat suppression, stored metadata and independent users.

For a concurrency check, apply the migration in the disposable database. In one
psql session, run the following with a fresh test user:

```sql
BEGIN;
SELECT check_upsell_trigger('concurrent-test-user', 5); -- upsell: true
```

In a second session, run the same `SELECT`. It waits until the first session runs
`COMMIT`, then returns `upsell: false`. There must be exactly one stored row for
that user.
