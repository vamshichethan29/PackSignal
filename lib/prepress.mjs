const MM_PER_POINT = 25.4 / 72;

const compact = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const normal = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/(?<=\d)\.(?=\d)/g, 'decimalpoint').replace(/[^\p{L}\p{N}%]+/gu, '');

export function estimatedHeightMm(page, box) {
  if (!page || !Array.isArray(box) || !Number.isFinite(page.height)) return null;
  const height = Math.max(0, Number(box[3]) - Number(box[1]));
  return height ? height * Number(page.height) * MM_PER_POINT : null;
}

export function textHasVisualAllergenCue(text, allergenStatement) {
  const raw = compact(text);
  const terms = compact(allergenStatement)
    .replace(/^contains\s*:?/i, '')
    .split(/,|;|\band\b/i)
    .map(term => term.replace(/[^\p{L}\p{N}]/gu, '').trim())
    .filter(term => term.length > 2);
  const hasExplicitContains = /\bCONTAINS\s*:/u.test(raw);
  const highlightedTerms = terms.filter(term => {
    const match = raw.match(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'iu'))?.[0] || '';
    return Boolean(match) && match === match.toUpperCase();
  });
  return { terms, hasExplicitContains, highlightedTerms, hasCue: hasExplicitContains || highlightedTerms.length > 0 };
}

export function boxInsideZone(box, zone) {
  if (!Array.isArray(box) || !Array.isArray(zone) || box.length !== 4 || zone.length !== 4) return false;
  const centerX = (Number(box[0]) + Number(box[2])) / 2;
  const centerY = (Number(box[1]) + Number(box[3])) / 2;
  return centerX >= Number(zone[0]) && centerX <= Number(zone[2]) && centerY >= Number(zone[1]) && centerY <= Number(zone[3]);
}

import { calculateAtwater, checkMassBalance } from './nutrition/atwater.mjs';
import { evaluatePackQuantityConsistency } from './pack-quantity-consistency.mjs';

export function nutritionSanityFacts(facts) {
  const numbers = new Map();
  for (const fact of facts || []) {
    if (!fact.field?.startsWith('nutrition.')) continue;
    const match = String(fact.value).match(/-?\d+(?:\.\d+)?/);
    if (match && !numbers.has(fact.field)) numbers.set(fact.field, Number(match[0]));
  }
  const get = (...names) => names.map(name => numbers.get(`nutrition.${name}`)).find(Number.isFinite);
  const results = [];
  const calories = get('energy_kcal', 'calories');
  const protein = get('protein_g', 'protein');
  const carbohydrate = get('carbohydrate_g', 'totalcarbohydrate');
  const fat = get('fat_g', 'totalfat');
  const value = field => String((facts || []).find(fact => fact.field === field)?.value || '');
  const amount = source => {
    const match = source.match(/(\d+(?:\.\d+)?)\s*(kg|mg|g|ml|cl|l|oz)\b/i);
    if (!match) return null;
    const unit = match[2].toLowerCase();
    return { value: Number(match[1]) * ({ kg: 1000, g: 1, mg: 0.001, l: 1000, cl: 10, ml: 1, oz: 28.349523125 }[unit]), dimension: ['l', 'cl', 'ml'].includes(unit) ? 'volume' : 'mass', unit: ['l', 'cl', 'ml'].includes(unit) ? 'mL' : 'g' };
  };
  const serving = amount(value('serving_size'));
  if ([calories, protein, carbohydrate, fat].every(Number.isFinite)) {
    const atwater = calculateAtwater({
      fatGrams: fat,
      carbohydrateGrams: carbohydrate,
      proteinGrams: protein,
      declaredCalories: calories
    });
    const massBalance = checkMassBalance({
      fatGrams: fat,
      carbohydrateGrams: carbohydrate,
      proteinGrams: protein,
      servingSizeGrams: serving?.value
    });
    const difference = Math.abs(calories - atwater.totalCalories) / Math.max(calories, atwater.totalCalories, 1);
    results.push({
      type: 'atwater',
      calories,
      estimate: atwater.totalCalories,
      difference,
      passes: difference <= 0.2,
      atwater,
      massBalance,
      proof: atwater.formula,
      proofSteps: atwater.proofSteps,
      macronutrients: atwater.macronutrients,
      limitations: atwater.limitations
    });
  }
  const sugars = get('sugars_g', 'totalsugars', 'incladdedsugars');
  if ([sugars, carbohydrate].every(Number.isFinite)) results.push({ type: 'sugars', lower: sugars, upper: carbohydrate, passes: sugars <= carbohydrate });
  const saturates = get('saturates_g', 'saturatedfat');
  if ([saturates, fat].every(Number.isFinite)) results.push({ type: 'saturates', lower: saturates, upper: fat, passes: saturates <= fat });
  const rawServings = value('servings');
  const rawServingSize = value('serving_size');
  const rawNetQty = value('net_quantity');

  const packQtyResult = evaluatePackQuantityConsistency({
    servings: rawServings,
    servingSize: rawServingSize,
    netQuantity: rawNetQty
  });

  const quantitySignalCount = (rawServings ? 1 : 0) + (rawServingSize ? 1 : 0) + (rawNetQty ? 1 : 0);
  if (quantitySignalCount >= 2) {
    const net = amount(rawNetQty);
    const servings = Number(rawServings?.match(/\d+(?:\.\d+)?/)?.[0]);
    results.push({
      type: 'serving-quantity',
      estimated: packQtyResult.expectedPackMassG ?? (serving && Number.isFinite(servings) ? serving.value * servings : 0),
      net: packQtyResult.declaredPackMassG ?? (net ? net.value : 0),
      difference: packQtyResult.percentDifference != null ? packQtyResult.percentDifference / 100 : 0,
      unit: net?.unit || 'g',
      passes: packQtyResult.passes,
      packQuantity: packQtyResult
    });
  }
  return results;
}
