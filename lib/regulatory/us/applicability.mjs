/**
 * PackSignal US Food Label Regulatory Preflight Pack — Applicability Profile
 * Evaluates whether conventional US FDA packaged food labeling rules apply to the review.
 */

import { US_OUT_OF_SCOPE } from './references.mjs';

/**
 * Builds the official product applicability profile for a US review.
 */
export function buildUsProductProfile(review, options = {}) {
  const facts = review.facts || [];
  const optionsObj = review.options || {};
  const findFact = field => facts.find(f => f.field === field)?.value || null;

  const productName = String(findFact('product_name') || review.name || '').toLowerCase();
  const ingredients = String(findFact('ingredients') || '').toLowerCase();
  const netQtyStr = String(findFact('net_quantity') || '').toLowerCase();

  // Out-of-scope screening
  let outOfScopeReason = null;
  if (/\b(?:dietary supplement|supplement facts)\b/i.test(productName + ' ' + ingredients)) {
    outOfScopeReason = 'Dietary supplement governed by 21 CFR 101.36; alternative Supplement Facts panel applies.';
  } else if (/\b(?:infant formula|for infants|toddler formula)\b/i.test(productName + ' ' + ingredients)) {
    outOfScopeReason = 'Infant formula governed by 21 CFR Part 107.';
  } else if (/\b(?:beef|pork|chicken|turkey|poultry|lamb|veal)\b/i.test(ingredients) && !/\b(?:flavor|flavouring|extract)\b/i.test(ingredients)) {
    outOfScopeReason = 'Contains meat or poultry ingredients; potentially governed by USDA FSIS (9 CFR), not FDA.';
  }

  const isLiquid = /ml|l|fl\s*oz|liter|fluid/i.test(netQtyStr);
  const isSolid = /g|kg|oz|lb|pound|gram/i.test(netQtyStr) && !isLiquid;

  // Source authority check
  const sourceAuthorityConfirmed = Boolean(
    optionsObj.sourceAuthorityConfirmed ||
    review.factApprovals && Object.keys(review.factApprovals).length > 0 ||
    review.documents?.some(d => d.role === 'spec' && d.approved)
  );

  // Nutrition basis check
  const nutritionBasisConfirmed = Boolean(
    optionsObj.nutritionBasisConfirmed ||
    findFact('nutrition_basis') === 'per_serving' ||
    review.options?.nutritionBasis === 'per_serving'
  );

  // Artwork coverage check
  const artworkCoverageConfirmed = Boolean(
    optionsObj.completeArtwork === true ||
    review.coverage?.completeArtwork === true
  );

  return {
    market: 'US',
    regulator: 'FDA',
    productCategory: outOfScopeReason ? 'special_or_out_of_scope' : 'conventional_food',
    nutritionFormat: 'standard',
    population: 'adults_and_children_4_plus',
    packagingType: optionsObj.packageType || 'carton',
    isLiquid,
    isSolid,
    isOutOfScope: Boolean(outOfScopeReason),
    outOfScopeReason,
    sourceAuthorityConfirmed,
    nutritionBasisConfirmed,
    artworkCoverageConfirmed,
    outOfScopeExclusions: US_OUT_OF_SCOPE,
  };
}
