/* mobile-landing.js — mobile detection, wallet deep-links, conversion tracking.
 *
 * Loads with `defer` so it never blocks first paint. No external
 * dependencies, no fonts, no frameworks — keeps the page light enough
 * for a >90 Lighthouse mobile score.
 */

(function () {
  'use strict';

  /* ---- platform detection ----
   * navigator.userAgentData.mobile is authoritative on modern Chrome;
   * the touch heuristic catches iPadOS 13+, which reports as
   * "Macintosh" in the UA string (the plain regex misses it). */
  var ua = navigator.userAgent || '';
  var uaDataMobile = (navigator.userAgentData && navigator.userAgentData.mobile) === true;
  var uaRegex = /iPhone|iPad|iPod|Android|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  var touchIPad = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  var isMobile = uaDataMobile || uaRegex || touchIPad;
  var isIOS = /iPhone|iPad|iPod/i.test(ua) || touchIPad;
  var isAndroid = /Android/i.test(ua);
  var platform = isIOS ? 'ios' : isAndroid ? 'android' : isMobile ? 'mobile' : 'desktop';

  /* ---- wallet config: deep-link scheme, desktop install page, app-store fallbacks ---- */
  var WALLETS = {
    metamask: {
      scheme: 'metamask://',
      install: 'https://metamask.io/download/',
      store: isIOS
        ? 'https://apps.apple.com/app/metamask/id1438144202'
        : 'https://play.google.com/store/apps/details?id=io.metamask'
    },
    coinbase: {
      scheme: 'cbwallet://',
      install: 'https://www.coinbase.com/wallet/downloads',
      store: isIOS
        ? 'https://apps.apple.com/app/coinbase-wallet/id1278383455'
        : 'https://play.google.com/store/apps/details?id=org.toshi'
    },
    rainbow: {
      scheme: 'rainbow://',
      install: 'https://rainbow.me/download',
      store: isIOS
        ? 'https://apps.apple.com/app/rainbow-ethereum-wallet/id1457119029'
        : 'https://play.google.com/store/apps/details?id=me.rainbow'
    }
  };

  /* ---- conversion tracking ----
   * event_type 'mobile_landing_cta_click' lands in system_events via the
   * project's tracking edge function; `platform` lets mobile and desktop
   * conversion be counted separately per acceptance criteria.
   * sendBeacon is used because a deep-link click switches apps immediately —
   * a plain fetch would be cancelled before it completes. */
  var TRACK_URL = 'https://kjtirbnxxymeumycrhqv.supabase.co/functions/v1/runtime-discovery';

  function trackCTA(wallet) {
    var payload = JSON.stringify({
      event_type: 'mobile_landing_cta_click',
      wallet: wallet,
      platform: platform,
      mobile: isMobile,
      ts: Date.now()
    });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(TRACK_URL, payload)) return;
    } catch (e) { /* fall through */ }
    fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    }).catch(function () { /* tracking must never break the page */ });
  }

  /* ---- deep-link with app-store fallback ----
   * Fires the scheme; if the page is still visible after ~1.5s the wallet
   * app isn't installed, so we route to the store instead of a dead link.
   * Desktop never gets scheme links — it goes straight to install pages. */
  function openWallet(wallet) {
    var cfg = WALLETS[wallet];
    if (!cfg) return;
    trackCTA(wallet);
    if (!isMobile) {
      window.open(cfg.install, '_blank', 'noopener');
      return;
    }
    var storeUrl = isIOS || isAndroid ? cfg.store : cfg.install;
    var timer = setTimeout(function () {
      if (!document.hidden) window.location.href = storeUrl;
    }, 1500);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) clearTimeout(timer);
    }, { once: true });
    window.location.href = cfg.scheme;
  }

  /* ---- wire up the page ---- */
  document.querySelectorAll('[data-wallet]').forEach(function (el) {
    var wallet = el.getAttribute('data-wallet');
    el.addEventListener('click', function (ev) {
      ev.preventDefault();
      openWallet(wallet);
    });
    // Desktop: label honest about where the button goes (install, not open).
    if (!isMobile && WALLETS[wallet]) {
      var label = el.querySelector('.btn-label');
      if (label) label.textContent = 'Get ' + label.textContent.replace(/^(Open in|Get) /, '');
    }
  });

  var viewBtn = document.querySelector('[data-action="view-bounties"]');
  if (viewBtn) {
    viewBtn.addEventListener('click', function () { trackCTA('browser'); });
  }

  // Desktop copy: no wallet app to deep-link into, so point at the issues.
  if (!isMobile) {
    var sub = document.querySelector('.hero p');
    if (sub) sub.textContent = 'Open bounties for AI agents and developers. Claim an issue, submit a PR, earn USDC automatically on merge.';
  }
})();
