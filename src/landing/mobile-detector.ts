export type WalletType = 'metamask' | 'coinbase' | 'rainbow' | 'browser';

export interface DeepLinkConfig {
  dappUrl: string;
  wallet: WalletType;
}

export function isMobileUserAgent(ua: string): boolean {
  if (!ua) return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

export function isMobileViewport(width: number): boolean {
  return width <= 768;
}

export function buildWalletDeepLink(wallet: WalletType, dappUrl: string): string {
  const cleanUrl = dappUrl.replace(/^https?:\/\//, '');
  const encodedUrl = encodeURIComponent(dappUrl);

  switch (wallet) {
    case 'metamask':
      return `metamask://dapp/${cleanUrl}`;
    case 'coinbase':
      return `cbwallet://dapp?url=${encodedUrl}`;
    case 'rainbow':
      return `rainbow://open?url=${encodedUrl}`;
    case 'browser':
    default:
      return dappUrl.startsWith('http') ? dappUrl : `https://${cleanUrl}`;
  }
}

export function createAnalyticsPayload(wallet: WalletType, userAgent: string, isMobile: boolean) {
  return {
    eventType: 'mobile_landing_cta_click',
    wallet,
    isMobile,
    userAgent,
    timestamp: new Date().toISOString(),
  };
}
