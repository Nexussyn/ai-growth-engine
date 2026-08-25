/**
 * Mobile / wallet-app context detection for the landing CTA surface.
 * Issue #4 — keep detection pure so Deno tests can cover UA + viewport cases.
 */

export type ClientContext = {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  source: 'ua' | 'viewport' | 'ua+viewport' | 'none';
};

const MOBILE_UA =
  /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini|Mobile/i;

/** True when the UA string looks like a phone / tablet browser. */
export function isMobileUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return MOBILE_UA.test(ua);
}

export function isIOSUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return /iPhone|iPad|iPod/i.test(ua);
}

export function isAndroidUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return /Android/i.test(ua);
}

/**
 * Combine UA + optional CSS viewport width (px).
 * Viewport-only mobile is treated as mobile when width <= 600.
 */
export function detectClientContext(
  ua: string | null | undefined,
  viewportWidth?: number | null,
): ClientContext {
  const uaMobile = isMobileUserAgent(ua);
  const vpMobile =
    typeof viewportWidth === 'number' &&
    Number.isFinite(viewportWidth) &&
    viewportWidth > 0 &&
    viewportWidth <= 600;

  let source: ClientContext['source'] = 'none';
  if (uaMobile && vpMobile) source = 'ua+viewport';
  else if (uaMobile) source = 'ua';
  else if (vpMobile) source = 'viewport';

  return {
    isMobile: uaMobile || vpMobile,
    isIOS: isIOSUserAgent(ua),
    isAndroid: isAndroidUserAgent(ua),
    source,
  };
}
