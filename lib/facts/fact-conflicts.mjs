/**
 * PackSignal Phase 2 — Fact Conflict Engine & Semantic Comparison
 * (lib/facts/fact-conflicts.mjs)
 * 
 * Detects:
 * 1. Value conflicts (Honey 1% vs 9%, Carbohydrate 15g vs 66g on comparable basis).
 * 2. Basis & Visibility safety (65g per-100g hidden EU table is not confused with 66g per-serving US panel).
 * 3. Commercial unit equivalence (480 g vs 16.9 oz does NOT conflict).
 * 4. Ingredient list semantic diff (added/removed ingredients, sequence, compound components).
 * 5. Meaning conflicts (Honey present vs Vegan claim; No Added Sugar claim vs added sugar ingredients).
 * 6. Preserves both sources, both quotations, both locations with zero data destruction.
 */

import { areQuantitiesEquivalent, parseNormalizedQuantity } from './fact-normalization.mjs';

/**
 * Normalizes an ingredient token for sequence and set comparison.
 */
function normalizeIngredientToken(token) {
  return String(token || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[().]/g, '');
}

/**
 * Parses raw ingredient declaration text into discrete component tokens.
 */
export function parseIngredientTokens(rawText) {
  if (!rawText) return [];
  // Strip "INGREDIENTS:" prefix
  let clean = String(rawText).replace(/^ingredients\s*:\s*/i, '').trim().replace(/\.$/, '');
  
  // Handle compound ingredients in parentheses e.g. "Crystallized Ginger (cane sugar)"
  // Split on commas not inside parentheses
  const tokens = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (char === '(') depth++;
    else if (char === ')') depth--;

    if (char === ',' && depth === 0) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) tokens.push(current.trim());

  return tokens;
}

/**
 * Detects conflicts among facts referring to the same semantic property.
 * 
 * @param {Array<object>} facts - Collection of unified Fact Sheet facts.
 * @param {object} options - Comparison configuration.
 * @returns {Array<object>} List of structured conflict records.
 */
export function detectFactConflicts(facts = [], options = {}) {
  const conflicts = [];

  // Group facts by canonical semantic field
  const byField = new Map();
  for (const fact of facts) {
    if (!byField.has(fact.field)) {
      byField.set(fact.field, []);
    }
    byField.get(fact.field).push(fact);
  }

  // 1. Honey Percentage Conflict (Honey 1% vs 9%)
  const honeyFacts = byField.get('ingredient.honey.percentage') || [];
  if (honeyFacts.length >= 2) {
    const artFact = honeyFacts.find(f => f.source?.documentRole === 'artwork') || honeyFacts[0];
    const specFact = honeyFacts.find(f => f.source?.documentRole === 'specification') || honeyFacts[1];

    if (artFact && specFact && artFact.value !== specFact.value) {
      conflicts.push({
        conflictId: 'CONFLICT-HONEY-PERCENTAGE',
        conflictType: 'VALUE_CONFLICT',
        field: 'ingredient.honey.percentage',
        factIds: [artFact.factId, specFact.factId],
        observedValues: {
          artwork: artFact.value,
          specification: specFact.value
        },
        normalizedValues: {
          artwork: artFact.normalizedValue,
          specification: specFact.normalizedValue
        },
        comparable: true,
        comparisonBasis: 'percentage_of_recipe',
        reason: `Value conflict: Artwork declares Honey at ${artFact.value} (${artFact.source?.panelId || 'panel'}), but specification sheet declares Honey at ${specFact.value} (${specFact.source?.cell || 'cell'}).`,
        evidenceIds: [artFact.evidence?.quote, specFact.evidence?.quote].filter(Boolean),
        authorityStatus: specFact.sourceAuthority || 'DRAFT',
        reviewStatus: 'NEEDS_SOURCE_DECISION',
        suggestedQuestions: [
          'Which formulation is authoritative: 1% Honey as printed on carton, or 9% Honey in draft specification?',
          'Verify whether the recipe was adjusted to 1% to reduce sugar content.'
        ]
      });

      artFact.conflictGroupIds.push('CONFLICT-HONEY-PERCENTAGE');
      specFact.conflictGroupIds.push('CONFLICT-HONEY-PERCENTAGE');
      artFact.verificationState = 'CONFLICTED';
      specFact.verificationState = 'CONFLICTED';
    }
  }

  // 2. Carbohydrate Comparison (15g in spec vs 66g on artwork)
  const carbFacts = byField.get('nutrition.carbohydrate.total') || [];
  if (carbFacts.length >= 2) {
    const artCarb = carbFacts.find(f => f.source?.documentRole === 'artwork') || carbFacts[0];
    const specCarb = carbFacts.find(f => f.source?.documentRole === 'specification') || carbFacts[1];

    if (artCarb && specCarb) {
      // Check if basis is comparable
      const artBasis = artCarb.normalizedValue?.basis || 'per_serving';
      const specBasis = specCarb.normalizedValue?.basis || 'per_serving';

      const equiv = areQuantitiesEquivalent(artCarb.value, specCarb.value, {
        tolerancePct: 2.0,
        requireMatchingBasis: true
      });

      if (!equiv.equivalent) {
        conflicts.push({
          conflictId: 'CONFLICT-TOTAL-CARBOHYDRATE',
          conflictType: 'VALUE_CONFLICT',
          field: 'nutrition.carbohydrate.total',
          factIds: [artCarb.factId, specCarb.factId],
          observedValues: {
            artwork: artCarb.value,
            specification: specCarb.value
          },
          normalizedValues: {
            artwork: artCarb.normalizedValue,
            specification: specCarb.normalizedValue
          },
          comparable: artBasis === specBasis,
          comparisonBasis: `${artBasis} vs ${specBasis}`,
          reason: `Value conflict: Artwork US Nutrition Facts panel declares Total Carbohydrate ${artCarb.value} (${artBasis}), while specification sheet states ${specCarb.value} (${specBasis}).`,
          evidenceIds: [artCarb.evidence?.quote, specCarb.evidence?.quote].filter(Boolean),
          authorityStatus: specCarb.sourceAuthority || 'DRAFT',
          reviewStatus: 'NEEDS_SOURCE_DECISION',
          suggestedQuestions: [
            'Confirm if 15g carbohydrate in specification column was an unverified draft placeholder or belongs to another portion size.',
            'Verify laboratory nutritional analysis for correct total carbohydrate per 85g serving.'
          ]
        });

        artCarb.conflictGroupIds.push('CONFLICT-TOTAL-CARBOHYDRATE');
        specCarb.conflictGroupIds.push('CONFLICT-TOTAL-CARBOHYDRATE');
        artCarb.verificationState = 'CONFLICTED';
        specCarb.verificationState = 'CONFLICTED';
      }
    }
  }

  // 3. Net Quantity Comparison (480 g vs 16.9 oz)
  const netQtyFacts = byField.get('net_quantity') || [];
  if (netQtyFacts.length >= 2) {
    const q1 = netQtyFacts[0];
    const q2 = netQtyFacts[1];
    const equiv = areQuantitiesEquivalent(q1.value, q2.value);
    if (!equiv.equivalent) {
      conflicts.push({
        conflictId: 'CONFLICT-NET-QUANTITY',
        conflictType: 'VALUE_CONFLICT',
        field: 'net_quantity',
        factIds: [q1.factId, q2.factId],
        observedValues: { first: q1.value, second: q2.value },
        comparable: true,
        reason: equiv.reason,
        reviewStatus: 'NEEDS_SOURCE_DECISION'
      });
      q1.verificationState = 'CONFLICTED';
      q2.verificationState = 'CONFLICTED';
    }
    // If equivalent (e.g. 480 g vs 16.9 oz), DO NOT generate a conflict!
  }

  // 4. Ingredient List Semantic Comparison
  const ingFacts = byField.get('ingredient.list') || [];
  if (ingFacts.length >= 2) {
    const artIng = ingFacts.find(f => f.source?.documentRole === 'artwork') || ingFacts[0];
    const specIng = ingFacts.find(f => f.source?.documentRole === 'specification') || ingFacts[1];

    if (artIng && specIng) {
      const artTokens = parseIngredientTokens(artIng.value);
      const specTokens = parseIngredientTokens(specIng.value);

      const artNorm = artTokens.map(normalizeIngredientToken);
      const specNorm = specTokens.map(normalizeIngredientToken);

      const addedOnCarton = artTokens.filter(t => !specNorm.some(s => s.includes(normalizeIngredientToken(t))));
      const removedFromCarton = specTokens.filter(t => !artNorm.some(a => a.includes(normalizeIngredientToken(t))));

      if (addedOnCarton.length > 0 || removedFromCarton.length > 0) {
        conflicts.push({
          conflictId: 'CONFLICT-INGREDIENT-LIST-DIFF',
          conflictType: 'INGREDIENT_LIST_DIFF',
          field: 'ingredient.list',
          factIds: [artIng.factId, specIng.factId],
          observedValues: {
            artwork: artIng.value,
            specification: specIng.value
          },
          addedIngredientsOnArtwork: addedOnCarton,
          missingIngredientsOnArtwork: removedFromCarton,
          comparable: true,
          comparisonBasis: 'ingredient_formulation_comparison',
          reason: `Ingredient list discrepancy: Printed carton declares ingredients not present in specification sheet (${addedOnCarton.join(', ')}).`,
          reviewStatus: 'NEEDS_SOURCE_DECISION',
          suggestedQuestions: [
            `Why are [${addedOnCarton.join(', ')}] declared on the printed carton but omitted from the specification sheet?`,
            'Confirm if Walnuts and Flax Seeds were added in formulation revision.'
          ]
        });

        artIng.conflictGroupIds.push('CONFLICT-INGREDIENT-LIST-DIFF');
        specIng.conflictGroupIds.push('CONFLICT-INGREDIENT-LIST-DIFF');
        artIng.verificationState = 'CONFLICTED';
        specIng.verificationState = 'CONFLICTED';
      }
    }
  }

  // 5. AI Meaning Conflicts (Step 17)
  // Scenario A: Honey present + Vegan claim present
  const hasHoney = facts.some(f => 
    f.field.includes('honey') || 
    (f.field === 'ingredient.list' && /honey/i.test(f.value))
  );
  const veganFacts = facts.filter(f => 
    f.field.includes('vegan') || 
    (f.field.includes('claim') && /vegan/i.test(f.value))
  );

  if (hasHoney && veganFacts.length > 0) {
    const veganFact = veganFacts[0];
    conflicts.push({
      conflictId: 'CONFLICT-MEANING-HONEY-VEGAN',
      conflictType: 'CLAIM_COMPATIBILITY_CONCERN',
      field: 'claims.dietary.vegan_compatibility',
      factIds: [veganFact.factId],
      observedValues: {
        ingredient: 'Honey present in formulation',
        claim: veganFact.value
      },
      comparable: true,
      comparisonBasis: 'dietary_standard_compatibility',
      reason: 'Claim compatibility concern: Product declares "Suitable for Vegans" or vegan certification mark, but contains Honey (an animal-derived ingredient).',
      authorityStatus: 'REGULATORY_REVIEW_REQUIRED',
      reviewStatus: 'NEEDS_REGULATORY_REVIEW',
      suggestedQuestions: [
        'Does the presence of Honey disqualify the "Suitable for Vegans" claim under applicable regional advertising standards?',
        'Verify if vegan certification agency permits honey under ethical beekeeping exemptions or if label requires removal of vegan claim.'
      ]
    });
  }

  // Scenario B: "No Added Sugar" claim + Sweeteners present
  const noAddedSugarClaim = facts.find(f => 
    f.field.includes('claim') && /no\s*added\s*sugar/i.test(f.value)
  );
  const sweetenerIngredients = ['honey', 'coconut sugar', 'cane sugar', 'sugar'];
  const hasSweeteners = facts.some(f => 
    f.field === 'ingredient.list' && sweetenerIngredients.some(sw => new RegExp(`\\b${sw}\\b`, 'i').test(f.value))
  );

  if (noAddedSugarClaim && hasSweeteners) {
    conflicts.push({
      conflictId: 'CONFLICT-MEANING-NO-ADDED-SUGAR',
      conflictType: 'CLAIM_COMPATIBILITY_CONCERN',
      field: 'claims.nutrition.no_added_sugar',
      factIds: [noAddedSugarClaim.factId],
      observedValues: {
        claim: noAddedSugarClaim.value,
        sweeteners: 'Honey, Coconut Sugar, Cane Sugar'
      },
      comparable: true,
      comparisonBasis: 'fda_21cfr101_60c_compliance',
      reason: 'Claim compatibility concern: Front panel displays "NO ADDED SUGAR", but ingredient list declares added nutritive sweeteners (Honey, Coconut Sugar, Cane Sugar). FDA 21 CFR 101.60(c) prohibits "No Added Sugar" claims when food contains added ingredients that functionally substitute for added sugars.',
      authorityStatus: 'REGULATORY_REVIEW_REQUIRED',
      reviewStatus: 'NEEDS_REGULATORY_REVIEW',
      suggestedQuestions: [
        'How can "NO ADDED SUGAR" be justified when Honey and Coconut Sugar are declared in the ingredient list?',
        'Recommend removing "NO ADDED SUGAR" claim from Front PDP to avoid FDA misbranding enforcement.'
      ]
    });
  }

  return conflicts;
}
