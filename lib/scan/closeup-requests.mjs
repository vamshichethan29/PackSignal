/**
 * PackSignal — Close-Up Request Engine (lib/scan/closeup-requests.mjs)
 * Phase 10A: Determines when targeted macro captures are required for regulatory certainty.
 */

export function evaluateCloseUpRequests(scannedPanels = {}, options = {}) {
  const requests = [];

  for (const [face, panel] of Object.entries(scannedPanels)) {
    if (!panel) continue;

    // 1. Nutrition Facts table too small or blurry
    if (face === 'right' || face === 'back') {
      const hasNutritionHeader = /nutrition\s*facts/i.test(panel.text || '');
      const hasLowContrastOrBlur = panel.hasBlur || panel.sharpness?.variance < 110;
      const isNutritionIncomplete = hasNutritionHeader && !/total\s*fat|sodium|carbohydrate/i.test(panel.text || '');

      if (hasNutritionHeader && (hasLowContrastOrBlur || isNutritionIncomplete)) {
        requests.push({
          id: `closeup-${face}-nutrition`,
          face,
          targetContent: 'Nutrition Facts Table',
          reason: 'Nutrition Facts rows have insufficient resolution to verify individual DV% percentages.',
          suggestedFraming: 'Frame the Nutrition Facts table directly from 10–15 cm under even lighting without glare.',
          affectedRequirements: ['US_FDA_21CFR_101_9', 'NUTRITION_MANDATORY_NUTRIENTS'],
          blockedFindings: ['f-nutrition-dv-calc', 'f-added-sugars'],
          priority: 'high',
          expectedImprovement: 'High-resolution character segmentation for individual calorie and mineral lines.',
        });
      }
    }

    // 2. Allergen Advisory line blurred
    if (face === 'back' || face === 'right') {
      const mentionsAllergen = /contains|allergen|may\s*contain/i.test(panel.text || '');
      const hasDisagreement = panel.dualReader?.status === 'READER_DISCREPANCY' || panel.hasBlur;

      if (mentionsAllergen && hasDisagreement) {
        requests.push({
          id: `closeup-${face}-allergens`,
          face,
          targetContent: 'Statutory Allergen Disclosure',
          reason: 'Allergen statement has low visual contrast or reader disagreement; statutory species cannot be confirmed.',
          suggestedFraming: 'Center the "CONTAINS:" declaration in the viewfinder and hold steady.',
          affectedRequirements: ['US_FALCPA_2004', 'INDIA_FSSAI_ALLERGENS'],
          blockedFindings: ['f-allergen-disclosure'],
          priority: 'high',
          expectedImprovement: 'Unambiguous character recognition of tree nut and cereal allergen species.',
        });
      }
    }

    // 3. Barcode unreadable or guard bars obscured
    if (face === 'bottom' || panel.hasBarcode) {
      const gtin = panel.values?.barcode_gtin || panel.barcode;
      const isUnreadableBarcode = !gtin || gtin.length < 8;

      if (isUnreadableBarcode || panel.hasGlare) {
        requests.push({
          id: `closeup-${face}-barcode`,
          face,
          targetContent: 'GS1 Barcode Symbol',
          reason: 'Barcode symbol modules or quiet zones are obscured by glare or insufficient resolution.',
          suggestedFraming: 'Capture the barcode squarely from perpendicular angle; avoid specular light reflections.',
          affectedRequirements: ['GS1_SPEC_BARCODE_QUALITY', 'BARCODE_CHECKSUM'],
          blockedFindings: ['f-barcode-integrity'],
          priority: 'medium',
          expectedImprovement: 'Accurate decoding of 12-14 digit GTIN and parity verification.',
        });
      }
    }

    // 4. Net quantity font size validation (21 CFR § 101.7 / LM Act)
    if (face === 'front') {
      const hasNetQty = /net\s*(?:wt|weight|quantity)/i.test(panel.text || '');
      const scale = panel.scale;

      if (hasNetQty && (!scale || !scale.valid || scale.pxPerMm < 5)) {
        requests.push({
          id: `closeup-${face}-netqty-scale`,
          face,
          targetContent: 'Net Quantity PDP Typography',
          reason: 'Net weight font height cannot be calibrated without coplanar scale reference card.',
          suggestedFraming: 'Place the calibration reference card adjacent to the Net Quantity statement on the front panel.',
          affectedRequirements: ['US_FDA_21CFR_101_7_LETTER_HEIGHT', 'INDIA_LM_PACKAGED_COMMODITIES'],
          blockedFindings: ['f-net-quantity-height'],
          priority: 'medium',
          expectedImprovement: 'Calibrated millimeter font height measurement with sub-0.2mm precision.',
        });
      }
    }
  }

  return {
    needsCloseUp: requests.length > 0,
    totalRequests: requests.length,
    requests,
  };
}
