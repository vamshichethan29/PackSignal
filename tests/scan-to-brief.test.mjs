import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getScanSession,
  saveScanSessionPanel,
  resetScanSession,
  generateBriefFromScanSession,
} from '../lib/campus/scan-to-brief.mjs';

test('1. Generates evidence-backed brief from photo scan session', () => {
  const sId = `session-brief-${Date.now()}`;
  resetScanSession(sId);

  saveScanSessionPanel(sId, {
    face: 'front',
    text: 'Dancing Fish Granola Berry Crunch Net Wt 10 oz (283 g)',
    values: { brand_name: 'Dancing Fish Granola', net_quantity: '10 oz (283 g)' },
    dualReader: { status: 'CONFIRMED', isConfirmed: true },
    photoUrl: '/samples/campus/front.png',
  });

  saveScanSessionPanel(sId, {
    face: 'back',
    text: 'Ingredients: Oats, Honey (1%), Almonds. Contains: Almonds, Wheat.',
    values: { allergen_statement: 'Contains: Almonds, Wheat' },
    dualReader: { status: 'CONFIRMED', isConfirmed: true },
    photoUrl: '/samples/campus/back.png',
  });

  const brief = generateBriefFromScanSession(sId, { hasApprovedSpec: false });
  assert.equal(brief.status, 'COMPLETE');
  assert.equal(brief.sourceRoute, 'PHYSICAL_PACKAGE_CAMERA_INTAKE');
  assert.match(brief.title, /Dancing Fish Granola/);
  assert.equal(brief.observedPackagingFacts.netQuantity, '10 oz (283 g)');
  assert.equal(brief.observedPackagingFacts.allergenDisclosure, 'Contains: Almonds, Wheat');

  // When spec is missing, sourceAuthority states incomplete authority
  assert.equal(brief.sourceAuthority.status, 'NO_SPECIFICATION_ATTACHED');
  assert.match(brief.sourceAuthority.disclaimer, /Product specification not yet supplied/i);

  // Evidence appendix contains real photo crops and hashes
  assert.equal(brief.sourceEvidenceAppendix.length, 2);
  assert.ok(brief.sourceEvidenceAppendix[0].cropUrl);
  assert.ok(brief.sourceEvidenceAppendix[0].sha256);
});

test('2. Strict isolation: Hidden EU table content from PDF does NOT leak into photo brief', () => {
  const sId = `session-eu-isolation-${Date.now()}`;
  resetScanSession(sId);

  saveScanSessionPanel(sId, {
    face: 'front',
    text: 'Dancing Fish Granola Berry Crunch',
    values: { brand_name: 'Dancing Fish Granola' },
  });

  const brief = generateBriefFromScanSession(sId, { hasApprovedSpec: false });

  // Assert zero mentions of European 1169/2011 nutrition tables in observed facts
  const briefText = JSON.stringify(brief.observedPackagingFacts).toLowerCase();
  assert.equal(briefText.includes('eu nutrition'), false);
  assert.equal(briefText.includes('1169/2011'), false);
  assert.equal(brief.hiddenEuTablePolicy.enforced, true);
  assert.match(brief.hiddenEuTablePolicy.result, /zero hallucinations from hidden PDF layers/i);
});

test('3. Attached Draft Specification is accurately declared as draft', () => {
  const sId = `session-draft-spec-${Date.now()}`;
  resetScanSession(sId);

  saveScanSessionPanel(sId, { face: 'front', text: 'Dancing Fish' });

  const brief = generateBriefFromScanSession(sId, { hasApprovedSpec: true, isDraft: true });
  assert.equal(brief.sourceAuthority.status, 'DRAFT_SPECIFICATION_ATTACHED');
  assert.match(brief.sourceAuthority.disclaimer, /Draft Organizer Content Sheet \(In Review\)/);
});
