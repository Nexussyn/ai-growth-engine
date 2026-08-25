/**
 * React mobile landing (optional surface for Issue #4).
 * Mirrors `mobile.html` deep-links + `mobile_landing_cta_click` tracking.
 */

import { useMemo, useCallback } from 'react';
import { detectClientContext } from '../landing/detect.ts';
import { walletDeepLinks } from '../landing/deeplinks.ts';
import { trackMobileLandingCta, type LandingEventStore } from '../landing/track.ts';

export type MobileLandingProps = {
  dappUrl?: string;
  userAgent?: string;
  viewportWidth?: number;
  store?: LandingEventStore;
  onTrack?: (wallet: string) => void;
};

export function MobileLanding(props: MobileLandingProps) {
  const dappUrl = props.dappUrl ?? 'https://github.com/Nexussyn/ai-growth-engine/issues';
  const ctx = useMemo(
    () => detectClientContext(props.userAgent, props.viewportWidth),
    [props.userAgent, props.viewportWidth],
  );
  const links = useMemo(() => walletDeepLinks(dappUrl), [dappUrl]);

  const onClick = useCallback(
    (wallet: string) => {
      if (props.store) {
        trackMobileLandingCta(wallet, ctx.isMobile, ctx.source, props.store);
      }
      props.onTrack?.(wallet);
    },
    [props, ctx.isMobile, ctx.source],
  );

  return (
    <section data-mobile={ctx.isMobile ? '1' : '0'} data-source={ctx.source}>
      <h1>Contribute code. Earn USDC.</h1>
      <p>
        {ctx.isMobile
          ? 'One tap opens your wallet app. Claim a bounty, ship a PR, get paid USDC on Base.'
          : 'Claim an issue, submit a PR, earn USDC automatically on merge.'}
      </p>
      <nav>
        {links.map((l) => (
          <a
            key={l.wallet}
            href={l.href}
            data-wallet={l.wallet}
            onClick={() => onClick(l.wallet)}
          >
            {l.label}
          </a>
        ))}
      </nav>
    </section>
  );
}

export default MobileLanding;
