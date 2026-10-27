/**
 * PackSignal Product Family — Cross-Contamination Screening Engine
 * (lib/product-family/cross-contamination.mjs)
 *
 * Implements Step 11, 12, 13, 14 of Phase 6:
 * Detects sibling-SKU variant carryover, wrong barcode assignment,
 * and formulation/allergen contamination without guessing.
 */

import { normal, equalQuantity, evidence, tokenSequencePresent } from '../engine.mjs';
import { hasValidGtinCheckDigit, canonicalGtin } from '../gtin.mjs';

function fieldMatchesBarcode(value, text) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 8) return false;
  const separated = digits.split('').join('[\\s-]*');
  return new RegExp(`(?<!\\d)${separated}(?!\\d)`).test(String(text || ''));
}

/**
 * Screens an artwork document for cross-contamination against sibling product records.
 */
export function screenCrossContamination({
  activeProduct,
  siblingProducts = [],
  artworkDocument = null,
  review = {},
  reviewerDecisions = {}
}) {
  if (!activeProduct || !artworkDocument || siblingProducts.length === 0) {
    return {
      evaluated: false,
      activeSku: activeProduct?.sku || null,
      findings: [],
      candidates: []
    };
  }

  const artText = String(artworkDocument.text || '');
  const findings = [];
  const candidates = [];

  // Active product normalized values
  const activeNormalized = {
    productName: normal(activeProduct.productName),
    variant: normal(activeProduct.variant),
    sku: normal(activeProduct.sku),
    netQuantity: activeProduct.netQuantity,
    ingredients: normal(activeProduct.ingredients),
    allergens: normal(activeProduct.allergens),
    gtin: activeProduct.gtin ? canonicalGtin(activeProduct.gtin) : null
  };

  // 1. Barcode Cross-Contamination
  const codes = (artworkDocument.pages || []).flatMap(page => (page.codes || []).map(code => ({ page, code })));
  for (const { page, code } of codes) {
    const rawGtin = String(code.gtin || '').replace(/\D/g, '');
    if (!rawGtin || rawGtin.length < 8) continue;

    const isValidCheck = hasValidGtinCheckDigit(rawGtin);
    const decodedCanonical = canonicalGtin(rawGtin);

    // Check if barcode matches a sibling product instead of the active product
    for (const sibling of siblingProducts) {
      if (!sibling.gtin) continue;
      const siblingCanonical = canonicalGtin(sibling.gtin);

      if (decodedCanonical === siblingCanonical && activeNormalized.gtin && decodedCanonical !== activeNormalized.gtin) {
        const decisionKey = `cross-sku-barcode:${sibling.sku || sibling.sourceRow}`;
        const isAcknowledged = reviewerDecisions[decisionKey]?.status === 'INTENTIONAL_CROSS_PROMOTION';

        const codeEv = {
          documentId: artworkDocument.id,
          name: artworkDocument.name,
          role: 'artwork',
          quote: `Decoded GTIN ${rawGtin}`,
          page: page.number,
          box: code.box || null,
          location: `Page ${page.number}`
        };

        const siblingEv = sibling.sourceCells?.barcode ? {
          documentId: sibling.sourceDocumentId,
          name: 'Product Family Catalog',
          role: 'spec',
          quote: sibling.gtin,
          location: `${sibling.sourceSheet}!${sibling.sourceCells.barcode.cell}`,
          sheet: sibling.sourceSheet,
          cell: sibling.sourceCells.barcode.cell,
          row: sibling.sourceRow
        } : null;

        const activeEv = activeProduct.sourceCells?.barcode ? {
          documentId: activeProduct.sourceDocumentId,
          name: 'Product Family Catalog',
          role: 'spec',
          quote: activeProduct.gtin,
          location: `${activeProduct.sourceSheet}!${activeProduct.sourceCells.barcode.cell}`,
          sheet: activeProduct.sourceSheet,
          cell: activeProduct.sourceCells.barcode.cell,
          row: activeProduct.sourceRow
        } : null;

        findings.push({
          id: `cross-sku-gtin:${sibling.sku || sibling.sourceRow}:${rawGtin}`,
          key: `cross-sku-gtin:${sibling.sku || sibling.sourceRow}`,
          title: `Decoded barcode belongs to sibling SKU (${sibling.displayName})`,
          status: isAcknowledged ? 'review' : 'issue',
          category: 'CROSS_SKU_CONTAMINATION',
          field: 'barcode',
          activeSku: activeProduct.sku,
          siblingSku: sibling.sku || sibling.displayName,
          expected: `GTIN ${activeProduct.gtin || 'assigned to active SKU'} (${activeProduct.displayName})`,
          observed: `Decoded GTIN ${rawGtin} matches sibling SKU row (${sibling.displayName})`,
          explanation: `The decoded barcode on the artwork matches sibling product "${sibling.displayName}" (SKU ${sibling.sku || 'N/A'}), not active SKU "${activeProduct.displayName}". Check-digit is valid (${isValidCheck ? 'pass' : 'fail'}), but product assignment conflicts with the family catalog.`,
          evidence: [activeEv, siblingEv, codeEv].filter(Boolean),
          decisionRequired: !isAcknowledged,
          rule: {
            text: 'Barcode SKU assignment check against family catalog. A barcode must match the confirmed target product, not a sibling variant.'
          },
          severity: 'major',
          method: 'cross_sku_barcode_check'
        });

        candidates.push({
          field: 'barcode',
          activeValue: activeProduct.gtin,
          siblingValue: sibling.gtin,
          siblingSku: sibling.sku || sibling.displayName,
          sourceRow: sibling.sourceRow
        });
      }
    }
  }

  // 2. Variant / Product Name Cross-Contamination
  for (const sibling of siblingProducts) {
    const siblingVariant = sibling.variant;
    const siblingName = sibling.productName;

    // Check sibling variant wording in artwork
    if (siblingVariant && siblingVariant.length >= 3) {
      const normSiblingVar = normal(siblingVariant);
      if (normSiblingVar !== activeNormalized.variant && normal(artText).includes(normSiblingVar)) {
        const decisionKey = `cross-sku-variant:${sibling.sku || sibling.sourceRow}`;
        const decision = reviewerDecisions[decisionKey];
        const isIntentional = decision?.status === 'INTENTIONAL_CROSS_PROMOTION';

        const rowEv = sibling.sourceCells?.variant ? {
          documentId: sibling.sourceDocumentId,
          role: 'spec',
          quote: siblingVariant,
          location: `${sibling.sourceSheet}!${sibling.sourceCells.variant.cell}`,
          sheet: sibling.sourceSheet,
          cell: sibling.sourceCells.variant.cell,
          row: sibling.sourceRow
        } : null;

        const artEv = evidence(artworkDocument, siblingVariant);

        findings.push({
          id: `cross-sku-variant:${sibling.sku || sibling.sourceRow}`,
          key: `cross-sku-variant:${sibling.sku || sibling.sourceRow}`,
          title: isIntentional
            ? `Acknowledged cross-promotion: "${siblingVariant}"`
            : `Possible sibling-variant copy: "${siblingVariant}"`,
          status: isIntentional ? 'match' : 'review',
          category: 'CROSS_SKU_CONTAMINATION',
          field: 'variant',
          activeSku: activeProduct.sku,
          siblingSku: sibling.sku || sibling.displayName,
          expected: `Active variant "${activeProduct.variant || activeProduct.displayName}"`,
          observed: `Sibling variant text "${siblingVariant}" appears on artwork`,
          explanation: isIntentional
            ? `Reviewer confirmed this mention of sibling variant "${siblingVariant}" as intentional packaging cross-promotion.`
            : `Wording matching sibling variant "${siblingVariant}" (SKU ${sibling.sku || 'N/A'}) was detected on the artwork. This may represent intentional cross-promotion or accidental copy carryover from another variant. Reviewer confirmation required.`,
          evidence: [rowEv, artEv].filter(Boolean),
          decisionRequired: !isIntentional,
          rule: {
            text: 'Cross-SKU carryover screening. Sibling variant mentions require human review to distinguish intentional cross-promotion from wrong-variant defects.'
          },
          severity: 'minor',
          method: 'cross_sku_variant_screen'
        });

        candidates.push({
          field: 'variant',
          activeValue: activeProduct.variant,
          siblingValue: siblingVariant,
          siblingSku: sibling.sku || sibling.displayName,
          sourceRow: sibling.sourceRow
        });
      }
    }

    // 3. Ingredient Statement Contamination
    // If artwork ingredient list matches a sibling SKU but differs from active SKU
    if (sibling.ingredients && sibling.ingredients.length >= 20 && activeProduct.ingredients) {
      const normSiblingIng = normal(sibling.ingredients);
      const normActiveIng = normal(activeProduct.ingredients);

      if (normSiblingIng !== normActiveIng && normal(artText).includes(normSiblingIng) && !normal(artText).includes(normActiveIng)) {
        const rowEv = sibling.sourceCells?.ingredients ? {
          documentId: sibling.sourceDocumentId,
          role: 'spec',
          quote: sibling.ingredients,
          location: `${sibling.sourceSheet}!${sibling.sourceCells.ingredients.cell}`,
          sheet: sibling.sourceSheet,
          cell: sibling.sourceCells.ingredients.cell,
          row: sibling.sourceRow
        } : null;

        findings.push({
          id: `cross-sku-ingredients:${sibling.sku || sibling.sourceRow}`,
          key: `cross-sku-ingredients:${sibling.sku || sibling.sourceRow}`,
          title: `Ingredient statement matches sibling SKU (${sibling.displayName})`,
          status: 'issue',
          category: 'CROSS_SKU_CONTAMINATION',
          field: 'ingredients',
          activeSku: activeProduct.sku,
          siblingSku: sibling.sku || sibling.displayName,
          expected: `Active formulation: "${activeProduct.ingredients.slice(0, 100)}..."`,
          observed: `Artwork matches sibling formulation: "${sibling.ingredients.slice(0, 100)}..."`,
          explanation: `The extracted artwork ingredient statement matches sibling variant "${sibling.displayName}" (SKU ${sibling.sku || 'N/A'}) instead of active SKU "${activeProduct.displayName}". Inspect formulation rows immediately.`,
          evidence: [rowEv, evidence(artworkDocument, sibling.ingredients.slice(0, 80))].filter(Boolean),
          severity: 'major',
          method: 'cross_sku_ingredients_check'
        });
      }
    }

    // 4. Allergen Statement Contamination
    if (sibling.allergens && sibling.allergens.length >= 8 && activeProduct.allergens) {
      const normSiblingAllergen = normal(sibling.allergens);
      const normActiveAllergen = normal(activeProduct.allergens);

      if (normSiblingAllergen !== normActiveAllergen && normal(artText).includes(normSiblingAllergen) && !normal(artText).includes(normActiveAllergen)) {
        const rowEv = sibling.sourceCells?.allergens ? {
          documentId: sibling.sourceDocumentId,
          role: 'spec',
          quote: sibling.allergens,
          location: `${sibling.sourceSheet}!${sibling.sourceCells.allergens.cell}`,
          sheet: sibling.sourceSheet,
          cell: sibling.sourceCells.allergens.cell,
          row: sibling.sourceRow
        } : null;

        findings.push({
          id: `cross-sku-allergens:${sibling.sku || sibling.sourceRow}`,
          key: `cross-sku-allergens:${sibling.sku || sibling.sourceRow}`,
          title: `Allergen warning matches sibling SKU (${sibling.displayName})`,
          status: 'issue',
          category: 'CROSS_SKU_CONTAMINATION',
          field: 'allergens',
          activeSku: activeProduct.sku,
          siblingSku: sibling.sku || sibling.displayName,
          expected: `Active allergen statement: "${activeProduct.allergens}"`,
          observed: `Artwork contains sibling allergen statement: "${sibling.allergens}"`,
          explanation: `The allergen warning on the artwork matches sibling variant "${sibling.displayName}" (SKU ${sibling.sku || 'N/A'}) instead of the active SKU declaration. Potential allergen misbranding risk.`,
          evidence: [rowEv, evidence(artworkDocument, sibling.allergens)].filter(Boolean),
          severity: 'major',
          method: 'cross_sku_allergen_check'
        });
      }
    }
  }

  return {
    evaluated: true,
    activeSku: activeProduct.sku,
    activeProduct,
    findings,
    candidates
  };
}
