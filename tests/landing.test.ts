import { assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.test('Landing page has mobile detection', async () => {
  const html = await Deno.readTextFile('./src/landing/mobile.html');
  assertStringIncludes(html, '/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)');
  assertStringIncludes(html, 'window.innerWidth <=');
});

Deno.test('Landing page has simplified hero layout', async () => {
  const html = await Deno.readTextFile('./src/landing/mobile.html');
  assertStringIncludes(html, '<h1>');
  assertStringIncludes(html, '<button class="btn btn-primary"');
  assertStringIncludes(html, 'Connect Web3 Wallet');
});

Deno.test('Landing page includes deep-links with web fallback', async () => {
  const html = await Deno.readTextFile('./src/landing/mobile.html');
  assertStringIncludes(html, 'href="metamask://"');
  assertStringIncludes(html, 'href="cbwallet://"');
  assertStringIncludes(html, 'href="rainbow://"');
  
  assertStringIncludes(html, "window.location.href = 'https://github.com/Nexussyn/ai-growth-engine/issues'");
  assertStringIncludes(html, 'setTimeout');
});

Deno.test('Landing page logs CTA click event', async () => {
  const html = await Deno.readTextFile('./src/landing/mobile.html');
  assertStringIncludes(html, "event_type: 'mobile_landing_cta_click'");
  assertStringIncludes(html, 'fetch(');
});
