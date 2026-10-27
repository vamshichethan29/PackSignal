import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractArtworkDesignAssets,
  recordDesignDecision,
  projectDesignDecisionsToBrief
} from '../lib/brief/design-decisions.mjs';

describe('Phase 3 — Brand Design Asset Decisions & Creative Brief Projection', () => {

  test('1. Extracts verified design assets from packaging without inventing absent assets', () => {
    const assets = extractArtworkDesignAssets([], [{ markType: 'vegan_dietary_claim', mark: 'Vegan' }]);
    assert.ok(assets.length >= 3);

    const types = assets.map(a => a.assetType);
    assert.ok(types.includes('BRAND_LOGO'), 'Must extract brand logo');
    assert.ok(types.includes('BRAND_COLORS'), 'Must extract color palette');
    assert.ok(types.includes('TAGLINE'), 'Must extract tagline');
    assert.ok(!types.includes('PRODUCT_PHOTOGRAPHY'), 'Must NOT invent product photography when carton is illustrative');
  });

  test('2. Records KEEP, CHANGE, ADD, and REMOVE decisions with audit metadata', () => {
    const logoAsset = { assetId: 'ASSET-LOGO', name: 'Dancing Fish Logo' };

    const keepDec = recordDesignDecision(logoAsset, 'KEEP', { reviewerId: 'Alice', reviewerReason: 'Established brand equity' });
    assert.equal(keepDec.decision, 'KEEP');
    assert.equal(keepDec.reviewerId, 'Alice');
    assert.ok(keepDec.answeredAt);

    const changeDec = recordDesignDecision(logoAsset, 'CHANGE', { reviewerId: 'Bob', requestedChange: 'Modernize typography font weight' });
    assert.equal(changeDec.decision, 'CHANGE');
    assert.equal(changeDec.requestedChange, 'Modernize typography font weight');
  });

  test('3. Projects design decisions into structured Creative Brief sections', () => {
    const decisions = [
      { assetId: '1', assetType: 'BRAND_LOGO', name: 'Logo', decision: 'KEEP' },
      { assetId: '2', assetType: 'TAGLINE', name: 'Tagline', decision: 'CHANGE', requestedChange: 'Update phrasing' },
      { assetId: '3', assetType: 'CERTIFICATION_MARKS', name: 'Old Seal', decision: 'REMOVE' },
      { assetId: '4', assetType: 'PACKAGING_SHAPE', name: 'Window Feature', decision: 'ADD', requestedChange: 'Transparent die-cut window' }
    ];

    const brief = projectDesignDecisionsToBrief(decisions);
    assert.equal(brief.summary.keepCount, 1);
    assert.equal(brief.summary.changeCount, 1);
    assert.equal(brief.summary.removeCount, 1);
    assert.equal(brief.summary.addCount, 1);

    assert.equal(brief.keep[0].name, 'Logo');
    assert.equal(brief.change[0].requestedChange, 'Update phrasing');
    assert.equal(brief.remove[0].name, 'Old Seal');
    assert.equal(brief.add[0].requestedChange, 'Transparent die-cut window');
  });
});
