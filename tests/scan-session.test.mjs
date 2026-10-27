import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMobileSessionToken,
  validateMobileSessionToken,
  getScanSession,
  saveScanSessionPanel,
  retakePanel,
  resetScanSession,
} from '../lib/campus/scan-to-brief.mjs';

test('1. Camera scan session requires valid authorization token', () => {
  const missing = validateMobileSessionToken('session-1', null);
  assert.equal(missing.valid, false);
  assert.match(missing.error, /missing/i);

  const invalid = validateMobileSessionToken('session-1', 'invalid-token-123');
  assert.equal(invalid.valid, false);
  assert.match(invalid.error, /invalid/i);
});

test('2. Mobile pairing token grants access and binds to session ID', () => {
  const sessionToken = createMobileSessionToken('sess-test-1', 'rev-dancing-fish');
  assert.ok(sessionToken.token.startsWith('tok-'));
  assert.equal(sessionToken.sessionId, 'sess-test-1');
  assert.equal(sessionToken.reviewId, 'rev-dancing-fish');
  assert.ok(sessionToken.qrUrl.includes('session=sess-test-1'));

  const valid = validateMobileSessionToken('sess-test-1', sessionToken.token);
  assert.equal(valid.valid, true);
  assert.equal(valid.reviewId, 'rev-dancing-fish');

  // Mismatched session ID rejected
  const mismatch = validateMobileSessionToken('other-session', sessionToken.token);
  assert.equal(mismatch.valid, false);
  assert.match(mismatch.error, /does not match/i);
});

test('3. Scan session persists panel data and records capture history on retake', () => {
  const sId = `session-${Date.now()}`;
  resetScanSession(sId);

  // Initial front capture
  saveScanSessionPanel(sId, {
    face: 'front',
    text: 'Dancing Fish Granola Rev 1',
    variance: 130,
  });

  let session = getScanSession(sId);
  assert.equal(session.panels.front.text, 'Dancing Fish Granola Rev 1');
  assert.equal(session.panels.front.version, 1);
  assert.equal(session.history.length, 0);

  // Retake front face
  saveScanSessionPanel(sId, {
    face: 'front',
    text: 'Dancing Fish Granola Rev 2 (Sharper Focus)',
    variance: 165,
  });

  session = getScanSession(sId);
  assert.equal(session.panels.front.text, 'Dancing Fish Granola Rev 2 (Sharper Focus)');
  assert.equal(session.panels.front.version, 2);
  assert.equal(session.history.length, 1);
  assert.equal(session.history[0].text, 'Dancing Fish Granola Rev 1');
  assert.ok(session.history[0].supersededAt);
});

test('4. Retake panel clears current face while archiving historical provenance', () => {
  const sId = `session-retake-${Date.now()}`;
  resetScanSession(sId);

  saveScanSessionPanel(sId, { face: 'right', text: 'Nutrition Facts 140' });
  assert.ok(getScanSession(sId).panels.right);

  retakePanel(sId, 'right');
  const session = getScanSession(sId);
  assert.equal(session.panels.right, undefined);
  assert.equal(session.history.length, 1);
  assert.equal(session.history[0].retakeInitiated, true);
});
