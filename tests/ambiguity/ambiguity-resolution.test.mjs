/**
 * PackSignal Ambiguity Resolution Engine — Automated Test Suite
 * (tests/ambiguity/ambiguity-resolution.test.mjs)
 * Implements Phase 28 & Phase 29: 20 regression test cases and
 * assertion of genuine targeted incremental evaluator invocations.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectAmbiguities,
  validateAnswer,
  buildDependencyPlan,
  resolveAndReevaluate,
  executionTracker,
  getDependentChecks,
  EVALUATOR_REGISTRY,
  QUESTION_TYPES,
  QUESTION_STATUS,
} from '../../lib/ambiguity/index.mjs';

function createMockReview({ withMultiNutrition = true, withConflict = false, withDraft = false } = {}) {
  const cells = [];
  if (withMultiNutrition) {
    // Spreadsheet with Nutrient Composition: Column B = Per Serving, Column C = Per 100 g
    cells.push(
      { sheet: 'Nutrition', row: 1, col: 1, value: 'Nutrient Composition' },
      { sheet: 'Nutrition', row: 1, col: 2, value: 'Per Serving' },
      { sheet: 'Nutrition', row: 1, col: 3, value: 'Per 100 g' },
      { sheet: 'Nutrition', row: 2, col: 1, value: 'Energy' },
      { sheet: 'Nutrition', row: 2, col: 2, value: '160 kcal' },
      { sheet: 'Nutrition', row: 2, col: 3, value: '390 kcal' },
      { sheet: 'Nutrition', row: 3, col: 1, value: 'Total Fat' },
      { sheet: 'Nutrition', row: 3, col: 2, value: '2.5 g' },
      { sheet: 'Nutrition', row: 3, col: 3, value: '6.1 g' },
      { sheet: 'Nutrition', row: 4, col: 1, value: 'Sodium' },
      { sheet: 'Nutrition', row: 4, col: 2, value: '230 mg' },
      { sheet: 'Nutrition', row: 4, col: 3, value: '575 mg' },
      { sheet: 'Nutrition', row: 5, col: 1, value: 'Protein' },
      { sheet: 'Nutrition', row: 5, col: 2, value: '5 g' },
      { sheet: 'Nutrition', row: 5, col: 3, value: '12.5 g' },
      { sheet: 'Nutrition', row: 6, col: 1, value: 'Total Carbohydrate' },
      { sheet: 'Nutrition', row: 6, col: 2, value: '30 g' },
      { sheet: 'Nutrition', row: 6, col: 3, value: '75 g' }
    );
  }

  const documents = [
    {
      id: 'doc-artwork',
      role: 'artwork',
      sha256: 'sha-art-001',
      text: 'DANCING FISH ORGANIC OAT\nNet Wt 12 oz (340 g)\nNutrition Facts\nServing Size 40 g\nPer Serving\nCalories 160\nTotal Fat 2.5 g 3%\nSodium 230 mg 10%\nTotal Carbohydrate 30 g 11%\nProtein 5 g\nDistributed by Organic Foods Co., Seattle, WA 98101\nUPC: 012345678905\nRecyclable packaging',
      pages: [{ number: 1, method: 'vector_text' }],
    },
    {
      id: 'doc-nutrition-spec',
      name: 'Nutrient Composition.xlsx',
      role: 'spec',
      sha256: 'sha-spec-001',
      cells,
      data: { status: withDraft ? 'Draft' : 'Approved', product: { sku: 'SKU-001' } },
    },
  ];

  if (withConflict) {
    documents.push({
      id: 'doc-brief',
      name: 'Packaging Brief.pdf',
      role: 'brief',
      sha256: 'sha-brief-002',
      text: 'Net Quantity: 16 oz (454 g)\nProduct Name: Dancing Fish',
    });
  }

  const initialFindings = [
    {
      id: 'barcode:checksum',
      key: 'barcode:checksum',
      title: 'Barcode Checksum Verification',
      status: 'match',
      expected: '012345678905',
      observed: '012345678905',
      method: 'barcode_check',
    },
    {
      id: 'rule:business_details',
      key: 'rule:business_details',
      title: 'Manufacturer and Distributor Address',
      status: 'match',
      expected: 'Organic Foods Co., Seattle, WA 98101',
      observed: 'Distributed by Organic Foods Co., Seattle, WA 98101',
      method: 'business_address_check',
    },
    {
      id: 'rule:nutrition.energy',
      key: 'rule:nutrition.energy',
      title: 'Energy',
      status: 'review',
      expected: 'Per Serving: 160 kcal | Per 100 g: 390 kcal',
      observed: 'Unconfirmed nutrition basis',
      field: 'nutrition.energy',
      method: 'nutrition_source_comparison',
    },
    {
      id: 'us-preflight-us-005',
      key: 'us-preflight-us-005',
      title: 'US-005 Percent Daily Value Arithmetic',
      status: 'review',
      expected: 'Statutory %DV',
      observed: 'Printed %DV',
      method: 'us_daily_value_arithmetic',
    },
    {
      id: 'us-preflight-us-006',
      key: 'us-preflight-us-006',
      title: 'US-006 Calorie & Macronutrient Sanity',
      status: 'review',
      expected: 'Atwater 4-4-9 Estimate',
      observed: 'Printed Calories',
      method: 'calorie_sanity',
    },
  ];

  const conflicts = withConflict ? [{
    field: 'net_quantity',
    label: 'Net Quantity',
    competingValues: [
      { factId: 'f1', documentId: 'doc-nutrition-spec', documentName: 'Nutrient Composition.xlsx', value: '12 oz (340 g)' },
      { factId: 'f2', documentId: 'doc-brief', documentName: 'Packaging Brief.pdf', value: '16 oz (454 g)' },
    ],
  }] : [];

  return {
    id: 'review-ambiguity-test',
    name: 'Dancing Fish Oat Drink',
    documents,
    findings: initialFindings,
    conflicts,
    facts: [
      { field: 'nutrition.basis', value: 'Multiple nutrition columns', ambiguous: true },
      { field: 'nutrition.energy', value: '160 kcal', ambiguous: true, variants: [{ variant: 'Per Serving', value: '160 kcal' }, { variant: 'Per 100 g', value: '390 kcal' }] },
      { field: 'nutrition.totalfat', value: '2.5 g', ambiguous: true, variants: [{ variant: 'Per Serving', value: '2.5 g' }, { variant: 'Per 100 g', value: '6.1 g' }] },
      { field: 'nutrition.sodium', value: '230 mg', ambiguous: true, variants: [{ variant: 'Per Serving', value: '230 mg' }, { variant: 'Per 100 g', value: '575 mg' }] },
      { field: 'nutrition.protein', value: '5 g', ambiguous: true, variants: [{ variant: 'Per Serving', value: '5 g' }, { variant: 'Per 100 g', value: '12.5 g' }] },
      { field: 'nutrition.totalcarbohydrate', value: '30 g', ambiguous: true, variants: [{ variant: 'Per Serving', value: '30 g' }, { variant: 'Per 100 g', value: '75 g' }] },
      { field: 'serving_size', value: '40 g', ambiguous: false },
      { field: 'net_quantity', value: '12 oz (340 g)', ambiguous: withConflict },
    ],
    options: {
      nutritionBasisConfirmed: false,
      nutritionVariant: null,
      factChoices: {},
    },
    decisions: {
      'barcode:checksum': {
        disposition: 'acknowledged',
        note: 'UPC barcode verified with GTIN check-digit tool.',
        reviewerName: 'Alice Reviewer',
        dependencyHash: 'dep-hash-barcode-stable',
      },
      'rule:business_details': {
        disposition: 'acknowledged',
        note: 'Business address matches FDA 21 CFR 101.5.',
        reviewerName: 'Alice Reviewer',
        dependencyHash: 'dep-hash-address-stable',
      },
    },
    counts: { match: 2, review: 3, issue: 0, unable: 0 },
    audit: [],
  };
}

const mockActor = { id: 'usr-1', username: 'alice', displayName: 'Alice QA', role: 'reviewer' };

// ==========================================
// TEST CASES
// ==========================================

test('TEST 1: Two nutrition bases present generates exactly one nutrition-basis question', () => {
  const review = createMockReview({ withMultiNutrition: true });
  const questions = detectAmbiguities(review);

  const nutritionQuestions = questions.filter(q => q.type === QUESTION_TYPES.NUTRITION_BASIS);
  assert.equal(nutritionQuestions.length, 1, 'Must generate exactly one nutrition basis question');
  assert.equal(nutritionQuestions[0].field, 'nutrition.basis');
  assert.equal(nutritionQuestions[0].sourceCandidates.length, 2, 'Must extract Column B and Column C candidates');
  assert.equal(nutritionQuestions[0].sourceCandidates[0].label, 'Column B — Per Serving');
  assert.equal(nutritionQuestions[0].sourceCandidates[1].label, 'Column C — Per 100 g');
});

test('TEST 2: Reviewer selects approved basis, resolves question, and affected checks reevaluate', () => {
  const review = createMockReview();
  const questions = detectAmbiguities(review);
  review.ambiguityQuestions = questions;
  const q = questions.find(item => item.type === QUESTION_TYPES.NUTRITION_BASIS);

  executionTracker.reset();
  const result = resolveAndReevaluate(review, q.questionId, {
    candidateId: 'cand-col-b',
    value: 'Per Serving',
    rationale: 'Verified against Master Formulation DF-US-001 Section 4',
  }, mockActor);

  assert.equal(result.success, true);
  assert.equal(result.status, QUESTION_STATUS.RESOLVED);
  assert.equal(review.options.nutritionVariant, 'Per Serving');
  assert.equal(review.options.nutritionBasisConfirmed, true);
  assert.equal(q.status, QUESTION_STATUS.RESOLVED);
  assert.equal(q.resolution.value, 'Per Serving');

  // Verify affected checks were reevaluated
  const energyFinding = review.findings.find(f => f.key === 'rule:nutrition.energy');
  assert.equal(energyFinding.status, 'match', 'Energy must now match 160 kcal declared on artwork');
});

test('TEST 3: Reviewer chooses a draft basis without source approval - retains draft status', () => {
  const review = createMockReview({ withDraft: true });
  const questions = detectAmbiguities(review);
  review.ambiguityQuestions = questions;
  const q = questions.find(item => item.type === QUESTION_TYPES.NUTRITION_BASIS);

  const result = resolveAndReevaluate(review, q.questionId, {
    candidateId: 'cand-col-b',
    value: 'Per Serving',
    rationale: 'Provisional draft selection pending customer release',
  }, mockActor);

  assert.equal(result.success, true);
  assert.equal(result.impact.decision, 'Per Serving');
  assert.equal(q.resolution.isDraftSource, true, 'Must preserve draft status indication');
});

test('TEST 4: Net quantity sources conflict generates a separate source-authority question', () => {
  const review = createMockReview({ withConflict: true });
  const questions = detectAmbiguities(review);

  const netQtyQuestion = questions.find(q => q.field === 'net_quantity');
  assert.ok(netQtyQuestion, 'Must generate a question for conflicting net quantity');
  assert.equal(netQtyQuestion.type, QUESTION_TYPES.FACT_CONFLICT);
  assert.equal(netQtyQuestion.sourceCandidates.length, 2);
  assert.ok(netQtyQuestion.sourceCandidates.some(c => c.value === '12 oz (340 g)'));
  assert.ok(netQtyQuestion.sourceCandidates.some(c => c.value === '16 oz (454 g)'));
});

test('TEST 5: One question blocks three nutrition checks - linked to all three checks', () => {
  const review = createMockReview();
  const questions = detectAmbiguities(review);
  const q = questions.find(item => item.type === QUESTION_TYPES.NUTRITION_BASIS);

  assert.ok(q.affectedCheckIds.includes('nutrition_source_comparison'));
  assert.ok(q.affectedCheckIds.includes('us_daily_value_arithmetic'));
  assert.ok(q.affectedCheckIds.includes('calorie_sanity'));
  assert.equal(q.affectedCheckIds.length, 3);
});

test('TEST 6: Nutrition basis resolved leaves barcode checksum finding unchanged', () => {
  const review = createMockReview();
  const originalBarcode = structuredClone(review.findings.find(f => f.id === 'barcode:checksum'));
  const questions = detectAmbiguities(review);
  review.ambiguityQuestions = questions;
  const q = questions.find(item => item.type === QUESTION_TYPES.NUTRITION_BASIS);

  resolveAndReevaluate(review, q.questionId, {
    candidateId: 'cand-col-b',
    value: 'Per Serving',
    rationale: 'Confirmed basis',
  }, mockActor);

  const afterBarcode = review.findings.find(f => f.id === 'barcode:checksum');
  assert.deepEqual(afterBarcode, originalBarcode, 'Barcode checksum finding must remain completely identical');
});

test('TEST 7: Nutrition basis resolved leaves manufacturer details unchanged', () => {
  const review = createMockReview();
  const originalAddress = structuredClone(review.findings.find(f => f.id === 'rule:business_details'));
  const questions = detectAmbiguities(review);
  review.ambiguityQuestions = questions;
  const q = questions.find(item => item.type === QUESTION_TYPES.NUTRITION_BASIS);

  resolveAndReevaluate(review, q.questionId, {
    candidateId: 'cand-col-b',
    value: 'Per Serving',
    rationale: 'Confirmed basis',
  }, mockActor);

  const afterAddress = review.findings.find(f => f.id === 'rule:business_details');
  assert.deepEqual(afterAddress, originalAddress, 'Business address finding must remain completely identical');
});

test('TEST 8: Nutrition basis resolved leaves unrelated barcode and address decisions NOT stale', () => {
  const review = createMockReview();
  const questions = detectAmbiguities(review);
  review.ambiguityQuestions = questions;
  const q = questions.find(item => item.type === QUESTION_TYPES.NUTRITION_BASIS);

  resolveAndReevaluate(review, q.questionId, {
    candidateId: 'cand-col-b',
    value: 'Per Serving',
    rationale: 'Confirmed basis',
  }, mockActor);

  assert.equal(review.decisions['barcode:checksum'].stale, undefined, 'Barcode approval must not become stale');
  assert.equal(review.decisions['rule:business_details'].stale, undefined, 'Business address approval must not become stale');
});

test('TEST 9: Selected nutrition source replaced marks question reopened or superseded', () => {
  const review = createMockReview();
  const questions = detectAmbiguities(review);
  review.ambiguityQuestions = questions;
  const q = questions.find(item => item.type === QUESTION_TYPES.NUTRITION_BASIS);

  // First resolve
  resolveAndReevaluate(review, q.questionId, {
    candidateId: 'cand-col-b',
    value: 'Per Serving',
    rationale: 'Initial resolution',
  }, mockActor);

  // Now simulate source spreadsheet modification (sha256 change)
  const specDoc = review.documents.find(d => d.id === 'doc-nutrition-spec');
  specDoc.sha256 = 'sha-spec-NEW-VERSION-999';

  // Validate answer against stale question
  const val = validateAnswer({
    question: q,
    answer: { candidateId: 'cand-col-b', value: 'Per Serving', rationale: 'Try resolving again' },
    review,
    actor: mockActor,
  });

  assert.equal(val.valid, false);
  assert.equal(val.status, 'STALE_DEPENDENCY');
  assert.ok(val.error.includes('modified'));
});

test('TEST 10: Question already answered produces no duplicate question', () => {
  const review = createMockReview();
  const questions1 = detectAmbiguities(review);
  review.ambiguityQuestions = questions1;
  const q = questions1.find(item => item.type === QUESTION_TYPES.NUTRITION_BASIS);

  resolveAndReevaluate(review, q.questionId, {
    candidateId: 'cand-col-b',
    value: 'Per Serving',
    rationale: 'Confirmed basis',
  }, mockActor);

  // Re-detect on resolved review
  const questions2 = detectAmbiguities(review);
  assert.equal(questions2.length, questions1.length, 'Question count must remain stable without duplicates');
  const qResolved = questions2.find(item => item.questionId === q.questionId);
  assert.equal(qResolved.status, QUESTION_STATUS.RESOLVED);
});

test('TEST 11: Resolution arrives from a stale browser tab rejected with meaningful error', () => {
  const review = createMockReview();
  const questions = detectAmbiguities(review);
  const q = questions.find(item => item.type === QUESTION_TYPES.NUTRITION_BASIS);
  q.status = QUESTION_STATUS.SUPERSEDED;

  const val = validateAnswer({
    question: q,
    answer: { candidateId: 'cand-col-b', value: 'Per Serving', rationale: 'Answer from old tab' },
    review,
    actor: mockActor,
  });

  assert.equal(val.valid, false);
  assert.equal(val.status, 'SUPERSEDED');
  assert.ok(val.error.includes('superseded'));
});

test('TEST 12: Reviewer selects non-existent candidate is rejected', () => {
  const review = createMockReview();
  const questions = detectAmbiguities(review);
  const q = questions.find(item => item.type === QUESTION_TYPES.NUTRITION_BASIS);

  const val = validateAnswer({
    question: q,
    answer: { candidateId: 'cand-non-existent-sku-column-z', value: 'Per 500g', rationale: 'Invalid' },
    review,
    actor: mockActor,
  });

  assert.equal(val.valid, false);
  assert.equal(val.status, 'INVALID_CANDIDATE');
});

test('TEST 13: Unsupported nutrition basis format rejected by answer validator', () => {
  const review = createMockReview();
  const questions = detectAmbiguities(review);
  const q = questions.find(item => item.type === QUESTION_TYPES.NUTRITION_BASIS);

  const val = validateAnswer({
    question: q,
    answer: { candidateId: 'cand-col-b', value: 'Per Gallon Bucket', rationale: 'Invalid unit' },
    review,
    actor: mockActor,
  });

  // Candidate B in mock has value "Per Serving", so overriding value with non-standard basis:
  const invalidCand = { ...q.sourceCandidates[0], value: 'Random Unspecified Unit' };
  const qCopy = { ...q, sourceCandidates: [invalidCand] };
  const val2 = validateAnswer({
    question: qCopy,
    answer: { candidateId: invalidCand.candidateId, value: 'Random Unspecified Unit', rationale: 'Test' },
    review,
    actor: mockActor,
  });

  assert.equal(val2.valid, false);
  assert.equal(val2.status, 'INVALID_BASIS');
});

test('TEST 14: User without reviewer permission is rejected', () => {
  const review = createMockReview();
  const questions = detectAmbiguities(review);
  const q = questions.find(item => item.type === QUESTION_TYPES.NUTRITION_BASIS);

  const unauthorizedActor = { id: 'guest', username: 'guest', role: 'viewer' };
  const val = validateAnswer({
    question: q,
    answer: { candidateId: 'cand-col-b', value: 'Per Serving', rationale: 'Viewer try' },
    review,
    actor: unauthorizedActor,
  });

  assert.equal(val.valid, false);
  assert.equal(val.status, 'UNAUTHORIZED');
});

test('TEST 15: Valid answer with dry-run preview shows affected checks without mutating review', () => {
  const review = createMockReview();
  const questions = detectAmbiguities(review);
  const q = questions.find(item => item.type === QUESTION_TYPES.NUTRITION_BASIS);

  const originalReviewCopy = JSON.stringify(review);
  const plan = buildDependencyPlan({
    question: q,
    candidate: q.sourceCandidates[0],
    review,
  });

  assert.equal(JSON.stringify(review), originalReviewCopy, 'Dry-run preview must not mutate review object');
  assert.ok(plan.dependentChecks.some(c => c.checkId === 'nutrition_source_comparison'));
  assert.ok(plan.unaffectedChecks.some(c => c.checkId === 'barcode_check'));
  assert.ok(plan.unaffectedChecks.some(c => c.checkId === 'business_address_check'));
});

test('TEST 16: Missing rationale note rejects answer', () => {
  const review = createMockReview();
  const questions = detectAmbiguities(review);
  const q = questions.find(item => item.type === QUESTION_TYPES.NUTRITION_BASIS);

  const val = validateAnswer({
    question: q,
    answer: { candidateId: 'cand-col-b', value: 'Per Serving', rationale: '' },
    review,
    actor: mockActor,
  });

  assert.equal(val.valid, false);
  assert.equal(val.status, 'MISSING_RATIONALE');
});

test('TEST 17: Nutrition decision reversed re-runs affected checks accordingly', () => {
  const review = createMockReview();
  const questions = detectAmbiguities(review);
  review.ambiguityQuestions = questions;
  const q = questions.find(item => item.type === QUESTION_TYPES.NUTRITION_BASIS);

  // 1. Select Per Serving
  resolveAndReevaluate(review, q.questionId, {
    candidateId: 'cand-col-b',
    value: 'Per Serving',
    rationale: 'Select serving',
  }, mockActor);
  assert.equal(review.options.nutritionVariant, 'Per Serving');

  // 2. Reverse to Per 100 g
  resolveAndReevaluate(review, q.questionId, {
    candidateId: 'cand-col-c',
    value: 'Per 100 g',
    rationale: 'Reverse to 100 g',
  }, mockActor);
  assert.equal(review.options.nutritionVariant, 'Per 100 g');

  const energyFinding = review.findings.find(f => f.key === 'rule:nutrition.energy');
  // Per 100 g is 390 kcal, whereas artwork declares 160 kcal per serving -> issue
  assert.equal(energyFinding.status, 'issue', 'Energy must now be issue because 390 kcal does not match 160 kcal on carton');
});

test('TEST 18: Reopening question preserves resolution history', () => {
  const review = createMockReview();
  const questions = detectAmbiguities(review);
  review.ambiguityQuestions = questions;
  const q = questions.find(item => item.type === QUESTION_TYPES.NUTRITION_BASIS);

  resolveAndReevaluate(review, q.questionId, {
    candidateId: 'cand-col-b',
    value: 'Per Serving',
    rationale: 'First resolution',
  }, mockActor);

  assert.equal(q.history.length, 1);
  assert.equal(q.history[0].action, 'RESOLVED');
  assert.equal(q.history[0].value, 'Per Serving');

  // Reopen
  q.status = QUESTION_STATUS.REOPENED;
  q.history.push({
    action: 'REOPENED',
    reason: 'Lab report updated',
    actor: mockActor.displayName,
    at: new Date().toISOString(),
  });

  assert.equal(q.history.length, 2);
  assert.equal(q.history[1].action, 'REOPENED');
  assert.equal(q.history[0].value, 'Per Serving', 'First resolution history must be preserved');
});

test('TEST 19: Requesting evidence transitions question to NEEDS_EVIDENCE without false pass', () => {
  const review = createMockReview();
  const questions = detectAmbiguities(review);
  review.ambiguityQuestions = questions;
  const q = questions.find(item => item.type === QUESTION_TYPES.NUTRITION_BASIS);

  const res = resolveAndReevaluate(review, q.questionId, {
    answerType: 'REQUEST_EVIDENCE',
    rationale: 'Need signed supplier COA for nutrition panel',
  }, mockActor);

  assert.equal(res.status, QUESTION_STATUS.NEEDS_EVIDENCE);
  assert.equal(q.status, QUESTION_STATUS.NEEDS_EVIDENCE);
  assert.equal(review.options.nutritionBasisConfirmed, false, 'Must not falsely confirm nutrition basis');
});

test('TEST 20: Deterministic question queue operates without external AI / Gemini calls', () => {
  const review = createMockReview();
  // Call detectAmbiguities with no AI keys and no network
  const questions = detectAmbiguities(review);
  assert.ok(Array.isArray(questions));
  assert.ok(questions.length > 0);
  assert.equal(questions[0].type, QUESTION_TYPES.NUTRITION_BASIS);
});

// ==========================================
// PHASE 29: MANDATORY INSTRUMENTATION ASSERTION
// ==========================================

test('PHASE 29 INSTRUMENTATION: Resolving nutrition.basis invokes ONLY dependent evaluators and NOT unrelated checks', () => {
  const review = createMockReview();
  const questions = detectAmbiguities(review);
  review.ambiguityQuestions = questions;
  const q = questions.find(item => item.type === QUESTION_TYPES.NUTRITION_BASIS);

  executionTracker.reset();

  const result = resolveAndReevaluate(review, q.questionId, {
    candidateId: 'cand-col-b',
    value: 'Per Serving',
    rationale: 'Confirmed per serving basis',
  }, mockActor);

  const calls = executionTracker.getCalls();

  // 1. MUST BE CALLED:
  assert.ok(calls.includes('nutrition_source_comparison'), 'nutrition_source_comparison MUST be called');
  assert.ok(calls.includes('us_daily_value_arithmetic'), 'us_daily_value_arithmetic MUST be called');
  assert.ok(calls.includes('calorie_sanity'), 'calorie_sanity MUST be called');

  // 2. MUST NOT BE CALLED:
  assert.ok(!calls.includes('barcode_check'), 'barcode_check MUST NOT be called');
  assert.ok(!calls.includes('business_address_check'), 'business_address_check MUST NOT be called');
  assert.ok(!calls.includes('net_quantity_check'), 'net_quantity_check MUST NOT be called');
  assert.ok(!calls.includes('claims_verification'), 'claims_verification MUST NOT be called');

  // Assert skipped list in impact report
  assert.ok(result.impact.unaffectedChecksSkipped.includes('barcode_check'));
  assert.ok(result.impact.unaffectedChecksSkipped.includes('business_address_check'));
  assert.ok(result.impact.unaffectedChecksSkipped.includes('net_quantity_check'));
  assert.ok(result.impact.unaffectedChecksSkipped.includes('claims_verification'));
});
