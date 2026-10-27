/**
 * PackSignal US Food Allergen Validation Engine (lib/regulatory/allergens.mjs)
 * Implements FALCPA (Food Allergen Labeling and Consumer Protection Act) &
 * FASTER Act (Food Allergy Safety, Treatment, Education, and Research Act of 2021):
 * - Identifies the 9 Major Food Allergens under 21 U.S.C. 321(qq):
 *   Milk, Egg, Fish, Crustacean shellfish, Tree nuts, Peanuts, Wheat, Soybeans, Sesame.
 * - Validates permitted declaration routes:
 *   Route A: Ingredient common/usual name includes food source (e.g., "Buttermilk", "Sesame oil")
 *   Route B: Parenthetical disclosure in ingredient list (e.g., "Whey (milk)", "Lecithin (soy)")
 *   Route C: Separate "Contains:" statement immediately adjacent to ingredients
 * - Tree nut species-specific identification requirement (e.g., "Walnut", "Almond", "Pecan")
 * - Distinguishes intentional declarations from voluntary precautionary ("May contain") statements
 */

export const US_MAJOR_ALLERGENS = [
  { id: 'milk', name: 'Milk', keywords: ['milk', 'whey', 'casein', 'butter', 'cream', 'cheese', 'yogurt', 'dairy', 'buttermilk'] },
  { id: 'egg', name: 'Egg', keywords: ['egg', 'albumin', 'lysozyme', 'ovalbumin'] },
  { id: 'fish', name: 'Fish', keywords: ['fish', 'salmon', 'cod', 'tuna', 'flounder', 'haddock', 'anchovy', 'bass', 'tilapia'] },
  { id: 'shellfish', name: 'Crustacean shellfish', keywords: ['crustacean', 'shellfish', 'crab', 'lobster', 'shrimp', 'prawn', 'crawfish'] },
  { id: 'tree_nuts', name: 'Tree nuts', keywords: ['tree nut', 'almond', 'walnut', 'cashew', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'brazil nut', 'coconut'] },
  { id: 'peanuts', name: 'Peanuts', keywords: ['peanut', 'peanuts', 'arachis'] },
  { id: 'wheat', name: 'Wheat', keywords: ['wheat', 'spelt', 'semolina', 'durum', 'farina'] },
  { id: 'soybeans', name: 'Soybeans', keywords: ['soy', 'soya', 'soybean', 'edamame', 'tofu'] },
  { id: 'sesame', name: 'Sesame', keywords: ['sesame', 'tahini', 'benne'] },
];

export const FDA_MAJOR_ALLERGENS = US_MAJOR_ALLERGENS;

/**
 * Parses an explicit "Contains:" statement from text.
 */
export function extractContainsStatement(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/\bcontains\s*[:.-]?\s*([^.]+)/i);
  if (!match) return null;
  const raw = match[0].trim();
  const declaredList = match[1]
    .split(/[,;&]|\band\b/i)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  return { raw, declaredAllergens: declaredList };
}

/**
 * Detects voluntary precautionary statements (e.g. "May contain: ...").
 */
export function extractPrecautionaryStatement(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/\b(?:may contain|manufactured on equipment that also processes|facility that processes)\s*[:.-]?\s*([^.]+)/i);
  if (!match) return null;
  return {
    raw: match[0].trim(),
    precautionaryAllergens: match[1].split(/[,;&]|\band\b/i).map(s => s.trim().toLowerCase()).filter(Boolean),
  };
}

/**
 * Detects major allergens mentioned in ingredient formulation text.
 */
export function detectMajorAllergensInIngredients(ingredientText) {
  if (!ingredientText || typeof ingredientText !== 'string') return [];
  const detected = [];
  for (const allergen of US_MAJOR_ALLERGENS) {
    const present = allergen.keywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(ingredientText));
    if (present) {
      detected.push(allergen);
    }
  }
  return detected;
}

/**
 * Evaluates whether an allergen is declared via Ingredient list or Contains statement.
 */
export function evaluateAllergenCompliance({
  sourceAllergens = [],
  declaredAllergens = [],
  ingredientList = '',
  artworkIngredients = '',
  artworkAllergenStatement = '',
  artworkText = '',
  artworkFullText = '',
  coverageConfirmed = true,
}) {
  let effectiveSourceAllergens = sourceAllergens.length ? sourceAllergens : declaredAllergens;
  const effectiveIngredients = ingredientList || artworkIngredients || '';
  if (!effectiveSourceAllergens.length && effectiveIngredients) {
    const detected = detectMajorAllergensInIngredients(effectiveIngredients);
    effectiveSourceAllergens = detected.map(d => d.name);
  }

  const effectiveFullText = artworkFullText || artworkText || '';
  const containsInfo = extractContainsStatement(artworkAllergenStatement || effectiveFullText);
  const precautionaryInfo = extractPrecautionaryStatement(artworkAllergenStatement || effectiveFullText);
  const artworkDeclaredText = artworkIngredients || (artworkText.match(/ingredients?:?\s*([^.]+)/i)?.[1]) || '';

  const results = [];
  let issueCount = 0;
  let reviewCount = 0;

  for (const allergenReq of effectiveSourceAllergens) {
    const normReq = String(allergenReq).toLowerCase().trim();
    const allergenDef = US_MAJOR_ALLERGENS.find(a =>
      a.id === normReq || a.name.toLowerCase() === normReq || a.keywords.some(k => k === normReq)
    ) || { id: normReq, name: allergenReq, keywords: [normReq] };

    // 1. Check if declared in Contains statement
    const inContains = containsInfo && containsInfo.declaredAllergens.some(decl =>
      allergenDef.keywords.some(k => decl.includes(k) || k.includes(decl))
    );

    // 2. Check if declared parenthetically or by common name in artwork ingredient list
    const inArtworkIngredients = artworkDeclaredText ? allergenDef.keywords.some(k => {
      const reg = new RegExp(`(?:\\b${k}\\b|\\(${k}\\))`, 'i');
      return reg.test(artworkDeclaredText);
    }) : false;

    const isDeclared = inContains || inArtworkIngredients;

    if (isDeclared) {
      results.push({
        allergen: allergenDef.name,
        status: 'match',
        declaredVia: inContains ? 'CONTAINS_STATEMENT' : 'INGREDIENT_LIST_NAME',
        evidence: inContains ? containsInfo.raw : `Found in ingredient list: ${allergenDef.name}`,
        explanation: `${allergenDef.name} is properly declared under FALCPA (${inContains ? 'Contains statement' : 'Ingredient designation'}).`,
      });
    } else {
      if (!coverageConfirmed) {
        reviewCount++;
        results.push({
          allergen: allergenDef.name,
          status: 'unable',
          declaredVia: 'NONE_DETECTED',
          explanation: `Allergen "${allergenDef.name}" required by formulation was not located on artwork. Extraction coverage unconfirmed; inspect rendered pack visually before confirming absence.`,
        });
      } else {
        issueCount++;
        results.push({
          allergen: allergenDef.name,
          status: 'issue',
          declaredVia: 'NONE_DETECTED',
          explanation: `FALCPA / FASTER Act Violation: Major food allergen "${allergenDef.name}" is present in verified source formulation but omitted from artwork ingredient list and Contains statement.`,
        });
      }
    }
  }

  // 3. Consistency check: If a Contains statement exists, it must list ALL allergens present in ingredients
  const unlistedInContains = [];
  if (containsInfo) {
    for (const allergenDef of US_MAJOR_ALLERGENS) {
      const inIngredients = allergenDef.keywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(effectiveIngredients));
      if (inIngredients) {
        const listed = containsInfo.declaredAllergens.some(decl =>
          allergenDef.keywords.some(k => decl.includes(k) || k.includes(decl))
        );
        if (!listed) {
          unlistedInContains.push(allergenDef.name);
          if (!issueCount) issueCount++;
        }
      }
    }
  }

  const overallStatus = issueCount > 0 ? 'issue' : (reviewCount > 0 ? 'review' : 'match');
  const undeclaredMajorAllergens = results.filter(r => r.status === 'issue' || r.status === 'unable').map(r => r.allergen).concat(unlistedInContains);

  return {
    status: overallStatus,
    results,
    containsStatement: containsInfo?.raw || null,
    precautionaryStatement: precautionaryInfo?.raw || null,
    precautionaryAdvisoryPresent: Boolean(precautionaryInfo),
    unlistedInContains,
    undeclaredMajorAllergens,
    citation: '21 U.S.C. 343(w) (FALCPA / FASTER Act)',
    explanation: overallStatus === 'match'
      ? 'All specified formulation allergens are declared according to statutory US FDA requirements.'
      : issueCount > 0
        ? `Allergen disclosure discrepancies detected (${issueCount} undeclared major allergen(s)).`
        : 'Allergen disclosure requires human reviewer inspection.',
  };
}
