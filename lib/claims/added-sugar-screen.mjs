/**
 * PackSignal Packaging Claim & Legal Disclosure Screener.
 * Evaluates:
 * - "No Added Sugar" claims vs sweetener formulations (21 CFR 101.60(c)(2))
 * - "Zero Added Sugars" nutrition declarations vs recipes
 * - "Vegan" / "Vegetarian" claims vs animal derivatives (honey, dairy, cholesterol)
 * - Allergen declarations under FDA FALCPA (21 U.S.C. 343(w))
 * - Market-specific terminology (EU vs US packaging conventions)
 * - Net quantity and manufacturer address declarations
 */

// Added sugar ingredients per FDA 21 CFR 101.60(c)(2)
const ADDED_SUGAR_TERMS = [
  'sugar', 'cane sugar', 'coconut sugar', 'brown sugar', 'raw sugar', 'beet sugar',
  'honey', 'syrup', 'maple syrup', 'corn syrup', 'high fructose corn syrup',
  'agave', 'molasses', 'dextrose', 'fructose', 'glucose', 'maltose', 'sucrose',
  'invert sugar', 'malt syrup', 'fruit juice concentrate'
];

// Animal derivatives conflicting with vegan definitions
const NON_VEGAN_INGREDIENTS = [
  { term: 'honey', type: 'insect / bee product', standard: 'Vegan Society / ISO 23662' },
  { term: 'milk', type: 'dairy', standard: 'Vegan Society / ISO 23662' },
  { term: 'butter', type: 'dairy', standard: 'Vegan Society / ISO 23662' },
  { term: 'whey', type: 'dairy derivative', standard: 'Vegan Society / ISO 23662' },
  { term: 'casein', type: 'dairy derivative', standard: 'Vegan Society / ISO 23662' },
  { term: 'gelatin', type: 'animal collagen', standard: 'Vegan Society / ISO 23662' },
  { term: 'egg', type: 'poultry product', standard: 'Vegan Society / ISO 23662' },
  { term: 'carmine', type: 'cochineal extract', standard: 'Vegan Society / ISO 23662' },
  { term: 'lard', type: 'animal fat', standard: 'Vegan Society / ISO 23662' }
];

// FDA Major Tree Nuts (FALCPA 2004)
const FDA_TREE_NUTS = [
  'almond', 'almonds', 'pecan', 'pecans', 'walnut', 'walnuts', 'cashew', 'cashews',
  'pistachio', 'pistachios', 'hazelnut', 'hazelnuts', 'macadamia', 'macadamias',
  'brazil nut', 'brazil nuts', 'coconut', 'coconuts', 'pine nut', 'pine nuts'
];

/**
 * Screens "No Added Sugar" claims against ingredient formulation.
 */
export function screenNoAddedSugarClaim(claimText, ingredientTokens) {
  if (!claimText) return null;
  const isNoSugarClaim = /\b(?:no\s+added\s+sugars?|without\s+added\s+sugars?|zero\s+added\s+sugars?)\b/i.test(claimText);
  if (!isNoSugarClaim) return null;

  const conflictingIngredients = [];
  for (const item of (ingredientTokens || [])) {
    const norm = (item.normalizedName || item.name || '').toLowerCase();
    const raw = (item.raw || '').toLowerCase();
    for (const sugarTerm of ADDED_SUGAR_TERMS) {
      if (norm.includes(sugarTerm) || raw.includes(sugarTerm)) {
        conflictingIngredients.push({
          ingredient: item.name || item.raw,
          matchedTerm: sugarTerm,
          raw: item.raw
        });
        break;
      }
    }
  }

  const hasConflict = conflictingIngredients.length > 0;
  return {
    claimText,
    isNoSugarClaim: true,
    hasConflict,
    conflictingIngredients,
    criteriaCheck: {
      '21_CFR_101_60_c_2': !hasConflict
    },
    status: hasConflict ? 'review' : 'match',
    findingStatus: hasConflict ? 'CLAIM_FORMULATION_CONFLICT' : 'CLAIM_PLAUSIBLE',
    cfrReference: '21 CFR 101.60(c)(2)',
    explanation: hasConflict
      ? `Package displays "${claimText}", but ingredient list includes added sugars: ${conflictingIngredients.map(c => c.ingredient).join(', ')}. Under 21 CFR 101.60(c)(2), a product bearing this claim must not contain added sugars or sugar-containing ingredients unless explicitly qualified.`
      : `No conflicting added sugar ingredients identified in formulation.`
  };
}

/**
 * Screens declared "0g Added Sugars" in Nutrition Facts against ingredients.
 */
export function screenDeclaredAddedSugars(declaredAddedSugarsText, ingredientTokens) {
  if (!declaredAddedSugarsText) return null;
  const isZeroDeclared = /\b0\s*g\b/i.test(declaredAddedSugarsText);
  if (!isZeroDeclared) return null;

  const sugarIngredients = [];
  for (const item of (ingredientTokens || [])) {
    const norm = (item.normalizedName || item.name || '').toLowerCase();
    const raw = (item.raw || '').toLowerCase();
    for (const sugarTerm of ADDED_SUGAR_TERMS) {
      if (norm.includes(sugarTerm) || raw.includes(sugarTerm)) {
        sugarIngredients.push(item.name || item.raw);
        break;
      }
    }
  }

  const hasDiscrepancy = sugarIngredients.length > 0;
  return {
    declaredAddedSugarsText,
    isZeroDeclared: true,
    hasDiscrepancy,
    sugarIngredients,
    status: hasDiscrepancy ? 'review' : 'match',
    findingStatus: hasDiscrepancy ? 'ADDED_SUGAR_VALUE_QUESTION' : 'ADDED_SUGARS_CONSISTENT',
    cfrReference: '21 CFR 101.9(c)(6)(iii)',
    explanation: hasDiscrepancy
      ? `Nutrition panel declares "${declaredAddedSugarsText}", but recipe contains caloric sweeteners (${sugarIngredients.join(', ')}). Requires technical formulation verification to determine if added sugar contributes < 0.5g per serving (permitting 0g rounding).`
      : `Declared added sugars are consistent with ingredient list.`
  };
}

/**
 * Screens Vegan claims against formulation and nutritional indicators.
 */
export function screenVeganClaim(claimText, ingredientTokens, nutritionFacts = {}) {
  if (!claimText) return null;
  const isVeganClaim = /\b(?:vegan|suitable\s+for\s+vegans?|certified\s+vegan)\b/i.test(claimText);
  if (!isVeganClaim) return null;

  const animalDerivatives = [];
  for (const item of (ingredientTokens || [])) {
    const text = ((item.name || '') + ' ' + (item.raw || '')).toLowerCase();
    for (const nonVegan of NON_VEGAN_INGREDIENTS) {
      if (text.includes(nonVegan.term)) {
        animalDerivatives.push({
          ingredient: item.name || item.raw,
          term: nonVegan.term,
          category: nonVegan.type,
          standard: nonVegan.standard
        });
        break;
      }
    }
  }

  const cholesterolMg = parseFloat(nutritionFacts.cholesterol);
  const hasCholesterol = !isNaN(cholesterolMg) && cholesterolMg > 5;

  const hasIssues = animalDerivatives.length > 0 || hasCholesterol;
  const honeyPresent = animalDerivatives.some(d => d.term === 'honey');

  return {
    claimText,
    isVeganClaim: true,
    animalDerivatives,
    honeyPresent,
    hasCholesterol,
    cholesterolPresent: hasCholesterol,
    cholesterolValue: hasCholesterol ? `${cholesterolMg} mg` : null,
    status: hasIssues ? 'review' : 'match',
    findingStatus: hasIssues ? 'VEGAN_CLAIM_SUBSTANTIATION_REVIEW' : 'VEGAN_CLAIM_PLAUSIBLE',
    explanation: hasIssues
      ? `Packaging bears "${claimText}", but formulation contains ${animalDerivatives.map(d => `${d.ingredient} (${d.category})`).join(', ')}${hasCholesterol ? ` and declares ${cholesterolMg} mg cholesterol (cholesterol is almost exclusively found in animal products)` : ''}. Honey is excluded under international vegan certification standards (e.g. Vegan Society, ISO 23662). Requires regulatory and brand substantiation.`
      : `No animal-derived ingredients detected in reviewed formulation.`
  };
}

/**
 * Evaluates allergen disclosures under FDA FALCPA (21 U.S.C. 343(w)).
 */
export function evaluateAllergenDisclosure(ingredientTokens, allergenStatementText) {
  const detectedTreeNuts = [];
  for (const item of (ingredientTokens || [])) {
    const text = ((item.name || '') + ' ' + (item.raw || '')).toLowerCase();
    for (const nut of FDA_TREE_NUTS) {
      if (text.includes(nut) && !detectedTreeNuts.includes(nut)) {
        detectedTreeNuts.push(nut);
      }
    }
  }

  const statement = (allergenStatementText || '').trim();
  const hasContainsStatement = /\bcontains\s*[:.-]?\b/i.test(statement);
  const hasMayContainStatement = /\bmay\s+contain\b/i.test(statement);

  // Legal analysis under FALCPA:
  // If specific tree nuts are named in the ingredient list, a separate "Contains:" line is OPTIONAL,
  // because FALCPA allows allergen source disclosure either in the ingredient list OR via "Contains:".
  const declaredInIngredientList = detectedTreeNuts.length > 0;

  return {
    detectedTreeNuts,
    declaredInIngredientList,
    compliantWithFalcpa: declaredInIngredientList,
    hasContainsStatement,
    hasMayContainStatement,
    allergenStatementText,
    status: (detectedTreeNuts.length > 0 && !hasContainsStatement && hasMayContainStatement) ? 'review' : 'match',
    findingStatus: (detectedTreeNuts.length > 0 && !hasContainsStatement) ? 'ALLERGEN_DECLARATION_REVIEW' : 'ALLERGEN_COMPLIANT',
    falcpaCitation: '21 U.S.C. 343(w)(1)',
    explanation: (detectedTreeNuts.length > 0 && !hasContainsStatement)
      ? `Specific tree nuts (${detectedTreeNuts.join(', ')}) are declared in the ingredient list. Under FALCPA (21 U.S.C. 343(w)), allergen naming in the ingredient list fulfills mandatory disclosure, meaning a separate "Contains:" statement is not legally required. However, the package only provides a precautionary "May Contain" statement without a "Contains:" line. Review recommended to ensure company allergen labeling policy is met.`
      : `Allergen declarations fulfill applicable labeling requirements.`
  };
}

/**
 * Screens for EU-style or mixed-market formatting on US packaging.
 */
export function screenMarketSpecificCopy(artworkText, targetMarket = 'us') {
  if (targetMarket.toLowerCase() !== 'us') return [];

  const findings = [];
  const text = artworkText || '';

  // EU Reference Intake energy in kJ
  if (/\b\d+\s*kJ\b/i.test(text)) {
    findings.push({
      type: 'EU_ENERGY_UNIT',
      term: 'kJ (kilojoules)',
      status: 'review',
      findingStatus: 'MIXED_MARKET_TERMINOLOGY',
      explanation: 'Kilojoules (kJ) energy declaration detected. US FDA Nutrition Facts (21 CFR 101.9) requires energy declared exclusively in Calories (kcal); kJ is an EU Regulation 1169/2011 requirement.'
    });
  }

  // EU terminology "Saturates" vs US "Saturated Fat"
  if (/\bSaturates\b/i.test(text) && !/\bSaturated\s+Fat\b/i.test(text)) {
    findings.push({
      type: 'EU_NUTRIENT_NAME',
      term: 'Saturates',
      status: 'review',
      findingStatus: 'MIXED_MARKET_TERMINOLOGY',
      explanation: '"Saturates" detected. US FDA requires the term "Saturated Fat" on food packaging.'
    });
  }

  // EU terminology "Salt" vs US "Sodium"
  if (/\bSalt\b/i.test(text) && (/\b(?:Saturates|\d+\s*kJ)\b/i.test(text) || !/\bSodium\b/i.test(text))) {
    findings.push({
      type: 'EU_NUTRIENT_NAME',
      term: 'Salt',
      status: 'review',
      findingStatus: 'MIXED_MARKET_TERMINOLOGY',
      explanation: '"Salt" declared as nutrient line. US 21 CFR 101.9 requires "Sodium" declared in milligrams (mg).'
    });
  }

  // EU Allergen phrase "Cereals Containing Gluten"
  if (/cereals\s+containing\s+gluten/i.test(text)) {
    findings.push({
      type: 'EU_ALLERGEN_PHRASING',
      term: 'Cereals Containing Gluten',
      status: 'review',
      findingStatus: 'MIXED_MARKET_TERMINOLOGY',
      explanation: '"Cereals Containing Gluten" is standard EU Regulation 1169/2011 Annex II wording. US FALCPA identifies specific grains (Wheat).'
    });
  }

  return findings;
}

/**
 * Evaluates Net Quantity declaration under US Fair Packaging & Labeling Act (FPLA).
 */
export function evaluateNetQuantity(netQuantityText, panelLocation = 'unknown') {
  const text = (netQuantityText || '').trim();
  const hasMetric = /\b\d+(?:\.\d+)?\s*(?:g|kg|ml|l)\b/i.test(text);
  const hasCustomary = /\b\d+(?:\.\d+)?\s*(?:oz|fl\s*oz|lb|lbs)\b/i.test(text);
  const hasNetWtPrefix = /\b(?:net\s*wt\.?|net\s*weight)\b/i.test(text);

  const isDualDeclaration = hasMetric && hasCustomary;
  const isPdp = panelLocation.toLowerCase() === 'front' || panelLocation.toLowerCase() === 'pdp';

  const issues = [];
  if (!hasCustomary) {
    issues.push('Missing US customary declaration (ounces / pounds). 15 U.S.C. 1453 and 21 CFR 101.7 require dual declaration in both US Customary and metric units.');
  }
  if (!isPdp) {
    issues.push(`Net quantity is located on "${panelLocation}" panel instead of the Principal Display Panel (PDP) as required by 21 CFR 101.7.`);
  }

  return {
    netQuantityText,
    panelLocation,
    hasMetric,
    hasCustomary,
    hasNetWtPrefix,
    isDualDeclaration,
    isPdp,
    customaryMissing: !hasCustomary,
    pdpMissing: !isPdp,
    issues,
    status: issues.length > 0 ? 'issue' : 'match',
    findingStatus: issues.length > 0 ? 'NET_QUANTITY_FORMAT_DEFECT' : 'NET_QUANTITY_COMPLIANT',
    cfrReference: '21 CFR 101.7 & 15 U.S.C. 1453',
    explanation: issues.length > 0
      ? `Net quantity "${netQuantityText}" on ${panelLocation} panel does not meet US requirements: ${issues.join(' ')}`
      : `Net quantity meets US dual declaration and PDP placement standards.`
  };
}

/**
 * Evaluates Manufacturer / Distributor address under 21 CFR 101.5.
 */
export function evaluateManufacturerAddress(addressText) {
  const text = (addressText || '').trim();
  const hasBusinessName = /\b(?:produced\s+by|manufactured\s+by|distributed\s+by|packed\s+for|company|co\.?|llc|inc\.?)\b/i.test(text);
  const hasZipCode = /\b\d{5}(?:-\d{4})?\b/.test(text);
  // US 2-letter state codes, excluding common corporate abbreviations like CO (when preceded by space/period at end)
  const cleanedForState = text.replace(/\b(?:co|llc|inc|ltd)\.?\b/gi, '');
  const hasState = /\b(?:AL|AK|AZ|AR|CA|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/.test(cleanedForState) ||
                   /\b(?:California|New York|Texas|Florida|Illinois|Ohio|Washington|Colorado)\b/i.test(cleanedForState);

  const hasCity = /\b(?:[A-Z][a-z]+|\bCity\b)/.test(text) && (hasZipCode || hasState);
  const isCompleteAddress = hasBusinessName && (hasZipCode || hasState);

  return {
    addressText,
    hasBusinessName,
    hasCity: Boolean(hasCity),
    hasState,
    hasZip: hasZipCode,
    hasZipCode,
    isCompleteAddress,
    status: isCompleteAddress ? 'match' : 'issue',
    findingStatus: isCompleteAddress ? 'MANUFACTURER_ADDRESS_COMPLIANT' : 'MANUFACTURER_ADDRESS_INCOMPLETE',
    cfrReference: '21 CFR 101.5',
    explanation: isCompleteAddress
      ? 'Manufacturer identification includes business name and location details.'
      : `Address declaration "${text}" lacks complete postal location details (city, state, and ZIP code) as required by 21 CFR 101.5.`
  };
}
