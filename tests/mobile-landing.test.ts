import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  isMobileUserAgent,
  isMobileViewport,
  buildWalletDeepLink,
  createAnalyticsPayload
} from '../src/landing/mobile-detector.ts';

Deno.test('Mobile Detection: correctly classifies mobile user agents and viewports', () => {
  const iphoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
  const androidUA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36';
  const desktopUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';

  assertEquals(isMobileUserAgent(iphoneUA), true);
  assertEquals(isMobileUserAgent(androidUA), true);
  assertEquals(isMobileUserAgent(desktopUA), false);
  assertEquals(isMobileUserAgent(''), false);

  assertEquals(isMobileViewport(375), true);  // iPhone SE
  assertEquals(isMobileViewport(414), true);  // iPhone Pro Max
  assertEquals(isMobileViewport(1024), false); // Desktop
});

Deno.test('Wallet Deep Links: formats valid schemes for MetaMask, Coinbase, and Rainbow', () => {
  const dapp = 'https://ai-growth.engine/bounties';

  assertEquals(buildWalletDeepLink('metamask', dapp), 'metamask://dapp/ai-growth.engine/bounties');
  assertEquals(buildWalletDeepLink('coinbase', dapp), `cbwallet://dapp?url=${encodeURIComponent(dapp)}`);
  assertEquals(buildWalletDeepLink('rainbow', dapp), `rainbow://open?url=${encodeURIComponent(dapp)}`);
  assertEquals(buildWalletDeepLink('browser', dapp), 'https://ai-growth.engine/bounties');
});

Deno.test('Analytics Payload: builds structured event for system_events tracking', () => {
  const payload = createAnalyticsPayload('metamask', 'iPhone UA', true);
  assertEquals(payload.eventType, 'mobile_landing_cta_click');
  assertEquals(payload.wallet, 'metamask');
  assertEquals(payload.isMobile, true);
  assertEquals(typeof payload.timestamp, 'string');
});
