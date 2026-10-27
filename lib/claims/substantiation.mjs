/**
 * PackSignal Claims Intelligence — Substantiation Evidence Evaluator
 * (lib/claims/substantiation.mjs)
 *
 * Implements Step 19, 20, 21 of Phase 6:
 * Evaluates detected claims against claims registers, active SKU, market,
 * effective/expiration dates, and supporting document references.
 */

import { normal } from '../engine.mjs';
import {
  CLAIM_TYPES,
  CLAIM_APPROVAL_STATUSES,
  SUBSTANTIATION_STATES
} from './registry.mjs';

/**
 * Evaluates substantiation status of a detected claim.
 */
export function evaluateClaimSubstantiation({
  detectedClaim = {},
  claimRegister = [],
  activeSku = null,
  activeMarket = 'US',
  reviewEffectiveDate = new Date().toISOString(),
  availableDocuments = []
}) {
  const claimText = detectedClaim.quote || detectedClaim.text || '';
  const normClaim = normal(claimText);

  // 1. Locate matching entries in the register
  const matchingEntries = claimRegister.filter(entry => {
    const entryNorm = normal(entry.claimText);
    return entryNorm && (normClaim.includes(entryNorm) || entryNorm.includes(normClaim));
  });

  if (matchingEntries.length === 0) {
    return {
      claimText,
      substantiationState: SUBSTANTIATION_STATES.REVIEW_REQUIRED,
      findingStatus: 'review',
      explanation: `Claim "${claimText}" was detected on artwork but has no matching entry in the approved claims register.`,
      matchingEntry: null,
      isAuthorized: false,
      hasSupportingDocuments: false
    };
  }

  // Find candidate for this SKU and market
  const activeEntry = matchingEntries.find(e => 
    (!e.sku || e.sku === activeSku) && 
    (!e.market || e.market === 'ALL' || e.market === activeMarket)
  ) || matchingEntries[0];

  // 2. Check SKU and Market Scope
  const isSkuMatch = !activeEntry.sku || activeEntry.sku === activeSku;
  const isMarketMatch = !activeEntry.market || activeEntry.market === 'ALL' || activeEntry.market === activeMarket;

  if (!isSkuMatch) {
    return {
      claimText,
      substantiationState: SUBSTANTIATION_STATES.SOURCE_CONFLICT,
      findingStatus: 'review',
      explanation: `Claim is registered for sibling SKU "${activeEntry.sku}", not active SKU "${activeSku}".`,
      matchingEntry: activeEntry,
      isAuthorized: false,
      hasSupportingDocuments: false
    };
  }

  if (!isMarketMatch) {
    return {
      claimText,
      substantiationState: SUBSTANTIATION_STATES.SOURCE_CONFLICT,
      findingStatus: 'review',
      explanation: `Claim is registered for market "${activeEntry.market}", not target market "${activeMarket}".`,
      matchingEntry: activeEntry,
      isAuthorized: false,
      hasSupportingDocuments: false
    };
  }

  // 3. Check Effective and Expiration Dates
  const effectiveTime = activeEntry.effectiveDate ? new Date(activeEntry.effectiveDate).getTime() : 0;
  const expirationTime = activeEntry.expirationDate ? new Date(activeEntry.expirationDate).getTime() : Infinity;
  const checkTime = new Date(reviewEffectiveDate).getTime();

  if (checkTime < effectiveTime) {
    return {
      claimText,
      substantiationState: SUBSTANTIATION_STATES.APPROVAL_EXPIRED_OR_NOT_EFFECTIVE,
      findingStatus: 'review',
      explanation: `Claim authorization is not effective until ${activeEntry.effectiveDate}.`,
      matchingEntry: activeEntry,
      isAuthorized: false,
      hasSupportingDocuments: false
    };
  }

  if (checkTime > expirationTime) {
    return {
      claimText,
      substantiationState: SUBSTANTIATION_STATES.APPROVAL_EXPIRED_OR_NOT_EFFECTIVE,
      findingStatus: 'review',
      explanation: `Claim authorization expired on ${activeEntry.expirationDate}.`,
      matchingEntry: activeEntry,
      isAuthorized: false,
      hasSupportingDocuments: false
    };
  }

  // 4. Check Supporting Documents
  const refDocIds = activeEntry.supportingDocumentIds || [];
  const refDocNames = activeEntry.supportingDocumentReferences || [];
  const availableDocIds = new Set(availableDocuments.map(d => d.id));
  const availableDocNames = new Set(availableDocuments.map(d => d.name));

  const hasDocsAvailable = refDocIds.some(id => availableDocIds.has(id)) ||
    refDocNames.some(name => availableDocNames.has(name));

  if (refDocIds.length > 0 || refDocNames.length > 0) {
    if (hasDocsAvailable) {
      return {
        claimText,
        substantiationState: SUBSTANTIATION_STATES.SUPPORTING_DOCUMENT_AVAILABLE,
        findingStatus: 'match',
        explanation: `Claim matches authorized register entry and supporting documentation is attached. (Note: does not constitute legal or scientific certification).`,
        matchingEntry: activeEntry,
        isAuthorized: true,
        hasSupportingDocuments: true
      };
    } else {
      return {
        claimText,
        substantiationState: SUBSTANTIATION_STATES.SUPPORTING_DOCUMENT_REFERENCED,
        findingStatus: 'review',
        explanation: `Claim is registered but referenced supporting document (${refDocNames.join(', ') || refDocIds.join(', ')}) is missing from review uploads.`,
        matchingEntry: activeEntry,
        isAuthorized: true,
        hasSupportingDocuments: false
      };
    }
  }

  // Authorized copy without explicit technical substantiation requirements
  return {
    claimText,
    substantiationState: SUBSTANTIATION_STATES.COPY_AUTHORIZED,
    findingStatus: 'match',
    explanation: `Artwork wording matches authorized claims register entry.`,
    matchingEntry: activeEntry,
    isAuthorized: true,
    hasSupportingDocuments: false
  };
}
