/**
 * @file lib/pack-canvas/layout-schema.mjs
 * 
 * PackSignal Phase 6 — Pack Canvas Canonical Data Model & Schema
 * 
 * Strictly defines and validates the canonical physical layout record:
 * - Separates original artwork geometry from proposed content placements
 * - Separates locked brand assets from dynamic regulatory text
 * - Tracks physical scale authority and market regulatory versions
 * - Immutably protects original PDF and dieline files
 */

export const LAYOUT_STATUSES = [
  'DRAFT',
  'FEASIBLE',
  'OVERFLOW',
  'CONSTRAINT_VIOLATION',
  'TIME_LIMIT_REACHED',
  'APPROVED_FOR_ARTWORK'
];

export const LAYOUT_STATUS = {
  DRAFT: 'DRAFT',
  PROPOSED: 'DRAFT',
  FEASIBLE: 'FEASIBLE',
  OVERFLOW: 'OVERFLOW',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  VALIDATION_FAILED: 'CONSTRAINT_VIOLATION',
  TIME_LIMIT_REACHED: 'TIME_LIMIT_REACHED',
  APPROVED_FOR_ARTWORK: 'APPROVED_FOR_ARTWORK'
};

export const SCALE_AUTHORITIES = [
  'PDF_MEDIA_BOX',
  'CONFIRMED_DXF_UNITS',
  'REVIEWER_SUPPLIED_GEOMETRY',
  'STRUCTURAL_CAD_SPEC',
  'PHYSICAL_SCALE_UNCONFIRMED'
];

export const ASSET_LOCK_STATUSES = [
  'KEEP_LOCKED',
  'MOVE_ALLOWED',
  'RESIZE_ALLOWED',
  'CHANGE_REQUESTED',
  'REMOVE_APPROVED',
  'UNDECIDED'
];

export const CONTENT_TYPES = [
  'STATEMENT_OF_IDENTITY',
  'NET_QUANTITY',
  'INGREDIENT_LIST',
  'ALLERGEN_DECLARATION',
  'NUTRITION_FACTS',
  'MANUFACTURER_NOTICE',
  'STORAGE_INSTRUCTIONS',
  'LOT_BATCH_MARKER',
  'REGULATORY_SYMBOL',
  'BARCODE_UPC',
  'MARKETING_CLAIM',
  'BRAND_STORY'
];

/**
 * Creates a canonical Pack Canvas layout state record.
 */
export function createLayoutRecord(params = {}) {
  const now = new Date().toISOString();
  
  return {
    layoutId: params.layoutId || `LAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    reviewId: params.reviewId || 'review-default',
    briefId: params.briefId || null,
    briefVersion: params.briefVersion || 1,
    documentId: params.documentId || 'doc-carton-pdf',
    documentSha256: params.documentSha256 || 'da77f98d00923297a780b616b3f717cf6b1b465139046bf70de1bc36efd7adfb',
    dielineDocumentId: params.dielineDocumentId || 'dieline-cad-1',
    dielineSha256: params.dielineSha256 || 'c584a68f00112233445566778899aabbccddeeff00112233445566778899aabb',
    market: String(params.market || 'US').toUpperCase(),
    marketPackVersion: params.marketPackVersion || '2026.1',
    launchDate: params.launchDate || '2026-06-01',
    packageType: params.packageType || 'CARTON_FOLDING',
    geometrySource: params.geometrySource || 'ESKO_STRUCTURAL_PDF',
    physicalScaleAuthority: params.physicalScaleAuthority || 'PDF_MEDIA_BOX',
    
    // Core physical geometry
    panels: Array.isArray(params.panels) ? params.panels : [],
    lockedZones: Array.isArray(params.lockedZones) ? params.lockedZones : [],
    contentBlocks: Array.isArray(params.contentBlocks) ? params.contentBlocks : [],
    placements: params.placements || {},
    
    // Evaluation results
    constraintResults: params.constraintResults || [],
    overflowResults: params.overflowResults || {
      hasOverflow: false,
      overflowPanels: [],
      unplacedBlocks: [],
      limitingConstraints: []
    },
    suggestedFixes: Array.isArray(params.suggestedFixes) ? params.suggestedFixes : [],
    reviewerDecisions: Array.isArray(params.reviewerDecisions) ? params.reviewerDecisions : [],
    
    // Lifecycle
    layoutStatus: params.layoutStatus || 'DRAFT',
    createdAt: params.createdAt || now,
    updatedAt: now
  };
}

/**
 * Validates a layout record against the Phase 6 specification.
 */
export function validateLayoutRecord(layout) {
  const errors = [];

  if (!layout || typeof layout !== 'object') {
    return { valid: false, errors: ['Layout record must be a non-null object'] };
  }

  // Required identifier strings
  if (!layout.layoutId || typeof layout.layoutId !== 'string') {
    errors.push('layoutId is required and must be a string');
  }
  if (!layout.reviewId || typeof layout.reviewId !== 'string') {
    errors.push('reviewId is required and must be a string');
  }
  if (!layout.documentSha256 || typeof layout.documentSha256 !== 'string') {
    errors.push('documentSha256 is required and must be a string');
  }

  // Scale authority verification
  if (!SCALE_AUTHORITIES.includes(layout.physicalScaleAuthority)) {
    errors.push(`Invalid physicalScaleAuthority: ${layout.physicalScaleAuthority}. Must be one of ${SCALE_AUTHORITIES.join(', ')}`);
  }

  // Status verification
  if (!LAYOUT_STATUSES.includes(layout.layoutStatus)) {
    errors.push(`Invalid layoutStatus: ${layout.layoutStatus}. Must be one of ${LAYOUT_STATUSES.join(', ')}`);
  }

  // Panels validation
  if (!Array.isArray(layout.panels)) {
    errors.push('panels must be an array');
  } else {
    layout.panels.forEach((p, idx) => {
      if (!p.id || !p.name || typeof p.widthMm !== 'number' || typeof p.heightMm !== 'number') {
        errors.push(`Panel at index ${idx} missing required fields (id, name, widthMm, heightMm)`);
      }
      if (p.widthMm <= 0 || p.heightMm <= 0) {
        errors.push(`Panel ${p.id || idx} has invalid physical dimensions <= 0`);
      }
    });
  }

  // Locked zones validation
  if (!Array.isArray(layout.lockedZones)) {
    errors.push('lockedZones must be an array');
  } else {
    layout.lockedZones.forEach((z, idx) => {
      if (!z.id || !z.panelId || typeof z.widthMm !== 'number' || typeof z.heightMm !== 'number') {
        errors.push(`Locked zone at index ${idx} missing required fields (id, panelId, widthMm, heightMm)`);
      }
      if (z.lockStatus && !ASSET_LOCK_STATUSES.includes(z.lockStatus)) {
        errors.push(`Locked zone ${z.id} has invalid lockStatus: ${z.lockStatus}`);
      }
    });
  }

  // Content blocks validation
  if (!Array.isArray(layout.contentBlocks)) {
    errors.push('contentBlocks must be an array');
  } else {
    layout.contentBlocks.forEach((b, idx) => {
      if (!b.id || !b.name || typeof b.text !== 'string') {
        errors.push(`Content block at index ${idx} missing required fields (id, name, text)`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
