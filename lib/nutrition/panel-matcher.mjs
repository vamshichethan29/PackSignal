/**
 * lib/nutrition/panel-matcher.mjs
 * 
 * Matches source nutrient records with artwork nutrition panel records.
 * Respects source authority, serving basis, unit compatibility, and multi-panel mapping.
 */

import { convertUnits, areUnitsCompatible } from './units.mjs';
import { convertServingBasis } from './serving-basis.mjs';

/**
 * Matches source nutrients to artwork nutrients across detected panels.
 * 
 * @param {Object} params
 * @param {Array<Object>} params.sourceNutrients - Normalized source records
 * @param {Array<Object>} params.panels - Detected artwork panels
 * @param {string} params.sourceAuthority - Source authority level
 * @param {Object} params.options - Review options (e.g., nutritionVariant, confirmed basis)
 * @returns {Array<Object>} Matched nutrient comparison pairs
 */
export function matchNutrientRecords({
  sourceNutrients = [],
  panels = [],
  sourceAuthority = 'UNKNOWN',
  options = {}
}) {
  const comparisons = [];
  const primaryPanel = panels[0] || null;

  if (!primaryPanel) {
    // If no artwork panels detected, we can still report source records as uncompared
    for (const src of sourceNutrients) {
      comparisons.push({
        comparisonId: `cmp:${src.nutrientId}:no-panel`,
        nutrientId: src.nutrientId,
        canonicalName: src.canonicalName,
        sourceRecord: src,
        artworkRecord: null,
        panelId: null,
        columnId: null,
        status: 'UNABLE',
        matchReason: 'No Nutrition Facts panel detected on artwork',
        sourceAuthority,
        limitations: ['Artwork panel missing or unreadable']
      });
    }
    return comparisons;
  }

  // Iterate over detected panels and their columns
  for (const panel of panels) {
    for (const col of panel.columns) {
      // Find artwork nutrients in this panel/column
      const artNutrients = panel.nutrientRecords.filter(r => r.columnId === col.id);
      const artMap = new Map(artNutrients.map(r => [r.nutrientId, r]));

      for (const src of sourceNutrients) {
        const art = artMap.get(src.nutrientId);

        // Check basis compatibility
        let convertedSourceValue = src.value;
        let conversionProof = null;
        let basisMismatch = false;

        if (art) {
          if (src.basis !== art.basis) {
            // Need serving basis conversion
            if (panel.servingSizeGrams && panel.servingSizeUnit) {
              const conv = convertServingBasis({
                amount: src.value,
                sourceBasis: src.basis,
                targetBasis: art.basis,
                servingSize: panel.servingSizeGrams,
                servingSizeUnit: panel.servingSizeUnit
              });
              if (conv.success) {
                convertedSourceValue = conv.convertedAmount;
                conversionProof = conv.proof;
              } else {
                basisMismatch = true;
              }
            } else {
              basisMismatch = true;
            }
          }

          // Check unit compatibility
          let unitMismatch = false;
          let convertedUnitValue = convertedSourceValue;
          if (src.unit && art.printedUnit && src.unit.toLowerCase() !== art.printedUnit.toLowerCase()) {
            if (areUnitsCompatible(src.unit, art.printedUnit)) {
              const uConv = convertUnits(convertedSourceValue, src.unit, art.printedUnit);
              if (uConv.success) {
                convertedUnitValue = uConv.convertedValue;
              } else {
                unitMismatch = true;
              }
            } else {
              unitMismatch = true;
            }
          }

          // Determine initial match status
          let status = 'REVIEW';
          let matchReason = '';
          const limitations = [];

          if (src.ambiguous || !options.nutritionBasisConfirmed && src.variants?.length > 1) {
            status = 'REVIEW';
            matchReason = 'Source has multiple nutrition variants; serving basis confirmation required';
            limitations.push('Ambiguous source column');
          } else if (basisMismatch) {
            status = 'REVIEW';
            matchReason = `Serving basis mismatch between source (${src.basis}) and artwork (${art.basis}) without verified serving size`;
            limitations.push('Serving basis unconfirmed');
          } else if (unitMismatch) {
            status = 'UNABLE';
            matchReason = `Dimensionally incompatible units: source ${src.unit} vs artwork ${art.printedUnit}`;
            limitations.push('Unit dimension mismatch');
          } else {
            // Units and basis are aligned
            status = 'ALIGNED';
            matchReason = 'Source and artwork records successfully mapped';
          }

          comparisons.push({
            comparisonId: `cmp:${src.nutrientId}:${panel.panelId}:${col.id}`,
            nutrientId: src.nutrientId,
            canonicalName: src.canonicalName,
            panelId: panel.panelId,
            columnId: col.id,
            basis: art.basis,
            sourceRecord: src,
            artworkRecord: art,
            convertedSourceValue: convertedUnitValue,
            targetUnit: art.printedUnit || src.unit,
            conversionProof,
            status,
            matchReason,
            sourceAuthority,
            limitations
          });

          artMap.delete(src.nutrientId);
        } else {
          // Source nutrient has no artwork counterpart in this column
          comparisons.push({
            comparisonId: `cmp:${src.nutrientId}:${panel.panelId}:${col.id}:missing-artwork`,
            nutrientId: src.nutrientId,
            canonicalName: src.canonicalName,
            panelId: panel.panelId,
            columnId: col.id,
            basis: col.basis,
            sourceRecord: src,
            artworkRecord: null,
            status: 'REVIEW',
            matchReason: 'Nutrient present in source specification but not detected on artwork panel',
            sourceAuthority,
            limitations: ['Artwork nutrient declaration missing']
          });
        }
      }

      // Any remaining artwork nutrients without source records
      for (const [nutId, art] of artMap.entries()) {
        comparisons.push({
          comparisonId: `cmp:${nutId}:${panel.panelId}:${col.id}:missing-source`,
          nutrientId: nutId,
          canonicalName: art.canonicalName,
          panelId: panel.panelId,
          columnId: col.id,
          basis: art.basis,
          sourceRecord: null,
          artworkRecord: art,
          status: 'REVIEW',
          matchReason: 'Nutrient declared on artwork but missing from approved source specification',
          sourceAuthority,
          limitations: ['Source specification nutrient missing']
        });
      }
    }
  }

  return comparisons;
}
