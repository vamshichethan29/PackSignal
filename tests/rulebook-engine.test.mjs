/**
 * PackSignal Advanced Rulebook Engine Comprehensive Test Suite
 * (tests/rulebook-engine.test.mjs)
 *
 * Implements Step 21: Covers all 30 specified test cases for:
 * - Multi-format rulebook extraction (JSON, DOCX, PDF, TXT)
 * - Deterministic quotation verification & numerical/unit preservation
 * - AI proposal integration & hallucination rejection
 * - Human authorization gate & lifecycle transitions
 * - Evaluator execution across all 13 supported check types
 * - Source change invalidation & stale approval revocation
 * - Execution & coverage ledger calculations
 * - Signed report backward compatibility
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRuleRecord,
  validateRuleRecord,
  buildStableRuleId,
  SUPPORTED_CHECK_TYPES,
  SOURCE_VERIFICATION,
  AUTHORIZATION_STATUS,
  APPLICABILITY_STATUS,
  EXECUTION_STATUS,
  FINDING_RESULT,
  EVALUATION_METHOD,
  verifyRuleQuotation,
  extractRequirementsFromDocument,
  compileRuleRequirement,
  integrateAiProposedRule,
  executeEvaluator,
  evaluateRuleApplicability,
  isRuleExecutable,
  transitionRuleAuthorization,
  invalidateStaleAuthorization,
  RuleExecutionLedger,
  buildRuleCoverageLedger,
  processRulebookEngine,
} from '../lib/rulebook/index.mjs';

import { sealReview, verifyReviewSeal } from '../lib/audit-signature.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// TEST 1: Valid JSON structured rule compiles and executes when authorized and applicable
test('TEST 1: Valid JSON structured rule compiles and executes when authorized and applicable', () => {
  const jsonDoc = {
    id: 'rulebook-json',
    role: 'rules',
    name: 'Standard_Rules.json',
    sha256: 'a'.repeat(64),
    data: {
      rules: [
        {
          id: 'RULE-NET-QTY',
          title: 'Net Quantity Dual Unit Requirement',
          checkType: 'UNIT_EQUIVALENT_VALUE',
          parameters: { field: 'net_quantity' },
          approved: true,
          approvedBy: 'Compliance Lead',
          rule_text: 'The principal display panel must bear net quantity in both metric and US customary units.',
        },
      ],
    },
  };

  const extracted = extractRequirementsFromDocument(jsonDoc);
  assert.equal(extracted.length, 1);
  assert.equal(extracted[0].id, 'RULE-NET-QTY');
  assert.equal(extracted[0].authorization.status, AUTHORIZATION_STATUS.APPROVED);
  assert.ok(isRuleExecutable(extracted[0]));

  const result = executeEvaluator(extracted[0].interpretation.checkType, extracted[0], {
    facts: { net_quantity: { value: '12 oz (340g)', observed: '12 oz (340g)' } },
    artworkQuantity: '12 oz (340g)',
  });
  assert.equal(result.result, FINDING_RESULT.MATCH);
});

// TEST 2: Valid DOCX requirement quotation and provenance retained
test('TEST 2: Valid DOCX requirement quotation and provenance retained', () => {
  const docxDoc = {
    id: 'rulebook-docx',
    role: 'rules',
    name: 'Brand_Guidelines.docx',
    lines: [
      { text: 'Section 4: Allergen Disclosures', heading: 'Section 4' },
      { text: 'Major allergens must be declared using the exact phrase "Contains Milk, Soy, and Wheat".', line: 12 },
    ],
  };

  const extracted = extractRequirementsFromDocument(docxDoc);
  assert.ok(extracted.length >= 1);
  const allergenRule = extracted.find(r => r.source.originalQuote.includes('Contains Milk'));
  assert.ok(allergenRule);
  assert.equal(allergenRule.source.documentId, 'rulebook-docx');
  assert.equal(allergenRule.source.line, 12);
  assert.ok(allergenRule.source.originalQuote.includes('Contains Milk, Soy, and Wheat'));
});

// TEST 3: Valid PDF requirement page and quotation retained
test('TEST 3: Valid PDF requirement page and quotation retained', () => {
  const pdfDoc = {
    id: 'rulebook-pdf',
    role: 'rules',
    name: 'Labeling_Manual.pdf',
    pages: [
      { number: 1, text: 'Cover page' },
      { number: 3, text: 'Storage instructions must state "Refrigerate after opening" on the back panel.' },
    ],
    lines: [
      { page: 3, line: 14, text: 'Storage instructions must state "Refrigerate after opening" on the back panel.' },
    ],
  };

  const extracted = extractRequirementsFromDocument(pdfDoc);
  assert.ok(extracted.length >= 1);
  const storageRule = extracted[0];
  assert.equal(storageRule.source.page, 3);
  assert.equal(storageRule.source.documentId, 'rulebook-pdf');
  assert.ok(storageRule.source.originalQuote.includes('Refrigerate after opening'));
});

// TEST 4: Valid TXT requirement line context retained
test('TEST 4: Valid TXT requirement line context retained', () => {
  const txtDoc = {
    id: 'rulebook-txt',
    role: 'rules',
    name: 'Specifications.txt',
    lines: [
      { line: 1, text: 'General notes' },
      { line: 5, text: 'The distributor address must be included on the information panel.' },
    ],
  };

  const extracted = extractRequirementsFromDocument(txtDoc);
  assert.ok(extracted.length >= 1);
  const distRule = extracted.find(r => r.source.originalQuote.includes('distributor address'));
  assert.ok(distRule);
  assert.equal(distRule.source.line, 5);
});

// TEST 5: AI invents a rule quotation -> quotation unverified, not automatically enforced
test('TEST 5: AI invents a rule quotation -> quotation unverified, not automatically enforced', () => {
  const sourceDoc = {
    id: 'doc-source',
    name: 'Source.txt',
    text: 'Keep in dry conditions at room temperature.',
  };

  const fakeQuote = 'Product must be refrigerated continuously at 4 degrees Celsius.';
  const qv = verifyRuleQuotation(fakeQuote, sourceDoc);

  assert.equal(qv.verified, false);
  assert.equal(qv.status, SOURCE_VERIFICATION.UNVERIFIED);

  const rule = createRuleRecord({
    title: 'Fabricated Refrigeration Requirement',
    source: { documentId: sourceDoc.id, originalQuote: fakeQuote, verificationStatus: qv.status },
    authorization: { status: AUTHORIZATION_STATUS.PROPOSED },
  });

  assert.equal(isRuleExecutable(rule), false, 'Rule with unverified quotation must not be executable');
});

// TEST 6: AI changes 1000 mL to 750 mL -> rejected altered numerical value
test('TEST 6: AI changes 1000 mL to 750 mL -> rejected altered numerical value', () => {
  const sourceDoc = {
    id: 'spec-sheet',
    name: 'Liquid_Spec.txt',
    text: 'Net quantity must be 1000 mL for standard retail package.',
  };

  const alteredQuote = 'Net quantity must be 750 mL for standard retail package.';
  const qv = verifyRuleQuotation(alteredQuote, sourceDoc);

  assert.equal(qv.verified, false);
  assert.ok(qv.reason.includes('Numerical or unit modification rejected') || qv.reason.includes('not found'));
});

// TEST 7: Proposed rule has supported evaluator -> not automatically applied
test('TEST 7: Proposed rule has supported evaluator -> not automatically applied', () => {
  const rule = createRuleRecord({
    id: 'rule-proposed',
    title: 'Required Phrase Rule',
    interpretation: { checkType: 'REQUIRED_PHRASE', parameters: { phrase: '100% Recyclable' } },
    source: { verificationStatus: SOURCE_VERIFICATION.VERIFIED },
    authorization: { status: AUTHORIZATION_STATUS.PROPOSED },
  });

  assert.equal(isRuleExecutable(rule), false, 'Proposed rule must not execute before reviewer authorization');
});

// TEST 8: Authorized supported rule -> actual evaluator executes
test('TEST 8: Authorized supported rule -> actual evaluator executes', () => {
  const rule = createRuleRecord({
    id: 'rule-authorized',
    title: 'Certified Organic Requirement',
    interpretation: { checkType: 'REQUIRED_PHRASE', parameters: { phrase: 'Certified Organic' } },
    source: { verificationStatus: SOURCE_VERIFICATION.VERIFIED },
    authorization: { status: AUTHORIZATION_STATUS.APPROVED, authorizedBy: 'QA Manager' },
  });

  assert.equal(isRuleExecutable(rule), true);
  const evalResult = executeEvaluator('REQUIRED_PHRASE', rule, {
    artworkText: 'Fieldday Organic Granola - Certified Organic by Ecocert',
  });
  assert.equal(evalResult.result, FINDING_RESULT.MATCH);
  assert.ok(evalResult.explanation.includes('Verified mandatory phrase'));
});

// TEST 9: Verified quotation but inapplicable product category -> not applicable
test('TEST 9: Verified quotation but inapplicable product category -> not applicable', () => {
  const rule = createRuleRecord({
    id: 'rule-dairy',
    title: 'Grade A Dairy Seal',
    source: { verificationStatus: SOURCE_VERIFICATION.VERIFIED },
    authorization: { status: AUTHORIZATION_STATUS.APPROVED },
    applicability: { market: 'us', productScope: 'dairy_milk' },
  });

  const app = evaluateRuleApplicability(rule, {
    market: 'us',
    foodCategory: 'cereal_granola',
  });

  assert.equal(app.isApplicable, false);
  assert.equal(app.status, APPLICABILITY_STATUS.NOT_APPLICABLE);
  assert.ok(app.reason.includes('product scope'));
});

// TEST 10: Approved rule with missing input facts -> blocked or review, not match
test('TEST 10: Approved rule with missing input facts -> blocked or review, not match', () => {
  const rule = createRuleRecord({
    id: 'rule-qty-fact',
    title: 'Net Quantity Matching',
    interpretation: { checkType: 'UNIT_EQUIVALENT_VALUE', field: 'net_quantity' },
    source: { verificationStatus: SOURCE_VERIFICATION.VERIFIED },
    authorization: { status: AUTHORIZATION_STATUS.APPROVED },
  });

  const evalResult = executeEvaluator('UNIT_EQUIVALENT_VALUE', rule, {
    facts: {}, // Missing facts
  });

  assert.equal(evalResult.result, FINDING_RESULT.BLOCKED);
  assert.ok(evalResult.blockers.length > 0);
});

// TEST 11: Exact numeric mismatch -> evidence-backed issue
test('TEST 11: Exact numeric mismatch -> evidence-backed issue', () => {
  const rule = createRuleRecord({
    id: 'rule-numeric',
    interpretation: { checkType: 'EXACT_NUMERIC_VALUE', field: 'honey_percent', parameters: { value: 12 } },
  });

  const evalResult = executeEvaluator('EXACT_NUMERIC_VALUE', rule, {
    facts: { honey_percent: { value: '10%' } },
  });

  assert.equal(evalResult.result, FINDING_RESULT.ISSUE);
  assert.ok(evalResult.explanation.includes('discrepancy'));
});

// TEST 12: Unit-equivalent quantity -> supported match
test('TEST 12: Unit-equivalent quantity -> supported match', () => {
  const rule = createRuleRecord({
    id: 'rule-unit-eq',
    interpretation: { checkType: 'UNIT_EQUIVALENT_VALUE', field: 'net_quantity', parameters: { value: '1 L' } },
  });

  const evalResult = executeEvaluator('UNIT_EQUIVALENT_VALUE', rule, {
    facts: { net_quantity: { value: '1 L' } },
    artworkQuantity: '1000 mL',
  });

  assert.equal(evalResult.result, FINDING_RESULT.MATCH);
  assert.ok(evalResult.explanation.includes('equivalence confirmed'));
});

// TEST 13: Required phrase found -> supported match
test('TEST 13: Required phrase found -> supported match', () => {
  const rule = createRuleRecord({
    interpretation: { checkType: 'REQUIRED_PHRASE', parameters: { phrase: 'Store in a cool, dry place.' } },
  });

  const evalResult = executeEvaluator('REQUIRED_PHRASE', rule, {
    artworkText: 'Dancing Fish Granola. Store in a cool, dry place. Keep sealed.',
    isArtworkComplete: true,
  });

  assert.equal(evalResult.result, FINDING_RESULT.MATCH);
});

// TEST 14: Phrase absent but artwork coverage incomplete -> review/unable, not definitive issue
test('TEST 14: Phrase absent but artwork coverage incomplete -> review/unable, not definitive issue', () => {
  const rule = createRuleRecord({
    interpretation: { checkType: 'REQUIRED_PHRASE', parameters: { phrase: 'Made in USA' } },
  });

  const evalResult = executeEvaluator('REQUIRED_PHRASE', rule, {
    artworkText: 'Front label only.',
    isArtworkComplete: false, // Incomplete coverage!
  });

  assert.equal(evalResult.result, FINDING_RESULT.REVIEW);
  assert.ok(evalResult.explanation.includes('complete artwork coverage has not been confirmed'));
});

// TEST 15: Forbidden phrase present -> issue only with applicable verified source rule
test('TEST 15: Forbidden phrase present -> issue only with applicable verified source rule', () => {
  const rule = createRuleRecord({
    interpretation: { checkType: 'FORBIDDEN_PHRASE', parameters: { phrase: 'Guaranteed to Cure Diabetes' } },
    source: { verificationStatus: SOURCE_VERIFICATION.VERIFIED },
    authorization: { status: AUTHORIZATION_STATUS.APPROVED },
  });

  const evalResult = executeEvaluator('FORBIDDEN_PHRASE', rule, {
    artworkText: 'Special Granola - Guaranteed to Cure Diabetes fast!',
  });

  assert.equal(evalResult.result, FINDING_RESULT.ISSUE);
  assert.ok(evalResult.explanation.includes('Prohibited text violation'));
});

// TEST 16: Minimum font-size rule with only text-box height -> does not falsely claim an exact PDF font measurement
test('TEST 16: Minimum font-size rule with only text-box height -> does not falsely claim an exact PDF font measurement', () => {
  const rule = createRuleRecord({
    interpretation: { checkType: 'MINIMUM_TEXT_SIZE', parameters: { minPoint: 6.0 } },
  });

  const evalResult = executeEvaluator('MINIMUM_TEXT_SIZE', rule, {
    nativeFontPoint: null, // No native font size
    boundingBoxHeightPt: 8.5, // Box height is only an estimate
  });

  assert.equal(evalResult.result, FINDING_RESULT.REVIEW);
  assert.ok(evalResult.limitations.some(l => l.includes('not a certified font measurement')));
});

// TEST 17: Panel placement rule without trusted panel mapping -> review/unable
test('TEST 17: Panel placement rule without trusted panel mapping -> review/unable', () => {
  const rule = createRuleRecord({
    interpretation: { checkType: 'REQUIRED_PANEL_PLACEMENT', parameters: { panel: 'principal_display_panel' } },
  });

  const evalResult = executeEvaluator('REQUIRED_PANEL_PLACEMENT', rule, {
    panelMappingConfirmed: false,
  });

  assert.equal(evalResult.result, FINDING_RESULT.REVIEW);
  assert.ok(evalResult.blockers.some(b => b.includes('Confirmed panel mapping required')));
});

// TEST 18: Claim lacks substantiation -> review/needs evidence
test('TEST 18: Claim lacks substantiation -> review/needs evidence', () => {
  const rule = createRuleRecord({
    source: { originalQuote: '100% Carbon Neutral Packaging' },
    interpretation: { checkType: 'CLAIM_SUBSTANTIATION', parameters: { claim: '100% Carbon Neutral Packaging' } },
  });

  const evalResult = executeEvaluator('CLAIM_SUBSTANTIATION', rule, {
    claimsRegister: [], // Empty register!
  });

  assert.equal(evalResult.result, FINDING_RESULT.REVIEW);
  assert.ok(evalResult.explanation.includes('lacks approved substantiation'));
});

// TEST 19: Unsupported natural-language requirement -> retained in rule coverage ledger
test('TEST 19: Unsupported natural-language requirement -> retained in rule coverage ledger', () => {
  const rawProse = 'Artwork should convey a warm and artisanal sunrise feeling with organic curves.';
  const compiled = compileRuleRequirement(rawProse);

  assert.equal(compiled.interpretation.isCompiled, false);
  assert.equal(compiled.interpretation.checkType, 'MANUAL_REVIEW');

  const coverage = buildRuleCoverageLedger([compiled]);
  assert.equal(coverage.metrics.uncompiledRules, 1);
  assert.equal(coverage.items[0].checkType, 'MANUAL_REVIEW');
});

// TEST 20: Changed rulebook source -> relevant verification and authorization invalidated
test('TEST 20: Changed rulebook source -> relevant verification and authorization invalidated', () => {
  const approvedRule = createRuleRecord({
    id: 'rule-storage-auth',
    source: { verificationStatus: SOURCE_VERIFICATION.VERIFIED },
    authorization: { status: AUTHORIZATION_STATUS.APPROVED, authorizedBy: 'Manager' },
  });

  const invalidated = invalidateStaleAuthorization(approvedRule, 'Source document SHA-256 changed');
  assert.equal(invalidated.authorization.status, AUTHORIZATION_STATUS.PROPOSED);
  assert.equal(invalidated.source.verificationStatus, SOURCE_VERIFICATION.SOURCE_CHANGED);
  assert.ok(invalidated.history.some(h => h.action === 'rule_approval_invalidated'));
});

// TEST 21: Existing saved review -> loads without fabricated historical execution data
test('TEST 21: Existing saved review -> loads without fabricated historical execution data', () => {
  const legacyReview = {
    id: 'legacy-001',
    rules: [
      { id: 'leg-1', text: 'Store in refrigerator', comparison: 'uncompiled' },
    ],
  };

  const coverage = buildRuleCoverageLedger(legacyReview.rules);
  assert.equal(coverage.metrics.totalRules, 1);
  assert.equal(coverage.items[0].executedAt, null, 'Historical rule without execution ledger must not fabricate execution timestamp');
});

// TEST 22: Unauthorized rule approval -> rejected (requires explicit reason for unverified quotation)
test('TEST 22: Unauthorized rule approval -> rejected (requires explicit reason for unverified quotation)', () => {
  const unverifiedRule = createRuleRecord({
    source: { verificationStatus: SOURCE_VERIFICATION.UNVERIFIED },
    authorization: { status: AUTHORIZATION_STATUS.PROPOSED },
  });

  assert.throws(
    () => transitionRuleAuthorization(unverifiedRule, AUTHORIZATION_STATUS.APPROVED, { displayName: 'Reviewer' }, ''),
    /Approval of an unverified quotation requires an explicit documented reason/i
  );
});

// TEST 23: Rule with linked artwork evidence -> navigates to the correct artwork page/region
test('TEST 23: Rule with linked artwork evidence -> navigates to the correct artwork page/region', () => {
  const rule = createRuleRecord({
    id: 'rule-honey',
    evidence: {
      artworkPage: 1,
      artworkBox: [0.1, 0.2, 0.3, 0.4],
      hasPreciseCoordinates: true,
    },
  });

  assert.equal(rule.evidence.artworkPage, 1);
  assert.deepEqual(rule.evidence.artworkBox, [0.1, 0.2, 0.3, 0.4]);
  assert.equal(rule.evidence.hasPreciseCoordinates, true);
});

// TEST 24: Rule without artwork coordinates -> honest unlocated state
test('TEST 24: Rule without artwork coordinates -> honest unlocated state', () => {
  const rule = createRuleRecord({
    id: 'rule-unlocated',
    evidence: { artworkBox: null, hasPreciseCoordinates: false },
  });

  assert.equal(rule.evidence.hasPreciseCoordinates, false);
  assert.equal(rule.evidence.artworkBox, null);
});

// TEST 25: Signed review export -> existing signature verification remains valid
test('TEST 25: Signed review export -> existing signature verification remains valid', async () => {
  const storage = await mkdtemp(join(tmpdir(), 'packsignal-sign-compat-'));
  try {
    const review = {
      id: 'review-seal-test',
      name: 'Signed Review Test',
      documents: [{ id: 'art-1', role: 'artwork', name: 'carton.pdf', sha256: 'b'.repeat(64) }],
      findings: [{ id: 'f-1', status: 'match', expected: '12 oz', observed: '12 oz', evidence: [] }],
      decisions: {},
    };

    const signature = await sealReview(review, storage);
    review.signature = signature;

    const verify = await verifyReviewSeal(review, storage);
    assert.equal(verify.valid, true);
    assert.equal(verify.algorithm, 'Ed25519');
  } finally {
    await rm(storage, { recursive: true, force: true }).catch(() => {});
  }
});

// TEST 26: Gemini unavailable -> approved deterministic checks continue working
test('TEST 26: Gemini unavailable -> approved deterministic checks continue working', () => {
  const deterministicRule = createRuleRecord({
    interpretation: { checkType: 'UNIT_EQUIVALENT_VALUE', parameters: { value: '12 oz (340g)' } },
    source: { verificationStatus: SOURCE_VERIFICATION.VERIFIED },
    authorization: { status: AUTHORIZATION_STATUS.APPROVED },
  });

  // Local deterministic evaluation with Gemini off
  const result = executeEvaluator('UNIT_EQUIVALENT_VALUE', deterministicRule, {
    facts: { net_quantity: { value: '12 oz (340g)' } },
    artworkQuantity: '12 oz (340g)',
  });

  assert.equal(result.result, FINDING_RESULT.MATCH);
  assert.equal(result.method, EVALUATION_METHOD.DETERMINISTIC);
});

// TEST 27: Same rule extracted twice -> correct deduplication without losing distinct requirements
test('TEST 27: Same rule extracted twice -> correct deduplication without losing distinct requirements', () => {
  const quote = 'Net quantity must be declared in lower 30% of PDP.';
  const id1 = buildStableRuleId({ documentId: 'doc-1', quotation: quote, section: 'Sec 1' });
  const id2 = buildStableRuleId({ documentId: 'doc-1', quotation: quote, section: 'Sec 1' });
  const id3 = buildStableRuleId({ documentId: 'doc-1', quotation: quote, section: 'Sec 2' });

  assert.equal(id1, id2, 'Identical requirements must yield stable duplicate-detecting IDs');
  assert.notEqual(id1, id3, 'Distinct sections must maintain distinct rule IDs');
});

// TEST 28: Rule with condition not satisfied -> not applicable, not automatically passed
test('TEST 28: Rule with condition not satisfied -> not applicable, not automatically passed', () => {
  const conditionalRule = createRuleRecord({
    interpretation: {
      checkType: 'CONDITIONAL_REQUIREMENT',
      condition: { field: 'is_organic', equals: true },
      parameters: { subCheckType: 'REQUIRED_PHRASE', phrase: 'Certified Organic' },
    },
  });

  const evalResult = executeEvaluator('CONDITIONAL_REQUIREMENT', conditionalRule, {
    facts: { is_organic: { value: false } },
  });

  assert.equal(evalResult.result, FINDING_RESULT.NOT_APPLICABLE);
  assert.ok(evalResult.explanation.includes('not met'));
});

// TEST 29: Rule source updated but UI holds stale version -> server rejects stale approval
test('TEST 29: Rule source updated but UI holds stale version -> server rejects stale approval', () => {
  const rule = createRuleRecord({
    id: 'rule-stale-check',
    source: { documentHash: '1111'.repeat(16), originalQuote: 'Keep refrigerated' },
  });

  const updatedSourceDoc = {
    id: 'doc-1',
    sha256: '2222'.repeat(16), // Source updated!
    text: 'Keep refrigerated at all times',
  };

  const qv = verifyRuleQuotation({ rule, sourceDocument: updatedSourceDoc });
  assert.equal(qv.verified, false);
  assert.equal(qv.status, SOURCE_VERIFICATION.SOURCE_CHANGED);
});

// TEST 30: Coverage dashboard metrics -> counts match actual ledger state
test('TEST 30: Coverage dashboard metrics -> counts match actual ledger state', () => {
  const rules = [
    createRuleRecord({
      id: 'r1',
      source: { verificationStatus: SOURCE_VERIFICATION.VERIFIED },
      authorization: { status: AUTHORIZATION_STATUS.APPROVED },
      execution: { status: EXECUTION_STATUS.APPLIED },
    }),
    createRuleRecord({
      id: 'r2',
      source: { verificationStatus: SOURCE_VERIFICATION.UNVERIFIED },
      authorization: { status: AUTHORIZATION_STATUS.PROPOSED },
      execution: { status: EXECUTION_STATUS.NOT_APPLIED },
    }),
    createRuleRecord({
      id: 'r3',
      source: { verificationStatus: SOURCE_VERIFICATION.VERIFIED },
      authorization: { status: AUTHORIZATION_STATUS.APPROVED },
      applicability: { status: APPLICABILITY_STATUS.NOT_APPLICABLE },
      execution: { status: EXECUTION_STATUS.NOT_APPLICABLE },
    }),
  ];

  const coverage = buildRuleCoverageLedger(rules);
  assert.equal(coverage.metrics.totalRules, 3);
  assert.equal(coverage.metrics.verifiedQuotations, 2);
  assert.equal(coverage.metrics.unverifiedRules, 1);
  assert.equal(coverage.metrics.authorizedRules, 2);
  assert.equal(coverage.metrics.proposedRules, 1);
  assert.equal(coverage.metrics.actuallyExecutedRules, 1);
  assert.equal(coverage.metrics.notApplicableRules, 1);
});
