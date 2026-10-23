import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildWalletDeepLinks,
  createConversionEvent,
  detectMobileContext,
} from '../src/landing/mobile-landing.ts';

Deno.test('detectMobileContext identifies iOS Safari and Android Chrome mobile user agents', () => {
  const ios = detectMobileContext(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    390,
  );
  assertEquals(ios.isMobile, true);
  assertEquals(ios.deviceContext, 'mobile');
  assertEquals(ios.platform, 'ios');

  const android = detectMobileContext(
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    412,
  );
  assertEquals(android.isMobile, true);
  assertEquals(android.deviceContext, 'mobile');
  assertEquals(android.platform, 'android');
});

Deno.test('detectMobileContext distinguishes desktop vs responsive mobile viewport', () => {
  const desktop = detectMobileContext(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    1440,
  );
  assertEquals(desktop.isMobile, false);
  assertEquals(desktop.deviceContext, 'desktop');

  const narrowViewport = detectMobileContext('Mozilla/5.0 (X11; Linux x86_64)', 375);
  assertEquals(narrowViewport.isMobile, true);
  assertEquals(narrowViewport.deviceContext, 'mobile');
});

Deno.test('buildWalletDeepLinks generates metamask://, cbwallet://, and rainbow:// URIs', () => {
  const links = buildWalletDeepLinks('https://github.com/Nexussyn/ai-growth-engine/issues');
  assertEquals(links.metamask.startsWith('metamask://'), true);
  assertEquals(links.coinbase.startsWith('cbwallet://'), true);
  assertEquals(links.rainbow.startsWith('rainbow://'), true);
  assertEquals(links.browser, 'https://github.com/Nexussyn/ai-growth-engine/issues');
});

Deno.test('createConversionEvent tracks mobile vs desktop conversions with mobile_landing_cta_click', () => {
  const mobileCtx = detectMobileContext('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 390);
  const desktopCtx = detectMobileContext('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 1920);

  const mobileEv = createConversionEvent('metamask', mobileCtx, 'https://github.com/Nexussyn/ai-growth-engine/issues', 1700000000000);
  assertEquals(mobileEv.event_type, 'mobile_landing_cta_click');
  assertEquals(mobileEv.mobile, true);
  assertEquals(mobileEv.device_context, 'mobile');
  assertEquals(mobileEv.platform, 'ios');
  assertEquals(mobileEv.wallet, 'metamask');

  const desktopEv = createConversionEvent('browser', desktopCtx, 'https://github.com/Nexussyn/ai-growth-engine/issues', 1700000000000);
  assertEquals(desktopEv.event_type, 'mobile_landing_cta_click');
  assertEquals(desktopEv.mobile, false);
  assertEquals(desktopEv.device_context, 'desktop');
});
