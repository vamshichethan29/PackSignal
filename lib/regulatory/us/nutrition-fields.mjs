/**
 * PackSignal US Food Label Preflight Pack — Check US-004: Nutrition Facts Required Fields
 * Legal Basis: 21 CFR 101.9
 */

import { FDA_STATUTORY_CITATIONS, FDA_NUTRITION_FACTS_FIELDS } from './references.mjs';

/**
 * Extracts and checks mandatory fields for the standard US Nutrition Facts panel.
 */
export function executeUsNutritionFieldsCheck({
  artworkText = '',
  formatType = 'standard',
  coverageConfirmed = true,
  evidenceBox = null,
} = {}) {
  const citation = FDA_STATUTORY_CITATIONS.US_004_NUTRITION_FIELDS;

  // 1. Format applicability: alternative or simplified format requires human review
  if (formatType !== 'standard') {
    return {
      checkId: citation.checkId,
      title: citation.name,
      legalBasis: citation.citation,
      sourceUrl: citation.sourceUrl,
      applicability: 'undetermined',
      executionStatus: 'manual_review',
      findingStatus: 'review',
      requiredInputs: ['nutrition_format_confirmation'],
      observedValue: `Alternative format: ${formatType}`,
      expectedValue: 'Standard vertical Nutrition Facts panel under 21 CFR 101.9(d)',
      calculation: null,
      evidence: null,
      explanation: `Alternative nutrition panel format specified (${formatType}). Simplified, dual-column, tabular, or linear formats follow distinct statutory omission and formatting rules under 21 CFR 101.9(f)-(j). Reviewer confirmation required.`,
      limitations: 'PackSignal standard check verifies standard vertical 21 CFR 101.9 panel layout.',
    };
  }

  // 2. Check presence of each mandatory field
  const fieldResults = [];
  const missingFields = [];
  const textLower = artworkText.toLowerCase();

  for (const field of FDA_NUTRITION_FACTS_FIELDS) {
    let isPresent = false;
    let detectedVal = null;

    if (field.key === 'heading') {
      isPresent = /\bnutrition\s+facts\b/i.test(artworkText);
    } else if (field.key === 'servings_per_container') {
      isPresent = /(?:servings\s+per\s+container|varied\s+servings|about\s+\d+\s+servings)/i.test(artworkText);
    } else if (field.key === 'serving_size') {
      isPresent = /serving\s+size\b/i.test(artworkText);
    } else if (field.key === 'calories') {
      const match = artworkText.match(/\bcalories\s+(\d+)\b/i);
      isPresent = Boolean(match);
      if (match) detectedVal = match[1];
    } else if (field.key === 'trans_fat') {
      const match = artworkText.match(/trans\s+fat\s+(\d+(?:\.\d+)?)\s*g/i);
      isPresent = Boolean(match);
      if (match) detectedVal = match[1];
    } else if (field.key === 'added_sugars') {
      isPresent = /(?:includes?\s+\d+g\s+added\s+sugars?|added\s+sugars?)/i.test(artworkText);
    } else {
      // General nutrient regex: e.g. "Total Fat 8g", "Sodium 230mg", "Iron 18mg"
      const labelNorm = field.label.toLowerCase();
      const reg = new RegExp(`(?:${labelNorm}|${field.key.replace('_', ' ')})\\s*(\\d+(?:\\.\\d+)?)\\s*(?:g|mg|mcg)?`, 'i');
      const match = artworkText.match(reg);
      isPresent = Boolean(match);
      if (match) detectedVal = match[1];
    }

    fieldResults.push({
      key: field.key,
      label: field.label,
      required: field.required,
      isPresent,
      detectedVal,
      hasDv: field.hasDv,
    });

    if (!isPresent && field.required) {
      missingFields.push(field.label);
    }
  }

  // 3. Handle unconfirmed coverage vs confirmed omission
  if (missingFields.length > 0) {
    if (!coverageConfirmed) {
      return {
        checkId: citation.checkId,
        title: citation.name,
        legalBasis: citation.citation,
        sourceUrl: citation.sourceUrl,
        applicability: 'applicable',
        executionStatus: 'requires_evidence',
        findingStatus: 'review',
        requiredInputs: ['artwork_nutrition_panel'],
        observedValue: `${fieldResults.filter(f => f.isPresent).length} / ${FDA_NUTRITION_FACTS_FIELDS.length} fields located`,
        expectedValue: 'All 18 standard Nutrition Facts fields',
        calculation: null,
        evidence: evidenceBox ? [{ role: 'artwork', box: evidenceBox, text: 'Nutrition Facts panel' }] : null,
        explanation: `Nutrition panel field coverage review: ${missingFields.length} field(s) were not detected [${missingFields.slice(0, 5).join(', ')}${missingFields.length > 5 ? '...' : ''}]. Because complete visible panel extraction is unconfirmed, inspect the rendered artwork to verify whether fields are present.`,
        limitations: 'OCR or text-layer clipping may cause unconfirmed field omissions.',
      };
    }

    return {
      checkId: citation.checkId,
      title: citation.name,
      legalBasis: citation.citation,
      sourceUrl: citation.sourceUrl,
      applicability: 'applicable',
      executionStatus: 'executed',
      findingStatus: 'issue',
      requiredInputs: ['artwork_nutrition_panel'],
      observedValue: `Missing mandatory field(s): ${missingFields.join(', ')}`,
      expectedValue: 'All mandatory 21 CFR 101.9 fields present in standard format',
      calculation: null,
      evidence: evidenceBox ? [{ role: 'artwork', box: evidenceBox, text: 'Nutrition Facts' }] : null,
      explanation: `Statutory Violation under 21 CFR 101.9: Standard US Nutrition Facts panel is missing mandatory field(s): [${missingFields.join(', ')}].`,
      limitations: 'Mandatory fields for conventional packaged food under 2016 revised FDA Nutrition Facts rules.',
    };
  }

  return {
    checkId: citation.checkId,
    title: citation.name,
    legalBasis: citation.citation,
    sourceUrl: citation.sourceUrl,
    applicability: 'applicable',
    executionStatus: 'executed',
    findingStatus: 'match',
    requiredInputs: ['artwork_nutrition_panel'],
    observedValue: `All ${FDA_NUTRITION_FACTS_FIELDS.length} standard fields located`,
    expectedValue: 'All mandatory 21 CFR 101.9 fields present in standard format',
    calculation: null,
    evidence: evidenceBox ? [{ role: 'artwork', box: evidenceBox, text: 'Nutrition Facts' }] : null,
    explanation: 'Standard US Nutrition Facts panel satisfies 21 CFR 101.9: All mandatory fields (heading, serving size, servings per container, calories, core macronutrients, and vitamins/minerals) are present.',
    limitations: 'Checks field presence; typography font sizing requires separate prepress measurement.',
  };
}
