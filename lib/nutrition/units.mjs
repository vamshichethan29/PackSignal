/**
 * PackSignal Unit Conversion & Dimensional Compatibility Engine (lib/nutrition/units.mjs)
 * Implements typed, dimensionally safe conversions with bounded precision.
 */

const DIMENSIONS = {
  // Mass in grams (g)
  kg: { dimension: 'mass', toBase: 1000 },
  g: { dimension: 'mass', toBase: 1 },
  mg: { dimension: 'mass', toBase: 0.001 },
  mcg: { dimension: 'mass', toBase: 0.000001 },
  'µg': { dimension: 'mass', toBase: 0.000001 },
  ug: { dimension: 'mass', toBase: 0.000001 },
  oz: { dimension: 'mass', toBase: 28.349523125 },
  lb: { dimension: 'mass', toBase: 453.59237 },

  // Volume in milliliters (mL)
  l: { dimension: 'volume', toBase: 1000 },
  cl: { dimension: 'volume', toBase: 10 },
  ml: { dimension: 'volume', toBase: 1 },
  'fl oz': { dimension: 'volume', toBase: 29.5735295625 },
  floz: { dimension: 'volume', toBase: 29.5735295625 },

  // Energy in kilocalories (kcal)
  kcal: { dimension: 'energy', toBase: 1 },
  cal: { dimension: 'energy', toBase: 0.001 },
  kj: { dimension: 'energy', toBase: 1 / 4.184 },

  // Ratio / percentage
  '%': { dimension: 'ratio', toBase: 0.01 },

  // Discrete counts
  serving: { dimension: 'count', toBase: 1 },
  piece: { dimension: 'count', toBase: 1 },
  unit: { dimension: 'count', toBase: 1 }
};

export function normalizeUnit(rawUnit) {
  if (!rawUnit) return '';
  const clean = String(rawUnit).trim().toLowerCase();
  if (['mcg', 'µg', 'ug'].includes(clean)) return 'mcg';
  if (clean === 'fl oz' || clean === 'floz' || clean === 'fl. oz.') return 'fl oz';
  if (clean === 'ml' || clean === 'milliliter' || clean === 'millilitre') return 'mL';
  if (clean === 'l' || clean === 'liter' || clean === 'litre') return 'L';
  if (clean === 'g' || clean === 'gram' || clean === 'grams') return 'g';
  if (clean === 'mg' || clean === 'milligram' || clean === 'milligrams') return 'mg';
  if (clean === 'kg' || clean === 'kilogram') return 'kg';
  if (clean === 'kcal' || clean === 'calories' || clean === 'calorie') return 'kcal';
  if (clean === 'kj' || clean === 'kilojoule' || clean === 'kilojoules') return 'kJ';
  if (clean === '%') return '%';
  return clean;
}

export function getUnitDimension(unit) {
  const norm = normalizeUnit(unit).toLowerCase();
  return DIMENSIONS[norm]?.dimension || 'unknown';
}

/**
 * Converts a numeric value between compatible units.
 * Throws or returns an error object if dimensions are incompatible.
 */
export function convertUnits(value, fromUnit, toUnit, options = {}) {
  const val = Number(value);
  if (!Number.isFinite(val)) {
    return { ok: false, error: 'Invalid numeric value for conversion' };
  }

  const uFrom = normalizeUnit(fromUnit).toLowerCase();
  const uTo = normalizeUnit(toUnit).toLowerCase();

  if (uFrom === uTo) {
    return { ok: true, value: val, fromUnit, toUnit, conversionFactor: 1 };
  }

  const defFrom = DIMENSIONS[uFrom];
  const defTo = DIMENSIONS[uTo];

  if (!defFrom || !defTo) {
    return {
      ok: false,
      error: `Unsupported unit in conversion: "${fromUnit}" -> "${toUnit}"`
    };
  }

  // Cross-dimension check (e.g. Mass to Volume)
  if (defFrom.dimension !== defTo.dimension) {
    if (defFrom.dimension === 'mass' && defTo.dimension === 'volume') {
      if (options.densityGPerMl && Number(options.densityGPerMl) > 0) {
        const grams = val * defFrom.toBase;
        const ml = grams / Number(options.densityGPerMl);
        const finalVal = ml / defTo.toBase;
        return {
          ok: true,
          value: Number(finalVal.toFixed(6)),
          fromUnit,
          toUnit,
          densityUsed: options.densityGPerMl
        };
      }
      return {
        ok: false,
        dimensionallyInvalid: true,
        error: `Cannot convert mass (${fromUnit}) to volume (${toUnit}) without verified product density.`
      };
    }

    if (defFrom.dimension === 'volume' && defTo.dimension === 'mass') {
      if (options.densityGPerMl && Number(options.densityGPerMl) > 0) {
        const ml = val * defFrom.toBase;
        const grams = ml * Number(options.densityGPerMl);
        const finalVal = grams / defTo.toBase;
        return {
          ok: true,
          value: Number(finalVal.toFixed(6)),
          fromUnit,
          toUnit,
          densityUsed: options.densityGPerMl
        };
      }
      return {
        ok: false,
        dimensionallyInvalid: true,
        error: `Cannot convert volume (${fromUnit}) to mass (${toUnit}) without verified product density.`
      };
    }

    return {
      ok: false,
      dimensionallyInvalid: true,
      error: `Incompatible dimensions: cannot convert ${defFrom.dimension} (${fromUnit}) to ${defTo.dimension} (${toUnit}).`
    };
  }

  // Dimensionally identical conversion
  const baseValue = val * defFrom.toBase;
  const targetValue = baseValue / defTo.toBase;
  const factor = defFrom.toBase / defTo.toBase;

  return {
    ok: true,
    success: true,
    value: Number(targetValue.toFixed(6)),
    convertedValue: Number(targetValue.toFixed(6)),
    fromUnit,
    toUnit,
    conversionFactor: factor
  };
}

export function areUnitsCompatible(unitA, unitB, options = {}) {
  const dimA = getUnitDimension(unitA);
  const dimB = getUnitDimension(unitB);
  if (dimA === 'unknown' || dimB === 'unknown') return false;
  if (dimA === dimB) return true;
  if ((dimA === 'mass' && dimB === 'volume') || (dimA === 'volume' && dimB === 'mass')) {
    return Boolean(options.densityGPerMl && Number(options.densityGPerMl) > 0);
  }
  return false;
}

export function validateConversion(fromUnit, toUnit, options = {}) {
  const compatible = areUnitsCompatible(fromUnit, toUnit, options);
  const dimFrom = getUnitDimension(fromUnit);
  const dimTo = getUnitDimension(toUnit);
  return {
    compatible,
    dimFrom,
    dimTo,
    requiresDensity: (dimFrom === 'mass' && dimTo === 'volume') || (dimFrom === 'volume' && dimTo === 'mass')
  };
}

