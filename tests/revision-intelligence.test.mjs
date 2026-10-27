import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeRevisionIntelligence,
  matchArtworkPages,
  analyzeBarcodeRelocation,
  analyzeFontSizeReduction,
  REVISION_CHANGE_TYPES,
  REVISION_CASES,
} from '../lib/revision-intelligence.mjs';

describe('Phase 6: Revision & Regression Detection Engine', () => {
  it('correctly maps artwork pages using dimensions, text Jaccard similarity, and sequential fallback', () => {
    const prevDoc = {
      pages: [
        { number: 1, width: 800, height: 600, text: 'Front panel Fieldday Oat Drink 1 L' },
        { number: 2, width: 400, height: 600, text: 'Side panel Nutrition Facts Ingredients' },
      ],
    };
    const currDoc = {
      pages: [
        { number: 1, width: 800, height: 600, text: 'Front panel Fieldday Oat Drink 1000 mL' },
        { number: 2, width: 400, height: 600, text: 'Side panel Nutrition Facts Ingredients' },
      ],
    };

    const mappings = matchArtworkPages(prevDoc, currDoc);
    assert.equal(mappings.length, 2);
    assert.equal(mappings[0].prevPageNumber, 1);
    assert.equal(mappings[0].currPageNumber, 1);
    assert.ok(mappings[0].confidence > 0.5);
  });

  it('classifies resolved findings when defect is fixed in revision', () => {
    const prevReview = {
      id: 'rev-v1',
      documents: [
        { role: 'artwork', sha256: 'art-sha-1', pages: [{ number: 1, text: 'Net 750 mL' }] },
        { role: 'spec', sha256: 'spec-sha-1', data: { product: { net_quantity: '1000 mL' } } },
      ],
      findings: [
        {
          id: 'find-qty-01',
          key: 'net-qty',
          title: 'Net quantity mismatch',
          status: 'issue',
          observed: '750 mL',
          expected: '1000 mL',
          evidence: [{ documentId: 'art-1', page: 1, quote: '750 mL' }],
        },
      ],
    };

    const currReview = {
      id: 'rev-v2',
      documents: [
        { role: 'artwork', sha256: 'art-sha-2', pages: [{ number: 1, text: 'Net 1000 mL' }] },
        { role: 'spec', sha256: 'spec-sha-1', data: { product: { net_quantity: '1000 mL' } } },
      ],
      findings: [
        {
          id: 'find-qty-01',
          key: 'net-qty',
          title: 'Net quantity mismatch',
          status: 'match',
          observed: '1000 mL',
          expected: '1000 mL',
          evidence: [{ documentId: 'art-2', page: 1, quote: '1000 mL' }],
        },
      ],
    };

    const intel = analyzeRevisionIntelligence(prevReview, currReview);
    assert.equal(intel.counts.resolvedCount, 1);
    const resolvedChange = intel.changes.find(c => c.classification === REVISION_CHANGE_TYPES.RESOLVED);
    assert.ok(resolvedChange, 'Should classify net quantity change as RESOLVED');
    assert.equal(resolvedChange.previousStatus, 'issue');
    assert.equal(resolvedChange.currentStatus, 'match');
  });

  it('detects verified regressions when previously passing check becomes a defect', () => {
    const prevReview = {
      id: 'rev-v1',
      documents: [
        { role: 'artwork', sha256: 'art-sha-1', pages: [{ number: 1, text: 'Contains oats.' }] },
        { role: 'spec', sha256: 'spec-sha-1', data: { allergens: ['Oats'] } },
      ],
      findings: [
        {
          id: 'find-allergen-01',
          key: 'allergen-decl',
          title: 'Allergen declaration',
          status: 'match',
          observed: 'Contains oats.',
          expected: 'Contains oats.',
        },
      ],
    };

    const currReview = {
      id: 'rev-v2',
      documents: [
        { role: 'artwork', sha256: 'art-sha-2', pages: [{ number: 1, text: 'No allergen text' }] },
        { role: 'spec', sha256: 'spec-sha-1', data: { allergens: ['Oats'] } },
      ],
      findings: [
        {
          id: 'find-allergen-01',
          key: 'allergen-decl',
          title: 'Allergen declaration',
          status: 'issue',
          observed: 'Not detected in extracted content',
          expected: 'Contains oats.',
        },
      ],
    };

    const intel = analyzeRevisionIntelligence(prevReview, currReview);
    assert.equal(intel.counts.regressionCount, 1);
    const regr = intel.changes.find(c => c.classification === REVISION_CHANGE_TYPES.REGRESSION);
    assert.ok(regr, 'Should detect regression when allergen statement was removed');
    assert.equal(regr.previousStatus, 'match');
    assert.equal(regr.currentStatus, 'issue');
  });

  it('detects barcode relocation regressions into glue flap exclusion zones', () => {
    const prevReview = {
      documents: [{
        role: 'artwork',
        pages: [{
          number: 1,
          codes: [{ type: 'UPC-A', value: '036000291452', box: [0.4, 0.4, 0.6, 0.6] }],
        }],
      }],
    };
    const currReview = {
      documents: [{
        role: 'artwork',
        pages: [{
          number: 1,
          // Relocated to x > 0.88 (glue flap)
          codes: [{ type: 'UPC-A', value: '036000291452', box: [0.90, 0.4, 0.98, 0.6] }],
        }],
      }],
    };

    const relocations = analyzeBarcodeRelocation(prevReview, currReview);
    assert.equal(relocations.length, 1);
    assert.equal(relocations[0].hasMoved, true);
    assert.equal(relocations[0].inExclusionZone, true);
    assert.equal(relocations[0].isRegression, true);
    assert.ok(relocations[0].reason.includes('glue flap'));
  });

  it('detects font size reduction below statutory minimum requirement', () => {
    const prevReview = {
      deepVerification: {
        preflightReport: {
          checks: [{
            category: 'typography',
            id: 'statutory-net-qty-font',
            details: { fontSizePt: 6.5, minPt: 6.0 },
          }],
        },
      },
    };
    const currReview = {
      deepVerification: {
        preflightReport: {
          checks: [{
            category: 'typography',
            id: 'statutory-net-qty-font',
            details: { fontSizePt: 4.8, minPt: 6.0 },
          }],
        },
      },
    };

    const reduction = analyzeFontSizeReduction(prevReview, currReview);
    assert.ok(reduction);
    assert.equal(reduction.isRegression, true);
    assert.equal(reduction.currentPt, 4.8);
    assert.ok(reduction.reason.includes('violates required minimum'));
  });

  it('detects accidental different SKU selection (CASE 5)', () => {
    const prevReview = {
      facts: [{ field: 'brand_name', value: 'Fieldday' }],
      documents: [{ role: 'artwork', sha256: 'art-1' }],
    };
    const currReview = {
      facts: [{ field: 'brand_name', value: 'OatMega' }],
      documents: [{ role: 'artwork', sha256: 'art-2' }],
    };

    const intel = analyzeRevisionIntelligence(prevReview, currReview);
    assert.equal(intel.caseClassification, REVISION_CASES.CASE_5_DIFFERENT_SKUS_MISMATCH);
    assert.ok(intel.caseExplanation.includes('Different brand identities detected'));
  });

  it('detects simultaneous artwork and specification changes (CASE 2)', () => {
    const prevReview = {
      documents: [
        { role: 'artwork', sha256: 'art-sha-1' },
        { role: 'spec', sha256: 'spec-sha-1' },
      ],
      findings: [{ id: 'f1', title: 'Quantity', status: 'issue', observed: '750 mL', expected: '1000 mL' }],
    };
    const currReview = {
      documents: [
        { role: 'artwork', sha256: 'art-sha-2' },
        { role: 'spec', sha256: 'spec-sha-2' },
      ],
      findings: [{ id: 'f1', title: 'Quantity', status: 'match', observed: '1000 mL', expected: '1000 mL' }],
    };

    const intel = analyzeRevisionIntelligence(prevReview, currReview);
    assert.equal(intel.caseClassification, REVISION_CASES.CASE_2_ARTWORK_CHANGED_SPECS_CHANGED);
    const chg = intel.changes.find(c => c.classification === REVISION_CHANGE_TYPES.RESOLVED);
    assert.ok(chg);
    assert.equal(chg.verifiedAgainstReference, false, 'Should note reference spec also changed');
  });

  it('detects word, number, and unit changes in diffTextBlocks', async () => {
    const { diffTextBlocks } = await import('../lib/text-revision-diff.mjs');
    const diff = diffTextBlocks('Net 750 mL', 'Net 1000 mL');
    assert.equal(diff.hasChanges, true);
    assert.deepEqual(diff.numbersRemoved, ['750']);
    assert.deepEqual(diff.numbersAdded, ['1000']);
  });

  it('compares geometry panel boundaries and layout overflows', async () => {
    const { compareGeometryRevisions } = await import('../lib/revision-intelligence.mjs');
    const prevReview = {
      options: { panelZones: { front: { box: [0, 0, 0.5, 1] } } },
      packagingGeometry: { layoutFits: [] },
    };
    const currReview = {
      options: { panelZones: { front: { box: [0, 0, 0.5, 1] }, back: { box: [0.5, 0, 1, 1] } } },
      packagingGeometry: { layoutFits: [{ outcome: 'OVERFLOW_RISK' }] },
    };

    const geomChanges = compareGeometryRevisions(prevReview, currReview);
    assert.ok(geomChanges.some(c => c.type === 'PANEL_MAPPING_CHANGED'));
    assert.ok(geomChanges.some(c => c.type === 'NEW_OVERFLOW_RISK'));
  });

  it('honors explicit reviewer page mapping', () => {
    const prevDoc = { pages: [{ number: 1 }, { number: 2 }] };
    const currDoc = { pages: [{ number: 1 }, { number: 2 }] };
    const manualMapping = [{ prevPageNumber: 1, currPageNumber: 2 }];

    const mappings = matchArtworkPages(prevDoc, currDoc, manualMapping);
    assert.equal(mappings.length, 1);
    assert.equal(mappings[0].prevPageNumber, 1);
    assert.equal(mappings[0].currPageNumber, 2);
    assert.equal(mappings[0].basis, 'REVIEWER_CONFIRMED');
    assert.equal(mappings[0].confidence, 1.0);
  });
});
