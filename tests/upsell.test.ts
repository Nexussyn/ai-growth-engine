import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { PGlite } from "npm:@electric-sql/pglite@0.3.14";

const migration = await Deno.readTextFile(
  new URL("../migrations/add_upsell_triggers.sql", import.meta.url),
);

Deno.test("migration reports only the insert that wins, including after reapplication", async () => {
  const db = new PGlite();
  try {
    await db.exec(migration);
    const check = async (user: string, count: number | null) => {
      const result = await db.query<{ result: { upsell: boolean } }>(
        "SELECT check_upsell_trigger($1, $2) AS result",
        [user, count],
      );
      return result.rows[0].result.upsell;
    };
    for (const count of [0, 1, 4, 6, 10, null]) {
      assertEquals(await check("boundary", count), false);
    }
    assertEquals(await check("same-user", 5), true);
    assertEquals(await check("same-user", 5), false);
    await db.exec(migration);
    assertEquals(await check("same-user", 5), false);
    const attempts = await Promise.all(
      Array.from({ length: 20 }, () => check("parallel-user", 5)),
    );
    assertEquals(attempts.filter(Boolean).length, 1);
    assertEquals(await check("other-user", 5), true);
    await assertRejects(() => check("", 5));
    await db.exec("BEGIN");
    assertEquals(await check("rolled-back", 5), true);
    await db.exec("ROLLBACK");
    assertEquals(await check("rolled-back", 5), true);
    const rows = await db.query(
      "SELECT user_id FROM upsell_triggers ORDER BY user_id",
    );
    assertEquals(rows.rows.length, 4);
  } finally {
    await db.close();
  }
});

import {
  applyUpsell,
  promptFor,
  variantFor,
} from "../src/monetization/upsell.ts";
import type { UpsellClient, Usage } from "../src/monetization/upsell.ts";

const usage: Usage = { userId: "user-1", callCount: 5, isFree: true };
const winning: UpsellClient = {
  rpc: () => Promise.resolve({ data: { upsell: true }, error: null }),
};

Deno.test("successful call preserves response and adds contextual A/B headers", async () => {
  for (const variant of ["A", "B"] as const) {
    const original = new Response("result", {
      status: 201,
      statusText: "Created",
      headers: { "X-Request-ID": "123" },
    });
    const result = await applyUpsell(
      original,
      { ...usage, pattern: "batch" },
      winning,
      variant,
    );
    assertEquals(result.status, 201);
    assertEquals(result.statusText, "Created");
    assertEquals(await result.text(), "result");
    assertEquals(result.headers.get("X-Request-ID"), "123");
    assertEquals(result.headers.get("X-Upsell-Prompt"), "true");
    assertEquals(result.headers.get("X-Upsell-Variant"), variant);
    assertEquals(
      result.headers.get("X-Upsell-Text"),
      promptFor({ ...usage, pattern: "batch" }, variant),
    );
  }
  assertEquals(variantFor("user-1"), variantFor("user-1"));
  assertEquals(new Set(["user-1", "user-2"].map(variantFor)).size, 2);
  assertEquals(
    new Set(
      ["A", "B"].flatMap((v) =>
        ["batch", "interactive"].map((pattern) =>
          promptFor(
            { ...usage, pattern: pattern as Usage["pattern"] },
            v as "A" | "B",
          )
        )
      ),
    ).size,
    4,
  );
});

Deno.test("non-fifth, paid and failed calls do not touch the store or leak stale headers", async () => {
  const never: UpsellClient = {
    rpc: () => {
      throw new Error("unexpected RPC");
    },
  };
  for (
    const state of [{ ...usage, callCount: 4 }, { ...usage, callCount: 6 }, {
      ...usage,
      isFree: false,
    }]
  ) {
    const result = await applyUpsell(
      new Response(null, {
        headers: {
          "X-Upsell-Prompt": "true",
          "X-Upsell-Text": "stale",
          "X-Upsell-Variant": "A",
        },
      }),
      state,
      never,
    );
    assertEquals(result.headers.has("X-Upsell-Prompt"), false);
    assertEquals(result.headers.has("X-Upsell-Text"), false);
    assertEquals(result.headers.has("X-Upsell-Variant"), false);
  }
  assertEquals(
    (await applyUpsell(new Response(null, { status: 500 }), usage, never))
      .status,
    500,
  );
  assertEquals(
    (await applyUpsell(new Response(null, { status: 204 }), {
      ...usage,
      callCount: 6,
    }, never)).status,
    204,
  );
});

Deno.test("invalid usage and malformed/error RPC results fail without a prompt", async () => {
  for (const callCount of [NaN, Infinity, -1, 4.5, 2147483648]) {
    await assertRejects(
      () => applyUpsell(new Response(), { ...usage, callCount }, winning),
      TypeError,
    );
  }
  await assertRejects(
    () => applyUpsell(new Response(), { ...usage, userId: " " }, winning),
    TypeError,
  );
  for (const data of [null, {}, { upsell: "true" }]) {
    await assertRejects(() =>
      applyUpsell(new Response(), usage, {
        rpc: () => Promise.resolve({ data, error: null }),
      })
    );
  }
  await assertRejects(() =>
    applyUpsell(new Response(), usage, {
      rpc: () =>
        Promise.resolve({ data: { upsell: true }, error: "store failed" }),
    })
  );
});

Deno.test("middleware plus real SQL emits one header over repeated attempts", async () => {
  const db = new PGlite();
  try {
    await db.exec(migration);
    const client: UpsellClient = {
      rpc: async (name, args) => {
        assertEquals(name, "check_upsell_trigger");
        const result = await db.query<{ data: unknown }>(
          "SELECT check_upsell_trigger($1, $2) AS data",
          [args.p_user_id, args.p_call_count],
        );
        return { data: result.rows[0].data, error: null };
      },
    };
    const results = await Promise.all(
      Array.from(
        { length: 20 },
        () => applyUpsell(new Response("ok"), usage, client),
      ),
    );
    assertEquals(
      results.filter((r) => r.headers.get("X-Upsell-Prompt") === "true").length,
      1,
    );
    for (const result of results) assertEquals(await result.text(), "ok");
  } finally {
    await db.close();
  }
});
