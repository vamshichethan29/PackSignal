/**
 * PackSignal Text Revision Diff Engine (lib/text-revision-diff.mjs)
 * Compares native PDF text and verified transcriptions between V1 and V2 artwork.
 * Identifies added, removed, and modified wording, numbers, units, and statutory phrases.
 */

function tokenize(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeToken(token) {
  return token.toLowerCase().replace(/[.,!?;:()"'“”‘’[\]{}—]/g, '');
}

/**
 * Computes word-level diff between two text strings
 */
export function diffTextBlocks(v1Text = '', v2Text = '') {
  const v1Tokens = tokenize(v1Text);
  const v2Tokens = tokenize(v2Text);

  const v1Norm = v1Tokens.map(normalizeToken);
  const v2Norm = v2Tokens.map(normalizeToken);

  const v1Set = new Set(v1Norm.filter(Boolean));
  const v2Set = new Set(v2Norm.filter(Boolean));

  const removed = v1Tokens.filter((t, i) => !v2Set.has(v1Norm[i]));
  const added = v2Tokens.filter((t, i) => !v1Set.has(v2Norm[i]));

  // Check for numerical value alterations
  const numRegex = /\b\d+(?:\.\d+)?\b/g;
  const v1Numbers = (String(v1Text).match(numRegex) || []);
  const v2Numbers = (String(v2Text).match(numRegex) || []);

  const numbersRemoved = v1Numbers.filter(n => !v2Numbers.includes(n));
  const numbersAdded = v2Numbers.filter(n => !v1Numbers.includes(n));

  // Check for unit changes (e.g. mL vs L, g vs oz)
  const unitRegex = /\b(ml|l|g|kg|oz|fl\s*oz|pt|qt|lb)\b/gi;
  const v1Units = (String(v1Text).match(unitRegex) || []).map(u => u.toLowerCase());
  const v2Units = (String(v2Text).match(unitRegex) || []).map(u => u.toLowerCase());

  const unitsChanged = v1Units.some((u, i) => v2Units[i] && v2Units[i] !== u);

  const hasChanges = removed.length > 0 || added.length > 0 || numbersRemoved.length > 0 || numbersAdded.length > 0;

  return {
    hasChanges,
    tokenCounts: { v1: v1Tokens.length, v2: v2Tokens.length },
    removed,
    added,
    numbersRemoved,
    numbersAdded,
    unitsChanged,
    summary: !hasChanges
      ? 'Identical text content'
      : `${removed.length} words removed, ${added.length} words added${numbersAdded.length ? ` (numerical changes: ${numbersAdded.join(', ')})` : ''}`,
  };
}

/**
 * Compares known product packaging sections across revisions
 */
export function comparePackagingSections(prevReview, currReview) {
  const sections = [
    { field: 'brand_name', label: 'Brand Name' },
    { field: 'product_name', label: 'Product Name' },
    { field: 'variant', label: 'Variant' },
    { field: 'net_quantity', label: 'Net Quantity' },
    { field: 'ingredients', label: 'Ingredient List' },
    { field: 'allergen_statement', label: 'Allergen Statement' },
    { field: 'storage_instructions', label: 'Storage Copy' },
    { field: 'claims', label: 'Marketing / Environmental Claims' },
    { field: 'manufacturer_contact', label: 'Manufacturer / Contact Copy' },
    { field: 'nutrition_facts', label: 'Nutrition Facts' },
  ];

  const results = [];

  for (const s of sections) {
    const prevObserved = (prevReview.findings || []).find(f => f.rule?.field === s.field || f.id?.includes(s.field))?.observed || '';
    const currObserved = (currReview.findings || []).find(f => f.rule?.field === s.field || f.id?.includes(s.field))?.observed || '';

    if (!prevObserved && !currObserved) continue;

    const diff = diffTextBlocks(prevObserved, currObserved);
    results.push({
      field: s.field,
      label: s.label,
      previous: prevObserved,
      current: currObserved,
      hasChanges: diff.hasChanges,
      diff,
    });
  }

  return results;
}
