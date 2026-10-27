/**
 * PackSignal US Food Label Regulatory Preflight Pack — Main Engine
 * Orchestrates the seven production-grade, deterministic FDA food-labeling preflight checks.
 */

import { US_PREFLIGHT_VERSION, US_JURISDICTION, US_OUT_OF_SCOPE } from './references.mjs';
import { buildUsProductProfile } from './applicability.mjs';
import { executeUsNetQuantityCheck } from './net-quantity.mjs';
import { executeUsBusinessAddressCheck } from './business-address.mjs';
import { executeUsIngredientsAllergensCheck } from './ingredients-allergens.mjs';
import { executeUsNutritionFieldsCheck } from './nutrition-fields.mjs';
import { executeUsDailyValueCheck } from './daily-values.mjs';
import { executeUsCalorieSanityCheck } from './calorie-sanity.mjs';
import { executeUsClaimVerificationCheck } from './claims-evidence.mjs';

/**
 * Runs the 7-check US Food Preflight Pack on a review workspace.
 */
export function runUsFoodPreflight(review, options = {}) {
  const profile = buildUsProductProfile(review, options);
  const facts = review.facts || [];
  const findFact = field => facts.find(f => f.field === field)?.value || null;

  // Aggregate artwork text from review documents or properties
  let artworkText = review.artworkText || '';
  if (!artworkText) {
    const artDoc = review.documents?.find(d => d.role === 'artwork');
    if (artDoc?.text) artworkText = artDoc.text;
  }
  if (!artworkText && Array.isArray(review.findings)) {
    // Collect observed text from findings
    artworkText = review.findings.map(f => f.observed || f.evidence?.text || '').join(' ');
  }

  // Extract relevant source facts
  const approvedNetQty = findFact('net_quantity') || review.approvedSourceQty || null;
  const approvedBusinessName = findFact('business_name') || findFact('manufacturer') || null;
  const approvedIngredients = findFact('ingredients') || null;
  const approvedAllergens = findFact('allergens') ? String(findFact('allergens')).split(/[,;]/).map(s => s.trim()) : null;

  // Nutrition values
  const declaredCalories = findFact('calories') || findFact('energy');
  const fatGrams = findFact('total_fat') || findFact('fat');
  const carbGrams = findFact('total_carbohydrate') || findFact('carbohydrates');
  const proteinGrams = findFact('protein');
  const sodiumMg = findFact('sodium');
  const declaredSodiumDv = findFact('sodium_dv') || findFact('sodium_percent_dv');

  // Nutrition basis
  const nutritionBasis = findFact('nutrition_basis') || review.options?.nutritionBasis || (profile.nutritionBasisConfirmed ? 'per_serving' : 'unresolved');

  // Artwork coverage flag
  const coverageConfirmed = profile.artworkCoverageConfirmed;

  // Claims register
  const claimsRegister = review.claimsRegister || review.options?.approvedClaims || [];
  const evidenceDocs = review.documents?.filter(d => ['spec', 'substantiation', 'brief'].includes(d.role)) || [];

  // =========================================================================
  // EXECUTE 7 PREFLIGHT CHECKS
  // =========================================================================

  // US-001: Net Quantity
  const checkNetQty = executeUsNetQuantityCheck({
    artworkText,
    approvedSourceQty: approvedNetQty,
    pdpMapped: Boolean(review.pdpGeometry || review.panelZones?.pdp),
    coverageConfirmed,
  });

  // US-002: Business Name & Address
  const checkBusiness = executeUsBusinessAddressCheck({
    artworkText,
    approvedBusinessName,
    coverageConfirmed,
  });

  // US-003: Ingredients & Allergens
  const checkIngredients = executeUsIngredientsAllergensCheck({
    artworkText,
    approvedIngredients,
    formulationAllergens: approvedAllergens,
    coverageConfirmed,
  });

  // US-004: Nutrition Facts Required Fields
  const checkNutritionFields = executeUsNutritionFieldsCheck({
    artworkText,
    formatType: profile.nutritionFormat,
    coverageConfirmed,
  });

  // US-005: Daily Value Arithmetic (Sodium primary benchmark)
  const checkDailyValues = executeUsDailyValueCheck({
    nutrientKey: 'sodium',
    declaredAmount: sodiumMg,
    declaredDvPercent: declaredSodiumDv,
    nutritionBasis,
  });

  // US-006: Calorie Sanity Screening
  const checkCalorieSanity = executeUsCalorieSanityCheck({
    declaredCalories,
    fatGrams,
    carbGrams,
    proteinGrams,
  });

  // US-007: Claims & Evidence Verification
  const checkClaims = executeUsClaimVerificationCheck({
    artworkText,
    approvedClaimsRegister: claimsRegister,
    evidenceDocuments: evidenceDocs,
  });

  const checks = [
    checkNetQty,
    checkBusiness,
    checkIngredients,
    checkNutritionFields,
    checkDailyValues,
    checkCalorieSanity,
    checkClaims,
  ];

  // Convert check results to PackSignal findings for display in evidence viewport
  const findings = [];
  for (const c of checks) {
    if (c.findingStatus === 'issue' || c.findingStatus === 'review' || c.findingStatus === 'unable') {
      findings.push({
        id: `us-preflight-${c.checkId.toLowerCase()}`,
        ruleId: c.checkId,
        category: 'regulatory_preflight',
        title: `${c.checkId} ${c.title}`,
        status: c.findingStatus,
        observed: c.observedValue,
        expected: c.expectedValue,
        explanation: c.explanation,
        calculation: c.calculation,
        legalBasis: c.legalBasis,
        sourceUrl: c.sourceUrl,
        evidence: c.evidence,
        preflightPack: 'us-food-preflight',
      });
    }
  }

  // Calculate coverage metrics
  const counts = {
    total: checks.length,
    match: checks.filter(c => c.findingStatus === 'match').length,
    issue: checks.filter(c => c.findingStatus === 'issue').length,
    review: checks.filter(c => c.findingStatus === 'review').length,
    unable: checks.filter(c => c.findingStatus === 'unable').length,
    not_applicable: checks.filter(c => c.applicability === 'not_applicable').length,
    executed: checks.filter(c => c.executionStatus === 'executed').length,
  };

  return {
    packId: 'us-food-preflight',
    version: US_PREFLIGHT_VERSION,
    jurisdiction: US_JURISDICTION,
    checks,
    findings,
    coverage: counts,
    applicabilityProfile: profile,
    limitations: [
      'PackSignal US Food Preflight is an inspection aid, not an FDA legal approval authority or release certificate.',
      'Applies to conventional multi-ingredient packaged foods under FDA jurisdiction; does not cover USDA meat/poultry, infant formula, or dietary supplements.',
      'Placement check requires Principal Display Panel (PDP) zone confirmation.',
      'Calorie 4-4-9 screen is an energy plausibility screen; does not supersede laboratory analytical testing.',
      ...US_OUT_OF_SCOPE,
    ],
  };
}
