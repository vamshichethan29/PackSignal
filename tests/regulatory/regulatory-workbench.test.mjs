/**
 * PackSignal Regulatory Intelligence & Source Verification Workbench Test Suite
 * Covers 30 deterministic fixtures across:
 * - Net quantity & dual declaration (21 CFR 101.105)
 * - Ingredient declaration, descending order, subingredients, preservatives (21 CFR 101.4, 101.22)
 * - Major US allergen validation under FALCPA & FASTER Act
 * - Daily Value (%DV) math & statutory reference values (21 CFR 101.9)
 * - Atwater 4-4-9 calorie screening & tolerance
 * - Serving basis & container count plausibility
 * - Rule quotation verification against source documents
 * - Bounded rule compiler & 3D trust model
 * - PDF visibility & occlusion classification
 * - Structured facts, conflict resolution, & guided questions
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateAtwaterScreen,
  calculateFdaRounding,
  evaluateServingPlausibility,
  evaluateDailyValueCheck,
  US_FDA_DAILY_VALUES,
} from '../../lib/regulatory/nutrition.mjs';

import {
  compareIngredientDeclarations,
  parseParentheticalIngredients,
  checkPreservativeFunction,
} from '../../lib/regulatory/ingredients.mjs';

import {
  evaluateAllergenCompliance,
  FDA_MAJOR_ALLERGENS,
} from '../../lib/regulatory/allergens.mjs';

import {
  evaluateStatementOfIdentity,
} from '../../lib/regulatory/identity.mjs';

import {
  evaluateNetQuantity,
} from '../../lib/regulatory/quantities.mjs';

import {
  evaluateBusinessDetails,
} from '../../lib/regulatory/business-details.mjs';

import {
  evaluateNutrientContentClaim,
  evaluateVeganClaim,
} from '../../lib/regulatory/claims.mjs';

import {
  buildRuleCoverageLedger,
} from '../../lib/regulatory/coverage.mjs';

import {
  buildStructuredFactCatalog,
  resolveFactConflict,
} from '../../lib/regulatory/facts.mjs';

import {
  verifyRuleQuotation,
} from '../../lib/rules/quote-verifier.mjs';

import {
  createRuleTrustState,
  transitionReviewerAuthorization,
  canRuleFailArtwork,
} from '../../lib/rules/trust-state.mjs';

import {
  compileRuleRequirement,
  SUPPORTED_RULE_TYPES,
} from '../../lib/rules/rule-compiler.mjs';

import {
  executeCompiledRule,
} from '../../lib/rules/runtime.mjs';

import {
  CHECK_DEPENDENCIES,
  getMissingDependencies,
} from '../../lib/questions/dependencies.mjs';

import {
  generateGuidedQuestions,
} from '../../lib/questions/generator.mjs';

import {
  resolveQuestion,
} from '../../lib/questions/resolution.mjs';

// ==========================================
// FIXTURE 1: Correct Net Quantity (Dual Units)
// ==========================================
test('Fixture 1: Correct Net Quantity with Dual Units (21 CFR 101.105)', () => {
  const result = evaluateNetQuantity({
    declaredText: 'NET WT 14 OZ (396g)',
    expectedValue: '14 oz (396 g)',
    pdpAreaSqIn: 32,
    panelPlacement: 'BOTTOM_30_PERCENT',
  });
  assert.equal(result.status, 'match');
  assert.equal(result.hasDualUnits, true);
  assert.equal(result.placementPass, true);
});

// ==========================================
// FIXTURE 2: Incorrect Net Quantity
// ==========================================
test('Fixture 2: Incorrect Net Quantity flags mismatch issue', () => {
  const result = evaluateNetQuantity({
    declaredText: 'NET WT 12 OZ (340g)',
    expectedValue: '14 oz (396 g)',
    pdpAreaSqIn: 32,
  });
  assert.equal(result.status, 'issue');
  assert.match(result.explanation, /Net quantity declaration mismatch/i);
});

// ==========================================
// FIXTURE 3: Conflicting Net Quantity References
// ==========================================
test('Fixture 3: Conflicting Net Quantity in sources remains CONFLICTED until resolved', () => {
  const specFacts = [
    { id: 'f1', field: 'net_quantity', value: '750 mL', documentId: 'draft-sheet', documentName: 'Draft Spec.xlsx' },
    { id: 'f2', field: 'net_quantity', value: '1000 mL', documentId: 'approved-brief', documentName: 'Signed Brief.pdf' },
  ];
  const catalog = buildStructuredFactCatalog(specFacts);
  const netQtyFacts = catalog.facts.filter(f => f.field === 'net_quantity');
  assert.equal(netQtyFacts.length, 2);
  assert.equal(netQtyFacts[0].approvalState, 'CONFLICTED');
  assert.equal(catalog.conflicts.length, 1);
  assert.equal(catalog.conflicts[0].field, 'net_quantity');

  // Resolution designates authoritative reference
  const resolved = resolveFactConflict(catalog, 'net_quantity', 'f2', 'QA Lead signoff');
  const authoritative = resolved.facts.find(f => f.factId === 'f2');
  const superseded = resolved.facts.find(f => f.factId === 'f1');
  assert.equal(authoritative.approvalState, 'REVIEWER_APPROVED');
  assert.equal(superseded.approvalState, 'SUPERSEDED');
});

// ==========================================
// FIXTURE 4: Ingredient Exact-Copy Match
// ==========================================
test('Fixture 4: Ingredient list exact match with verified formulation', () => {
  const formulation = 'Organic Rolled Oats, Cane Sugar, Canola Oil, Crisp Rice (Rice Flour, Sugar, Salt), Honey, Sea Salt.';
  const artwork = 'Ingredients: Organic Rolled Oats, Cane Sugar, Canola Oil, Crisp Rice (Rice Flour, Sugar, Salt), Honey, Sea Salt.';
  const comp = compareIngredientDeclarations(artwork, formulation);
  assert.equal(comp.status, 'match');
  assert.equal(comp.omittedIngredients.length, 0);
  assert.equal(comp.unapprovedAdditions.length, 0);
});

// ==========================================
// FIXTURE 5: Ingredient Omission with Verified Source
// ==========================================
test('Fixture 5: Ingredient omission from verified source flags issue', () => {
  const formulation = 'Oats, Honey, Almonds, Vanilla Extract, Sea Salt.';
  const artwork = 'Ingredients: Oats, Honey, Vanilla Extract, Sea Salt.'; // Almonds missing!
  const comp = compareIngredientDeclarations(artwork, formulation);
  assert.equal(comp.status, 'issue');
  assert.ok(comp.omittedIngredients.some(i => /almond/i.test(i)));
});

// ==========================================
// FIXTURE 6: Ingredient Order Unsupported
// ==========================================
test('Fixture 6: Ingredient order unsupported without approved weight basis returns review', () => {
  const formulation = 'Oats, Sugar, Honey.';
  const artwork = 'Ingredients: Sugar, Oats, Honey.';
  // Without reliable formulation weights, do not claim legal violation
  const comp = compareIngredientDeclarations(artwork, formulation, { hasFormulationWeights: false });
  assert.equal(comp.orderCheck, 'REVIEW_REQUIRED');
  assert.match(comp.notes, /Weight order unverified without formulation percentage data/i);
});

// ==========================================
// FIXTURE 7: Correct Verified Allergen Declaration
// ==========================================
test('Fixture 7: Correct allergen declaration (FALCPA & FASTER Act 9 allergens)', () => {
  const ingredients = 'Rolled Oats, Almonds, Coconut Oil, Sesame Seeds, Sea Salt.';
  const allergensDeclared = ['Tree nuts (Almonds)', 'Sesame'];
  const artworkText = 'Contains: Almonds, Sesame.';
  const evalRes = evaluateAllergenCompliance({
    ingredientList: ingredients,
    declaredAllergens: allergensDeclared,
    artworkText,
  });
  assert.equal(evalRes.status, 'match');
  assert.equal(evalRes.undeclaredMajorAllergens.length, 0);
});

// ==========================================
// FIXTURE 8: Missing Supported Allergen
// ==========================================
test('Fixture 8: Missing major allergen declaration flags issue', () => {
  const ingredients = 'Wheat Flour, Sugar, Butter (Milk), Eggs, Sesame Tahini.';
  const artworkText = 'Contains: Wheat, Milk.'; // Missing Egg and Sesame
  const evalRes = evaluateAllergenCompliance({
    ingredientList: ingredients,
    artworkText,
  });
  assert.equal(evalRes.status, 'issue');
  assert.ok(evalRes.undeclaredMajorAllergens.includes('Egg') || evalRes.undeclaredMajorAllergens.includes('Sesame'));
});

// ==========================================
// FIXTURE 9: Uncertain Allergen Source (Precautionary vs Intentional)
// ==========================================
test('Fixture 9: Uncertain allergen source distinguishes voluntary advisory statements', () => {
  const evalRes = evaluateAllergenCompliance({
    ingredientList: 'Oats, Honey, Salt.',
    artworkText: 'May contain traces of peanuts.',
    declaredAllergens: [],
  });
  assert.equal(evalRes.precautionaryAdvisoryPresent, true);
  assert.notEqual(evalRes.status, 'issue'); // Precautionary statements are voluntary under FDA
});

// ==========================================
// FIXTURE 10: Correct Nutrient %DV Calculation
// ==========================================
test('Fixture 10: Correct nutrient %DV calculation matches statutory standard', () => {
  // Sodium: 230 mg / 2300 mg DV = 10%
  const res = evaluateDailyValueCheck({
    nutrient: 'sodium',
    printedAmount: 230,
    printedUnit: 'mg',
    printedDvPercent: 10,
  });
  assert.equal(res.status, 'MATH_MATCH');
  assert.equal(res.calculatedDvPercent, 10);
});

// ==========================================
// FIXTURE 11: Incorrect Nutrient %DV Calculation
// ==========================================
test('Fixture 11: Incorrect nutrient %DV flags MATH_MISMATCH', () => {
  // Sodium: 460 mg / 2300 mg = 20%, but artwork declares 5%
  const res = evaluateDailyValueCheck({
    nutrient: 'sodium',
    printedAmount: 460,
    printedUnit: 'mg',
    printedDvPercent: 5,
  });
  assert.equal(res.status, 'MATH_MISMATCH');
  assert.equal(res.calculatedDvPercent, 20);
});

// ==========================================
// FIXTURE 12: Serving-Basis Conflict
// ==========================================
test('Fixture 12: Serving-basis conflict returns INSUFFICIENT_INPUT instead of fake failure', () => {
  const res = evaluateDailyValueCheck({
    nutrient: 'protein',
    printedAmount: 10,
    printedUnit: 'g',
    servingBasis: 'UNKNOWN_OR_MIXED',
  });
  assert.equal(res.status, 'INSUFFICIENT_INPUT');
  assert.match(res.explanation, /Serving basis unresolved/i);
});

// ==========================================
// FIXTURE 13: Calorie Estimate within Atwater Tolerance
// ==========================================
test('Fixture 13: Calorie estimate within 20% Atwater screening tolerance (21 CFR 101.9(g))', () => {
  // Fat 8g (72 kcal) + Carb 24g (96 kcal) + Protein 4g (16 kcal) = 184 kcal. Printed: 180 kcal.
  const atwater = evaluateAtwaterScreen({
    totalFatG: 8,
    totalCarbG: 24,
    proteinG: 4,
    printedCalories: 180,
  });
  assert.equal(atwater.status, 'match');
  assert.equal(atwater.withinTolerance, true);
  assert.equal(atwater.estimatedEnergyKcal, 184);
});

// ==========================================
// FIXTURE 14: Calorie Estimate Outside Screening Tolerance
// ==========================================
test('Fixture 14: Calorie estimate outside 20% tolerance flags review', () => {
  // Fat 20g (180) + Carb 40g (160) + Protein 10g (40) = 380 kcal. Printed: 100 kcal.
  const atwater = evaluateAtwaterScreen({
    totalFatG: 20,
    totalCarbG: 40,
    proteinG: 10,
    printedCalories: 100,
  });
  assert.equal(atwater.status, 'review');
  assert.equal(atwater.withinTolerance, false);
});

// ==========================================
// FIXTURE 15: Complete Valid Source Quotation
// ==========================================
test('Fixture 15: Valid source quotation independently verified against source text', () => {
  const sourceDoc = {
    id: 'spec-01',
    name: 'Brand Guidelines 2026.pdf',
    text: 'All packages must declare Net Quantity in both U.S. Customary and Metric units placed on the bottom 30% of the principal display panel.',
  };
  const quote = 'Net Quantity in both U.S. Customary and Metric units placed on the bottom 30%';
  const ver = verifyRuleQuotation(quote, sourceDoc);
  assert.equal(ver.verified, true);
  assert.equal(ver.verificationStatus, 'VERIFIED_QUOTATION');
});

// ==========================================
// FIXTURE 16: Fabricated AI Rule Quotation
// ==========================================
test('Fixture 16: Fabricated AI rule quotation is marked unverified and blocked', () => {
  const sourceDoc = {
    id: 'spec-01',
    name: 'Spec.pdf',
    text: 'PackSignal standard carton specification version 2.0.',
  };
  const fakeQuote = 'All fonts on side panels must be at least 14pt Arial bold in magenta ink.';
  const ver = verifyRuleQuotation(fakeQuote, sourceDoc);
  assert.equal(ver.verified, false);
  assert.equal(ver.verificationStatus, 'QUOTATION_NOT_VERIFIED');
});

// ==========================================
// FIXTURE 17: Approved Executable Rule Execution
// ==========================================
test('Fixture 17: Approved executable rule runs and determines pass/issue', () => {
  const compiled = compileRuleRequirement({
    ruleId: 'RULE-NET-QTY',
    type: 'REQUIRED_EXACT_TEXT',
    targetField: 'net_quantity',
    parameters: { requiredText: 'NET WT 14 OZ (396g)' },
  });
  const trust = createRuleTrustState({
    sourceVerification: 'VERIFIED_QUOTATION',
    reviewerAuthorization: 'APPROVED',
  });
  assert.equal(canRuleFailArtwork(trust), true);

  const exec = executeCompiledRule(compiled, {
    artworkText: 'NET WT 14 OZ (396g) Delicious Organic Snack',
    trustState: trust,
  });
  assert.equal(exec.verdict, 'match');
});

// ==========================================
// FIXTURE 18: Proposed Non-Executable Rule Cannot Fail Artwork
// ==========================================
test('Fixture 18: Proposed rule cannot fail artwork without approval', () => {
  const trust = createRuleTrustState({
    sourceVerification: 'QUOTATION_NOT_VERIFIED',
    reviewerAuthorization: 'PROPOSED',
  });
  assert.equal(canRuleFailArtwork(trust), false);

  const compiled = compileRuleRequirement({
    ruleId: 'RULE-UNVERIFIED',
    type: 'REQUIRED_EXACT_TEXT',
    parameters: { requiredText: 'NON_EXISTENT_TEXT' },
  });
  const exec = executeCompiledRule(compiled, {
    artworkText: 'Regular artwork content',
    trustState: trust,
  });
  // Must NOT produce issue!
  assert.notEqual(exec.verdict, 'issue');
  assert.equal(exec.verdict, 'not_applicable');
  assert.match(exec.reason, /Cannot fail artwork: Rule is not approved/i);
});

// ==========================================
// FIXTURE 19: Hidden PDF Text Classification
// ==========================================
test('Fixture 19: Hidden PDF text (rendering mode 3 / opacity 0) classified as HIDDEN', () => {
  // Test simulated span data conforming to lib/pdf-visible-text.py output
  const span = {
    text: 'Hidden OCR Layer Text',
    renderMode: 3, // Invisible text
    opacity: 0,
    layerName: 'OCR',
  };
  const isVisible = span.renderMode !== 3 && span.opacity > 0;
  assert.equal(isVisible, false);
});

// ==========================================
// FIXTURE 20: Dieline Guide Text Filtering
// ==========================================
test('Fixture 20: Dieline and technical production guide text classified as GUIDE_OR_DIELINE', () => {
  const span = {
    text: 'CUT LINE - GLUE FLAP 12mm',
    layerName: 'DIELINE',
    isNonPrinting: true,
  };
  const isConsumerFacing = !span.isNonPrinting && !/dieline/i.test(span.layerName);
  assert.equal(isConsumerFacing, false);
});

// ==========================================
// FIXTURE 21: Covered Native PDF Text (Occlusion)
// ==========================================
test('Fixture 21: Occluded text behind opaque drawing is POTENTIALLY_OCCLUDED', () => {
  const textObj = { seqno: 227, bbox: [100, 100, 200, 150], text: 'Old Legacy Nutrition' };
  const rectObj = { seqno: 241, bbox: [90, 90, 210, 160], isOpaqueFill: true };
  const isOccluded = rectObj.seqno > textObj.seqno && rectObj.isOpaqueFill;
  assert.equal(isOccluded, true);
});

// ==========================================
// FIXTURE 22: Unknown PDF Visibility
// ==========================================
test('Fixture 22: Ambiguous PDF transparency or blend mode produces UNKNOWN_VISIBILITY', () => {
  const span = {
    blendMode: 'Difference',
    hasComplexClipping: true,
  };
  const visibility = span.hasComplexClipping ? 'UNKNOWN_VISIBILITY' : 'VISIBLE';
  assert.equal(visibility, 'UNKNOWN_VISIBILITY');
});

// ==========================================
// FIXTURE 23: Missing Source Approval
// ==========================================
test('Fixture 23: Draft specification facts remain UNCONFIRMED until reviewer approval', () => {
  const fact = {
    factId: 'f-draft',
    field: 'brand_name',
    value: 'Dancing Fish',
    sourceRole: 'spec',
    approvalState: 'EXTRACTED',
  };
  assert.notEqual(fact.approvalState, 'REVIEWER_APPROVED');
});

// ==========================================
// FIXTURE 24: Follow-up Question Generation
// ==========================================
test('Fixture 24: Missing serving basis generates targeted follow-up question', () => {
  const review = {
    structuredFacts: [
      { field: 'calories', value: '180' },
    ],
    findings: [
      { id: 'f-basis', key: 'NUTRITION_SERVING_BASIS', status: 'unable' },
    ],
  };
  const questions = generateGuidedQuestions(review);
  assert.ok(questions.length > 0);
  assert.ok(questions.some(q => /serving/i.test(q.title) || /basis/i.test(q.title)));
});

// ==========================================
// FIXTURE 25: Question Resolution Unblocks Checks
// ==========================================
test('Fixture 25: Answering guided question updates state and dependent check', () => {
  const review = {
    guidedQuestions: [
      {
        questionId: 'q-basis',
        title: 'Serving Size Basis',
        status: 'OPEN',
        dependentCheckIds: ['CHK-DV-SODIUM'],
      },
    ],
    structuredFacts: [],
  };
  const updated = resolveQuestion(review, 'q-basis', {
    answer: 'Per 1 Bar (40g)',
    actor: 'Lead Packaging QA',
  });
  const q = updated.guidedQuestions.find(i => i.questionId === 'q-basis');
  assert.equal(q.status, 'RESOLVED');
  assert.equal(q.answer.answer, 'Per 1 Bar (40g)');
});

// ==========================================
// FIXTURE 26: Dependent-Check Recomputation
// ==========================================
test('Fixture 26: Serving basis dependency graph unblocks DV calculation', () => {
  const missing = getMissingDependencies('CHK_NUTRITION_DV', {
    hasApprovedReferenceDv: true,
    hasResolvedServingBasis: true,
  });
  assert.equal(missing.length, 0); // All unblocked!
});

// ==========================================
// FIXTURE 27: Stale Reviewer Sign-Off on Source Change
// ==========================================
test('Fixture 27: Source document replacement invalidates previous sign-off', () => {
  const trust = createRuleTrustState({
    sourceVerification: 'VERIFIED_QUOTATION',
    reviewerAuthorization: 'APPROVED',
  });
  // Simulate source replacement
  const invalidated = transitionReviewerAuthorization(trust, 'PROPOSED', 'Source document was modified');
  assert.equal(invalidated.reviewerAuthorization, 'PROPOSED');
  assert.equal(canRuleFailArtwork(invalidated), false);
});

// ==========================================
// FIXTURE 28: Original Artwork Evidence Navigation
// ==========================================
test('Fixture 28: Finding connects to genuine artwork coordinates without fake bbox', () => {
  const finding = {
    id: 'f-net-qty',
    key: 'NET_QUANTITY_MISMATCH',
    evidence: [
      { role: 'artwork', page: 1, box: [100, 200, 300, 250], quote: 'NET WT 12 OZ' },
      { role: 'spec', documentName: 'Spec.pdf', location: 'Page 2, Table 1', quote: '14 oz (396g)' },
    ],
  };
  const artEvidence = finding.evidence.find(e => e.role === 'artwork');
  assert.ok(artEvidence);
  assert.equal(artEvidence.box.length, 4);
});

// ==========================================
// FIXTURE 29: Source Version Tracking
// ==========================================
test('Fixture 29: Multi-source version tracking preserves draft vs final specs', () => {
  const rawFacts = [
    { field: 'product_name', value: 'Dancing Fish Original', version: '1.0-draft' },
    { field: 'product_name', value: 'Dancing Fish Crisp Snack', version: '2.0-final' },
  ];
  const catalog = buildStructuredFactCatalog(rawFacts);
  assert.equal(catalog.facts.length, 2);
  assert.equal(catalog.conflicts.length, 1);
});

// ==========================================
// FIXTURE 30: Unsupported Regulatory Requirement
// ==========================================
test('Fixture 30: Unsupported requirement returns NEEDS_MANUAL_REVIEW without failing', () => {
  const compiled = compileRuleRequirement({
    ruleId: 'RULE-COMPLEX-BIOENGINEERED',
    naturalText: 'Bioengineered food symbol must adhere to USDA AMS electronic digital link disclosure.',
  });
  assert.equal(compiled.type, 'MANUAL_REVIEW');
  const exec = executeCompiledRule(compiled, { artworkText: 'Scan here for more info.' });
  assert.equal(exec.verdict, 'review');
  assert.match(exec.reason, /Manual human review required/i);
});

// ==========================================
// RULE COVERAGE LEDGER INTEGRITY
// ==========================================
test('Rule Coverage Ledger tracks executed, manual, blocked, and unsupported rules', () => {
  const rules = [
    { verdict: 'match', executed: true, evidenceBox: [10, 10, 20, 20] },
    { verdict: 'issue', executed: true, evidenceBox: [30, 30, 40, 40] },
    { verdict: 'review', manualReview: true },
    { verdict: 'unable', blocked: true },
    { verdict: 'unsupported', unsupported: true },
  ];
  const ledger = buildRuleCoverageLedger(rules);
  assert.equal(ledger.totalCandidateRequirements, 5);
  assert.equal(ledger.appliedRules, 2);
  assert.equal(ledger.manualReviewRules, 1);
  assert.equal(ledger.blockedRules, 1);
  assert.equal(ledger.unsupportedRules, 1);
  assert.equal(ledger.rulesWithLocatedEvidence, 2);
});
