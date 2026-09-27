export interface Usage {
  /** Authenticated identity and committed count supplied by the server. */
  userId: string;
  callCount: number;
  isFree: boolean;
  pattern?: "interactive" | "batch";
}

export interface UpsellClient {
  rpc(
    name: "check_upsell_trigger",
    args: { p_user_id: string; p_call_count: number },
  ): PromiseLike<{ data: unknown; error: unknown }>;
}

export type Variant = "A" | "B";

export function promptFor(usage: Usage, variant: Variant): string {
  if (usage.pattern === "batch") {
    return variant === "A"
      ? "Your batch has used 5 of 10 free calls. Review upgrade options before the next batch."
      : "Planning more batches? You have 5 free calls left. Compare upgrade options.";
  }
  return variant === "A"
    ? "You have used 5 of 10 free calls. Review upgrade options to keep exploring."
    : "You have 5 free calls left. Compare upgrade options for your next steps.";
}

/** Stable cohort assignment; callers can instead supply their experiment variant. */
export function variantFor(userId: string): Variant {
  let hash = 2166136261;
  for (const character of userId) {
    hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619);
  }
  return (hash >>> 0) % 2 === 0 ? "A" : "B";
}

/** Apply after a successful, counted free call. The database arbitrates retries. */
export async function applyUpsell(
  response: Response,
  usage: Usage,
  client: UpsellClient,
  variant: Variant = variantFor(usage.userId),
): Promise<Response> {
  if (
    !usage.userId.trim() || !Number.isInteger(usage.callCount) ||
    usage.callCount < 0 || usage.callCount > 2147483647
  ) {
    throw new TypeError(
      "Expected authenticated user and non-negative PostgreSQL integer call count",
    );
  }
  const headers = new Headers(response.headers);
  for (const name of ["X-Upsell-Prompt", "X-Upsell-Text", "X-Upsell-Variant"]) {
    headers.delete(name);
  }
  if (response.ok && usage.isFree && usage.callCount === 5) {
    const { data, error } = await client.rpc("check_upsell_trigger", {
      p_user_id: usage.userId,
      p_call_count: usage.callCount,
    });
    // An unavailable/malformed store must never manufacture a winning trigger.
    if (
      error || !data || typeof data !== "object" || !("upsell" in data) ||
      typeof data.upsell !== "boolean"
    ) {
      throw new Error("Unable to determine upsell trigger");
    }
    if (data.upsell) {
      headers.set("X-Upsell-Prompt", "true");
      headers.set("X-Upsell-Text", promptFor(usage, variant));
      headers.set("X-Upsell-Variant", variant);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
