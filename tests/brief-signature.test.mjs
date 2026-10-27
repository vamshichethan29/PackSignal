/**
 * @file tests/brief-signature.test.mjs
 * 
 * Unit tests for Phase 5 Export Manifest and Cryptographic Integrity Binding.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resetDeskSession } from '../lib/evidence-desk.mjs';
import { buildBriefFromSession } from '../lib/brief/brief-builder.mjs';
import { createBriefExportManifest, verifyBriefManifest } from '../lib/brief/brief-manifest.mjs';

describe('Phase 5 — Brief Export Manifest & Cryptographic Binding', () => {

  test('1. Creates structured manifest with content hashes and seal', () => {
    const session = resetDeskSession('test-manifest-create');
    const brief = buildBriefFromSession(session);
    brief.status = 'APPROVED';

    const manifest = createBriefExportManifest({
      brief,
      session,
      reviewer: { name: 'Elena Rostova', role: 'REGULATORY_LEAD' }
    });

    assert.strictEqual(manifest.schema, 'packsignal-brief-manifest/v1');
    assert.strictEqual(manifest.briefId, brief.briefId);
    assert.ok(manifest.briefContentHash);
    assert.ok(manifest.manifestHash);
    assert.match(manifest.signatureSeal, /^SEAL-PACKSIGNAL-/);
    assert.ok(manifest.sourceDocumentHashes.length > 0);
  });

  test('2. Verifies manifest successfully when brief content is untampered', () => {
    const session = resetDeskSession('test-manifest-verify-pass');
    const brief = buildBriefFromSession(session);

    const manifest = createBriefExportManifest({ brief, session });
    const verifyRes = verifyBriefManifest(manifest, brief);

    assert.strictEqual(verifyRes.valid, true);
    assert.match(verifyRes.reason, /matches manifest checksum/i);
  });

  test('3. Detects tampering when brief content changes after manifest export', () => {
    const session = resetDeskSession('test-manifest-tamper');
    const brief = buildBriefFromSession(session);

    const manifest = createBriefExportManifest({ brief, session });

    // Tamper with a sentence in the brief
    brief.sentences[0].text = 'Tampered text claiming 999g and certified vegan.';

    const verifyRes = verifyBriefManifest(manifest, brief);
    assert.strictEqual(verifyRes.valid, false);
    assert.match(verifyRes.reason, /Content hash mismatch/i);
  });

});
