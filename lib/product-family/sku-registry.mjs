/**
 * PackSignal Product Family — SKU Registry & Canonical Model
 * (lib/product-family/sku-registry.mjs)
 *
 * Implements Step 8, 9, 10 of Phase 6:
 * Product-family representation, active SKU resolution, and source-cell provenance.
 */

import { normal } from '../engine.mjs';

export const SKU_IDENTITY_STATES = {
  CONFIRMED_SKU: 'CONFIRMED_SKU',
  PROVISIONAL_SKU: 'PROVISIONAL_SKU',
  CONFLICTED_SKU: 'CONFLICTED_SKU',
  UNKNOWN_SKU: 'UNKNOWN_SKU'
};

export const SKU_COLUMN_ALIASES = {
  sku: ['sku', 'itemnumber', 'productcode', 'item_code', 'material_number'],
  variant: ['variant', 'flavor', 'flavour', 'variety', 'scent'],
  productName: ['productname', 'product', 'item_description', 'title'],
  netQuantity: ['netquantity', 'netweight', 'packagesize', 'packageweight', 'size', 'volume'],
  ingredients: ['ingredients', 'ingredientlist', 'formulation'],
  allergens: ['allergenstatement', 'allergeninformation', 'allergens', 'contains'],
  barcode: ['upc', 'barcode', 'gtin', 'ean', 'upc_code'],
  market: ['market', 'country', 'jurisdiction', 'region'],
  status: ['status', 'approvalstatus', 'approval_status', 'version']
};

/**
 * Normalizes a product record from parsed spreadsheet row cells.
 */
export function createProductRecord({
  sku = '',
  gtin = '',
  productName = '',
  variant = '',
  netQuantity = '',
  ingredients = '',
  allergens = '',
  market = '',
  status = 'active',
  sourceDocumentId = '',
  sourceDocumentHash = '',
  sourceSheet = '',
  sourceRow = 0,
  sourceCells = {}
}) {
  return {
    sku: String(sku || '').trim(),
    gtin: String(gtin || '').trim(),
    productName: String(productName || '').trim(),
    variant: String(variant || '').trim(),
    netQuantity: String(netQuantity || '').trim(),
    ingredients: String(ingredients || '').trim(),
    allergens: String(allergens || '').trim(),
    market: String(market || '').trim(),
    sourceApprovalStatus: String(status || '').trim(),
    sourceDocumentId,
    sourceDocumentHash,
    sourceSheet,
    sourceRow,
    sourceCells,
    displayName: variant || productName || sku || `Row ${sourceRow}`
  };
}

/**
 * Resolves the active SKU identity for a review.
 */
export function resolveActiveSku({
  products = [],
  reviewerSelection = null,
  decodedGtin = null,
  artworkText = '',
  sourceSpecSku = null
}) {
  if (products.length === 0) {
    return {
      activeProduct: null,
      identityState: SKU_IDENTITY_STATES.UNKNOWN_SKU,
      reason: 'No product family spreadsheet rows available.'
    };
  }

  // 1. Explicit reviewer confirmed selection
  if (reviewerSelection) {
    const matched = products.find(p => p.sku === reviewerSelection || p.displayName === reviewerSelection);
    if (matched) {
      return {
        activeProduct: matched,
        identityState: SKU_IDENTITY_STATES.CONFIRMED_SKU,
        reason: `Reviewer explicitly confirmed active SKU "${matched.sku || matched.displayName}".`
      };
    }
  }

  // 2. Exact match with source spec SKU
  if (sourceSpecSku) {
    const normSpecSku = normal(sourceSpecSku);
    const matched = products.find(p => normal(p.sku) === normSpecSku);
    if (matched) {
      return {
        activeProduct: matched,
        identityState: SKU_IDENTITY_STATES.CONFIRMED_SKU,
        reason: `Matches SKU "${matched.sku}" from approved product specification document.`
      };
    }
  }

  // 3. Decoded barcode match
  if (decodedGtin) {
    const normGtin = String(decodedGtin).replace(/\D/g, '');
    const matchedByBarcode = products.filter(p => {
      const pGtin = String(p.gtin).replace(/\D/g, '');
      return pGtin && (pGtin === normGtin || normGtin.endsWith(pGtin) || pGtin.endsWith(normGtin));
    });

    if (matchedByBarcode.length === 1) {
      return {
        activeProduct: matchedByBarcode[0],
        identityState: SKU_IDENTITY_STATES.PROVISIONAL_SKU,
        reason: `Provisional SKU based on decoded barcode GTIN "${decodedGtin}". Requires reviewer confirmation.`
      };
    } else if (matchedByBarcode.length > 1) {
      return {
        activeProduct: null,
        identityState: SKU_IDENTITY_STATES.CONFLICTED_SKU,
        reason: `Multiple product records share barcode GTIN "${decodedGtin}".`
      };
    }
  }

  // 4. Unique variant or product name in artwork
  const candidateMatches = products.filter(p => {
    const normVariant = normal(p.variant);
    const normName = normal(p.productName);
    return (normVariant && normal(artworkText).includes(normVariant)) ||
           (normName && normal(artworkText).includes(normName));
  });

  if (candidateMatches.length === 1) {
    return {
      activeProduct: candidateMatches[0],
      identityState: SKU_IDENTITY_STATES.PROVISIONAL_SKU,
      reason: `Provisional SKU based on detected variant/product name "${candidateMatches[0].displayName}". Reviewer confirmation recommended.`
    };
  } else if (candidateMatches.length > 1) {
    return {
      activeProduct: null,
      identityState: SKU_IDENTITY_STATES.CONFLICTED_SKU,
      reason: `Artwork text mentions multiple sibling variants (${candidateMatches.map(c => c.displayName).join(', ')}). Reviewer selection required.`
    };
  }

  // Default to first product if only 1 exists, otherwise unknown
  if (products.length === 1) {
    return {
      activeProduct: products[0],
      identityState: SKU_IDENTITY_STATES.PROVISIONAL_SKU,
      reason: 'Single product record in catalog; provisional assignment.'
    };
  }

  return {
    activeProduct: null,
    identityState: SKU_IDENTITY_STATES.UNKNOWN_SKU,
    reason: 'Could not determine active product SKU unambiguously from artwork or barcode. Select target SKU in Product Family tab.'
  };
}
