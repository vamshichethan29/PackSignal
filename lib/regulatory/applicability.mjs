/**
 * PackSignal Regulatory Applicability & Product Profile Engine (lib/regulatory/applicability.mjs)
 * Evaluates product eligibility, regulatory exemptions, statutory scopes,
 * and effective date transitions (enacted vs future amendments).
 */

export function buildProductProfile(review, effectiveDate = '2026-10-23') {
  const facts = review.facts || [];
  const findFact = field => facts.find(f => f.field === field)?.value || null;

  const netQtyStr = String(findFact('net_quantity') || '').toLowerCase();
  const isLiquid = /ml|l|fl\s*oz|liter|fluid/i.test(netQtyStr);
  const isSolid = /g|kg|oz|lb|pound|gram/i.test(netQtyStr) && !isLiquid;

  // Serving info
  const servingSize = findFact('serving_size');
  let servingGrams = null;
  if (servingSize) {
    const match = String(servingSize).match(/(\d+(?:\.\d+)?)\s*(?:g|grams?)/i);
    if (match) servingGrams = Number(match[1]);
  }

  // Ingredients and allergens
  const ingredientsStr = String(findFact('ingredients') || '');
  const allergensStr = String(findFact('allergens') || '');
  const knownAllergens = allergensStr
    ? allergensStr.split(/[,;\n]/).map(s => s.trim().toLowerCase()).filter(Boolean)
    : [];

  // Vegetarian classification
  let vegetarianStatus = 'undetermined';
  if (/contains\s*(?:meat|chicken|pork|beef|fish|gelatin)|non[- ]veg/i.test(ingredientsStr + ' ' + allergensStr)) {
    vegetarianStatus = 'non_vegetarian';
  } else if (/vegetarian|100%\s*veg|pure\s*veg/i.test(ingredientsStr) || review.options?.packageType === 'carton') {
    vegetarianStatus = 'vegetarian';
  }

  // Packaging dimensions / surface area screening
  // If dieline or panel dimensions exist in review
  let packageAreaSqIn = null;
  const artworkDoc = review.documents?.find(d => d.role === 'artwork');
  if (artworkDoc?.pages?.[0]?.width && artworkDoc?.pages?.[0]?.height) {
    // PDF points: 72 points = 1 inch
    const wIn = artworkDoc.pages[0].width / 72;
    const hIn = artworkDoc.pages[0].height / 72;
    packageAreaSqIn = wIn * hIn;
  }

  return {
    isFood: true,
    isLiquid,
    isSolid,
    netQuantity: netQtyStr,
    servingSize,
    servingGrams,
    ingredients: ingredientsStr,
    allergens: allergensStr,
    knownAllergens,
    vegetarianStatus,
    packageAreaSqIn,
    effectiveDate: String(effectiveDate || '2026-10-23'),
  };
}

/**
 * Determines whether a specific regulatory rule applies to the product profile.
 * Returns: { applicability: 'applicable'|'not_applicable'|'undetermined'|'future_requirement', applicable: boolean, exempt: boolean, reason: string }
 */
export function evaluateRuleApplicability(rule, profile) {
  const reviewDate = profile.effectiveDate || '2026-10-23';

  // 1. Effective Date Check (Future Provisions)
  if (rule.effectiveDate && rule.effectiveDate > reviewDate) {
    return {
      applicability: 'future_requirement',
      applicable: false,
      exempt: false,
      reason: `Rule commencement date is ${rule.effectiveDate}. As of evaluation date ${reviewDate}, this requirement is enacted but not yet enforceable.`,
      isFuture: true,
    };
  }

  // 2. Small Package Exemptions
  const hasSmallPackExemption = (rule.exemptions || rule.exceptions || []).some(e =>
    e.includes('small_package') || e.includes('small_pack')
  );
  const area = profile.packageAreaSqIn ?? profile.packageAreaSqInches ?? null;

  if (hasSmallPackExemption && (area !== null && area < 12)) {
    return {
      applicability: 'not_applicable',
      applicable: false,
      exempt: true,
      isExempt: true,
      reason: `Exempt under 21 CFR 101.9(j)(13)(i): Package surface area (${area} sq in) qualifies for small package labeling exemption.`,
    };
  }

  if (hasSmallPackExemption && (rule.jurisdiction === 'eu' || String(rule.id).startsWith('EU-'))) {
    if (area !== null) {
      const areaCm2 = area * 6.4516;
      if (areaCm2 < 25) {
        return {
          applicability: 'not_applicable',
          applicable: false,
          exempt: true,
          isExempt: true,
          reason: `Exempt under Regulation (EU) No 1169/2011, Article 16(2): Packaging surface area (${areaCm2.toFixed(1)} cm²) is less than 25 cm².`,
        };
      }
    }
  }

  // 3. Category & Non-food exclusions
  if (!profile.isFood) {
    return {
      applicability: 'not_applicable',
      applicable: false,
      exempt: true,
      isExempt: true,
      reason: 'Rule applies strictly to food and beverage products.',
    };
  }

  return {
    applicability: 'applicable',
    applicable: true,
    exempt: false,
    reason: 'Product meets statutory applicability criteria; requirement is enforceable.',
  };

  // 4. Vegetarian / Non-Vegetarian Logo
  if (rule.id === 'FSSAI-2020-REG5.2-VEG-MARK') {
    if (profile.vegetarianStatus === 'undetermined') {
      return {
        applicability: 'undetermined',
        reason: 'Product vegetarian or non-vegetarian origin could not be definitively determined from extracted formulation facts.',
      };
    }
  }

  return {
    applicability: 'applicable',
    reason: 'Product meets statutory scope and applicability criteria under current regulation.',
  };
}
