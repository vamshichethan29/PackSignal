/**
 * PackSignal Phase 2 — Deterministic Unit Normalization & Quantity Engine
 * (lib/facts/fact-normalization.mjs)
 * 
 * Implements deterministic packaging unit conversion, commercial display rounding,
 * and strict dimension safety guardrails (mass != volume, oz != fl oz).
 */

export const MASS_CONVERSIONS = {
  g: 1.0,
  gram: 1.0,
  grams: 1.0,
  kg: 1000.0,
  kilogram: 1000.0,
  mg: 0.001,
  milligram: 0.001,
  mcg: 0.000001,
  microgram: 0.000001,
  // Avoirdupois ounce standard: 1 oz = 28.349523125 g
  oz: 28.349523125,
  ounce: 28.349523125,
  ounces: 28.349523125,
  lb: 453.59237,
  lbs: 453.59237,
  pound: 453.59237
};

export const VOLUME_CONVERSIONS = {
  ml: 1.0,
  milliliter: 1.0,
  l: 1000.0,
  liter: 1000.0,
  liters: 1000.0,
  cl: 10.0,
  // US Fluid ounce standard: 1 fl oz = 29.5735295625 mL
  'fl oz': 29.5735295625,
  floz: 29.5735295625,
  'fluid ounce': 29.5735295625,
  'fl. oz.': 29.5735295625
};

export const ENERGY_CONVERSIONS = {
  kcal: 1.0,
  calorie: 0.001,
  calories: 1.0,
  kj: 0.239005736, // 1 kJ = ~0.239 kcal
  joule: 0.000239005736
};

/**
 * Parses a raw value string into a normalized packaging quantity.
 * 
 * @param {string|number} rawVal - Value string like "480g", "16.9 oz", "15 g", "1%".
 * @param {string|null} basis - Serving basis e.g. "per_serving", "per_100g", or null.
 * @returns {object|null} Normalized quantity record or null.
 */
export function parseNormalizedQuantity(rawVal, basis = null) {
  if (rawVal === null || rawVal === undefined) return null;
  const s = String(rawVal).trim();
  if (!s) return null;

  // Percentage check: "1%", "9%"
  const pctMatch = s.match(/^([\d.]+)\s*%$/);
  if (pctMatch) {
    const amt = parseFloat(pctMatch[1]);
    return {
      amount: amt,
      unit: '%',
      dimension: 'percentage',
      basis,
      baseValue: amt / 100.0,
      raw: s
    };
  }

  // Regex for quantity and unit: "480 g", "16.9 oz", "15g", "2.2%*"
  const m = s.match(/^([\d.]+)\s*([a-zA-Z\s.]+)?\*?$/);
  if (!m) return null;

  const num = parseFloat(m[1]);
  if (isNaN(num)) return null;

  let unit = (m[2] || '').trim().toLowerCase();
  unit = unit.replace(/\.$/, ''); // remove trailing dot

  // Mass check
  if (unit in MASS_CONVERSIONS) {
    return {
      amount: num,
      unit: unit,
      dimension: 'mass',
      basis,
      baseValue: num * MASS_CONVERSIONS[unit], // in grams
      baseUnit: 'g',
      raw: s
    };
  }

  // Volume check
  if (unit in VOLUME_CONVERSIONS) {
    return {
      amount: num,
      unit: unit,
      dimension: 'volume',
      basis,
      baseValue: num * VOLUME_CONVERSIONS[unit], // in mL
      baseUnit: 'ml',
      raw: s
    };
  }

  // Energy check
  if (unit in ENERGY_CONVERSIONS) {
    return {
      amount: num,
      unit: unit,
      dimension: 'energy',
      basis,
      baseValue: num * ENERGY_CONVERSIONS[unit], // in kcal
      baseUnit: 'kcal',
      raw: s
    };
  }

  return {
    amount: num,
    unit: unit || null,
    dimension: unit ? 'custom' : 'scalar',
    basis,
    baseValue: num,
    baseUnit: unit || null,
    raw: s
  };
}

/**
 * Checks whether two quantities are equivalent under commercial packaging conversion & rounding.
 * 
 * Rules:
 * 1. Dimensions must match. (Mass != Volume; oz != fl oz).
 * 2. Basis must match if specified. (per-100g cannot compare to per-serving without basis conversion).
 * 3. Commercial rounding tolerance: 480 g vs 16.9 oz:
 *    480 g = 480.0 g. 16.9 oz = 479.11 g. Relative diff ~0.19% <= tolerancePct (default 1.0%).
 * 
 * @param {string|object} val1 - First quantity.
 * @param {string|object} val2 - Second quantity.
 * @param {object} options - Comparison options: tolerancePct, density, basisCheck.
 * @returns {{ equivalent: boolean, reason: string, relDiffPct?: number, dimension?: string }}
 */
export function areQuantitiesEquivalent(val1, val2, options = {}) {
  const { tolerancePct = 1.0, density = null, requireMatchingBasis = true } = options;

  const q1 = typeof val1 === 'object' && val1?.dimension ? val1 : parseNormalizedQuantity(val1);
  const q2 = typeof val2 === 'object' && val2?.dimension ? val2 : parseNormalizedQuantity(val2);

  if (!q1 || !q2) {
    return { equivalent: false, reason: 'One or both quantities could not be parsed.' };
  }

  // Check basis compatibility
  if (requireMatchingBasis && q1.basis && q2.basis && q1.basis !== q2.basis) {
    return {
      equivalent: false,
      reason: `Basis mismatch: "${q1.basis}" vs "${q2.basis}". Cannot compare per-serving to per-100g directly.`
    };
  }

  // Guardrail: Mass vs Volume
  if (q1.dimension !== q2.dimension) {
    if ((q1.dimension === 'mass' && q2.dimension === 'volume') || (q1.dimension === 'volume' && q2.dimension === 'mass')) {
      if (!density) {
        return {
          equivalent: false,
          reason: `Dimension mismatch: cannot convert between mass (${q1.unit || q1.dimension}) and volume (${q2.unit || q2.dimension}) without food density information.`
        };
      }
    } else {
      return {
        equivalent: false,
        reason: `Incompatible dimensions: "${q1.dimension}" (${q1.unit}) vs "${q2.dimension}" (${q2.unit}).`
      };
    }
  }

  // Same base unit comparison
  const maxBase = Math.max(Math.abs(q1.baseValue), Math.abs(q2.baseValue));
  if (maxBase === 0) {
    return { equivalent: true, reason: 'Both zero.', relDiffPct: 0, dimension: q1.dimension };
  }

  const absDiff = Math.abs(q1.baseValue - q2.baseValue);
  const relDiffPct = (absDiff / maxBase) * 100.0;

  if (relDiffPct <= tolerancePct) {
    return {
      equivalent: true,
      reason: `Values are equivalent within ${tolerancePct}% packaging display rounding tolerance (diff: ${relDiffPct.toFixed(2)}%).`,
      relDiffPct,
      dimension: q1.dimension
    };
  }

  return {
    equivalent: false,
    reason: `Significant discrepancy: ${q1.raw} (${q1.baseValue.toFixed(2)} ${q1.baseUnit}) vs ${q2.raw} (${q2.baseValue.toFixed(2)} ${q2.baseUnit}) differs by ${relDiffPct.toFixed(2)}% (exceeds ${tolerancePct}% tolerance).`,
    relDiffPct,
    dimension: q1.dimension
  };
}
