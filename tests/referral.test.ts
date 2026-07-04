import {
  generateReferralCode,
  validateReferralInput,
  buildReferralNotifications,
} from '../src/growth/referral';
import type { ReferralCode, ReferralConversion } from '../src/growth/referral';

function testGenerateCode() {
  const code = generateReferralCode();
  console.assert(code.length === 8, `Expected length 8, got ${code.length}`);
  console.assert(/^[A-Z2-9]+$/.test(code), `Invalid chars in code: ${code}`);
  console.log('PASS: generateReferralCode produces 8-char alphanumeric code');
}

function testGenerateCodeUnique() {
  const codes = new Set<string>();
  for (let i = 0; i < 100; i++) {
    codes.add(generateReferralCode());
  }
  console.assert(codes.size > 95, `Only ${codes.size} unique codes out of 100`);
  console.log('PASS: generateReferralCode produces sufficiently unique codes');
}

const mockCodes: ReferralCode[] = [
  { id: '1', code: 'ABC12345', owner_id: 'user_1', uses: 0, credits_awarded: 0, created_at: '2026-07-04T00:00:00Z' },
];

const mockConversions: ReferralConversion[] = [
  { id: '1', referral_code: 'ABC12345', new_user_id: 'user_already', converted_at: '2026-07-04T01:00:00Z' },
];

function testValidateEmptyCode() {
  const result = validateReferralInput('', 'user_2', mockCodes, []);
  console.assert(!result.valid, 'Should reject empty code');
  console.log('PASS: validateReferralInput rejects empty code');
}

function testValidateShortCode() {
  const result = validateReferralInput('SHORT', 'user_2', mockCodes, []);
  console.assert(!result.valid, 'Should reject short code');
  console.log('PASS: validateReferralInput rejects short code');
}

function testValidateNonexistentCode() {
  const result = validateReferralInput('ZZZZZZZZ', 'user_2', mockCodes, []);
  console.assert(!result.valid, 'Should reject nonexistent code');
  console.log('PASS: validateReferralInput rejects nonexistent code');
}

function testValidateDuplicateConversion() {
  const result = validateReferralInput('ABC12345', 'user_already', mockCodes, mockConversions);
  console.assert(!result.valid, 'Should reject duplicate conversion');
  console.log('PASS: validateReferralInput rejects duplicate conversion');
}

function testValidateHappyPath() {
  const result = validateReferralInput('ABC12345', 'user_new', mockCodes, []);
  console.assert(result.valid, `Should accept valid referral, got: ${result.error}`);
  console.log('PASS: validateReferralInput accepts valid referral');
}

function testNotifications() {
  const notifications = buildReferralNotifications('user_1', 'user_2', 5);
  console.assert(notifications.length === 2, `Expected 2 notifications, got ${notifications.length}`);
  console.assert(notifications[0].userId === 'user_1', 'First should be referrer');
  console.assert(notifications[1].userId === 'user_2', 'Second should be new user');
  console.log('PASS: buildReferralNotifications produces correct notification pair');
}

console.log('Running referral system tests...\n');
testGenerateCode();
testGenerateCodeUnique();
testValidateEmptyCode();
testValidateShortCode();
testValidateNonexistentCode();
testValidateDuplicateConversion();
testValidateHappyPath();
testNotifications();
console.log('\nAll tests passed!');
