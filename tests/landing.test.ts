import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  detectClientContext,
  isAndroidUserAgent,
  isIOSUserAgent,
  isMobileUserAgent,
} from '../src/landing/detect.ts';
import {
  assertRequiredSchemes,
  metamaskDeepLink,
  requiredSchemeHrefs,
  walletDeepLinks,
} from '../src/landing/deeplinks.ts';
import {
  EVENT_TYPE,
  LandingEventStore,
  trackMobileLandingCta,
} from '../src/landing/track.ts';

Deno.test('UA detection: iPhone is mobile + iOS', () => {
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
  assertEquals(isMobileUserAgent(ua), true);
  assertEquals(isIOSUserAgent(ua), true);
  assertEquals(isAndroidUserAgent(ua), false);
  const ctx = detectClientContext(ua, 390);
  assertEquals(ctx.isMobile, true);
  assertEquals(ctx.source, 'ua+viewport');
});

Deno.test('UA detection: desktop wide viewport is not mobile', () => {
  const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/120.0.0.0';
  const ctx = detectClientContext(ua, 1280);
  assertEquals(ctx.isMobile, false);
  assertEquals(ctx.source, 'none');
});

Deno.test('viewport-only narrow width counts as mobile', () => {
  const ctx = detectClientContext('Mozilla/5.0 desktop', 375);
  assertEquals(ctx.isMobile, true);
  assertEquals(ctx.source, 'viewport');
});

Deno.test('deep links include required wallet schemes', () => {
  const links = walletDeepLinks();
  const hrefs = links.map((l) => l.href);
  assertEquals(assertRequiredSchemes(hrefs), true);
  const required = requiredSchemeHrefs();
  assertEquals(required.metamask.startsWith('metamask://'), true);
  assertEquals(required.coinbase.startsWith('cbwallet://'), true);
  assertEquals(required.rainbow.startsWith('rainbow://'), true);
  assertEquals(metamaskDeepLink().startsWith('metamask://'), true);
});

Deno.test('trackMobileLandingCta writes system_events-shaped rows', () => {
  const store = new LandingEventStore();
  const row = trackMobileLandingCta('metamask', true, 'ua', store);
  assertEquals(row.eventType, EVENT_TYPE);
  assertEquals(EVENT_TYPE, 'mobile_landing_cta_click');
  assertEquals(row.mobile, true);
  assertEquals(row.wallet, 'metamask');
  assertExists(row.payload.event_type);
  assertEquals(store.countByWallet('metamask'), 1);
});

Deno.test('mobile vs desktop conversion counters split correctly', () => {
  const store = new LandingEventStore();
  trackMobileLandingCta('metamask', true, 'ua', store);
  trackMobileLandingCta('coinbase', true, 'ua', store);
  trackMobileLandingCta('browser', false, 'none', store);
  const split = store.mobileVsDesktop();
  assertEquals(split.mobile, 2);
  assertEquals(split.desktop, 1);
});

Deno.test('empty wallet is rejected', () => {
  const store = new LandingEventStore();
  let threw = false;
  try {
    store.track({ wallet: '  ', mobile: true });
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test('mobile.html ships required schemes and event type', async () => {
  const html = await Deno.readTextFile(
    new URL('../src/landing/mobile.html', import.meta.url),
  );
  assertEquals(html.includes('metamask://'), true);
  assertEquals(html.includes('cbwallet://'), true);
  assertEquals(html.includes('rainbow://'), true);
  assertEquals(html.includes('mobile_landing_cta_click'), true);
  assertEquals(html.includes('viewport'), true);
  assertEquals(html.includes('./assets/mark.svg'), true);
});

Deno.test('SVG mark asset exists and is non-empty', async () => {
  const svg = await Deno.readTextFile(
    new URL('../src/landing/assets/mark.svg', import.meta.url),
  );
  assertEquals(svg.includes('<svg'), true);
  assertEquals(svg.length > 100, true);
});
