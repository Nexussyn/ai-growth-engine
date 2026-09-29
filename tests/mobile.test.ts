import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isMobileUserAgent, trackMobileLandingCTA, WALLET_DEEP_LINKS } from '../src/components/MobileLanding.tsx';

Deno.test('Detects iOS Safari and Android Chrome user agents as mobile', () => {
  assertEquals(isMobileUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1', 1024), true);
  assertEquals(isMobileUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36', 1024), true);
  assertEquals(isMobileUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)', 1440), false);
});

Deno.test('Includes MetaMask, Coinbase Wallet, and Rainbow deep-links', () => {
  const schemes = WALLET_DEEP_LINKS.map((w) => w.href);
  assertEquals(schemes.includes('metamask://'), true);
  assertEquals(schemes.includes('cbwallet://'), true);
  assertEquals(schemes.includes('rainbow://'), true);
});

Deno.test('Tracks mobile_landing_cta_click with separate mobile/desktop conversion segments', async () => {
  const mobileEvent = await trackMobileLandingCTA('metamask', true, async () => new Response('{}'));
  const desktopEvent = await trackMobileLandingCTA('browser', false, async () => new Response('{}'));
  assertEquals(mobileEvent.event_type, 'mobile_landing_cta_click');
  assertEquals(mobileEvent.conversion_segment, 'mobile_conversion');
  assertEquals(desktopEvent.conversion_segment, 'desktop_conversion');
});
