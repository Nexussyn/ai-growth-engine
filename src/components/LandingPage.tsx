@@ -1,6 +1,8 @@
 import React, { useEffect, useState } from 'react';
 import { trackEvent } from '../utils/analytics';

+const isMobile = () => window.innerWidth <= 768;
+
 const LandingPage = () => {
   const [isMobileView, setIsMobileView] = useState(false);

@@ -10,6 +12,14 @@
     const handleResize = () => {
       setIsMobileView(isMobile());
     };
+    
+    const handleCtaClick = (wallet: string) => {
+      trackEvent('mobile_landing_cta_click', { wallet });
+      window.location.href = wallet;
+    };

     return () => {
       window.removeEventListener('resize', handleResize);
     };
+  };
+
+  useEffect(() => {
+    setIsMobileView(isMobile());
+  }, []);

   return (
     <div>
@@ -24,6 +34,18 @@
           <h1>Welcome to AI Growth Engine</h1>
           <p>Your autonomous growth system</p>
           <button onClick={() => trackEvent('desktop_landing_cta_click')}>Get Started</button>
+         ) : (
+           <>
+             <h1>Welcome to AI Growth Engine</h1>
+             <button onClick={() => handleCtaClick('metamask://')}>Connect with MetaMask</button>
+             <button onClick={() => handleCtaClick('cbwallet://')}>Connect with Coinbase Wallet</button>
+             <button onClick={() => handleCtaClick('rainbow://')}>Connect with Rainbow</button>
+           </>
+         )}
       </div>
     </div>
   );
```

This patch adds a function to detect mobile view, sets up event listeners to track resize events, and conditionally renders the simplified CTA buttons for mobile users. It also tracks the CTA clicks with the appropriate event.