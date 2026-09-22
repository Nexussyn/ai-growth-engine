import React, { useEffect, useState } from 'react';

/**
 * MobileLanding Component
 * 
 * Provides a mobile-optimized landing page experience.
 * Detects mobile devices and provides direct deep-links to popular Web3 wallets.
 * Tracks conversion events via the system's event logging mechanism.
 */

// Interface for the expected system_events global object
interface SystemEvents {
  log: (eventName: string, metadata?: Record<string, any>) => void;
}

declare global {
  interface Window {
    system_events?: SystemEvents;
  }
}

const MobileLanding: React.FC = () => {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const detectMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).MS_Agent;
      const isMobileUA = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      const isSmallScreen = window.innerWidth <= 768;
      setIsMobile(isMobileUA || isSmallScreen);
      setIsLoading(false);
    };

    detectMobile();
    window.addEventListener('resize', detectMobile);
    return () => window.removeEventListener('resize', detectMobile);
  }, []);

  const handleWalletClick = (walletName: string, deepLink: string) => {
    // 1. Track the conversion event
    if (window.system_events) {
      window.system_events.log('mobile_landing_cta_click', {
        wallet: walletName,
        platform: isMobile ? 'mobile' : 'desktop'
      });
    } else {
      console.log(`[Tracking] mobile_landing_cta_click: ${walletName}, platform: ${isMobile ? 'mobile' : 'desktop'}`);
    }

    // 2. Execute deep link
    window.location.href = deepLink;
  };

  const wallets = [
    { name: 'MetaMask', url: 'metamask://' },
    { name: 'Coinbase Wallet', url: 'cbwallet://' },
    { name: 'Rainbow', url: 'rainbow://' },
  ];

  if (isLoading) {
    return <div style={{ backgroundColor: '#000', height: '100vh' }} />;
  }

  // Desktop View (Simplified fallback)
  if (!isMobile) {
    return (
      <div style={styles.desktopContainer}>
        <h1 style={styles.desktopTitle}>AI Growth Engine</h1>
        <p style={styles.desktopSubtitle}>
          Scale your Web3 presence with AI-driven automation.
        </p>
        <button style={styles.desktopButton}>
          Get Started
        </button>
      </div>
    );
  }

  // Mobile View
  return (
    <div style={styles.mobileContainer}>
      <header style={styles.mobileHeader}>
        <h1 style={styles.mobileTitle}>
          Grow your Web3 presence.
        </h1>
        <p style={styles.mobileSubtitle}>
          Connect your mobile wallet to begin.
        </p>
      </header>

      <main style={styles.mobileMain}>
        {wallets.map((wallet) => (
          <button
            key={wallet.name}
            onClick={() => handleWalletClick(wallet.name, wallet.url)}
            style={styles.walletButton}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            Open {wallet.name}
          </button>
        ))}
      </main>

      <footer style={styles.mobileFooter}>
        Powered by AI Growth Engine
      </footer>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  desktopContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: '#000',
    color: '#fff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textAlign: 'center',
    padding: '20px',
  },
  desktopTitle: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  desktopSubtitle: {
    fontSize: '1.25rem',
    color: '#aaa',
    marginBottom: '2rem',
  },
  desktopButton: {
    padding: '12px 24px',
    fontSize: '1rem',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#3b82f6',
    color: 'white',
    cursor: 'pointer',
  },
  mobileContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#000',
    color: '#fff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textAlign: 'center',
    padding: '24px',
    boxSizing: 'border-box',
  },
  mobileHeader: {
    marginBottom: '2.5rem',
  },
  mobileTitle: {
    fontSize: '2.25rem',
    lineHeight: '1.2',
    marginBottom: '1rem',
  },
  mobileSubtitle: {
    fontSize: '1.1rem',
    color: '#aaa',
  },
  mobileMain: {
    width: '100%',
    maxWidth: '320px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  walletButton: {
    width: '100%',
    padding: '16px',
    fontSize: '1.1rem',
    fontWeight: '600',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#ffffff',
    color: '#000000',
    cursor: 'pointer',
    transition: 'transform 0.1s ease',
  },
  mobileFooter: {
    marginTop: 'auto',
    paddingTop: '2rem',
    fontSize: '0.875rem',
    color: '#666',
  },
};

export default MobileLanding;