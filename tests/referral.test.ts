import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { process_referral, ReferralState } from "../src/growth/referral.ts";

function createState(): ReferralState {
  return {
    referral_codes: [{
      code: "AGENT5",
      owner_id: "user-a",
      uses: 0,
      credits_awarded: 0,
    }],
    referral_conversions: [],
    credit_balances: {},
    system_events: [],
    referral_notifications: [],
  };
}

Deno.test("process_referral awards 5 credits and logs conversion", () => {
  const state = createState();

  const result = process_referral(state, "AGENT5", "user-b");

  assertEquals(result, {
    status: "ok",
    credits_awarded: 5,
    owner_id: "user-a",
  });
  assertEquals(state.referral_codes[0].uses, 1);
  assertEquals(state.referral_codes[0].credits_awarded, 5);
  assertEquals(state.credit_balances["user-a"], 5);
  assertEquals(state.referral_conversions, [{
    referral_code: "AGENT5",
    new_user_id: "user-b",
  }]);
  assertEquals(state.system_events[0].event_type, "referral_conversion");
  assertEquals(state.referral_notifications.length, 2);
  assertEquals(
    state.referral_notifications.map((notification) => notification.user_id),
    ["user-a", "user-b"],
  );
});

Deno.test("process_referral is idempotent for duplicate referrals", () => {
  const state = createState();

  process_referral(state, "AGENT5", "user-b");
  const duplicate = process_referral(state, "AGENT5", "user-b");

  assertEquals(duplicate, { status: "already_processed" });
  assertEquals(state.referral_codes[0].uses, 1);
  assertEquals(state.credit_balances["user-a"], 5);
  assertEquals(state.system_events.length, 1);
  assertEquals(state.referral_notifications.length, 2);
});

Deno.test("process_referral rejects invalid codes", () => {
  const state = createState();

  const result = process_referral(state, "MISSING", "user-b");

  assertEquals(result, { status: "invalid_code" });
  assertEquals(state.referral_conversions.length, 0);
  assertEquals(state.system_events.length, 0);
});

Deno.test("process_referral rejects self referrals", () => {
  const state = createState();

  const result = process_referral(state, "AGENT5", "user-a");

  assertEquals(result, { status: "self_referral" });
  assertEquals(state.referral_codes[0].uses, 0);
  assertEquals(state.credit_balances["user-a"], undefined);
});
