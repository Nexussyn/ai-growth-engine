export interface ReferralCode {
  code: string;
  owner_id: string;
  uses: number;
  credits_awarded: number;
}

export interface ReferralConversion {
  referral_code: string;
  new_user_id: string;
}

export interface ReferralNotification {
  user_id: string;
  notification_type: "referral_credit_awarded" | "referral_signup_confirmed";
  payload: Record<string, unknown>;
}

export interface ReferralState {
  referral_codes: ReferralCode[];
  referral_conversions: ReferralConversion[];
  credit_balances: Record<string, number>;
  system_events: Array<
    { event_type: string; payload: Record<string, unknown> }
  >;
  referral_notifications: ReferralNotification[];
}

export interface ReferralResult {
  status: "ok" | "already_processed" | "invalid_code" | "self_referral";
  credits_awarded?: number;
  owner_id?: string;
}

const REFERRAL_CREDITS = 5;

export function process_referral(
  state: ReferralState,
  referral_code: string,
  new_user_id: string,
): ReferralResult {
  const code = state.referral_codes.find((entry) =>
    entry.code === referral_code
  );
  if (!code) return { status: "invalid_code" };

  if (code.owner_id === new_user_id) {
    return { status: "self_referral" };
  }

  const alreadyProcessed = state.referral_conversions.some((conversion) =>
    conversion.referral_code === referral_code &&
    conversion.new_user_id === new_user_id
  );
  if (alreadyProcessed) return { status: "already_processed" };

  state.referral_conversions.push({ referral_code, new_user_id });
  code.uses += 1;
  code.credits_awarded += REFERRAL_CREDITS;
  state.credit_balances[code.owner_id] =
    (state.credit_balances[code.owner_id] ?? 0) + REFERRAL_CREDITS;

  state.system_events.push({
    event_type: "referral_conversion",
    payload: {
      code: referral_code,
      new_user: new_user_id,
      owner_id: code.owner_id,
      credits: REFERRAL_CREDITS,
    },
  });

  state.referral_notifications.push(
    {
      user_id: code.owner_id,
      notification_type: "referral_credit_awarded",
      payload: {
        code: referral_code,
        new_user: new_user_id,
        credits: REFERRAL_CREDITS,
      },
    },
    {
      user_id: new_user_id,
      notification_type: "referral_signup_confirmed",
      payload: {
        code: referral_code,
        referrer: code.owner_id,
      },
    },
  );

  return {
    status: "ok",
    credits_awarded: REFERRAL_CREDITS,
    owner_id: code.owner_id,
  };
}
