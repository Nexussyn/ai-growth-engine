/**
 * Wallet deep-links for mobile CTAs (MetaMask / Coinbase / Rainbow).
 * Issue #4 acceptance: metamask://, cbwallet://, rainbow://
 */

export type WalletKind = 'metamask' | 'coinbase' | 'rainbow' | 'browser';

export type DeepLink = {
  wallet: WalletKind;
  href: string;
  label: string;
};

const DEFAULT_DAPP = 'https://github.com/Nexussyn/ai-growth-engine/issues';

/** Build a metamask:// deep link that opens the in-app browser on `url`. */
export function metamaskDeepLink(dappUrl: string = DEFAULT_DAPP): string {
  const hostPath = dappUrl.replace(/^https?:\/\//i, '');
  return `metamask://dapp/${hostPath}`;
}

/**
 * Canonical mobile deep-links. `dappUrl` is the page wallets should open.
 * Bare schemes satisfy acceptance criteria; dapp-path variants improve UX.
 */
export function walletDeepLinks(dappUrl: string = DEFAULT_DAPP): DeepLink[] {
  const hostPath = dappUrl.replace(/^https?:\/\//i, '');
  return [
    {
      wallet: 'metamask',
      href: `metamask://dapp/${hostPath}`,
      label: 'Open in MetaMask',
    },
    {
      wallet: 'coinbase',
      href: `cbwallet://dapp?url=${encodeURIComponent(dappUrl)}`,
      label: 'Coinbase Wallet',
    },
    {
      wallet: 'rainbow',
      href: `rainbow://dapp?url=${encodeURIComponent(dappUrl)}`,
      label: 'Rainbow',
    },
    {
      wallet: 'browser',
      href: dappUrl,
      label: 'View Bounties',
    },
  ];
}

/** Minimal schemes required by the bounty acceptance checklist. */
export function requiredSchemeHrefs(): Record<'metamask' | 'coinbase' | 'rainbow', string> {
  return {
    metamask: 'metamask://',
    coinbase: 'cbwallet://',
    rainbow: 'rainbow://',
  };
}

export function assertRequiredSchemes(hrefs: string[]): boolean {
  const joined = hrefs.join(' ');
  return (
    joined.includes('metamask://') &&
    joined.includes('cbwallet://') &&
    joined.includes('rainbow://')
  );
}
