import React from 'react';

const MobileLanding = () => {
  const handleCtaClick = () => {
    // Track conversion event
    window.dispatchEvent(new CustomEvent('system_events', { detail: { type: 'mobile_landing_cta_click' } }));
  };

  return (
    <div className="mobile-landing">
      <h1>Join the Future of AI</h1>
      <button onClick={handleCtaClick}>
        <a href="metamask://">MetaMask</a>
        <a href="cbwallet://">Coinbase Wallet</a>
        <a href="rainbow://">Rainbow</a>
      </button>
    </div>
  );
};

export default MobileLanding;
