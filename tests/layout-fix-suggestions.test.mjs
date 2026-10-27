/**
 * @file layout-fix-suggestions.test.mjs
 * 
 * Unit tests for explainable auto-fix generation and independent re-verification loop.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  generateExplainableFixes, 
  applyFixToBlocks, 
  verifyAndApplyFix 
} from '../lib/pack-canvas/layout-fixes.mjs';
import { 
  PACK_PANELS, 
  LOCKED_BRAND_ZONES, 
  getCorrectedUSPackBlocks, 
  EXTRA_REQUIRED_ITEMS, 
  calculateSpaceMeters 
} from '../lib/pack-canvas.mjs';

test('Layout Fixes: Generates explainable fixes when panel space overflows', () => {
  const blocks = [...getCorrectedUSPackBlocks(), ...EXTRA_REQUIRED_ITEMS];
  const spaceMeters = calculateSpaceMeters(PACK_PANELS, LOCKED_BRAND_ZONES, blocks);
  const backMeter = spaceMeters.find(m => m.panelId === 'panel-back');

  assert.ok(backMeter.hasOverflow, 'Back panel must have overflow');

  const fixes = generateExplainableFixes('panel-back', blocks, spaceMeters, LOCKED_BRAND_ZONES);
  assert.ok(fixes.length >= 2, 'Must generate multiple fix options');

  const multiCol = fixes.find(f => f.action === 'split-columns');
  const condense = fixes.find(f => f.action === 'condense-font');
  const relocate = fixes.find(f => f.action === 'relocate-block');

  assert.ok(multiCol, 'Must offer 2-column split');
  assert.ok(condense, 'Must offer typography condense down to FDA 6.0pt');
  assert.ok(relocate, 'Must offer panel relocation');

  // Explainability assertions
  assert.ok(multiCol.rationale.length > 20);
  assert.ok(multiCol.applicableRule.includes('21 CFR'));
  assert.ok(multiCol.estimatedAreaSavedMm2 > 0);
});

test('Layout Fixes: Applying fix-multi-column clears overflow and passes independent validation', () => {
  const blocks = [...getCorrectedUSPackBlocks(), ...EXTRA_REQUIRED_ITEMS];

  const verification = verifyAndApplyFix(PACK_PANELS, LOCKED_BRAND_ZONES, blocks, 'fix-multi-column');

  assert.equal(verification.success, true);
  assert.equal(verification.status, 'OVERFLOW_CLEARED');
  assert.equal(verification.unplacedCount, 0);
  assert.equal(verification.remainingOverflowPanels.length, 0);
  assert.equal(verification.validation.valid, true);
  assert.ok(verification.validation.verifiedCheckCount > 30);
});

test('Layout Fixes: Applying fix-condense-typography clears overflow and maintains FDA minimum 6.0pt', () => {
  const blocks = [...getCorrectedUSPackBlocks(), ...EXTRA_REQUIRED_ITEMS];

  const verification = verifyAndApplyFix(PACK_PANELS, LOCKED_BRAND_ZONES, blocks, 'fix-condense-typography');

  assert.equal(verification.success, true);
  assert.equal(verification.status, 'OVERFLOW_CLEARED');
  assert.equal(verification.validation.valid, true);

  // Assert font sizes never drop below 6.0pt
  for (const b of verification.modifiedBlocks) {
    if (b.fontPt) {
      assert.ok(b.fontPt >= 6.0, `Block ${b.name} font size (${b.fontPt}pt) must be >= 6.0pt`);
    }
  }
});
