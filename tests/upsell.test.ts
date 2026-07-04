import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  attachUpsellHeaders,
  createUpsellTriggerRow,
  evaluateUpsell,
  UPSELL_HEADER,
  UPSELL_TRIGGER_TYPE,
} from "../src/monetization/upsell.ts";

Deno.test("does not trigger before the 50 percent free-call threshold", () => {
  const result = evaluateUpsell({ userId: "user_1", freeCallCount: 4 });

  assertEquals(result.shouldTrigger, false);
  assertEquals(result.headers, {});
});

Deno.test("triggers on the fifth free call and includes the expected header", () => {
  const result = evaluateUpsell({ userId: "user_1", freeCallCount: 5 });

  assertEquals(result.shouldTrigger, true);
  assertEquals(result.triggerType, UPSELL_TRIGGER_TYPE);
  assertEquals(result.headers[UPSELL_HEADER], "true");
  assertExists(result.prompt);
});

Deno.test("does not double-trigger after the user already has a trigger row", () => {
  const result = evaluateUpsell({
    userId: "user_1",
    freeCallCount: 6,
    alreadyTriggered: true,
  });

  assertEquals(result.shouldTrigger, false);
});

Deno.test("creates an idempotent trigger row for persistence", () => {
  const now = new Date("2026-07-04T12:00:00.000Z");
  const row = createUpsellTriggerRow({ userId: "user_1", freeCallCount: 5 }, now);

  assertExists(row);
  assertEquals(row.user_id, "user_1");
  assertEquals(row.trigger_type, UPSELL_TRIGGER_TYPE);
  assertEquals(row.shown_at, "2026-07-04T12:00:00.000Z");
  assertEquals(row.converted, false);
});

Deno.test("adds upsell headers to an existing response", async () => {
  const base = new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
  const result = evaluateUpsell({ userId: "user_1", freeCallCount: 5 });
  const response = attachUpsellHeaders(base, result);

  assertEquals(response.headers.get(UPSELL_HEADER), "true");
  assertEquals(response.headers.get("content-type"), "application/json");
  assertEquals(await response.json(), { ok: true });
});
