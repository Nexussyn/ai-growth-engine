export interface LandingEvent {
  event_type: 'mobile_landing_cta_click';
  payload: { device: 'mobile' | 'desktop'; wallet: string };
  created_at: string;
}

export function createLandingEventHandler(
  insert: (table: 'system_events', event: LandingEvent) => Promise<void>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
    }
    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }
    if (!payload || !['mobile', 'desktop'].includes(payload.device) ||
      !['metamask', 'coinbase', 'rainbow', 'browser'].includes(payload.wallet)) {
      return new Response('Invalid landing event', { status: 400 });
    }
    try {
      await insert('system_events', {
        event_type: 'mobile_landing_cta_click',
        payload: { device: payload.device, wallet: payload.wallet },
        created_at: new Date().toISOString(),
      });
      return new Response(null, { status: 204 });
    } catch {
      return new Response('Event storage unavailable', { status: 503 });
    }
  };
}
