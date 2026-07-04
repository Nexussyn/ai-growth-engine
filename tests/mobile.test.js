const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const HTML_PATH = path.join(__dirname, '../src/landing/mobile.html');

test('Mobile Landing Page - Deep-links & Tracking Verification', () => {
  const content = fs.readFileSync(HTML_PATH, 'utf8');

  // Verify deep links are present
  assert.ok(content.includes('metamask://'), 'Should contain metamask:// deep link');
  assert.ok(content.includes('cbwallet://'), 'Should contain cbwallet:// deep link');
  assert.ok(content.includes('rainbow://'), 'Should contain rainbow:// deep link');

  // Verify Supabase event type
  assert.ok(content.includes('mobile_landing_cta_click'), 'Should track mobile_landing_cta_click');

  // Verify Supabase API endpoint
  assert.ok(content.includes('supabase.co/functions/v1/runtime-discovery'), 'Should point to correct Supabase tracking endpoint');

  // Verify Google Fonts (Outfit and Inter) are imported for premium aesthetics
  assert.ok(content.includes('fonts.googleapis.com/css2?family=Outfit'), 'Should import Outfit font from Google Fonts');
  assert.ok(content.includes('fonts.googleapis.com/css2?family=Inter'), 'Should import Inter font from Google Fonts');
});
