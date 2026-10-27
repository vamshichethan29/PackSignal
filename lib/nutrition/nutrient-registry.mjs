/**
 * PackSignal Canonical Nutrient Registry (lib/nutrition/nutrient-registry.mjs)
 * Defines standardized nutrient identities, aliases, default metric units, and FDA classifications.
 */

export const NUTRIENTS = {
  calories: {
    id: 'calories',
    name: 'Calories',
    category: 'energy',
    defaultUnit: 'kcal',
    allowedUnits: ['kcal', 'cal', 'kJ'],
    mandatory: true,
    hasDailyValue: false
  },
  total_fat: {
    id: 'total_fat',
    name: 'Total Fat',
    category: 'macronutrient',
    defaultUnit: 'g',
    allowedUnits: ['g', 'mg'],
    mandatory: true,
    hasDailyValue: true
  },
  saturated_fat: {
    id: 'saturated_fat',
    name: 'Saturated Fat',
    category: 'macronutrient',
    defaultUnit: 'g',
    allowedUnits: ['g', 'mg'],
    mandatory: true,
    hasDailyValue: true
  },
  trans_fat: {
    id: 'trans_fat',
    name: 'Trans Fat',
    category: 'macronutrient',
    defaultUnit: 'g',
    allowedUnits: ['g', 'mg'],
    mandatory: true,
    hasDailyValue: false // FDA has no DRV for trans fat
  },
  polyunsaturated_fat: {
    id: 'polyunsaturated_fat',
    name: 'Polyunsaturated Fat',
    category: 'macronutrient',
    defaultUnit: 'g',
    allowedUnits: ['g', 'mg'],
    mandatory: false,
    hasDailyValue: false
  },
  monounsaturated_fat: {
    id: 'monounsaturated_fat',
    name: 'Monounsaturated Fat',
    category: 'macronutrient',
    defaultUnit: 'g',
    allowedUnits: ['g', 'mg'],
    mandatory: false,
    hasDailyValue: false
  },
  cholesterol: {
    id: 'cholesterol',
    name: 'Cholesterol',
    category: 'lipid',
    defaultUnit: 'mg',
    allowedUnits: ['mg', 'g'],
    mandatory: true,
    hasDailyValue: true
  },
  sodium: {
    id: 'sodium',
    name: 'Sodium',
    category: 'mineral',
    defaultUnit: 'mg',
    allowedUnits: ['mg', 'g'],
    mandatory: true,
    hasDailyValue: true
  },
  total_carbohydrate: {
    id: 'total_carbohydrate',
    name: 'Total Carbohydrate',
    category: 'macronutrient',
    defaultUnit: 'g',
    allowedUnits: ['g', 'mg'],
    mandatory: true,
    hasDailyValue: true
  },
  dietary_fiber: {
    id: 'dietary_fiber',
    name: 'Dietary Fiber',
    category: 'macronutrient',
    defaultUnit: 'g',
    allowedUnits: ['g', 'mg'],
    mandatory: true,
    hasDailyValue: true
  },
  soluble_fiber: {
    id: 'soluble_fiber',
    name: 'Soluble Fiber',
    category: 'macronutrient',
    defaultUnit: 'g',
    allowedUnits: ['g', 'mg'],
    mandatory: false,
    hasDailyValue: false
  },
  insoluble_fiber: {
    id: 'insoluble_fiber',
    name: 'Insoluble Fiber',
    category: 'macronutrient',
    defaultUnit: 'g',
    allowedUnits: ['g', 'mg'],
    mandatory: false,
    hasDailyValue: false
  },
  total_sugars: {
    id: 'total_sugars',
    name: 'Total Sugars',
    category: 'carbohydrate',
    defaultUnit: 'g',
    allowedUnits: ['g', 'mg'],
    mandatory: true,
    hasDailyValue: false // FDA has no DRV for total sugars
  },
  added_sugars: {
    id: 'added_sugars',
    name: 'Added Sugars',
    category: 'carbohydrate',
    defaultUnit: 'g',
    allowedUnits: ['g', 'mg'],
    mandatory: true,
    hasDailyValue: true
  },
  sugar_alcohol: {
    id: 'sugar_alcohol',
    name: 'Sugar Alcohol',
    category: 'carbohydrate',
    defaultUnit: 'g',
    allowedUnits: ['g', 'mg'],
    mandatory: false,
    hasDailyValue: false
  },
  protein: {
    id: 'protein',
    name: 'Protein',
    category: 'macronutrient',
    defaultUnit: 'g',
    allowedUnits: ['g', 'mg'],
    mandatory: true,
    hasDailyValue: true, // Conditional under 21 CFR 101.9(c)(7)
    conditionalDailyValue: true
  },
  vitamin_d: {
    id: 'vitamin_d',
    name: 'Vitamin D',
    category: 'vitamin',
    defaultUnit: 'mcg',
    allowedUnits: ['mcg', 'µg', 'ug', 'mg', 'IU'],
    mandatory: true,
    hasDailyValue: true
  },
  calcium: {
    id: 'calcium',
    name: 'Calcium',
    category: 'mineral',
    defaultUnit: 'mg',
    allowedUnits: ['mg', 'g'],
    mandatory: true,
    hasDailyValue: true
  },
  iron: {
    id: 'iron',
    name: 'Iron',
    category: 'mineral',
    defaultUnit: 'mg',
    allowedUnits: ['mg', 'g'],
    mandatory: true,
    hasDailyValue: true
  },
  potassium: {
    id: 'potassium',
    name: 'Potassium',
    category: 'mineral',
    defaultUnit: 'mg',
    allowedUnits: ['mg', 'g'],
    mandatory: true,
    hasDailyValue: true
  }
};

const ALIAS_MAP = new Map([
  ['calories', 'calories'],
  ['energy', 'calories'],
  ['energykcal', 'calories'],
  ['energy_kcal', 'calories'],
  ['calorie', 'calories'],
  
  ['totalfat', 'total_fat'],
  ['total_fat', 'total_fat'],
  ['fat', 'total_fat'],
  ['fat_g', 'total_fat'],
  ['fatg', 'total_fat'],
  
  ['saturatedfat', 'saturated_fat'],
  ['saturated_fat', 'saturated_fat'],
  ['satfat', 'saturated_fat'],
  ['saturates', 'saturated_fat'],
  ['saturates_g', 'saturated_fat'],
  ['ofwhichsaturates', 'saturated_fat'],
  
  ['transfat', 'trans_fat'],
  ['trans_fat', 'trans_fat'],
  ['transfattyacids', 'trans_fat'],
  
  ['polyunsaturatedfat', 'polyunsaturated_fat'],
  ['polyunsaturated_fat', 'polyunsaturated_fat'],
  ['polyunsaturates', 'polyunsaturated_fat'],
  
  ['monounsaturatedfat', 'monounsaturated_fat'],
  ['monounsaturated_fat', 'monounsaturated_fat'],
  ['monounsaturates', 'monounsaturated_fat'],
  
  ['cholesterol', 'cholesterol'],
  ['cholest', 'cholesterol'],
  
  ['sodium', 'sodium'],
  ['salt', 'sodium'],
  
  ['totalcarbohydrate', 'total_carbohydrate'],
  ['total_carbohydrate', 'total_carbohydrate'],
  ['totalcarb', 'total_carbohydrate'],
  ['totalcarbs', 'total_carbohydrate'],
  ['carbohydrate', 'total_carbohydrate'],
  ['carbohydrates', 'total_carbohydrate'],
  ['carbohydrate_g', 'total_carbohydrate'],
  ['carbs', 'total_carbohydrate'],
  
  ['dietaryfiber', 'dietary_fiber'],
  ['dietary_fiber', 'dietary_fiber'],
  ['fiber', 'dietary_fiber'],
  ['dietaryfibre', 'dietary_fiber'],
  ['fibre', 'dietary_fiber'],
  ['fiber_g', 'dietary_fiber'],
  
  ['solublefiber', 'soluble_fiber'],
  ['soluble_fiber', 'soluble_fiber'],
  ['insolublefiber', 'insoluble_fiber'],
  ['insoluble_fiber', 'insoluble_fiber'],
  
  ['totalsugars', 'total_sugars'],
  ['total_sugars', 'total_sugars'],
  ['sugars', 'total_sugars'],
  ['sugars_g', 'total_sugars'],
  ['ofwhichsugars', 'total_sugars'],
  
  ['addedsugars', 'added_sugars'],
  ['added_sugars', 'added_sugars'],
  ['includesaddedsugars', 'added_sugars'],
  ['incladdedsugars', 'added_sugars'],
  ['includes_added_sugars', 'added_sugars'],
  
  ['sugaralcohol', 'sugar_alcohol'],
  ['sugar_alcohol', 'sugar_alcohol'],
  ['polyols', 'sugar_alcohol'],
  
  ['protein', 'protein'],
  ['protein_g', 'protein'],
  
  ['vitamind', 'vitamin_d'],
  ['vitamin_d', 'vitamin_d'],
  ['vitd', 'vitamin_d'],
  
  ['calcium', 'calcium'],
  ['iron', 'iron'],
  ['potassium', 'potassium']
]);

const SORTED_ALIASES = Array.from(ALIAS_MAP.entries()).sort((a, b) => b[0].length - a[0].length);

export function normalizeNutrientId(rawName) {
  if (!rawName) return null;
  const clean = String(rawName)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/^nutrition\./i, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');

  if (ALIAS_MAP.has(clean)) {
    return ALIAS_MAP.get(clean);
  }

  // Look for longest matching alias inside string
  for (const [alias, canonical] of SORTED_ALIASES) {
    if (clean.includes(alias)) {
      return canonical;
    }
  }

  return null;
}


export function getNutrientDefinition(nutrientId) {
  const norm = normalizeNutrientId(nutrientId) || nutrientId;
  return NUTRIENTS[norm] || null;
}
