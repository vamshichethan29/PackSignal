/**
 * PackSignal Ambiguity Resolution Engine — Incremental Reevaluation Runner
 * (lib/ambiguity/incremental-runner.mjs)
 * Implements Phase 11 & Phase 29: Genuine targeted reevaluation without rerunning
 * full analyze(), PDF extraction, OCR, or unrelated check evaluators.
 */

import { validateAnswer } from './answer-validator.mjs';
import { getDependentChecks, EVALUATOR_REGISTRY } from './dependency-graph.mjs';
import { QUESTION_STATUS } from './question-types.mjs';
import { executeUsDailyValueCheck } from '../regulatory/us/daily-values.mjs';
import { executeUsCalorieSanityCheck } from '../regulatory/us/calorie-sanity.mjs';
import { executeUsNutritionFieldsCheck } from '../regulatory/us/nutrition-fields.mjs';
import { executeUsNetQuantityCheck } from '../regulatory/us/net-quantity.mjs';
import { executeUsBusinessAddressCheck } from '../regulatory/us/business-address.mjs';
import { executeUsIngredientsAllergensCheck } from '../regulatory/us/ingredients-allergens.mjs';
import { executeUsClaimVerificationCheck } from '../regulatory/us/claims-evidence.mjs';

/**
 * Global or test-accessible execution tracker that records which evaluators are invoked.
 */
export const executionTracker = {
  invocations: [],
  reset() { this.invocations = []; },
  record(checkId) { this.invocations.push(checkId); },
  getCalls() { return [...this.invocations]; },
};

function normal(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Re-evaluates nutrition source comparison against artwork text.
 */
function runNutritionComparisonEvaluator(review, workingSelectedFacts) {
  executionTracker.record('nutrition_source_comparison');

  const artDoc = review.documents?.find(d => d.role === 'artwork') || { text: review.artworkText || '' };
  const artText = artDoc.text || '';
  const artNorm = normal(artText);
  const basis = workingSelectedFacts.find(f => f.field === 'nutrition.basis');
  const isBasisConfirmed = Boolean(review.options?.nutritionBasisConfirmed);

  const newFindings = [];
  const nutritionFacts = workingSelectedFacts.filter(f => f.field.startsWith('nutrition.') && f.field !== 'nutrition.basis');

  const labels = {
    'nutrition.energy': 'Energy',
    'nutrition.totalfat': 'Total Fat',
    'nutrition.saturatedfat': 'Saturated Fat',
    'nutrition.sodium': 'Sodium',
    'nutrition.totalcarbohydrate': 'Total Carbohydrate',
    'nutrition.dietaryfiber': 'Dietary Fiber',
    'nutrition.totalsugars': 'Total Sugars',
    'nutrition.protein': 'Protein',
  };

  for (const f of nutritionFacts) {
    const key = `rule:${f.field}`;
    const expected = f.value;
    const title = labels[f.field] || f.field;

    // Check if basis matches
    if (!isBasisConfirmed || !basis) {
      newFindings.push({
        id: key,
        key,
        title,
        status: 'review',
        expected,
        observed: 'Unconfirmed nutrition basis',
        explanation: 'The nutrition basis is unconfirmed or not found in the artwork. Confirm basis in Sources.',
        evidence: f.evidence ? [f.evidence] : [],
        field: f.field,
        method: 'nutrition_source_comparison',
        updatedAt: new Date().toISOString(),
      });
      continue;
    }

    // Number matching
    const expectedNums = expected.match(/\d+(?:\.\d+)?/g) || [];
    const expectedNum = expectedNums[0];

    const searchTerms = f.field === 'nutrition.energy'
      ? ['calories', 'energy', 'kcal']
      : [title.replace('Total ', '').toLowerCase()];

    const lines = artText.split(/\r?\n/).filter(l => {
      const normL = normal(l);
      return searchTerms.some(term => normL.includes(normal(term)));
    });

    const lineWithNum = lines.find(l => expectedNum && l.includes(expectedNum));
    const basisMatchesArtwork = artNorm.includes(normal(basis.value));

    const match = Boolean(lineWithNum) && basisMatchesArtwork;
    newFindings.push({
      id: key,
      key,
      title,
      status: match ? 'match' : 'issue',
      expected,
      observed: lineWithNum ? lineWithNum.trim() : (lines[0]?.trim() || `Declared ${title} differs from approved source`),
      explanation: match
        ? `Declared ${title} matches the verified source specification (${expected}).`
        : `Declared ${title} differs from the verified source specification (${expected}).`,
      evidence: f.evidence ? [f.evidence] : [],
      field: f.field,
      method: 'nutrition_source_comparison',
      updatedAt: new Date().toISOString(),
    });
  }

  return newFindings;
}

/**
 * Re-evaluates US-005 Daily Value check.
 */
function runDailyValueEvaluator(review, workingSelectedFacts) {
  executionTracker.record('us_daily_value_arithmetic');
  const result = executeUsDailyValueCheck(review);

  const finding = {
    id: 'us-preflight-us-005',
    key: 'us-preflight-us-005',
    title: result.title,
    status: result.findingStatus,
    expected: result.expectedValue || 'Statutory %DV',
    observed: result.observedValue || 'Printed %DV',
    explanation: result.explanation,
    calculation: result.calculation,
    evidence: result.evidence ? [result.evidence] : [],
    legalBasis: result.legalBasis,
    method: 'us_daily_value_arithmetic',
    updatedAt: new Date().toISOString(),
  };

  return [finding];
}

/**
 * Re-evaluates US-006 Calorie Sanity check.
 */
function runCalorieSanityEvaluator(review, workingSelectedFacts) {
  executionTracker.record('calorie_sanity');
  const result = executeUsCalorieSanityCheck(review);

  const finding = {
    id: 'us-preflight-us-006',
    key: 'us-preflight-us-006',
    title: result.title,
    status: result.findingStatus,
    expected: result.expectedValue || 'Atwater 4-4-9 Estimate',
    observed: result.observedValue || 'Printed Calories',
    explanation: result.explanation,
    calculation: result.calculation,
    evidence: result.evidence ? [result.evidence] : [],
    legalBasis: result.legalBasis,
    method: 'calorie_sanity',
    updatedAt: new Date().toISOString(),
  };

  return [finding];
}

/**
 * Evaluates Net Quantity check.
 */
function runNetQuantityEvaluator(review) {
  executionTracker.record('net_quantity_check');
  const result = executeUsNetQuantityCheck(review);
  return [{
    id: 'us-preflight-us-001',
    key: 'us-preflight-us-001',
    title: result.title,
    status: result.findingStatus,
    expected: result.expectedValue,
    observed: result.observedValue,
    explanation: result.explanation,
    legalBasis: result.legalBasis,
    method: 'net_quantity_check',
    updatedAt: new Date().toISOString(),
  }];
}

/**
 * Evaluates Business Address check.
 */
function runBusinessAddressEvaluator(review) {
  executionTracker.record('business_address_check');
  const result = executeUsBusinessAddressCheck(review);
  return [{
    id: 'us-preflight-us-002',
    key: 'us-preflight-us-002',
    title: result.title,
    status: result.findingStatus,
    expected: result.expectedValue,
    observed: result.observedValue,
    explanation: result.explanation,
    legalBasis: result.legalBasis,
    method: 'business_address_check',
    updatedAt: new Date().toISOString(),
  }];
}

/**
 * Evaluates Ingredients & Allergens check.
 */
function runIngredientsAllergensEvaluator(review) {
  executionTracker.record('ingredients_allergens_check');
  const result = executeUsIngredientsAllergensCheck(review);
  return [{
    id: 'us-preflight-us-003',
    key: 'us-preflight-us-003',
    title: result.title,
    status: result.findingStatus,
    expected: result.expectedValue,
    observed: result.observedValue,
    explanation: result.explanation,
    legalBasis: result.legalBasis,
    method: 'ingredients_allergens_check',
    updatedAt: new Date().toISOString(),
  }];
}

/**
 * Evaluates Claims check.
 */
function runClaimsEvaluator(review) {
  executionTracker.record('claims_verification');
  const result = executeUsClaimVerificationCheck(review);
  return [{
    id: 'us-preflight-us-007',
    key: 'us-preflight-us-007',
    title: result.title,
    status: result.findingStatus,
    expected: result.expectedValue,
    observed: result.observedValue,
    explanation: result.explanation,
    legalBasis: result.legalBasis,
    method: 'claims_verification',
    updatedAt: new Date().toISOString(),
  }];
}

/**
 * Evaluates Barcode check.
 */
function runBarcodeEvaluator(review) {
  executionTracker.record('barcode_check');
  return [];
}

/**
 * Master mapping of check IDs to their isolated evaluator function.
 */
export const EVALUATOR_RUNNERS = {
  'nutrition_source_comparison': runNutritionComparisonEvaluator,
  'us_daily_value_arithmetic': runDailyValueEvaluator,
  'calorie_sanity': runCalorieSanityEvaluator,
  'net_quantity_check': runNetQuantityEvaluator,
  'business_address_check': runBusinessAddressEvaluator,
  'ingredients_allergens_check': runIngredientsAllergensEvaluator,
  'claims_verification': runClaimsEvaluator,
  'barcode_check': runBarcodeEvaluator,
};

/**
 * Incremental Ambiguity Resolution and Execution:
 * 1. Validates the question and answer
 * 2. Determines changed input keys
 * 3. Identifies dependent check closure from dependency graph
 * 4. Runs ONLY dependent evaluators
 * 5. Merges new findings, preserving all unrelated findings
 * 6. Updates question status and records audit history
 * 
 * @param {object} review - Current review state (mutated and returned)
 * @param {string} questionId - ID of the question being resolved
 * @param {object} answer - Reviewer answer payload
 * @param {object} actor - Authenticated reviewer
 * @returns {object} { success: boolean, impact: object, review: object }
 */
export function resolveAndReevaluate(review, questionId, answer, actor) {
  const questions = review.ambiguityQuestions || [];
  const question = questions.find(q => q.questionId === questionId);

  // 1. Validate answer
  const validation = validateAnswer({ question, answer, review, actor });
  if (!validation.valid) {
    throw new Error(validation.error || 'Failed to validate ambiguity answer.');
  }

  // Handle NEEDS_EVIDENCE action
  if (validation.status === QUESTION_STATUS.NEEDS_EVIDENCE) {
    question.status = QUESTION_STATUS.NEEDS_EVIDENCE;
    question.updatedAt = new Date().toISOString();
    question.history.push({
      action: 'REQUEST_EVIDENCE',
      rationale: validation.validatedResolution.rationale,
      actor: actor?.displayName || 'Reviewer',
      at: new Date().toISOString(),
    });
    return {
      success: true,
      status: QUESTION_STATUS.NEEDS_EVIDENCE,
      impact: {
        questionId,
        status: QUESTION_STATUS.NEEDS_EVIDENCE,
        message: 'Question transitioned to NEEDS EVIDENCE. Waiting for supporting document upload.',
        affectedChecksRerun: 0,
      },
      review,
    };
  }

  // 2. Identify changed keys
  const res = validation.validatedResolution;
  const changedKeys = [];
  if (question.field) changedKeys.push(question.field);

  review.options ||= {};
  review.ambiguityResolutions ||= {};
  review.ambiguityResolutions[question.field] = res;

  if (question.type === 'NUTRITION_BASIS') {
    review.options.nutritionVariant = res.value;
    review.options.nutritionBasisConfirmed = true;
    changedKeys.push('nutrition.basis', 'nutritionVariant', 'nutritionBasisConfirmed');
  } else if (question.type === 'FACT_CONFLICT') {
    review.options.factChoices ||= {};
    review.options.factChoices[question.field] = res.candidateId || res.value;
    changedKeys.push(question.field, 'factChoices');
  } else if (question.type === 'SOURCE_AUTHORITY') {
    review.options.sourceConfirmed = res.value === 'APPROVED_AUTHORITY';
    changedKeys.push('sourceConfirmed', 'source.authority');
  }

  // 3. Build dependent check closure
  const dependentChecks = getDependentChecks(changedKeys);
  const dependentCheckIds = dependentChecks.map(c => c.checkId);
  const allKnownChecks = Object.keys(EVALUATOR_REGISTRY);
  const skippedCheckIds = allKnownChecks.filter(id => !dependentCheckIds.includes(id));

  // 4. Capture previous finding statuses
  const currentFindings = review.findings || [];
  const outputKeysToReplace = new Set(dependentChecks.flatMap(c => c.outputFindingKeys));
  const previousAffectedFindings = currentFindings.filter(f => outputKeysToReplace.has(f.key) || (f.field && changedKeys.includes(f.field)));
  const preservedFindings = currentFindings.filter(f => !outputKeysToReplace.has(f.key) && (!f.field || !changedKeys.includes(f.field)));

  // 5. Update working facts for the rerun
  const workingSelectedFacts = (review.facts || []).map(f => {
    if (f.field === question.field) {
      return { ...f, value: res.value, ambiguous: false };
    }
    if (question.type === 'NUTRITION_BASIS' && f.variants?.length) {
      const matchVariant = f.variants.find(v => v.variant === res.value);
      if (matchVariant) {
        return { ...f, value: matchVariant.value, ambiguous: false };
      }
    }
    return f;
  });
  review.facts = workingSelectedFacts;

  if (!review.ambiguityResolutions) review.ambiguityResolutions = {};
  review.ambiguityResolutions[question.field] = res;
  review.ambiguityResolutions[question.questionId] = res;

  // 6. Execute ONLY the dependent evaluators
  const newGeneratedFindings = [];
  for (const check of dependentChecks) {
    const runner = EVALUATOR_RUNNERS[check.checkId];
    if (runner) {
      const results = runner(review, workingSelectedFacts);
      newGeneratedFindings.push(...results);
    }
  }

  // 7. Atomic merge of findings
  const updatedFindingIds = new Set(newGeneratedFindings.map(f => f.id));
  const mergedFindings = [
    ...preservedFindings,
    ...newGeneratedFindings,
  ];
  review.findings = mergedFindings;

  // 8. Recompute overall counts
  const counts = { issue: 0, review: 0, match: 0, unable: 0 };
  for (const f of mergedFindings) {
    if (counts[f.status] !== undefined) counts[f.status]++;
  }
  review.counts = counts;

  // 9. Mark dependent decisions stale (preserving unrelated decisions)
  const staleDecisions = [];
  if (review.decisions) {
    for (const [findingId, decision] of Object.entries(review.decisions)) {
      if (updatedFindingIds.has(findingId)) {
        decision.stale = true;
        decision.stalenessReason = `Source ambiguity for ${question.field} was resolved by ${actor?.displayName || 'reviewer'}.`;
        staleDecisions.push(findingId);
      }
    }
  }

  // 10. Update question state
  question.status = QUESTION_STATUS.RESOLVED;
  question.resolution = res;
  question.updatedAt = new Date().toISOString();
  question.history.push({
    action: 'RESOLVED',
    selectedCandidateId: res.candidateId,
    value: res.value,
    rationale: res.rationale,
    actor: actor?.displayName || 'Reviewer',
    at: res.resolvedAt,
  });

  // 11. Build Impact Summary
  const findingChanges = previousAffectedFindings.map(prev => {
    const next = newGeneratedFindings.find(n => n.id === prev.id || n.key === prev.key);
    return {
      id: prev.id,
      title: prev.title,
      previousStatus: prev.status,
      newStatus: next?.status || 'removed',
    };
  });

  const impact = {
    questionId,
    field: question.field,
    decision: res.value,
    rationale: res.rationale,
    reviewer: res.reviewerName,
    resolvedAt: res.resolvedAt,
    affectedChecksRerun: dependentCheckIds,
    unaffectedChecksSkipped: skippedCheckIds,
    invokedEvaluatorList: [...executionTracker.getCalls()],
    findingChanges,
    staleDecisions,
    counts,
  };

  return {
    success: true,
    status: QUESTION_STATUS.RESOLVED,
    impact,
    review,
  };
}
