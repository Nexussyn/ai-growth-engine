/**
 * Auto-upsell trigger tests — Issue #3
 *
 * Covers the acceptance criteria:
 *   - correct threshold detection (fires at 50% of free calls)
 *   - no double-trigger (idempotent across repeated calls)
 *   - the response header is set exactly when a prompt is emitted
 */

import { assertEquals, assert, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  applyUpsellMiddleware,
  buildPrompt,
  createMemoryUpsellStore,
  evaluateUpsell,
  FREE_CALL_LIMIT,
  isUpsellThreshold,
  pickVariant,
  UPSELL_HEADER,
  UPSELL_THRESHOLD,
  upsellHeaders,
} from "../src/monetization/upsell.ts";

Deno.test("threshold is 50% of the free call limit", () => {
  assertEquals(FREE_CALL_LIMIT, 10);
  assertEquals(UPSELL_THRESHOLD, 5);
});

Deno.test("threshold detection: below, at, and above the boundary", () => {
  assertFalse(isUpsellThreshold(0));
  assertFalse(isUpsellThreshold(4));
  assert(isUpsellThreshold(5));
  assert(isUpsellThreshold(6));
  assert(isUpsellThreshold(100));
  // Non-finite counts never trigger.
  assertFalse(isUpsellThreshold(Number.NaN));
  assertFalse(isUpsellThreshold(Number.POSITIVE_INFINITY));
});

Deno.test("fires exactly once on the 5th call", async () => {
  const store = createMemoryUpsellStore();

  const call4 = await evaluateUpsell("user-1", 4, store);
  assertEquals(call4.upsell, false);

  const call5 = await evaluateUpsell("user-1", 5, store);
  assertEquals(call5.upsell, true);
  assertEquals(call5.triggerType, "free_limit_50pct");
  assert(call5.prompt && call5.prompt.length > 0);

  const call6 = await evaluateUpsell("user-1", 6, store);
  assertEquals(call6.upsell, false, "must not re-trigger after firing");
  assertEquals(call6.prompt, undefined);
});

Deno.test("repeat calls at the same threshold never double-trigger", async () => {
  const store = createMemoryUpsellStore();
  const results = await Promise.all(
    Array.from({ length: 10 }, () => evaluateUpsell("user-dup", 5, store)),
  );
  assertEquals(results.filter((r) => r.upsell).length, 1);
});

Deno.test("concurrent threshold crossings trigger once", async () => {
  const store = createMemoryUpsellStore();
  const [a, b, c] = await Promise.all([
    evaluateUpsell("user-race", 5, store),
    evaluateUpsell("user-race", 5, store),
    evaluateUpsell("user-race", 5, store),
  ]);
  assertEquals([a.upsell, b.upsell, c.upsell].filter(Boolean).length, 1);
});

Deno.test("skipping past the threshold still triggers (crossing, not equality)", async () => {
  const store = createMemoryUpsellStore();
  const decision = await evaluateUpsell("user-skip", 7, store);
  assertEquals(decision.upsell, true);
});

Deno.test("each user is triggered independently", async () => {
  const store = createMemoryUpsellStore();
  assertEquals((await evaluateUpsell("u-a", 5, store)).upsell, true);
  assertEquals((await evaluateUpsell("u-b", 5, store)).upsell, true);
});

Deno.test("A/B variants are stable per user and both render the counts", () => {
  assertEquals(pickVariant("user-1"), pickVariant("user-1"));
  const a = buildPrompt("A", 5);
  const b = buildPrompt("B", 5);
  assert(a.includes("5"));
  assert(a.includes("10"));
  assert(b.includes("5"));
  assert(b.includes("10"));
  assert(a !== b, "variants must differ for A/B testing");
});

Deno.test("header is present only when a prompt fires", () => {
  assertEquals(upsellHeaders({ upsell: true, triggerType: "x", prompt: "p" }), {
    [UPSELL_HEADER]: "true",
  });
  assertEquals(upsellHeaders({ upsell: false, triggerType: "x" }), {});
});

Deno.test("middleware adds the header on the threshold call only", async () => {
  const store = createMemoryUpsellStore();

  const r4 = await applyUpsellMiddleware(new Response("ok"), "mw-user", 4, store);
  assertEquals(r4.headers.get(UPSELL_HEADER), null);
  assertEquals(await r4.text(), "ok");

  const r5 = await applyUpsellMiddleware(new Response("ok"), "mw-user", 5, store);
  assertEquals(r5.headers.get(UPSELL_HEADER), "true");

  const r6 = await applyUpsellMiddleware(new Response("ok"), "mw-user", 6, store);
  assertEquals(r6.headers.get(UPSELL_HEADER), null);
});

Deno.test("middleware never breaks the response on store failure", async () => {
  const brokenStore = {
    hasTriggered: () => Promise.reject(new Error("db down")),
    recordTrigger: () => Promise.reject(new Error("db down")),
  };
  const res = await applyUpsellMiddleware(new Response("payload", { status: 201 }), "u", 5, brokenStore);
  assertEquals(res.status, 201);
  assertEquals(await res.text(), "payload");
  assertEquals(res.headers.get(UPSELL_HEADER), null);
});
