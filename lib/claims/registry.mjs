/**
 * PackSignal Claims Intelligence — Structured Claims Register
 * (lib/claims/registry.mjs)
 *
 * Implements Step 16 & Step 17 of Phase 6:
 * Versioned claim schema, bounded claim categories, and register normalization.
 */

export const CLAIM_TYPES = {
  NUTRIENT_CONTENT: 'NUTRIENT_CONTENT',
  PRODUCT_ATTRIBUTE: 'PRODUCT_ATTRIBUTE',
  SUSTAINABILITY: 'SUSTAINABILITY',
  RECYCLABILITY: 'RECYCLABILITY',
  RECYCLED_CONTENT: 'RECYCLED_CONTENT',
  COMPOSTABILITY: 'COMPOSTABILITY',
  CARBON_IMPACT: 'CARBON_IMPACT',
  CERTIFICATION: 'CERTIFICATION',
  VEGAN: 'VEGAN',
  ORGANIC: 'ORGANIC',
  OTHER_MARKETING: 'OTHER_MARKETING'
};

export const CLAIM_APPROVAL_STATUSES = {
  APPROVED: 'APPROVED',
  PENDING_SUBSTANTIATION: 'PENDING_SUBSTANTIATION',
  PROVISIONAL: 'PROVISIONAL',
  EXPIRED: 'EXPIRED',
  REJECTED: 'REJECTED'
};

export const SUBSTANTIATION_STATES = {
  CLAIM_DETECTED: 'CLAIM_DETECTED',
  REGISTER_ENTRY_FOUND: 'REGISTER_ENTRY_FOUND',
  COPY_AUTHORIZED: 'COPY_AUTHORIZED',
  SUPPORTING_DOCUMENT_REFERENCED: 'SUPPORTING_DOCUMENT_REFERENCED',
  SUPPORTING_DOCUMENT_AVAILABLE: 'SUPPORTING_DOCUMENT_AVAILABLE',
  SUPPORTING_DOCUMENT_REVIEWED: 'SUPPORTING_DOCUMENT_REVIEWED',
  SUBSTANTIATION_NOT_ESTABLISHED: 'SUBSTANTIATION_NOT_ESTABLISHED',
  SOURCE_CONFLICT: 'SOURCE_CONFLICT',
  APPROVAL_EXPIRED_OR_NOT_EFFECTIVE: 'APPROVAL_EXPIRED_OR_NOT_EFFECTIVE',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED'
};

/**
 * Normalizes a claim register entry into a versioned canonical record.
 */
export function createClaimEntry({
  claimId = '',
  claimText = '',
  claimType = CLAIM_TYPES.OTHER_MARKETING,
  sku = null,
  productFamily = null,
  market = 'ALL',
  approvalStatus = CLAIM_APPROVAL_STATUSES.APPROVED,
  supportingDocumentIds = [],
  supportingDocumentReferences = [],
  effectiveDate = null,
  expirationDate = null,
  conditions = [],
  reviewStatus = 'REVIEW_REQUIRED',
  approvedBy = null,
  approvalTimestamp = null,
  sourceDocumentId = '',
  sourceDocumentHash = '',
  sourceLocation = ''
}) {
  return {
    claimId: String(claimId || `claim_${Date.now()}`).trim(),
    claimText: String(claimText || '').trim(),
    claimType: CLAIM_TYPES[claimType] || CLAIM_TYPES.OTHER_MARKETING,
    sku: sku ? String(sku).trim() : null,
    productFamily: productFamily ? String(productFamily).trim() : null,
    market: String(market || 'ALL').trim().toUpperCase(),
    approvalStatus: CLAIM_APPROVAL_STATUSES[approvalStatus] || CLAIM_APPROVAL_STATUSES.PENDING_SUBSTANTIATION,
    supportingDocumentIds: Array.isArray(supportingDocumentIds) ? supportingDocumentIds : [],
    supportingDocumentReferences: Array.isArray(supportingDocumentReferences)
      ? supportingDocumentReferences
      : (supportingDocumentReferences ? [String(supportingDocumentReferences)] : []),
    effectiveDate: effectiveDate ? String(effectiveDate) : null,
    expirationDate: expirationDate ? String(expirationDate) : null,
    conditions: Array.isArray(conditions) ? conditions : (conditions ? [String(conditions)] : []),
    reviewStatus,
    approvedBy: approvedBy ? String(approvedBy) : null,
    approvalTimestamp: approvalTimestamp ? String(approvalTimestamp) : null,
    sourceDocumentId,
    sourceDocumentHash,
    sourceLocation
  };
}

/**
 * Extracts claim entries from all claim register documents in a review.
 */
export function extractReviewClaimsRegister(review = {}) {
  const docs = (review.documents || []).filter(d => d.role === 'claims' || (d.data?.entries && Array.isArray(d.data.entries)));
  const entries = [];

  for (const doc of docs) {
    const rawEntries = Array.isArray(doc.data?.entries) ? doc.data.entries : [];
    for (let i = 0; i < rawEntries.length; i++) {
      const item = rawEntries[i];
      if (!item || typeof item !== 'object') continue;

      const claimText = item.text || item.claim || item.claimText || '';
      if (!claimText.trim()) continue;

      const subRef = item.evidence_reference || item.substantiation || item.supporting_document || item.certification_reference;
      const supportingRefs = subRef ? [subRef] : [];

      const entry = createClaimEntry({
        claimId: item.claim_id || item.id || `claim_${doc.id}_${i + 1}`,
        claimText,
        claimType: item.claim_type || item.type || CLAIM_TYPES.SUSTAINABILITY,
        sku: item.sku || null,
        productFamily: item.product_family || item.family || null,
        market: item.market || item.country || 'ALL',
        approvalStatus: /^APPROVED/i.test(item.status || '') ? CLAIM_APPROVAL_STATUSES.APPROVED : (item.status || CLAIM_APPROVAL_STATUSES.PENDING_SUBSTANTIATION),
        supportingDocumentReferences: supportingRefs,
        effectiveDate: item.effective_date || item.effectiveDate || null,
        expirationDate: item.expiration_date || item.expirationDate || null,
        conditions: item.conditions || item.condition || [],
        approvedBy: item.approved_by || null,
        approvalTimestamp: item.approval_timestamp || null,
        sourceDocumentId: doc.id,
        sourceDocumentHash: doc.sha256 || '',
        sourceLocation: `Claims register · Entry ${i + 1}`
      });

      entries.push(entry);
    }
  }

  return entries;
}
