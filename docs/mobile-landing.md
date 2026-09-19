# Mobile landing integration

Serve `src/landing/mobile.html` as HTML. A mobile user agent or a viewport of
600px or narrower gets one wallet CTA and a labelled wallet selector. A desktop
gets one link to the open bounties. Resizing updates the choice. Without
JavaScript, the bounty link remains usable.

The three wallet targets use the schemes requested by issue #4: `metamask://`,
`cbwallet://`, and `rainbow://`. They open an installed app; they do not connect
a wallet, sign a transaction, or open an invented dapp URL. App installation and
OS handling are outside browser emulation coverage.

## Event persistence

Mount `createLandingEventHandler` from `src/landing/events.ts` at
`POST /api/landing-events` on the same origin as the page. Provide a server-side
store adapter. For an existing Supabase client:

```ts
const landingEvents = createLandingEventHandler(async (table, event) => {
  const { error } = await supabase.from(table).insert(event);
  if (error) {
    throw error;
  }
});
// In the host router: POST /api/landing-events -> landingEvents(request)
```

The adapter uses the existing `system_events(event_type, payload, created_at)`
shape also used in `migrations/add_referral_system.sql`. Every accepted row has
`event_type = 'mobile_landing_cta_click'`. Its payload contains `device`
(`mobile` or `desktop`) and `wallet`; group by device for separate click counts.
These are click events, not proof of a completed paid conversion. Timestamping
occurs on the server. Storage errors return 503, never a false successful write.

Browser requests use `keepalive` so navigating away need not cancel the event;
delivery remains best effort. Analytics failure does not block the wallet link.
No service credentials belong in the page. The old `runtime-discovery` endpoint
is not used because this repository supplies no contract that persists its POSTs.
The host must mount the route and authorize database inserts before deploying.

## Local verification

```sh
deno test tests
npm install --prefix /tmp/landing-tools playwright
/tmp/landing-tools/node_modules/.bin/playwright install chromium webkit
NODE_PATH=/tmp/landing-tools/node_modules node tests/landing.browser.cjs
python -m http.server 8765 --bind 127.0.0.1 --directory src/landing
# In another terminal (mobile is Lighthouse's default):
npx lighthouse http://127.0.0.1:8765/mobile.html --chrome-flags="--headless" --output=html
```

Set `LANDING_EVIDENCE_DIR` to save screenshots. Browser tests serve the actual
HTML on loopback, capture event POSTs locally, and block all external requests.
They exercise Chromium Android and WebKit iPhone emulation, a wide iPhone user
agent, desktop, and narrow desktop, plus resizing. The handler tests verify the
actual `system_events` insert contract with an injected local store, including
invalid requests and failed persistence. No production system was contacted.
