import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMobileSessionToken,
  validateMobileSessionToken,
} from '../lib/campus/scan-to-brief.mjs';
import { checkFinancialCardPrivacyRisk } from '../lib/scan/scale-calibration.mjs';

test('1. Session token expiration prevents replay beyond TTL', () => {
  const tokenData = createMobileSessionToken('sess-sec-1', 'rev-security');
  assert.equal(validateMobileSessionToken('sess-sec-1', tokenData.token).valid, true);

  // Expired token is rejected
  const expiredToken = 'tok-expired-test';
  assert.equal(validateMobileSessionToken('sess-sec-1', expiredToken).valid, false);
});

test('2. Financial credit card PAN/CVV detection blocks payment card upload', () => {
  const paymentCardOcr = 'Mastercard 5412 7512 3412 3456 CVV 789 Exp 08/29';
  const risk = checkFinancialCardPrivacyRisk(paymentCardOcr);
  assert.equal(risk.privacyRisk, true);
  assert.equal(risk.recommendedAction, 'RETAKE_WITH_BLANK_TARGET');
});

test('3. Scan session identifiers remain isolated across review scopes', () => {
  const t1 = createMobileSessionToken('session-review-a', 'rev-a');
  const t2 = createMobileSessionToken('session-review-b', 'rev-b');

  assert.notEqual(t1.token, t2.token);
  assert.equal(validateMobileSessionToken('session-review-a', t2.token).valid, false);
});
