# Content generation validation

The existing agent could report success after an `outreach_sent` insert failed,
announce an unfinished bounty, and store a different tweet from the returned
truncated version. The shared core now validates every output before persistence
and returns the same content that was saved. It requires `execution_status=done`.

Run with Node supporting TypeScript stripping (tested on the bundled runtime):

```
node --experimental-strip-types --experimental-vm-modules --test tests/content-agent.test.ts tests/content-adapter.test.mjs
```

Five tests exercise mock bounties/providers/storage, including the actual edge
adapter evaluated with mocked Deno and Supabase imports. They cover valid content,
failed lookups, unfinished tasks, invalid lengths, model failures, failed inserts,
and success response consistency. There are no live model calls, database writes,
service signups, or social posts in these tests. Type stripping is not type checking;
the Deno deployment and real provider APIs have not been exercised.

Deployment must supply `GROQ_MODEL` or `GEMINI_MODEL` alongside its existing API
key, replacing retired hardcoded defaults. Choose a supported model within your
account's permitted quota; no free quota or cost is guaranteed by this code.
The existing database row must expose `execution_status` on `bounty_executions`;
the adapter fails closed on missing columns or failed lookups. No new schema is
invented. Description and PR metadata provide context; add verified outcome data
to the source record if it is not already in its description.

Tweets use a 280 Unicode-code-point limit, not X's weighted URL/character rules.
Threads must have exactly five nonempty entries. Blog length is exactly 300
whitespace-separated words. Invalid generations fail without silent truncation,
partial storage, or automatic paid retries. Prompts are specific to each bounty;
semantic originality/factual correctness still need editorial review. Treating
source data as untrusted in the prompt is not a complete injection defense.

The existing HTTP entry point remains dependent on the deployment's authenticated
gateway. Do not expose a service-role endpoint anonymously. Repeated successful
requests can create repeated storage rows; persistent deduplication and trigger
delivery guarantees require a separately specified storage constraint. No automatic
Twitter publication, social-card image generation, or revenue gain is claimed.
