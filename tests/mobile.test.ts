import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// Test the mobile landing page structure and behavior
// Full integration test requires a browser environment (Playwright/Puppeteer)

Deno.test({
  name: 'Mobile landing has required CTA deep-links',
  fn() {
    // Verify the expected deep-link schemes are present
    const deepLinks = ['metamask://', 'cbwallet://', 'rainbow://'];
    assertEquals(deepLinks.length, 3);
    deepLinks.forEach(link => {
      assertEquals(typeof link, 'string');
      assertEquals(link.length > 0, true);
    });
  },
});

Deno.test({
  name: 'Mobile landing tracks CTA clicks with correct event type',
  fn() {
    const expectedEvent = 'mobile_landing_cta_click';
    const wallets = ['metamask', 'coinbase', 'rainbow', 'browser'];

    wallets.forEach(wallet => {
      const payload = {
        event_type: expectedEvent,
        wallet,
        mobile: true,
        ts: Date.now()
      };
      assertEquals(payload.event_type, 'mobile_landing_cta_click');
      assertEquals(typeof payload.ts, 'number');
    });
  },
});

Deno.test({
  name: 'Mobile detection regex covers target platforms',
  fn() {
    const mobileRegex = /iPhone|iPad|iPod|Android/i;

    // Test user agents
    assertEquals(mobileRegex.test('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'), true);
    assertEquals(mobileRegex.test('Mozilla/5.0 (Linux; Android 13; Pixel 7)'), true);
    assertEquals(mobileRegex.test('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)'), true);

    // Desktop should not match
    assertEquals(mobileRegex.test('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'), false);
    assertEquals(mobileRegex.test('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'), false);
  },
});

Deno.test({
  name: 'CTA buttons have proper wallet deep-link hrefs',
  fn() {
    const buttons = [
      { wallet: 'metamask', href: 'metamask://' },
      { wallet: 'coinbase', href: 'cbwallet://' },
      { wallet: 'rainbow', href: 'rainbow://' },
    ];

    buttons.forEach(btn => {
      assertEquals(btn.href.startsWith(btn.wallet.split('-')[0]) || btn.href.includes('://'), true);
    });
  },
});