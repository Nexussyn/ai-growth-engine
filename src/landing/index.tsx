import React from 'react';
import MobileLanding from './MobileLanding';

const LandingPage = () => {
  const isMobile = () => {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('mobile') || ua.includes('android') || ua.includes('iphone');
  };

  return (
    <div>
      {isMobile() ? <MobileLanding /> : <DesktopLanding />}
    </div>
  );
};

export default LandingPage;
