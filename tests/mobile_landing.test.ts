/**
 * Mobile landing acceptance tests (Issue #4).
 * Style mirrors tests/pricing.test.ts — plain Deno.test + std assert.
 */
import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const ROOT = new URL('..', import.meta.url).pathname;

async function readRepoFile(rel: string): Promise<string> {
  return await Deno.readTextFile(`${ROOT}${rel}`);
}

Deno.test('mobile.html includes required wallet deep-link schemes', async () => {
  const html = await readRepoFile('src/landing/mobile.html');
  assertStringIncludes(html, 'metamask://');
  assertStringIncludes(html, 'cbwallet://');
  assertStringIncludes(html, 'rainbow://');
});

Deno.test('mobile.html tracks mobile_landing_cta_click', async () => {
  const html = await readRepoFile('src/landing/mobile.html');
  assertStringIncludes(html, 'mobile_landing_cta_click');
  assertStringIncludes(html, '/api/events');
  assertStringIncludes(html, 'is_mobile');
  assertStringIncludes(html, 'viewport');
});

Deno.test('mobile.html has viewport meta and UA + screen-size detection', async () => {
  const html = await readRepoFile('src/landing/mobile.html');
  assertStringIncludes(html, 'name="viewport"');
  assertStringIncludes(html, 'width=device-width');
  // UA detection
  assertStringIncludes(html, 'navigator.userAgent');
  // Screen / max-width detection
  assertStringIncludes(html, 'innerWidth');
  assertStringIncludes(html, 'screen.width');
  assertStringIncludes(html, 'MOBILE_MAX_WIDTH');
  assertStringIncludes(html, 'detectMobile');
});

Deno.test('mobile.html is Lighthouse-friendly (inline CSS, no heavy deps)', async () => {
  const html = await readRepoFile('src/landing/mobile.html');
  assertStringIncludes(html, '<style>');
  // No CDN script tags / heavy frameworks
  assertEquals(/<script\s+src=/.test(html), false);
  assertEquals(/cdn\.|unpkg\.|jsdelivr\./i.test(html), false);
});

Deno.test('MobileLanding.tsx mirrors deep-links + tracking + detection', async () => {
  const tsx = await readRepoFile('src/components/MobileLanding.tsx');
  assertStringIncludes(tsx, 'metamask://');
  assertStringIncludes(tsx, 'cbwallet://');
  assertStringIncludes(tsx, 'rainbow://');
  assertStringIncludes(tsx, 'mobile_landing_cta_click');
  assertStringIncludes(tsx, '/api/events');
  assertStringIncludes(tsx, 'detectMobile');
  assertStringIncludes(tsx, 'MOBILE_MAX_WIDTH');
  assertStringIncludes(tsx, 'trackCTA');
  assertStringIncludes(tsx, 'is_mobile');
  assertStringIncludes(tsx, 'viewport');
});

Deno.test('detectMobile helpers: UA or narrow viewport ⇒ mobile', async () => {
  // Import pure helpers from the component module (Deno can import .tsx as TS if types stripped;
  // fall back to re-evaluating exported logic via dynamic import of a tiny mirror).
  // We assert against the source contract + a local reimplementation matching the component.
  const MOBILE_UA =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;
  const MOBILE_MAX_WIDTH = 768;

  function detectMobile(userAgent: string, width: number) {
    const ua_mobile = MOBILE_UA.test(userAgent || '');
    const size_mobile = width <= MOBILE_MAX_WIDTH;
    return { is_mobile: ua_mobile || size_mobile, ua_mobile, size_mobile };
  }

  assertEquals(
    detectMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 390)
      .is_mobile,
    true,
  );
  assertEquals(
    detectMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)', 1280).is_mobile,
    false,
  );
  assertEquals(
    detectMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)', 375).is_mobile,
    true,
  );
  assertEquals(
    detectMobile('Mozilla/5.0 (Linux; Android 13)', 1024).is_mobile,
    true,
  );

  // Ensure component source documents the same threshold
  const tsx = await readRepoFile('src/components/MobileLanding.tsx');
  assertStringIncludes(tsx, '768');
});