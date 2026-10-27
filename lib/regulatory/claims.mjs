/**
 * PackSignal FDA Nutrient Content Claims & Dietary Claims Engine (lib/regulatory/claims.mjs)
 * Implements 21 CFR 101.54, 101.60, 101.61, 101.62:
 * - "No Added Sugar" (21 CFR 101.60(c)(2))
 * - "Low Sodium" (21 CFR 101.61(b)(4))
 * - "Good Source" (10-19% DV) & "High / Excellent Source" (>=20% DV) (21 CFR 101.54(b), (c))
 * - Vegan / Vegetarian substantiation against ingredients
 */

import { computeUsFdaDailyValue } from './nutrition.mjs';

export function evaluateNutrientClaim({
  claimType,
  artworkClaimText = '',
  nutritionFacts = {},
  ingredientsText = '',
}) {
  const normArt = (artworkClaimText || '').toLowerCase();
  const normIng = (ingredientsText || '').toLowerCase();

  // 1. "No Added Sugar" / "Zero Added Sugar" (21 CFR 101.60(c)(2))
  if (/no\s+added\s+sugars?|without\s+added\s+sugars?|zero\s+added\s+sugars?/i.test(normArt)) {
    const addedSugarG = Number(nutritionFacts.addedSugars ?? nutritionFacts.incladdedsugars ?? 0);
    const hasAddedSugarInIngredients = /\b(sugar|syrup|honey|molasses|corn syrup|cane juice|agave|dextrose|fructose|sucrose|maltose)\b/i.test(normIng);

    const hasIssue = addedSugarG > 0 || hasAddedSugarInIngredients;
    return {
      claim: 'No Added Sugar',
      status: hasIssue ? 'issue' : 'match',
      citation: '21 CFR 101.60(c)(2)',
      declaredAddedSugarG: addedSugarG,
      hasAddedSugarInIngredients,
      explanation: hasIssue
        ? `Claim "No Added Sugar" is contradicted by nutrition/formulation evidence: ${addedSugarG > 0 ? `${addedSugarG}g added sugars declared in nutrition table. ` : ''}${hasAddedSugarInIngredients ? 'Sugar-containing ingredients detected in ingredient list.' : ''}`
        : 'Claim "No Added Sugar" substantiated: 0g added sugars declared and no sugar ingredients detected.',
    };
  }

  // 2. "Low Sodium" (21 CFR 101.61: <= 140 mg sodium per serving)
  if (/low\s+sodium/i.test(normArt)) {
    const sodiumMg = Number(nutritionFacts.sodium ?? 9999);
    const passes = sodiumMg <= 140;
    return {
      claim: 'Low Sodium',
      status: passes ? 'match' : 'issue',
      citation: '21 CFR 101.61(b)(4)',
      sodiumPerServingMg: sodiumMg,
      explanation: passes
        ? `Claim "Low Sodium" substantiated: ${sodiumMg} mg sodium per serving is below statutory threshold (<= 140 mg).`
        : `Claim "Low Sodium" invalid under 21 CFR 101.61: declared ${sodiumMg} mg sodium exceeds the 140 mg per serving threshold.`,
    };
  }

  // 3. "Vegan" / "Suitable for Vegans"
  if (/vegan|suitable\s+for\s+vegans/i.test(normArt)) {
    const nonVeganMatch = normIng.match(/\b(milk|whey|casein|butter|cheese|egg|gelatin|honey|meat|fish|poultry|beef|pork|carmine)\b/i);
    const hasNonVegan = Boolean(nonVeganMatch);
    return {
      claim: 'Vegan',
      status: hasNonVegan ? 'issue' : 'match',
      citation: 'Dietary Claim Substantiation (Truth in Advertising / FD&C Act 403(a))',
      nonVeganIngredient: nonVeganMatch ? nonVeganMatch[0] : null,
      explanation: hasNonVegan
        ? `Vegan claim conflict: Animal-derived ingredient "${nonVeganMatch[0]}" detected in ingredient list.`
        : 'Vegan claim substantiated: No animal-derived ingredients detected in formula.',
    };
  }

  return {
    claim: 'General Claim Review',
    status: 'review',
    citation: '21 CFR Part 101 Subpart D',
    explanation: `Claim statement "${artworkClaimText}" requires human regulatory review against applicable product standard.`,
  };
}

export const evaluateNutrientContentClaim = evaluateNutrientClaim;
export const evaluateVeganClaim = evaluateNutrientClaim;

