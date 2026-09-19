/**
 * MobileLanding — React/TS mirror of src/landing/mobile.html
 * Issue #4: mobile UA + screen-size detection, wallet deep-links, CTA tracking.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

export const MOBILE_UA =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;
export const MOBILE_MAX_WIDTH = 768;
export const EVENT_TYPE = 'mobile_landing_cta_click' as const;

export const WALLET_DEEP_LINKS = {
  metamask: 'metamask://',
  coinbase: 'cbwallet://',
  rainbow: 'rainbow://',
  browser: 'https://github.com/Nexussyn/ai-growth-engine/issues',
} as const;

export type WalletId = keyof typeof WALLET_DEEP_LINKS;

export interface ViewportInfo {
  width: number;
  height: number;
  screen_width: number;
}

export interface MobileContext {
  is_mobile: boolean;
  ua_mobile: boolean;
  size_mobile: boolean;
  viewport: ViewportInfo;
}

/** Detect mobile via UA AND max-width / screen size (either signal counts). */
export function detectMobile(
  userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  width?: number,
  screenWidth?: number,
): MobileContext {
  const ua_mobile = MOBILE_UA.test(userAgent || '');
  const w =
    width ??
    (typeof window !== 'undefined'
      ? Math.min(
          window.innerWidth || Infinity,
          (window.screen && window.screen.width) || Infinity,
        )
      : Infinity);
  const sw =
    screenWidth ??
    (typeof window !== 'undefined' && window.screen ? window.screen.width : 0);
  const size_mobile = w <= MOBILE_MAX_WIDTH;
  return {
    is_mobile: ua_mobile || size_mobile,
    ua_mobile,
    size_mobile,
    viewport: {
      width: typeof window !== 'undefined' ? window.innerWidth || 0 : Number.isFinite(w) ? w : 0,
      height: typeof window !== 'undefined' ? window.innerHeight || 0 : 0,
      screen_width: sw || 0,
    },
  };
}

/** Build system_events-shaped payload and POST to relative /api/events (resilient). */
export async function trackCTA(
  wallet: WalletId | string,
  ctx?: MobileContext,
): Promise<void> {
  try {
    const context = ctx ?? detectMobile();
    const body = {
      event_type: EVENT_TYPE,
      payload: {
        wallet,
        is_mobile: context.is_mobile,
        ua_mobile: context.ua_mobile,
        size_mobile: context.size_mobile,
        viewport: context.viewport,
        path:
          typeof location !== 'undefined'
            ? location.pathname || '/landing/mobile'
            : '/landing/mobile',
      },
      created_at: new Date().toISOString(),
    };
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {
      /* resilient — never throw into UI */
    });
  } catch {
    /* resilient */
  }
}

export interface MobileLandingProps {
  /** Optional override for tests / SSR */
  initialContext?: MobileContext;
  onTrack?: (wallet: string, ctx: MobileContext) => void;
}

/**
 * Simplified mobile hero (1 headline + CTA group) when is_mobile;
 * desktop keeps fuller copy + stats. All three wallet deep-links + browser fallback.
 */
export function MobileLanding({
  initialContext,
  onTrack,
}: MobileLandingProps): React.ReactElement {
  const [ctx, setCtx] = useState<MobileContext>(
    () => initialContext ?? detectMobile(),
  );

  useEffect(() => {
    if (initialContext) return;
    const onResize = () => setCtx(detectMobile());
    window.addEventListener('resize', onResize);
    setCtx(detectMobile());
    return () => window.removeEventListener('resize', onResize);
  }, [initialContext]);

  const handleClick = useCallback(
    (wallet: WalletId) => {
      void trackCTA(wallet, ctx);
      onTrack?.(wallet, ctx);
    },
    [ctx, onTrack],
  );

  const copy = useMemo(() => {
    if (ctx.is_mobile) {
      return {
        badge: '📱 MOBILE — Tap to earn',
        headline: (
          <>
            Earn USDC
            <br />
            <span>from your phone.</span>
          </>
        ),
        sub: 'Tap a wallet below to claim open bounties. Merge a PR → get paid on Base.',
        showStats: false,
      };
    }
    return {
      badge: '⚡ LIVE — Earning Now',
      headline: (
        <>
          Contribute code.
          <br />
          <span>Earn USDC.</span>
        </>
      ),
      sub: 'Open bounties for AI agents and developers. Claim an issue, submit a PR, earn USDC automatically on merge.',
      showStats: true,
    };
  }, [ctx.is_mobile]);

  return (
    <main
      className="hero"
      data-mobile={ctx.is_mobile ? 'true' : 'false'}
      style={{
        textAlign: 'center',
        maxWidth: 480,
        width: '100%',
        margin: '0 auto',
        padding: 24,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: '#0a0a0a',
        color: '#fff',
        minHeight: '100vh',
      }}
    >
      <div
        className="badge"
        style={{
          display: 'inline-block',
          background: '#1a1a2e',
          border: '1px solid #00ff88',
          color: '#00ff88',
          fontSize: 12,
          padding: '4px 12px',
          borderRadius: 20,
          marginBottom: 20,
          letterSpacing: 1,
        }}
      >
        {copy.badge}
      </div>
      <h1 style={{ fontSize: 'clamp(28px, 8vw, 48px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 16 }}>
        {copy.headline}
      </h1>
      <p style={{ fontSize: 16, color: '#aaa', marginBottom: 32, lineHeight: 1.6 }}>{copy.sub}</p>

      <div
        className="cta-group"
        role="group"
        aria-label="Wallet deep-links"
        style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}
      >
        <a
          className="btn btn-metamask"
          href={WALLET_DEEP_LINKS.metamask}
          data-wallet="metamask"
          onClick={() => handleClick('metamask')}
          style={btnStyle('#f6851b')}
        >
          🦊 Open in MetaMask
        </a>
        <a
          className="btn btn-coinbase"
          href={WALLET_DEEP_LINKS.coinbase}
          data-wallet="coinbase"
          onClick={() => handleClick('coinbase')}
          style={btnStyle('#0052ff')}
        >
          🔵 Coinbase Wallet
        </a>
        <a
          className="btn btn-rainbow"
          href={WALLET_DEEP_LINKS.rainbow}
          data-wallet="rainbow"
          onClick={() => handleClick('rainbow')}
          style={{
            ...btnStyle('transparent'),
            background: 'linear-gradient(135deg, #ff6b6b, #a855f7, #3b82f6)',
          }}
        >
          🌈 Rainbow
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#444', fontSize: 13 }}>
          or
        </div>
        <a
          className="btn btn-browser"
          href={WALLET_DEEP_LINKS.browser}
          data-wallet="browser"
          onClick={() => handleClick('browser')}
          style={{ ...btnStyle('#1a1a1a'), border: '1px solid #333' }}
        >
          🌐 View Bounties
        </a>
      </div>

      {copy.showStats && (
        <div
          className="stats"
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 32,
            marginTop: 40,
            paddingTop: 32,
            borderTop: '1px solid #1a1a1a',
          }}
        >
          <Stat value="$50" label="USDC Available" />
          <Stat value="5" label="Open Issues" />
          <Stat value="0%" label="Fee" />
        </div>
      )}
    </main>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '16px 24px',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 600,
    textDecoration: 'none',
    cursor: 'pointer',
    border: 'none',
    background: bg,
    color: '#fff',
  };
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#00ff88' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default MobileLanding;