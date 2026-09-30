import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const htmlPath = path.resolve('/home/user/github_bounty_10usdc/src/landing/mobile.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// 1. Verify mobile viewport & semantic structure
assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1\.0/);
assert.match(html, /<h1[^>]*>Contribute code\.<br><span>Earn USDC\.<\/span><\/h1>/);

// 2. Verify all required wallet deep-links
assert.match(html, /metamask:\/\//, 'Missing MetaMask deep-link');
assert.match(html, /cbwallet:\/\//, 'Missing Coinbase Wallet deep-link');
assert.match(html, /rainbow:\/\//, 'Missing Rainbow Wallet deep-link');

// 3. Verify User-Agent + screen size detection for iOS Safari & Android Chrome
assert.match(html, /iPhone\|iPad\|iPod\|Android/i);
assert.match(html, /window\.innerWidth\s*<=\s*768/);

// 4. Verify conversion event tracking in system_events with mobile_landing_cta_click and separate mobile vs desktop conversion segments
assert.match(html, /system_events/);
assert.match(html, /mobile_landing_cta_click/);
assert.match(html, /mobile_conversion/);
assert.match(html, /desktop_conversion/);

console.log('ALL 4 MOBILE LANDING ACCEPTANCE TESTS PASSED!');
