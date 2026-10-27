/**
 * PackSignal US Food Label Preflight Pack — Check US-005: Percent Daily Value Arithmetic
 * Legal Basis: 21 CFR 101.9(c)(8), 21 CFR 101.9(c)(9)
 */

import { FDA_STATUTORY_CITATIONS, FDA_DAILY_VALUES_ADULT } from './references.mjs';

/**
 * Standard FDA Percent Daily Value Rounding under 21 CFR 101.9(c)
 */
export function roundFdaPercentDailyValue(rawPct) {
  if (rawPct < 1) return 0;
  if (rawPct <= 10) return Math.round(rawPct); // nearest 1%
  if (rawPct <= 50) return Math.round(rawPct / 2) * 2; // nearest 2%
  return Math.round(rawPct / 5) * 5; // nearest 5%
}

/**
 * Executes Check US-005: Percent Daily Value Arithmetic
 */
export function executeUsDailyValueCheck({
  nutrientKey = 'sodium',
  declaredAmount = null,
  unit = 'mg',
  declaredDvPercent = null,
  nutritionBasis = 'per_serving',
  evidenceBox = null,
} = {}) {
  const citation = FDA_STATUTORY_CITATIONS.US_005_DAILY_VALUES;
  const refDef = FDA_DAILY_VALUES_ADULT[nutrientKey] || Object.values(FDA_DAILY_VALUES_ADULT).find(d => d.id === nutrientKey || d.name.toLowerCase() === nutrientKey.toLowerCase());

  if (!refDef) {
    return {
      checkId: citation.checkId,
      title: citation.name,
      legalBasis: citation.citation,
      sourceUrl: citation.sourceUrl,
      applicability: 'not_applicable',
      executionStatus: 'unsupported',
      findingStatus: 'unable',
      requiredInputs: ['nutrient_key'],
      observedValue: nutrientKey,
      expectedValue: 'Supported FDA nutrient with established Daily Value',
      calculation: null,
      evidence: null,
      explanation: `No established FDA Daily Value for nutrient "${nutrientKey}" under 21 CFR 101.9 (e.g. Trans Fat, Total Sugars, Protein without claim).`,
      limitations: 'Calculations supported for nutrients with statutory reference values under 21 CFR 101.9(c).',
    };
  }

  // 1. Serving basis validation
  if (!nutritionBasis || nutritionBasis === 'unresolved' || nutritionBasis === 'conflicted') {
    return {
      checkId: citation.checkId,
      title: citation.name,
      legalBasis: citation.citation,
      sourceUrl: citation.sourceUrl,
      applicability: 'applicable',
      executionStatus: 'requires_evidence',
      findingStatus: 'review',
      checkVerdict: 'INSUFFICIENT_INPUT',
      requiredInputs: ['nutrition_basis'],
      observedValue: `${declaredAmount ?? '?'} ${unit}`,
      expectedValue: 'Confirmed per-serving nutrition basis',
      calculation: null,
      evidence: null,
      explanation: `Serving basis unresolved: Nutrition values cannot be evaluated against statutory Daily Values without confirmed per-serving declaration basis. Reviewer confirmation required to avoid false mathematical failure.`,
      limitations: 'FDA Daily Values apply strictly on a per-serving basis for conventional foods.',
    };
  }

  if (declaredAmount == null || declaredDvPercent == null) {
    return {
      checkId: citation.checkId,
      title: citation.name,
      legalBasis: citation.citation,
      sourceUrl: citation.sourceUrl,
      applicability: 'applicable',
      executionStatus: 'requires_evidence',
      findingStatus: 'unable',
      checkVerdict: 'INSUFFICIENT_INPUT',
      requiredInputs: ['declared_amount', 'declared_dv_percent'],
      observedValue: `Amount: ${declaredAmount ?? 'missing'}, Declared %DV: ${declaredDvPercent ?? 'missing'}`,
      expectedValue: `Both declared amount and %DV for ${refDef.name}`,
      calculation: null,
      evidence: null,
      explanation: `Insufficient inputs to calculate %DV for ${refDef.name}. Both nutrient quantity and declared %DV are required.`,
      limitations: 'Deterministic calculation requires both inputs.',
    };
  }

  // 2. Compute %DV deterministically
  const amountNum = Number(declaredAmount);
  const printedDvNum = Number(declaredDvPercent);
  const rawPct = (amountNum / refDef.amount) * 100;
  const standardRoundedPct = roundFdaPercentDailyValue(rawPct);
  const simpleRoundedPct = Math.round(rawPct);

  const diff = Math.abs(printedDvNum - standardRoundedPct);
  const isExactOrRoundedMatch = (printedDvNum === standardRoundedPct || printedDvNum === simpleRoundedPct || Math.abs(printedDvNum - rawPct) <= 1.0);

  const calcFormula = `%DV = (${amountNum} ${refDef.unit} / ${refDef.amount} ${refDef.unit} statutory reference) × 100 = ${rawPct.toFixed(2)}% (FDA rounded: ${standardRoundedPct}%)`;

  if (isExactOrRoundedMatch) {
    return {
      checkId: citation.checkId,
      title: citation.name,
      legalBasis: citation.citation,
      sourceUrl: citation.sourceUrl,
      applicability: 'applicable',
      executionStatus: 'executed',
      findingStatus: 'match',
      checkVerdict: 'MATH_MATCH',
      requiredInputs: ['declared_amount', 'declared_dv_percent'],
      observedValue: `${printedDvNum}% DV (${amountNum} ${refDef.unit})`,
      expectedValue: `${standardRoundedPct}% DV (computed from ${refDef.amount} ${refDef.unit} reference)`,
      calculation: calcFormula,
      evidence: evidenceBox ? [{ role: 'artwork', box: evidenceBox, text: `${refDef.name} ${amountNum}${refDef.unit} ${printedDvNum}%` }] : null,
      explanation: `Daily Value calculation verified under 21 CFR 101.9: ${refDef.name} declared amount of ${amountNum} ${refDef.unit} matches declared ${printedDvNum}% DV (${calcFormula}).`,
      limitations: 'Calculated using FDA reference table for general population (4+ years).',
    };
  }

  // Check if discrepancy is within 2% rounding convention
  if (diff <= 2) {
    return {
      checkId: citation.checkId,
      title: citation.name,
      legalBasis: citation.citation,
      sourceUrl: citation.sourceUrl,
      applicability: 'applicable',
      executionStatus: 'executed',
      findingStatus: 'review',
      checkVerdict: 'ROUNDING_REVIEW',
      requiredInputs: ['declared_amount', 'declared_dv_percent'],
      observedValue: `${printedDvNum}% DV`,
      expectedValue: `${standardRoundedPct}% DV`,
      calculation: calcFormula,
      evidence: evidenceBox ? [{ role: 'artwork', box: evidenceBox, text: `${refDef.name} ${amountNum}${refDef.unit} ${printedDvNum}%` }] : null,
      explanation: `Rounding convention review: Declared ${printedDvNum}% DV differs slightly from FDA standard rounded value of ${standardRoundedPct}% (unrounded: ${rawPct.toFixed(1)}%). Review source formulation significant digits.`,
      limitations: 'Small percentage difference may be due to source unrounded nutrient analytical data.',
    };
  }

  // Definite mathematical mismatch
  return {
    checkId: citation.checkId,
    title: citation.name,
    legalBasis: citation.citation,
    sourceUrl: citation.sourceUrl,
    applicability: 'applicable',
    executionStatus: 'executed',
    findingStatus: 'issue',
    checkVerdict: 'MATH_MISMATCH',
    requiredInputs: ['declared_amount', 'declared_dv_percent'],
    observedValue: `${printedDvNum}% DV`,
    expectedValue: `${standardRoundedPct}% DV (statutory calculation: ${calcFormula})`,
    calculation: calcFormula,
    evidence: evidenceBox ? [{ role: 'artwork', box: evidenceBox, text: `${refDef.name} ${amountNum}${refDef.unit} ${printedDvNum}%` }] : null,
    explanation: `Statutory Calculation Discrepancy under 21 CFR 101.9: Declared % Daily Value for ${refDef.name} (${printedDvNum}%) conflicts with computed value (${standardRoundedPct}%) based on ${amountNum} ${refDef.unit} declared content (${calcFormula}).`,
    limitations: 'Verified mathematical conflict against statutory Daily Value reference standards.',
  };
}
