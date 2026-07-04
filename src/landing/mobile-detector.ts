export function isMobileDevice(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
}

export function isWalletApp(userAgent: string): boolean {
  return /Phantom|MetaMask|TrustWallet|OKX|CoinbaseWallet|Rainbow/i.test(userAgent);
}

export function getDeepLink(walletName: string, fallbackUrl: string): string {
  const deepLinks: Record<string, string> = {
    phantom: `phantom://browse/${encodeURIComponent(fallbackUrl)}`,
    metamask: `metamask://dapp/${encodeURIComponent(fallbackUrl)}`,
    trustwallet: `trust://open_url?url=${encodeURIComponent(fallbackUrl)}`,
  };
  return deepLinks[walletName.toLowerCase()] || fallbackUrl;
}

export function getMobileCTA(userAgent: string): { text: string; href: string } {
  if (isMobileDevice(userAgent) && !isWalletApp(userAgent)) {
    return { text: 'Connect Wallet → Start Earning', href: 'https://github.com/Nexussyn/ai-growth-engine' };
  }
  return { text: 'Browse Bounties — $50 USDC Available', href: 'https://github.com/Nexussyn/ai-growth-engine' };
}
