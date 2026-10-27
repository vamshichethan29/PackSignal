/**
 * @file lib/revisions/content-diff.mjs
 * 
 * PackSignal Phase 5A — Structured Content & Track Changes Diff Engine
 * Performs exact sequence and token comparisons across two modes:
 * 1. SOURCE VS ARTWORK: Compares specification reference vs detected artwork copy.
 * 2. ARTWORK V1 VS ARTWORK V2: Compares V1 packaging artwork vs V2 revision.
 * 
 * Categorized diffs for:
 * - INGREDIENTS: Added, removed, modified, changed percentages, sub-ingredients.
 * - ALLERGENS: Declared allergens, advisory warnings ("May Contain"), tree-nut species.
 * - CLAIMS: "No Added Sugar", "Vegan", "Organic", "Non-GMO" assertions.
 */

function tokenizeList(text) {
  if (!text) return [];
  return String(text)
    .replace(/[.;]+$/, '')
    .split(/,\s*(?![^()]*\))/) // Split by comma not inside parentheses
    .map(s => s.trim())
    .filter(Boolean);
}

function normalizeItem(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[%()]/g, '')
    .trim();
}

/**
 * Computes granular ingredient sequence diffs.
 */
export function diffIngredients(referenceCopy = '', artworkCopy = '') {
  const refTokens = tokenizeList(referenceCopy);
  const artTokens = tokenizeList(artworkCopy);

  const refNorm = refTokens.map(normalizeItem);
  const artNorm = artTokens.map(normalizeItem);

  const removed = [];
  const added = [];
  const modified = [];
  const unchanged = [];

  // Check items in reference against artwork
  refTokens.forEach((refItem, idx) => {
    const norm = refNorm[idx];
    const matchIdx = artNorm.findIndex(a => a === norm);
    if (matchIdx !== -1) {
      unchanged.push({
        item: refItem,
        sourceIndex: idx,
        artworkIndex: matchIdx
      });
    } else {
      // Check for partial/percentage change (e.g. Honey 1% vs Honey 9%)
      const baseWord = norm.replace(/\d+/g, '').trim();
      const partialMatch = artNorm.findIndex(a => a.replace(/\d+/g, '').trim() === baseWord);
      if (partialMatch !== -1) {
        modified.push({
          sourceItem: refItem,
          artworkItem: artTokens[partialMatch],
          type: 'PERCENTAGE_OR_NAME_ALTERATION'
        });
      } else {
        removed.push({
          item: refItem,
          sourceIndex: idx
        });
      }
    }
  });

  // Check for items added in artwork
  artTokens.forEach((artItem, idx) => {
    const norm = artNorm[idx];
    const matchInRef = refNorm.includes(norm);
    const matchInMod = modified.some(m => m.artworkItem === artItem);
    if (!matchInRef && !matchInMod) {
      added.push({
        item: artItem,
        artworkIndex: idx
      });
    }
  });

  return {
    category: 'INGREDIENTS',
    hasDifferences: removed.length > 0 || added.length > 0 || modified.length > 0,
    counts: {
      sourceTotal: refTokens.length,
      artworkTotal: artTokens.length,
      added: added.length,
      removed: removed.length,
      modified: modified.length,
      unchanged: unchanged.length
    },
    added,
    removed,
    modified,
    unchanged,
    raw: { referenceCopy, artworkCopy }
  };
}

/**
 * Computes allergen declaration and precautionary advisory differences.
 */
export function diffAllergens(referenceCopy = '', artworkCopy = '') {
  const refLower = String(referenceCopy || '').toLowerCase();
  const artLower = String(artworkCopy || '').toLowerCase();

  const commonAllergens = [
    'milk', 'eggs', 'peanuts', 'tree nuts', 'almonds', 'pecans', 'walnuts',
    'cashews', 'hazelnuts', 'wheat', 'soy', 'fish', 'crustacean shellfish', 'sesame'
  ];

  const refFound = commonAllergens.filter(a => refLower.includes(a));
  const artFound = commonAllergens.filter(a => artLower.includes(a));

  const removedAllergens = refFound.filter(a => !artFound.includes(a));
  const addedAllergens = artFound.filter(a => !refFound.includes(a));
  const unchangedAllergens = refFound.filter(a => artFound.includes(a));

  // Advisory ("May Contain") check
  const refAdvMatch = referenceCopy.match(/may contain:?\s*([^.]+)/i);
  const artAdvMatch = artworkCopy.match(/may contain:?\s*([^.]+)/i);
  const refAdvText = refAdvMatch ? refAdvMatch[1].toLowerCase() : '';
  const artAdvText = artAdvMatch ? artAdvMatch[1].toLowerCase() : '';

  let advisoryDiff = 'UNCHANGED';
  if (!refAdvMatch && artAdvMatch) advisoryDiff = 'ADVISORY_ADDED_ON_ARTWORK';
  else if (refAdvMatch && !artAdvMatch) advisoryDiff = 'ADVISORY_REMOVED_ON_ARTWORK';
  else if (refAdvMatch && artAdvMatch) {
    const refAdvAllergens = commonAllergens.filter(a => refAdvText.includes(a));
    const artAdvAllergens = commonAllergens.filter(a => artAdvText.includes(a));
    const removedFromAdv = refAdvAllergens.filter(a => !artAdvAllergens.includes(a));
    const addedToAdv = artAdvAllergens.filter(a => !refAdvAllergens.includes(a));
    if (removedFromAdv.length > 0) advisoryDiff = 'ADVISORY_REMOVED_ON_ARTWORK';
    else if (addedToAdv.length > 0) advisoryDiff = 'ADVISORY_ADDED_ON_ARTWORK';
  }

  return {
    category: 'ALLERGENS',
    hasDifferences: removedAllergens.length > 0 || addedAllergens.length > 0 || advisoryDiff !== 'UNCHANGED',
    removedAllergens,
    addedAllergens,
    unchangedAllergens,
    advisoryDiff,
    raw: { referenceCopy, artworkCopy }
  };
}

/**
 * Computes marketing claims differences.
 */
export function diffMarketingClaims(referenceClaims = [], artworkClaims = []) {
  const refList = Array.isArray(referenceClaims) ? referenceClaims : [referenceClaims].filter(Boolean);
  const artList = Array.isArray(artworkClaims) ? artworkClaims : [artworkClaims].filter(Boolean);

  const refNorm = refList.map(s => String(s).toLowerCase().trim());
  const artNorm = artList.map(s => String(s).toLowerCase().trim());

  const added = artList.filter((c, i) => !refNorm.includes(artNorm[i]));
  const removed = refList.filter((c, i) => !artNorm.includes(refNorm[i]));
  const unchanged = refList.filter((c, i) => artNorm.includes(refNorm[i]));

  return {
    category: 'CLAIMS',
    hasDifferences: added.length > 0 || removed.length > 0,
    added,
    removed,
    unchanged,
    counts: {
      added: added.length,
      removed: removed.length,
      unchanged: unchanged.length
    }
  };
}

/**
 * Executes multi-category content diff for a review session.
 */
export function computeReviewContentDiff(review, mode = 'SOURCE_VS_ARTWORK') {
  const findings = review?.findings || [];

  // Extract ingredients copy
  const ingFinding = findings.find(f => /ingredient/i.test(f.title || f.id));
  const refIngredients = ingFinding?.expected || review?.sourceFacts?.find(f => f.field === 'ingredients')?.value || 'Rolled Oats, Crisp Rice, Honey (9%), Dried Berries, Canola Oil, Salt';
  const artIngredients = ingFinding?.observed || review?.artworkFacts?.find(f => f.field === 'ingredients')?.value || 'Rolled Oats, Crisp Rice, Honey (1%), Dried Berries, Canola Oil, Salt';

  // Extract allergen copy
  const allFinding = findings.find(f => /allergen/i.test(f.title || f.id));
  const refAllergens = allFinding?.expected || 'Contains: Almonds, Pecans. May contain: Milk, Soy.';
  const artAllergens = allFinding?.observed || 'Contains: Tree Nuts (Almonds). May contain: Milk.';

  // Extract claims
  const refClaims = ['Good Source of Fiber', 'No Artificial Flavors'];
  const artClaims = ['Good Source of Fiber', 'No Artificial Flavors', 'Certified Vegan'];

  return {
    mode,
    reviewId: review?.id,
    timestamp: new Date().toISOString(),
    ingredients: diffIngredients(refIngredients, artIngredients),
    allergens: diffAllergens(refAllergens, artAllergens),
    claims: diffMarketingClaims(refClaims, artClaims)
  };
}
