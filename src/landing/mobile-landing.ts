/**
 * Mobile-First Wallet Deep-Link & Conversion Tracking — Issue #4
 */

export type WalletProvider = 'metamask' | 'coinbase' | 'rainbow' | 'browser';
export type DeviceContext = 'mobile' | 'desktop';

export interface MobileContextInfo {
  isMobile: boolean;
  deviceContext: DeviceContext;
  platform: 'ios' | 'android' | 'other';
  inAppWallet: WalletProvider | null;
}

export interface WalletDeepLinks {
  metamask: string;
  coinbase: string;
  rainbow: string;
  browser: string;
}

export interface ConversionEventPayload {
  event_type: 'mobile_landing_cta_click';
  wallet: WalletProvider;
  mobile: boolean;
  device_context: DeviceContext;
  platform: 'ios' | 'android' | 'other';
  deep_link: string;
  ts: number;
}

const MOBILE_UA_REGEX = /iPhone|iPad|iPod|Android|Mobile|WebOS|BlackBerry|IEMobile|Opera Mini/i;

/**
 * Detects whether the visitor is in a mobile context via User-Agent and/or screen width.
 */
export function detectMobileContext(userAgent: string, screenWidth = 1024): MobileContextInfo {
  const ua = userAgent || '';
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const uaMobile = MOBILE_UA_REGEX.test(ua);
  const viewportMobile = typeof screenWidth === 'number' && Number.isFinite(screenWidth) && screenWidth > 0 && screenWidth <= 768;
  const isMobile = uaMobile || viewportMobile;

  let inAppWallet: WalletProvider | null = null;
  if (/MetaMaskMobile/i.test(ua)) {
    inAppWallet = 'metamask';
  } else if (/CoinbaseWallet|CBWallet/i.test(ua)) {
    inAppWallet = 'coinbase';
  } else if (/Rainbow/i.test(ua)) {
    inAppWallet = 'rainbow';
  }

  return {
    isMobile,
    deviceContext: isMobile ? 'mobile' : 'desktop',
    platform: isIos ? 'ios' : isAndroid ? 'android' : 'other',
    inAppWallet,
  };
}

/**
 * Builds wallet deep-link URIs for MetaMask (`metamask://`), Coinbase Wallet (`cbwallet://`),
 * and Rainbow (`rainbow://`).
 */
export function buildWalletDeepLinks(
  targetUrl = 'https://github.com/Nexussyn/ai-growth-engine/issues',
): WalletDeepLinks {
  const cleanHostPath = targetUrl.replace(/^https?:\/\//i, '');
  const encodedUrl = encodeURIComponent(targetUrl);
  return {
    metamask: `metamask://dapp/${cleanHostPath}`,
    coinbase: `cbwallet://dapp?url=${encodedUrl}`,
    rainbow: `rainbow://dapp?url=${encodedUrl}`,
    browser: targetUrl,
  };
}

/**
 * Constructs the `system_events` telemetry payload with `mobile_landing_cta_click`,
 * separating mobile vs desktop conversion attribution.
 */
export function createConversionEvent(
  wallet: WalletProvider,
  context: MobileContextInfo,
  targetUrl = 'https://github.com/Nexussyn/ai-growth-engine/issues',
  timestamp = Date.now(),
): ConversionEventPayload {
  const links = buildWalletDeepLinks(targetUrl);
  return {
    event_type: 'mobile_landing_cta_click',
    wallet,
    mobile: context.isMobile,
    device_context: context.deviceContext,
    platform: context.platform,
    deep_link: links[wallet],
    ts: timestamp,
  };
}
