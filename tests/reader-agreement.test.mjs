import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareReaderOutputs,
  evaluatePanelConsensus,
  AGREEMENT_STATUSES,
  OBSERVATION_CATEGORIES,
} from '../lib/scan/reader-agreement.mjs';

test('1. Exact reader consensus achieves Confirmed Printed Observation', () => {
  const result = compareReaderOutputs('brand_name', { text: 'Dancing Fish Granola' }, { text: 'Dancing Fish Granola' });
  assert.equal(result.agreement, AGREEMENT_STATUSES.AGREE_EXACT);
  assert.equal(result.category, OBSERVATION_CATEGORIES.CONFIRMED_PRINTED);
  assert.equal(result.isConfirmed, true);
  assert.equal(result.confidence, 0.99);
  assert.equal(result.reconciliationRequired, false);
});

test('2. Normalized consensus bridges safe whitespace and unit formatting', () => {
  const result = compareReaderOutputs('net_quantity', { text: '480g' }, { text: '480 g' });
  assert.equal(result.agreement, AGREEMENT_STATUSES.AGREE_NORMALIZED);
  assert.equal(result.category, OBSERVATION_CATEGORIES.CONFIRMED_PRINTED);
  assert.equal(result.isConfirmed, true);
  assert.equal(result.value, '480 g');
});

test('3. Semantic field mismatch prevents false confirmation', () => {
  // If OCR read Fat but Vision read Carbohydrate for total_fat field
  const result = compareReaderOutputs('total_fat', { text: '15g Fat' }, { text: '15g Carbohydrate' });
  assert.equal(result.agreement, AGREEMENT_STATUSES.DISAGREE);
  assert.equal(result.category, OBSERVATION_CATEGORIES.NEEDS_REVIEW);
  assert.equal(result.isConfirmed, false);
  assert.ok(result.reconciliationCard);
  assert.match(result.reconciliationCard.reason, /variance/i);
});

test('4. Numeric discrepancy creates reconciliation card with actionable choices', () => {
  const result = compareReaderOutputs('calories', { text: '140' }, { text: '160' });
  assert.equal(result.agreement, AGREEMENT_STATUSES.DISAGREE);
  assert.equal(result.numericConflict, true);
  assert.equal(result.isConfirmed, false);
  assert.ok(result.reconciliationCard);
  assert.deepEqual(result.reconciliationCard.actions, [
    'Retake Close-Up',
    'Select OCR Reading',
    'Select Vision Reading',
    'Mark Unreadable',
  ]);
});

test('5. Single reader output classifies as AI-Suggested / Review Required', () => {
  const ocrOnly = compareReaderOutputs('storage', { text: 'Store in cool place' }, { text: '' });
  assert.equal(ocrOnly.agreement, AGREEMENT_STATUSES.ONE_READER_ONLY);
  assert.equal(ocrOnly.category, OBSERVATION_CATEGORIES.AI_SUGGESTED);
  assert.equal(ocrOnly.isConfirmed, false);

  const visionOnly = compareReaderOutputs('storage', { text: '' }, { text: 'Store in cool place' });
  assert.equal(visionOnly.agreement, AGREEMENT_STATUSES.ONE_READER_ONLY);
  assert.equal(visionOnly.category, OBSERVATION_CATEGORIES.AI_SUGGESTED);
  assert.equal(visionOnly.isConfirmed, false);
});

test('6. Both readers unreadable flags Needs Review without crashing', () => {
  const unreadable = compareReaderOutputs('allergen_warning', { text: '' }, { text: '' });
  assert.equal(unreadable.agreement, AGREEMENT_STATUSES.BOTH_UNREADABLE);
  assert.equal(unreadable.category, OBSERVATION_CATEGORIES.NEEDS_REVIEW);
  assert.equal(unreadable.value, null);
});

test('7. Critical field with quality warning assigns Candidate with Limitations', () => {
  const result = compareReaderOutputs(
    'net_quantity',
    { text: '10 oz (283 g)' },
    { text: '10 oz (283 g)' },
    { hasQualityWarning: true, isBlurry: true }
  );
  assert.equal(result.agreement, AGREEMENT_STATUSES.AGREE_EXACT);
  assert.equal(result.category, OBSERVATION_CATEGORIES.CANDIDATE_WITH_LIMITATIONS);
  assert.equal(result.isConfirmed, false);
  assert.ok(result.qualityLimitation);
});

test('8. Full panel consensus aggregates field agreements cleanly', () => {
  const ocrFields = {
    brand_name: 'Dancing Fish',
    net_quantity: '10 oz (283 g)',
  };
  const visionFields = {
    brand_name: 'Dancing Fish',
    net_quantity: '10 oz (283 g)',
  };

  const panel = evaluatePanelConsensus('front', ocrFields, visionFields);
  assert.equal(panel.panelId, 'front');
  assert.equal(panel.totalFields, 2);
  assert.equal(panel.totalAgreed, 2);
  assert.equal(panel.totalDisagreed, 0);
  assert.equal(panel.isPanelConfirmed, true);
});
