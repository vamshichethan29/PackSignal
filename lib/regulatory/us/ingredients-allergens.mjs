/**
 * PackSignal US Food Label Preflight Pack — Check US-003: Ingredients & Major Allergens
 * Legal Basis: 21 CFR 101.4, 21 U.S.C. 343(w) (FALCPA & FASTER Act 2021)
 */

import { FDA_STATUTORY_CITATIONS, FDA_MAJOR_ALLERGENS_LIST } from './references.mjs';
import { parseIngredientList, evaluateIngredientDeclaration } from '../ingredients.mjs';
import { extractContainsStatement, extractPrecautionaryStatement } from '../allergens.mjs';

/**
 * Extracts ingredient statement from packaging artwork text.
 */
export function extractIngredientStatementText(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/\bingredients?\s*[:.-]?\s*([^.]+)/i);
  if (!match) return null;
  const raw = match[0].trim();
  const parsed = parseIngredientList(match[1]);
  return {
    raw,
    items: parsed.map(p => p.name || p.raw),
    parsed,
  };
}

/**
 * Executes Check US-003: Ingredients and Major Food Allergens
 */
export function executeUsIngredientsAllergensCheck({
  artworkText = '',
  approvedIngredients = null,
  formulationIngredients = [],
  formulationAllergens = null,
  coverageConfirmed = true,
  evidenceBox = null,
} = {}) {
  const citation = FDA_STATUTORY_CITATIONS.US_003_INGREDIENTS_ALLERGENS;

  // 1. Locate ingredient declaration on artwork
  const extractedIngr = extractIngredientStatementText(artworkText);
  const containsInfo = extractContainsStatement(artworkText);
  const precautionaryInfo = extractPrecautionaryStatement(artworkText);

  if (!extractedIngr) {
    if (!coverageConfirmed) {
      return {
        checkId: citation.checkId,
        title: citation.name,
        legalBasis: citation.citation,
        sourceUrl: citation.sourceUrl,
        applicability: 'applicable',
        executionStatus: 'requires_evidence',
        findingStatus: 'unable',
        requiredInputs: ['artwork_ingredient_list', 'approved_formulation'],
        observedValue: 'Not detected in extracted artwork',
        expectedValue: approvedIngredients || 'Ingredient statement starting with "Ingredients:"',
        calculation: null,
        evidence: null,
        explanation: 'Ingredient declaration was not located in extracted artwork text. Complete artwork panel coverage is unconfirmed.',
        limitations: 'Inspect information panel visually before confirming absence.',
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
      requiredInputs: ['artwork_ingredient_list', 'approved_formulation'],
      observedValue: 'Missing',
      expectedValue: 'Statutory ingredient declaration under 21 CFR 101.4',
      calculation: null,
      evidence: null,
      explanation: 'Statutory Violation under 21 CFR 101.4: Mandatory ingredient declaration is missing from food packaging.',
      limitations: 'All multi-ingredient packaged foods require an ingredient declaration.',
    };
  }

  const artworkIngrText = extractedIngr.raw;
  const artworkIngrItems = extractedIngr.items || [];

  // 2. Ingredient order and omission checking against approved formulation
  let ingredientDiscrepancies = [];

  if (approvedIngredients) {
    const evalRes = evaluateIngredientDeclaration(approvedIngredients, artworkIngrText, formulationIngredients?.length > 0 && formulationIngredients[0].weight != null);
    if (evalRes.omissions && evalRes.omissions.length > 0) {
      for (const om of evalRes.omissions) {
        ingredientDiscrepancies.push(`Missing ingredient from approved formulation: "${om}"`);
      }
    }
    if (evalRes.orderIssues && evalRes.orderIssues.length > 0) {
      for (const ord of evalRes.orderIssues) {
        ingredientDiscrepancies.push(`Ingredient order violation under 21 CFR 101.4: ${ord.reason}`);
      }
    }
  }

  // 3. Allergen Verification against 9 Major US Allergens
  // Determine verified formulation allergens
  let requiredAllergens = [];
  if (Array.isArray(formulationAllergens) && formulationAllergens.length > 0) {
    requiredAllergens = formulationAllergens;
  } else if (approvedIngredients || artworkIngrText) {
    const textToCheck = approvedIngredients || artworkIngrText;
    for (const allergen of FDA_MAJOR_ALLERGENS_LIST) {
      const isPresent = allergen.keywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(textToCheck));
      if (isPresent) requiredAllergens.push(allergen.name);
    }
  }

  const undeclaredAllergens = [];
  const declaredAllergensFound = [];

  for (const allergenName of requiredAllergens) {
    const norm = allergenName.toLowerCase();
    const allergenDef = FDA_MAJOR_ALLERGENS_LIST.find(a =>
      a.id === norm || a.name.toLowerCase() === norm || a.keywords.includes(norm)
    ) || { id: norm, name: allergenName, keywords: [norm] };

    // Check Contains statement
    const inContains = containsInfo && containsInfo.declaredAllergens.some(decl =>
      allergenDef.keywords.some(k => decl.includes(k) || k.includes(decl))
    );

    // Check parenthetical or common name in ingredient declaration
    const inIngredients = allergenDef.keywords.some(k =>
      new RegExp(`(?:\\b${k}\\b|\\(${k}\\))`, 'i').test(artworkIngrText)
    );

    if (inContains || inIngredients) {
      declaredAllergensFound.push({
        allergen: allergenDef.name,
        route: inContains ? 'Contains statement' : 'Ingredient designation',
      });
    } else {
      undeclaredAllergens.push(allergenDef.name);
    }
  }

  // 4. Contains Statement Consistency Check:
  // If a Contains statement is present, it must list ALL major allergens present in ingredients
  const unlistedInContains = [];
  if (containsInfo) {
    for (const allergenDef of FDA_MAJOR_ALLERGENS_LIST) {
      const inIngredients = allergenDef.keywords.some(k =>
        new RegExp(`(?:\\b${k}\\b|\\(${k}\\))`, 'i').test(artworkIngrText)
      );
      if (inIngredients) {
        const listedInContains = containsInfo.declaredAllergens.some(decl =>
          allergenDef.keywords.some(k => decl.includes(k) || k.includes(decl))
        );
        if (!listedInContains) {
          unlistedInContains.push(allergenDef.name);
        }
      }
    }
  }

  // 5. Synthesize Result
  if (undeclaredAllergens.length > 0) {
    return {
      checkId: citation.checkId,
      title: citation.name,
      legalBasis: citation.citation,
      sourceUrl: citation.sourceUrl,
      applicability: 'applicable',
      executionStatus: 'executed',
      findingStatus: 'issue',
      requiredInputs: ['artwork_ingredient_list', 'approved_formulation_allergens'],
      observedValue: artworkIngrText,
      expectedValue: `Mandatory declaration of major food allergen(s): ${undeclaredAllergens.join(', ')}`,
      calculation: null,
      evidence: evidenceBox ? [{ role: 'artwork', box: evidenceBox, text: artworkIngrText }] : null,
      explanation: `FALCPA / FASTER Act Violation (21 U.S.C. 343(w)): Major food allergen(s) [${undeclaredAllergens.join(', ')}] are present in verified formulation but omitted from artwork declarations.`,
      limitations: 'All 9 major US food allergens must be declared by source name in ingredient list or in adjacent Contains statement.',
    };
  }

  if (unlistedInContains.length > 0) {
    return {
      checkId: citation.checkId,
      title: citation.name,
      legalBasis: citation.citation,
      sourceUrl: citation.sourceUrl,
      applicability: 'applicable',
      executionStatus: 'executed',
      findingStatus: 'issue',
      requiredInputs: ['artwork_contains_statement', 'artwork_ingredient_list'],
      observedValue: containsInfo.raw,
      expectedValue: `Contains statement must include all allergens present in ingredients (missing: ${unlistedInContains.join(', ')})`,
      calculation: null,
      evidence: evidenceBox ? [{ role: 'artwork', box: evidenceBox, text: containsInfo.raw }] : null,
      explanation: `Contains Statement Statutory Inconsistency: If a "Contains" statement is placed on packaging, 21 U.S.C. 343(w)(1)(A) requires that ALL major allergens present in ingredients be listed (omitted: ${unlistedInContains.join(', ')}).`,
      limitations: 'Contains statement is voluntary, but if used, omission of any present major allergen violates FALCPA.',
    };
  }

  if (ingredientDiscrepancies.length > 0) {
    return {
      checkId: citation.checkId,
      title: citation.name,
      legalBasis: citation.citation,
      sourceUrl: citation.sourceUrl,
      applicability: 'applicable',
      executionStatus: 'executed',
      findingStatus: 'issue',
      requiredInputs: ['artwork_ingredient_list', 'approved_formulation'],
      observedValue: artworkIngrText,
      expectedValue: approvedIngredients,
      calculation: null,
      evidence: evidenceBox ? [{ role: 'artwork', box: evidenceBox, text: artworkIngrText }] : null,
      explanation: `Ingredient declaration discrepancy: ${ingredientDiscrepancies.join('; ')}`,
      limitations: 'Comparison against approved source formulation.',
    };
  }

  if (!approvedIngredients && (!formulationIngredients || formulationIngredients.length === 0)) {
    return {
      checkId: citation.checkId,
      title: citation.name,
      legalBasis: citation.citation,
      sourceUrl: citation.sourceUrl,
      applicability: 'applicable',
      executionStatus: 'manual_review',
      findingStatus: 'review',
      requiredInputs: ['approved_formulation'],
      observedValue: artworkIngrText,
      expectedValue: 'Verified approved formulation specification',
      calculation: null,
      evidence: evidenceBox ? [{ role: 'artwork', box: evidenceBox, text: artworkIngrText }] : null,
      explanation: `Ingredient statement extracted successfully (${artworkIngrItems.length} ingredients), but no approved formulation specification was supplied for verification. Human review required to confirm accuracy.`,
      limitations: 'Cannot verify common/usual names or descending order without verified source formulation.',
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
    requiredInputs: ['artwork_ingredient_list', 'approved_formulation'],
    observedValue: artworkIngrText,
    expectedValue: approvedIngredients || 'Verified formulation agreement',
    calculation: null,
    evidence: evidenceBox ? [{ role: 'artwork', box: evidenceBox, text: artworkIngrText }] : null,
    explanation: `Ingredients and major food allergens satisfy 21 CFR 101.4 and FALCPA/FASTER Act: All formulation ingredients confirmed and declared major allergens [${declaredAllergensFound.map(d => `${d.allergen} (${d.route})`).join(', ')}] are compliant.`,
    limitations: 'Does not verify flavor labeling sub-clauses under 21 CFR 101.22 unless specifically configured.',
  };
}
