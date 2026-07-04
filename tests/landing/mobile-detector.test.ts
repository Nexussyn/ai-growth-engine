import { describe, it, expect } from 'vitest';
import { isMobileDevice, isWalletApp, getMobileCTA } from '../../src/landing/mobile-detector';

describe('isMobileDevice', () => {
  it('should detect Android', () => expect(isMobileDevice('Mozilla/5.0 Android 13')).toBe(true));
  it('should detect iPhone', () => expect(isMobileDevice('Mozilla/5.0 iPhone CPU iPhone OS')).toBe(true));
  it('should not detect desktop', () => expect(isMobileDevice('Mozilla/5.0 Windows NT 10.0')).toBe(false));
});

describe('isWalletApp', () => {
  it('should detect Phantom', () => expect(isWalletApp('Mozilla/5.0 Phantom/25.0')).toBe(true));
  it('should detect MetaMask', () => expect(isWalletApp('Mozilla/5.0 MetaMask/10.0')).toBe(true));
  it('should not detect Chrome', () => expect(isWalletApp('Mozilla/5.0 Chrome/120')).toBe(false));
});

describe('getMobileCTA', () => {
  it('should return mobile CTA for mobile', () => {
    const cta = getMobileCTA('Mozilla/5.0 Android 13');
    expect(cta.text).toContain('Connect Wallet');
  });
  it('should return desktop CTA for desktop', () => {
    const cta = getMobileCTA('Mozilla/5.0 Windows NT 10.0');
    expect(cta.text).toContain('Browse Bounties');
  });
});
