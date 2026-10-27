/**
 * PackSignal Product Family Intelligence — Master Pipeline
 * (lib/product-family/index.mjs)
 *
 * Implements Phase 6 Multi-SKU product-family integration.
 */

import { extractReviewProductFamily } from './spreadsheet-parser.mjs';
import { resolveActiveSku, SKU_IDENTITY_STATES } from './sku-registry.mjs';
import { screenCrossContamination } from './cross-contamination.mjs';

export { SKU_IDENTITY_STATES };

/**
 * Orchestrates product-family extraction, active SKU resolution, and cross-contamination screening.
 */
export function analyzeProductFamily({
  review = {},
  activeSkuId = null,
  reviewerDecisions = {}
}) {
  const products = extractReviewProductFamily(review);
  const artworkDoc = (review.documents || []).find(d => d.role === 'artwork');

  // Find decoded GTIN from artwork if available
  const firstGtinCode = (artworkDoc?.pages || []).flatMap(p => p.codes || []).find(c => c.gtin);
  const decodedGtin = firstGtinCode?.gtin || null;

  // Selected SKU from reviewer options or direct parameter
  const reviewerSelection = activeSkuId || review.options?.activeSku || review.options?.selectedSku || null;
  const sourceSpec = (review.documents || []).find(d => d.role === 'spec');
  const sourceSpecSku = sourceSpec?.data?.product?.sku || null;

  const skuResolution = resolveActiveSku({
    products,
    reviewerSelection,
    decodedGtin,
    artworkText: artworkDoc?.text || '',
    sourceSpecSku
  });

  const activeProduct = skuResolution.activeProduct;
  const siblingProducts = activeProduct
    ? products.filter(p => p !== activeProduct && (p.sku !== activeProduct.sku || p.sourceRow !== activeProduct.sourceRow))
    : products;

  const decisions = reviewerDecisions || review.productFamilyDecisions || {};

  const screening = screenCrossContamination({
    activeProduct,
    siblingProducts,
    artworkDocument: artworkDoc,
    review,
    reviewerDecisions: decisions
  });

  return {
    schemaVersion: 'packsignal-product-family/v1',
    hasProductFamily: products.length > 0,
    totalProductsCount: products.length,
    activeProduct,
    identityState: skuResolution.identityState,
    identityReason: skuResolution.reason,
    allProducts: products,
    siblingProducts,
    findings: screening.findings || [],
    candidates: screening.candidates || [],
    limitations: [
      'Sibling SKU screening detects text and barcode carryover from supplied family spreadsheets.',
      'A sibling mention is not an automatic defect; intentional cross-promotion requires reviewer confirmation.'
    ]
  };
}
