/**
 * PackSignal FDA 21 CFR 101.9 Rounding Engine (lib/nutrition/rounding.mjs)
 * Implements nutrient-specific statutory rounding rules and inverse interval calculation.
 */

export function roundCalories(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n < 5) return 0;
  if (n <= 50) return Math.round(n / 5) * 5;
  return Math.round(n / 10) * 10;
}

export function roundTotalFat(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0.5) return 0;
  if (n < 5) return Math.round(n * 2) / 2; // nearest 0.5 g
  return Math.round(n); // nearest 1 g
}

export function roundSaturatedFat(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0.5) return 0;
  if (n < 5) return Math.round(n * 2) / 2; // nearest 0.5 g
  return Math.round(n); // nearest 1 g
}

export function roundTransFat(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0.5) return 0;
  return Math.round(n * 2) / 2; // nearest 0.5 g
}

export function roundCholesterol(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n < 2) return 0;
  if (n <= 5) return 5; // "less than 5 mg" represented numerically as 5 or threshold
  return Math.round(n / 5) * 5;
}

export function roundSodium(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n < 5) return 0;
  if (n <= 140) return Math.round(n / 5) * 5;
  return Math.round(n / 10) * 10;
}

export function roundCarbohydrate(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0.5) return 0;
  if (n < 1) return 1; // "less than 1 g"
  return Math.round(n);
}

export function roundDietaryFiber(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0.5) return 0;
  if (n < 1) return 1;
  return Math.round(n);
}

export function roundSugars(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0.5) return 0;
  if (n < 1) return 1;
  return Math.round(n);
}

export function roundProtein(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0.5) return 0;
  if (n < 1) return 1;
  return Math.round(n);
}

export function roundDailyValuePercent(rawPercent) {
  const p = Number(rawPercent);
  if (!Number.isFinite(p) || p <= 0) return 0;
  if (p < 1) return Math.round(p * 10) / 10; // e.g. 0.5%
  return Math.round(p); // 2016 rules standard: whole percent
}

/**
 * Alternative permitted FDA rounding for vitamins & minerals (21 CFR 101.9(c)(8)(iii))
 * <= 10%: nearest 2% or nearest whole percent
 * 10% - 50%: nearest 5% or nearest whole percent
 * > 50%: nearest 10% or nearest whole percent
 */
export function getPermittedVitaminMineralDvOptions(rawPercent) {
  const p = Number(rawPercent);
  if (!Number.isFinite(p) || p <= 0) return [0];
  const standard = Math.round(p);
  const options = new Set([standard]);

  if (p < 10) {
    options.add(Math.round(p / 2) * 2);
  } else if (p <= 50) {
    options.add(Math.round(p / 5) * 5);
  } else {
    options.add(Math.round(p / 10) * 10);
  }

  return Array.from(options).sort((a, b) => a - b);
}

export function roundNutrientAmount(nutrientId, unroundedValue) {
  switch (nutrientId) {
    case 'calories': return roundCalories(unroundedValue);
    case 'total_fat': return roundTotalFat(unroundedValue);
    case 'saturated_fat': return roundSaturatedFat(unroundedValue);
    case 'trans_fat': return roundTransFat(unroundedValue);
    case 'cholesterol': return roundCholesterol(unroundedValue);
    case 'sodium': return roundSodium(unroundedValue);
    case 'total_carbohydrate': return roundCarbohydrate(unroundedValue);
    case 'dietary_fiber': return roundDietaryFiber(unroundedValue);
    case 'total_sugars':
    case 'added_sugars': return roundSugars(unroundedValue);
    case 'protein': return roundProtein(unroundedValue);
    default: return Math.round(Number(unroundedValue));
  }
}

export const roundNutrientValue = roundNutrientAmount;


/**
 * Returns the compatible underlying continuous interval [min, max] that would round to declaredRounded.
 */
export function compatibleUnderlyingInterval(nutrientId, declaredRounded) {
  const d = Number(declaredRounded);
  if (!Number.isFinite(d)) return [0, 0];

  switch (nutrientId) {
    case 'calories':
      if (d === 0) return [0, 5];
      if (d <= 50) return [d - 2.5, d + 2.5];
      return [d - 5, d + 5];

    case 'total_fat':
    case 'saturated_fat':
      if (d === 0) return [0, 0.5];
      if (d < 5) return [d - 0.25, d + 0.25];
      return [d - 0.5, d + 0.5];

    case 'sodium':
      if (d === 0) return [0, 5];
      if (d <= 140) return [d - 2.5, d + 2.5];
      return [d - 5, d + 5];

    case 'total_carbohydrate':
    case 'dietary_fiber':
    case 'total_sugars':
    case 'added_sugars':
    case 'protein':
      if (d === 0) return [0, 0.5];
      return [d - 0.5, d + 0.5];

    default:
      return [d - 0.5, d + 0.5];
  }
}

