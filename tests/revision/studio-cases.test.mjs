import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareArtworkRevisions,
  evaluateComparisonBasis,
  check3DGeometryCompatibility,
  analyzeBarcodeRelocation,
  analyzeFontSizeReduction,
  correlateFindings,
  REVISION_CHANGE_TYPES,
  COMPARISON_MODES,
} from '../../lib/revision/index.mjs';

test('TEST 1: Identical artwork -> No meaningful visual or semantic changes', () => {
  const revA = {
    id: 'rev-1',
    documents: [{ role: 'artwork', sha256: 'identical-sha', pages: [{ number: 1, text: 'Clean label' }] }],
    findings: [{ id: 'f1', status: 'match', title: 'Product name', observed: 'Oat Drink', expected: 'Oat Drink' }],
  };
  const revB = {
    id: 'rev-2',
    documents: [{ role: 'artwork', sha256: 'identical-sha', pages: [{ number: 1, text: 'Clean label' }] }],
    findings: [{ id: 'f1', status: 'match', title: 'Product name', observed: 'Oat Drink', expected: 'Oat Drink' }],
  };

  const cmp = compareArtworkRevisions(revA, revB);
  assert.equal(cmp.summary.regressions, 0);
  assert.equal(cmp.summary.newIssues, 0);
  assert.equal(cmp.summary.verifiedFixes, 0);
  assert.equal(cmp.summary.unchangedCount, 1);
});

test('TEST 2: Incorrect quantity corrected -> Verified resolution', () => {
  const revA = {
    id: 'rev-1',
    documents: [{ role: 'artwork', sha256: 'art-1', pages: [{ number: 1, text: '750 mL' }] }],
    findings: [{ id: 'f-qty', status: 'issue', title: 'Net Quantity', observed: '750 mL', expected: '1000 mL' }],
  };
  const revB = {
    id: 'rev-2',
    documents: [{ role: 'artwork', sha256: 'art-2', pages: [{ number: 1, text: '1000 mL' }] }],
    findings: [{ id: 'f-qty', status: 'match', title: 'Net Quantity', observed: '1000 mL', expected: '1000 mL' }],
  };

  const cmp = compareArtworkRevisions(revA, revB);
  assert.equal(cmp.summary.verifiedFixes, 1);
  assert.equal(cmp.changes[0].classification, REVISION_CHANGE_TYPES.VERIFIED_RESOLVED);
  assert.equal(cmp.changes[0].statusColor, 'green');
});

test('TEST 3: Allergen declaration removed -> Regression with source requirement', () => {
  const revA = {
    id: 'rev-1',
    documents: [{ role: 'artwork', sha256: 'art-1', pages: [{ number: 1, text: 'Contains Milk' }] }],
    findings: [{ id: 'f-allergen', status: 'match', title: 'Allergen declaration', observed: 'Contains Milk', expected: 'Contains Milk', evidence: [{ page: 1 }] }],
  };
  const revB = {
    id: 'rev-2',
    documents: [{ role: 'artwork', sha256: 'art-2', pages: [{ number: 1, text: 'Logo redesign' }] }],
    findings: [],
  };

  const cmp = compareArtworkRevisions(revA, revB);
  assert.equal(cmp.summary.regressions, 1);
  const regr = cmp.changes.find(c => c.classification === REVISION_CHANGE_TYPES.REGRESSION);
  assert.ok(regr);
  assert.equal(regr.statusColor, 'red');
});

test('TEST 4: Allergen area unreadable in B -> Unverified, not definite removal', () => {
  const revA = {
    id: 'rev-1',
    documents: [{ role: 'artwork', sha256: 'art-1', pages: [{ number: 1, text: 'Contains Milk' }] }],
    findings: [{ id: 'f-allergen', status: 'match', title: 'Allergen declaration', observed: 'Contains Milk', expected: 'Contains Milk' }],
  };
  const revB = {
    id: 'rev-2',
    documents: [{ role: 'artwork', sha256: 'art-2', pages: [{ number: 1, text: '' }] }],
    findings: [{ id: 'f-allergen', status: 'unable', title: 'Allergen declaration', observed: 'Unreadable region', expected: 'Contains Milk' }],
  };

  const cmp = compareArtworkRevisions(revA, revB);
  assert.equal(cmp.summary.regressions, 1);
  assert.equal(cmp.changes[0].statusColor, 'red');
});

test('TEST 5: Barcode moved into confirmed restricted geometry -> Regression', () => {
  const revA = {
    id: 'rev-1',
    documents: [{ role: 'artwork', pages: [{ number: 1, codes: [{ value: '012345678905', type: 'EAN13', box: [0.4, 0.7, 0.6, 0.9] }] }] }],
    findings: [],
  };
  const revB = {
    id: 'rev-2',
    documents: [{ role: 'artwork', pages: [{ number: 1, codes: [{ value: '012345678905', type: 'EAN13', box: [0.90, 0.7, 0.99, 0.9] }] }] }],
    findings: [],
  };

  const cmp = compareArtworkRevisions(revA, revB);
  assert.ok(cmp.summary.regressions >= 1);
  const bcRegr = cmp.changes.find(c => c.id.includes('barcode'));
  assert.ok(bcRegr);
  assert.equal(bcRegr.classification, REVISION_CHANGE_TYPES.REGRESSION);
  assert.equal(bcRegr.statusColor, 'red');
});

test('TEST 6: Barcode moved harmlessly -> Stable or neutral movement', () => {
  const revA = {
    id: 'rev-1',
    documents: [{ role: 'artwork', pages: [{ number: 1, codes: [{ value: '012345678905', type: 'EAN13', box: [0.4, 0.7, 0.6, 0.9] }] }] }],
    findings: [],
  };
  const revB = {
    id: 'rev-2',
    documents: [{ role: 'artwork', pages: [{ number: 1, codes: [{ value: '012345678905', type: 'EAN13', box: [0.41, 0.7, 0.61, 0.9] }] }] }],
    findings: [],
  };

  const cmp = compareArtworkRevisions(revA, revB);
  const bcChange = cmp.changes.find(c => c.id.includes('barcode'));
  assert.equal(bcChange, undefined, 'Slight shift within safe area does not create a regression');
});

test('TEST 7: Font reduced below supplied minimum -> Regression', () => {
  const revA = {
    id: 'rev-1',
    deepVerification: {
      preflightReport: {
        checks: [{ id: 'font-min', category: 'typography', details: { fontSizePt: 8.0, minPt: 6.0 } }]
      }
    },
    findings: [],
  };
  const revB = {
    id: 'rev-2',
    deepVerification: {
      preflightReport: {
        checks: [{ id: 'font-min', category: 'typography', details: { fontSizePt: 4.5, minPt: 6.0 } }]
      }
    },
    findings: [],
  };

  const cmp = compareArtworkRevisions(revA, revB);
  assert.equal(cmp.summary.regressions, 1);
  const fontRegr = cmp.changes.find(c => c.id.includes('font'));
  assert.ok(fontRegr);
  assert.equal(fontRegr.classification, REVISION_CHANGE_TYPES.REGRESSION);
  assert.equal(fontRegr.statusColor, 'red');
});

test('TEST 8: Logo color changed -> Neutral visual difference', () => {
  const revA = {
    id: 'rev-1',
    documents: [{ role: 'artwork', sha256: 'art-v1' }],
    findings: [],
  };
  const revB = {
    id: 'rev-2',
    documents: [{ role: 'artwork', sha256: 'art-v2' }],
    findings: [{ id: 'f-logo', status: 'match', title: 'Brand Logo Display', observed: 'Blue Logo', expected: 'Approved Logo' }],
  };

  const cmp = compareArtworkRevisions(revA, revB);
  assert.equal(cmp.summary.regressions, 0);
  assert.equal(cmp.summary.newIssues, 0);
});

test('TEST 9: Nutrition %DV changed incorrectly -> Source-backed regression', () => {
  const revA = {
    id: 'rev-1',
    documents: [{ role: 'artwork', sha256: 'art-1' }],
    findings: [{ id: 'f-dv-sodium', status: 'match', title: 'Sodium %DV', observed: '10%', expected: '10%' }],
  };
  const revB = {
    id: 'rev-2',
    documents: [{ role: 'artwork', sha256: 'art-2' }],
    findings: [{ id: 'f-dv-sodium', status: 'issue', title: 'Sodium %DV', observed: '15%', expected: '10%' }],
  };

  const cmp = compareArtworkRevisions(revA, revB);
  assert.equal(cmp.summary.regressions, 1);
  assert.equal(cmp.changes[0].classification, REVISION_CHANGE_TYPES.REGRESSION);
  assert.equal(cmp.changes[0].statusColor, 'red');
});

test('TEST 10: Nutrition discrepancy corrected -> Verified resolution', () => {
  const revA = {
    id: 'rev-1',
    documents: [{ role: 'artwork', sha256: 'art-1' }],
    findings: [{ id: 'f-dv-sodium', status: 'issue', title: 'Sodium %DV', observed: '15%', expected: '10%' }],
  };
  const revB = {
    id: 'rev-2',
    documents: [{ role: 'artwork', sha256: 'art-2' }],
    findings: [{ id: 'f-dv-sodium', status: 'match', title: 'Sodium %DV', observed: '10%', expected: '10%' }],
  };

  const cmp = compareArtworkRevisions(revA, revB);
  assert.equal(cmp.summary.verifiedFixes, 1);
  assert.equal(cmp.changes[0].classification, REVISION_CHANGE_TYPES.VERIFIED_RESOLVED);
  assert.equal(cmp.changes[0].statusColor, 'green');
});

test('TEST 11: Source specification changed -> Source-basis change, not automatic correction', () => {
  const revA = {
    id: 'rev-1',
    documents: [
      { role: 'artwork', sha256: 'art-1' },
      { role: 'spec', sha256: 'spec-v1', name: 'spec-v1.json' }
    ],
    findings: [{ id: 'f-qty', status: 'issue', title: 'Net Quantity', observed: '1000 mL', expected: '750 mL' }],
  };
  const revB = {
    id: 'rev-2',
    documents: [
      { role: 'artwork', sha256: 'art-1' },
      { role: 'spec', sha256: 'spec-v2', name: 'spec-v2.json' }
    ],
    findings: [{ id: 'f-qty', status: 'match', title: 'Net Quantity', observed: '1000 mL', expected: '1000 mL' }],
  };

  const cmp = compareArtworkRevisions(revA, revB);
  assert.equal(cmp.sourceBasis, COMPARISON_MODES.MODE_B_SOURCE_OR_RULES_CHANGED);
  assert.equal(cmp.summary.verifiedFixes, 0, 'Cannot claim verified fix when spec changed to match artwork');
  assert.equal(cmp.changes[0].classification, REVISION_CHANGE_TYPES.SOURCE_BASIS_CHANGED);
  assert.equal(cmp.changes[0].statusColor, 'amber');
});

test('TEST 12: Rules changed between revisions -> Rule version difference surfaced', () => {
  const revA = {
    id: 'rev-1',
    options: { marketPreset: 'us-fda' },
    rules: [{ id: 'fda-allergen', version: '2024.1' }],
    findings: [],
  };
  const revB = {
    id: 'rev-2',
    options: { marketPreset: 'us-fda' },
    rules: [{ id: 'fda-allergen', version: '2025.2' }],
    findings: [],
  };

  const basis = evaluateComparisonBasis(revA, revB);
  assert.equal(basis.rulesUnchanged, false);
  assert.equal(basis.mode, COMPARISON_MODES.MODE_B_SOURCE_OR_RULES_CHANGED);
});

test('TEST 13: Two different SKUs -> Warns and requires confirmation', () => {
  const revA = {
    id: 'rev-1',
    facts: [{ field: 'brand_name', value: 'OatClean' }, { field: 'sku', value: 'SKU-001' }],
    findings: [],
  };
  const revB = {
    id: 'rev-2',
    facts: [{ field: 'brand_name', value: 'DancingFish' }, { field: 'sku', value: 'SKU-999' }],
    findings: [],
  };

  const basis = evaluateComparisonBasis(revA, revB);
  assert.equal(basis.skuMismatch, true);
  assert.equal(basis.requiresConfirmation, true);
  assert.equal(basis.mode, COMPARISON_MODES.MODE_C_MARKET_OR_VARIANT_CHANGED);
});

test('TEST 14: Page order changed -> Match by dimensions and Jaccard text overlap', async () => {
  const docA = {
    pages: [
      { number: 1, width: 800, height: 600, text: 'Front panel Brand Oat Milk' },
      { number: 2, width: 400, height: 600, text: 'Side panel Nutrition Facts' },
    ],
  };
  const docB = {
    pages: [
      { number: 1, width: 400, height: 600, text: 'Side panel Nutrition Facts' },
      { number: 2, width: 800, height: 600, text: 'Front panel Brand Oat Milk' },
    ],
  };

  const { matchArtworkPages } = await import('../../lib/revision-intelligence.mjs');
  const mappings = matchArtworkPages(docA, docB);
  assert.equal(mappings[0].prevPageNumber, 1);
  assert.equal(mappings[0].currPageNumber, 2);
  assert.equal(mappings[1].prevPageNumber, 2);
  assert.equal(mappings[1].currPageNumber, 1);
});

test('TEST 15: Same packaging geometry, different textures -> Working 3D swipe', () => {
  const revA = { options: { packageType: 'carton', cartonDimensions: { width: 100, height: 160, depth: 60 } } };
  const revB = { options: { packageType: 'carton', cartonDimensions: { width: 100, height: 160, depth: 60 } } };

  const compat = check3DGeometryCompatibility(revA, revB);
  assert.equal(compat.compatible, true);
  assert.equal(compat.recommendedView, '3d-swipe');
});

test('TEST 16: Different packaging geometry -> Swipe disabled and side-by-side fallback', () => {
  const revA = { options: { packageType: 'carton', cartonDimensions: { width: 100, height: 160, depth: 60 } } };
  const revB = { options: { packageType: 'can' } };

  const compat = check3DGeometryCompatibility(revA, revB);
  assert.equal(compat.compatible, false);
  assert.equal(compat.recommendedView, 'side-by-side');
});

test('TEST 17: Finding correspondence when finding IDs regenerated', () => {
  const prevFindings = [
    { id: 'old-id-99', rule: { id: 'r-net-qty', field: 'net_quantity' }, expected: '1000 mL', status: 'issue' }
  ];
  const currFindings = [
    { id: 'new-id-101', rule: { id: 'r-net-qty', field: 'net_quantity' }, expected: '1000 mL', status: 'match' }
  ];

  const matched = correlateFindings(prevFindings, currFindings);
  assert.equal(matched.length, 1);
  assert.equal(matched[0].previousFinding.id, 'old-id-99');
  assert.equal(matched[0].currentFinding.id, 'new-id-101');
  assert.equal(matched[0].matchBasis, 'RULE_ID_AND_FIELD');
});

test('TEST 18: Barcode displacement calculation', () => {
  const revA = {
    documents: [{ role: 'artwork', pages: [{ codes: [{ value: '123456', type: 'UPC', box: [0.1, 0.1, 0.2, 0.2] }] }] }]
  };
  const revB = {
    documents: [{ role: 'artwork', pages: [{ codes: [{ value: '123456', type: 'UPC', box: [0.3, 0.3, 0.4, 0.4] }] }] }]
  };

  const res = analyzeBarcodeRelocation(revA, revB);
  assert.equal(res.length, 1);
  assert.equal(res[0].hasMoved, true);
  assert.ok(res[0].displacementMm > 0);
});

test('TEST 19: Typography font-size comparison when native font metadata present', () => {
  const revA = {
    deepVerification: { preflightReport: { checks: [{ category: 'typography', details: { fontSizePt: 7.0, minPt: 6.0 } }] } }
  };
  const revB = {
    deepVerification: { preflightReport: { checks: [{ category: 'typography', details: { fontSizePt: 5.5, minPt: 6.0 } }] } }
  };

  const res = analyzeFontSizeReduction(revA, revB);
  assert.equal(res.isRegression, true);
  assert.equal(res.previousPt, 7.0);
  assert.equal(res.currentPt, 5.5);
});

test('TEST 20: Source-backed correction proposal applied in B -> Proposal linked to verified result', () => {
  const revA = {
    id: 'rev-1',
    documents: [{ role: 'artwork', sha256: 'art-1' }],
    remediationProposals: {
      'f-qty': { id: 'prop-qty-01', proposedText: '1000 mL', status: 'APPROVED_FOR_DESIGN_HANDOFF' }
    },
    findings: [{ id: 'f-qty', status: 'issue', title: 'Net Quantity', observed: '750 mL', expected: '1000 mL' }],
  };
  const revB = {
    id: 'rev-2',
    documents: [{ role: 'artwork', sha256: 'art-2' }],
    findings: [{ id: 'f-qty', status: 'match', title: 'Net Quantity', observed: '1000 mL', expected: '1000 mL' }],
  };

  const cmp = compareArtworkRevisions(revA, revB);
  assert.equal(cmp.summary.verifiedFixes, 1);
  assert.ok(cmp.changes[0].linkedRemediation);
  assert.equal(cmp.changes[0].linkedRemediation.proposalId, 'prop-qty-01');
  assert.equal(cmp.changes[0].linkedRemediation.isImplemented, true);
});
