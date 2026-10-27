import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planNextScanSteps,
  evaluateRequirementCoverage,
  COVERAGE_STATUSES,
} from '../lib/scan/scan-planner.mjs';
import { evaluateCloseUpRequests } from '../lib/scan/closeup-requests.mjs';

test('1. Unscanned face cannot be declared missing text', () => {
  // Only front panel has been scanned
  const scannedPanels = {
    front: { text: 'Dancing Fish Granola Berry Crunch Net Wt 10 oz (283 g)' },
  };

  // Manufacturer declaration can appear on back or left panel
  const coverage = evaluateRequirementCoverage('manufacturer_address', ['back', 'left'], scannedPanels);
  assert.equal(coverage.status, 'COVERAGE_INCOMPLETE');
  assert.equal(coverage.canConcludeMissing, false);
  assert.deepEqual(coverage.pendingPanels, ['back', 'left']);
  assert.match(coverage.explanation, /Cannot declare .* missing/i);
});

test('2. Requirement is confirmed missing only after all permitted panels are scanned', () => {
  const scannedPanels = {
    front: { text: 'Dancing Fish Granola' },
    back: { text: 'Ingredients: Oats, Honey' },
    left: { text: 'Product of USA' },
    right: { text: 'Nutrition Facts' },
  };

  const coverage = evaluateRequirementCoverage('storage_copy', ['back', 'left'], scannedPanels);
  assert.equal(coverage.status, 'MISSING_AFTER_FULL_COVERAGE');
  assert.equal(coverage.canConcludeMissing, true);
});

test('3. Planner prioritizes rescan of blurry panel before asking for new panels', () => {
  const scannedPanels = {
    front: { hasBlur: true, text: 'Dancing Fish' },
  };

  const plan = planNextScanSteps(scannedPanels);
  assert.equal(plan.completeness, COVERAGE_STATUSES.PARTIAL);
  assert.equal(plan.nextAction.type, 'RESCAN_FACE');
  assert.equal(plan.nextAction.face, 'front');
  assert.match(plan.nextAction.title, /Retake Front/i);
});

test('4. Planner guides user through sequential mandatory carton faces', () => {
  const scannedPanels = {
    front: { hasBlur: false, text: 'Brand' },
    right: { hasBlur: false, text: 'Nutrition Facts' },
  };

  const plan = planNextScanSteps(scannedPanels);
  assert.equal(plan.capturedRequiredCount, 2);
  assert.equal(plan.nextAction.type, 'SCAN_FACE');
  assert.equal(plan.nextAction.face, 'back');
});

test('5. Close-up request engine flags small or blurry nutrition and allergen regions', () => {
  const scannedPanels = {
    right: {
      hasBlur: true,
      text: 'Nutrition Facts',
      sharpness: { variance: 65 },
    },
    bottom: {
      hasBarcode: true,
      values: { barcode_gtin: '' }, // unreadable barcode
      hasGlare: true,
    },
  };

  const closeUpEval = evaluateCloseUpRequests(scannedPanels);
  assert.equal(closeUpEval.needsCloseUp, true);
  assert.ok(closeUpEval.requests.length >= 2);

  const nutritionReq = closeUpEval.requests.find(r => r.targetContent === 'Nutrition Facts Table');
  assert.ok(nutritionReq);
  assert.equal(nutritionReq.priority, 'high');
  assert.ok(nutritionReq.affectedRequirements.includes('US_FDA_21CFR_101_9'));

  const barcodeReq = closeUpEval.requests.find(r => r.targetContent === 'GS1 Barcode Symbol');
  assert.ok(barcodeReq);
  assert.equal(barcodeReq.face, 'bottom');
});
