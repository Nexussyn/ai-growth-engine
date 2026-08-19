import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

describe('Mobile Landing Page (#4)', () => {
  const htmlPath = path.join(__dirname, '../src/landing/mobile.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  it('includes wallet app deep-links for MetaMask, Coinbase Wallet, and Rainbow', () => {
    assert.ok(html.includes('href="metamask://"'), 'MetaMask deep-link missing');
    assert.ok(html.includes('href="cbwallet://"'), 'Coinbase Wallet deep-link missing');
    assert.ok(html.includes('href="rainbow://"'), 'Rainbow deep-link missing');
  });

  it('tracks mobile_landing_cta_click conversion event', () => {
    assert.ok(html.includes('mobile_landing_cta_click'), 'Conversion event tracking missing');
  });

  it('contains mobile viewport and responsive styles', () => {
    assert.ok(html.includes('name="viewport"'), 'Viewport meta tag missing');
    assert.ok(html.includes('@media (min-width: 600px)'), 'Responsive media query missing');
  });
});
