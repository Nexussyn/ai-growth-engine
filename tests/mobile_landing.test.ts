import { assertEquals, assertMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.test('Mobile Landing: HTML contains essential meta tags and responsive styling', () => {
  const html = Deno.readTextFileSync('src/landing/mobile.html');
  assertMatch(html, /<meta\s+name=["']viewport["']\s+content=["'][^"']*width=device-width[^"']*["']/i);
  assertMatch(html, /<!DOCTYPE html>/i);
});

Deno.test('Mobile Landing: contains wallet deep links for MetaMask, Coinbase Wallet, and Rainbow', () => {
  const html = Deno.readTextFileSync('src/landing/mobile.html');
  assertMatch(html, /href=["']metamask:\/\//);
  assertMatch(html, /href=["']cbwallet:\/\//);
  assertMatch(html, /href=["']rainbow:\/\//);
});

Deno.test('Mobile Landing: event tracking tracks mobile_landing_cta_click', () => {
  const html = Deno.readTextFileSync('src/landing/mobile.html');
  assertMatch(html, /mobile_landing_cta_click/);
  assertMatch(html, /isMobile/);
});
