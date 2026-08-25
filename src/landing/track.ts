/**
 * Conversion tracking → `system_events` with event_type `mobile_landing_cta_click`.
 * Issue #4. In-memory store mirrors production insert for unit tests.
 */

export const EVENT_TYPE = 'mobile_landing_cta_click' as const;

export type MobileLandingEvent = {
  id: string;
  eventType: typeof EVENT_TYPE;
  wallet: string;
  mobile: boolean;
  source: string;
  ts: string;
  payload: Record<string, unknown>;
};

export type TrackInput = {
  wallet: string;
  mobile: boolean;
  source?: string;
  extra?: Record<string, unknown>;
  at?: Date;
};

export class LandingEventStore {
  events: MobileLandingEvent[] = [];
  private seq = 0;

  track(input: TrackInput): MobileLandingEvent {
    const wallet = (input.wallet || '').trim();
    if (!wallet) {
      throw new Error('wallet required');
    }
    const at = input.at ?? new Date();
    const row: MobileLandingEvent = {
      id: `mle_${++this.seq}`,
      eventType: EVENT_TYPE,
      wallet,
      mobile: !!input.mobile,
      source: input.source ?? 'unknown',
      ts: at.toISOString(),
      payload: {
        event_type: EVENT_TYPE,
        wallet,
        mobile: !!input.mobile,
        source: input.source ?? 'unknown',
        ...(input.extra ?? {}),
      },
    };
    this.events.push(row);
    return row;
  }

  countByWallet(wallet: string): number {
    return this.events.filter((e) => e.wallet === wallet).length;
  }

  mobileVsDesktop(): { mobile: number; desktop: number } {
    let mobile = 0;
    let desktop = 0;
    for (const e of this.events) {
      if (e.mobile) mobile++;
      else desktop++;
    }
    return { mobile, desktop };
  }
}

/** Default shared store for simple script / HTML bridge usage. */
export const defaultLandingStore = new LandingEventStore();

export function trackMobileLandingCta(
  wallet: string,
  mobile: boolean,
  source = 'ua',
  store: LandingEventStore = defaultLandingStore,
): MobileLandingEvent {
  return store.track({ wallet, mobile, source });
}
