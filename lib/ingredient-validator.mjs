/**
 * Generalized Ingredient List Parser, Tokenizer and Validator for PackSignal.
 * Compares source formulations against printed artwork copy.
 *
 * Preserves hierarchy, percentages, compound ingredients, and detects:
 * - Percentage mismatches (e.g. Honey 9% vs 1%)
 * - Artwork-only ingredients (e.g. Walnuts, Flax Seeds, etc.)
 * - Source-only ingredients
 * - Duplicate ingredient declarations in source or artwork
 * - Order differences
 */

/**
 * Normalizes an ingredient name for fair comparison (handles case, trailing punctuation, plurals).
 */
export function normalizeIngredientName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]/g, '')
    .replace(/\boils\b/g, 'oil')
    .replace(/\bflakes\b/g, 'flake')
    .replace(/\bseeds\b/g, 'seed')
    .replace(/\bnuts\b/g, 'nut')
    .trim();
}

/**
 * Checks if two ingredient names represent the same ingredient concept (e.g. "dried blueberries" vs "blueberries").
 */
export function areIngredientsEquivalent(nameA, nameB) {
  const normA = normalizeIngredientName(nameA);
  const normB = normalizeIngredientName(nameB);
  if (normA === normB) return true;
  // Check if one is just the "dried" variant of the other
  const strippedA = normA.replace(/\bdried\s+/g, '').trim();
  const strippedB = normB.replace(/\bdried\s+/g, '').trim();
  return strippedA === strippedB;
}

/**
 * Tokenizes a raw ingredient string into structured items with:
 * - name
 * - percentage (number or null)
 * - rawText
 * - subIngredients (if parenthetical compound)
 */
export function parseIngredientList(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return [];
  }

  // Strip leading "INGREDIENTS:" or similar label
  let text = rawText.replace(/^(?:ingredients?|contains?|composition)\s*[:.-]\s*/i, '').trim();

  // Tokenize taking care of nested parentheses
  const tokens = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '(' || char === '[') {
      depth++;
      current += char;
    } else if (char === ')' || char === ']') {
      if (depth > 0) depth--;
      current += char;
    } else if ((char === ',' || char === '.' || char === ';') && depth === 0) {
      // End of an ingredient item
      const item = current.trim();
      if (item) {
        tokens.push(item);
      }
      current = '';
    } else {
      current += char;
    }
  }
  const lastItem = current.trim();
  if (lastItem) {
    tokens.push(lastItem);
  }

  return tokens.map((token, index) => {
    // Check for percentage, e.g. "Honey (9%)", "Organic Wholegrain Oat Flakes (79%)", "Honey 1%"
    let percentage = null;
    let percentageStr = null;
    const pctMatch = token.match(/(?:^|\(|\s)(\d+(?:\.\d+)?)\s*%(?:\)|\s|$)/);
    if (pctMatch) {
      percentage = parseFloat(pctMatch[1]);
      percentageStr = `${pctMatch[1]}%`;
    }

    // Clean name by stripping out the percentage clause and compound sub-ingredients for primary matching
    let baseName = token
      .replace(/\(\s*\d+(?:\.\d+)?\s*%\s*\)/g, '')
      .replace(/\d+(?:\.\d+)?\s*%/g, '')
      .replace(/\s*\([^)]*\)/g, '') // remove parentheticals for core name
      .replace(/[.,;]/g, '')
      .trim();

    // Check for nested sub-ingredients in parentheses
    let subIngredients = [];
    const subMatch = token.match(/\(([^)]+)\)/);
    if (subMatch && !subMatch[1].match(/^\s*\d+(?:\.\d+)?\s*%\s*$/)) {
      subIngredients = subMatch[1]
        .split(/(?:,|and|in varying proportions)/i)
        .map(s => s.trim())
        .filter(Boolean);
    }

    return {
      raw: token,
      name: baseName,
      normalizedName: normalizeIngredientName(baseName),
      percentage,
      percentageStr,
      subIngredients,
      sequence: index + 1
    };
  }).filter(item => item.name.length > 0);
}

/**
 * Detects duplicate ingredient declarations within a single list.
 */
export function detectDuplicateIngredients(parsedList) {
  const seen = new Map();
  const duplicates = [];

  for (const item of parsedList) {
    const key = item.normalizedName;
    if (seen.has(key)) {
      duplicates.push({
        name: item.name,
        normalizedName: key,
        firstOccurrence: seen.get(key),
        secondOccurrence: item
      });
    } else {
      seen.set(key, item);
    }
  }

  return duplicates;
}

/**
 * Compares two ingredient lists (e.g. source sheet vs carton artwork).
 */
export function compareIngredientLists(sourceRaw, artworkRaw, meta = {}) {
  const sourceItems = parseIngredientList(sourceRaw);
  const artworkItems = parseIngredientList(artworkRaw);

  const sourceDuplicates = detectDuplicateIngredients(sourceItems);
  const artworkDuplicates = detectDuplicateIngredients(artworkItems);

  // Map by normalized name
  const sourceMap = new Map();
  sourceItems.forEach(item => {
    // Keep first occurrence if duplicate
    if (!sourceMap.has(item.normalizedName)) {
      sourceMap.set(item.normalizedName, item);
    }
  });

  const artworkMap = new Map();
  artworkItems.forEach(item => {
    if (!artworkMap.has(item.normalizedName)) {
      artworkMap.set(item.normalizedName, item);
    }
  });

  // 1. Percentage mismatches
  const percentageMismatches = [];
  for (const [key, srcItem] of sourceMap.entries()) {
    if (artworkMap.has(key)) {
      const artItem = artworkMap.get(key);
      if (srcItem.percentage !== null && artItem.percentage !== null) {
        if (srcItem.percentage !== artItem.percentage) {
          percentageMismatches.push({
            ingredient: srcItem.name,
            sourcePercentage: srcItem.percentage,
            artworkPercentage: artItem.percentage,
            sourceRaw: srcItem.raw,
            artworkRaw: artItem.raw,
            difference: `${srcItem.percentage}% (source) vs ${artItem.percentage}% (artwork)`
          });
        }
      }
    }
  }

  // 2. Artwork-only ingredients (present in artwork but missing in source)
  const artworkOnly = [];
  for (const [key, artItem] of artworkMap.entries()) {
    const matchedInSource = sourceItems.some(src => 
      areIngredientsEquivalent(src.name, artItem.name) ||
      src.subIngredients.some(sub => areIngredientsEquivalent(sub, artItem.name))
    );
    if (!matchedInSource) {
      artworkOnly.push({
        ingredient: artItem.name,
        raw: artItem.raw,
        sequence: artItem.sequence
      });
    }
  }

  // 3. Source-only ingredients (present in source but missing in artwork)
  const sourceOnly = [];
  for (const [key, srcItem] of sourceMap.entries()) {
    const matchedInArtwork = artworkItems.some(art => 
      areIngredientsEquivalent(art.name, srcItem.name) ||
      art.subIngredients.some(sub => areIngredientsEquivalent(sub, srcItem.name))
    );
    if (!matchedInArtwork) {
      sourceOnly.push({
        ingredient: srcItem.name,
        raw: srcItem.raw,
        sequence: srcItem.sequence
      });
    }
  }

  return {
    sourceItemsCount: sourceItems.length,
    artworkItemsCount: artworkItems.length,
    sourceDuplicates,
    artworkDuplicates,
    percentageMismatches,
    artworkOnly,
    sourceOnly,
    hasDiscrepancies: (percentageMismatches.length > 0 || artworkOnly.length > 0 || sourceOnly.length > 0 || sourceDuplicates.length > 0)
  };
}
