import React, { useEffect, useState } from 'react';

export interface WalletDeepLink {
  id: 'metamask' | 'coinbase' | 'rainbow';
  label: string;
  href: string;
}

export const WALLET_DEEP_LINKS: WalletDeepLink[] = [
  { id: 'metamask', label: 'Open in MetaMask', href: 'metamask://' },
  { id: 'coinbase', label: 'Coinbase Wallet', href: 'cbwallet://' },
  { id: 'rainbow', label: 'Rainbow Wallet', href: 'rainbow://' },
];

export function isMobileUserAgent(userAgent: string, viewportWidth = 1024): boolean {
  return /iPhone|iPad|iPod|Android|Mobile/i.test(userAgent) || viewportWidth <= 768;
}

export async function trackMobileLandingCTA(
  wallet: string,
  isMobile: boolean,
  fetchImpl: typeof fetch = fetch
) {
  const payload = {
    table: 'system_events',
    event_type: 'mobile_landing_cta_click',
    wallet,
    mobile: isMobile,
    conversion_segment: isMobile ? 'mobile_conversion' : 'desktop_conversion',
    ts: Date.now(),
  };
  try {
    await fetchImpl('https://kjtirbnxxymeumycrhqv.supabase.co/functions/v1/runtime-discovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-blocking telemetry
  }
  return payload;
}

export default function MobileLanding() {
  const [isMobile, setIsMobile] = useState<boolean>(true);

  useEffect(() => {
    const check = () =>
      setIsMobile(isMobileUserAgent(navigator.userAgent, window.innerWidth));
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <main className="hero">
      <h1>Contribute code. <span>Earn USDC.</span></h1>
      {isMobile ? (
        <a
          href="metamask://"
          onClick={() => trackMobileLandingCTA('metamask', true)}
        >
          Launch Wallet & Claim Bounty
        </a>
      ) : null}
      <div className="cta-group">
        {WALLET_DEEP_LINKS.map((w) => (
          <a
            key={w.id}
            href={w.href}
            onClick={() => trackMobileLandingCTA(w.id, isMobile)}
          >
            {w.label}
          </a>
        ))}
      </div>
    </main>
  );
}
