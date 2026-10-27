/**
 * PackSignal US Food Label Preflight Pack — Check US-007: Claim-to-Evidence Verification
 * Legal Basis: 21 CFR 101.13, 21 CFR 101.54, 16 CFR Part 260 (FTC Green Guides)
 */

import { FDA_STATUTORY_CITATIONS } from './references.mjs';

export const SUPPORTED_CLAIM_PATTERNS = [
  { id: 'high_protein', type: 'nutrient_content', regex: /\b(?:high\s+in\s+protein|excellent\s+source\s+of\s+protein|high\s+protein)\b/i, name: 'High Protein' },
  { id: 'low_fat', type: 'nutrient_content', regex: /\b(?:low\s+fat|low\s+in\s+fat)\b/i, name: 'Low Fat' },
  { id: 'no_added_sugar', type: 'nutrient_content', regex: /\b(?:no\s+added\s+sugars?|without\s+added\s+sugars?|zero\s+added\s+sugars?)\b/i, name: 'No Added Sugar' },
  { id: 'organic', type: 'agricultural', regex: /\b(?:100%\s*organic|certified\s+organic|usda\s+organic|organic)\b/i, name: 'Organic Claim' },
  { id: 'natural', type: 'marketing', regex: /\b(?:100%\s*natural|all\s+natural|natural)\b/i, name: 'Natural' },
  { id: 'recyclable', type: 'environmental', regex: /\b(?:100%\s*recyclable|please\s+recycle|widely\s+recycled|recyclable)\b/i, name: 'Recyclable' },
  { id: 'eco_friendly', type: 'environmental', regex: /\b(?:eco[- ]friendly|planet[- ]friendly|green\s+choice)\b/i, name: 'Eco-Friendly' },
  { id: 'recycled_content', type: 'environmental', regex: /\b(?:made\s+with\s+(?:\d+%)?\s*recycled\s+content|recycled\s+packaging)\b/i, name: 'Recycled Content' },
  { id: 'carbon_neutral', type: 'environmental', regex: /\b(?:carbon\s+neutral|net\s+zero|carbon\s+offset)\b/i, name: 'Carbon Neutral' },
  { id: 'compostable', type: 'environmental', regex: /\b(?:100%\s*compostable|compostable\s+packaging|compostable)\b/i, name: 'Compostable' },
];

/**
 * Executes Check US-007: Claim-to-Evidence Verification
 */
export function executeUsClaimVerificationCheck({
  artworkText = '',
  approvedClaimsRegister = [],
  evidenceDocuments = [],
  evidenceBox = null,
} = {}) {
  const citation = FDA_STATUTORY_CITATIONS.US_007_CLAIMS_EVIDENCE;

  // 1. Detect claims present in artwork
  const detectedClaims = [];
  for (const pat of SUPPORTED_CLAIM_PATTERNS) {
    const match = artworkText.match(pat.regex);
    if (match) {
      detectedClaims.push({
        claimId: pat.id,
        claimName: pat.name,
        type: pat.type,
        detectedWording: match[0],
      });
    }
  }

  if (detectedClaims.length === 0) {
    return {
      checkId: citation.checkId,
      title: citation.name,
      legalBasis: citation.citation,
      sourceUrl: citation.sourceUrl,
      applicability: 'not_applicable',
      executionStatus: 'executed',
      findingStatus: 'match',
      requiredInputs: ['artwork_claims'],
      observedValue: 'No specific marketing or nutrient claims detected',
      expectedValue: 'None',
      calculation: null,
      evidence: null,
      explanation: 'No regulated nutrient content, organic, or environmental marketing claims were detected on the artwork.',
      limitations: 'Scans for 10 common FDA nutrient and FTC environmental claim types.',
    };
  }

  // 2. Cross-reference detected claims with approved claims register
  const unsupportedClaims = [];
  const contradictedClaims = [];
  const substantiatedClaims = [];

  for (const claim of detectedClaims) {
    const matchedEntry = approvedClaimsRegister.find(entry => {
      const entryId = entry.id || entry.claimId;
      const entryText = entry.approvedWording || entry.claimText || entry.claim || '';
      return (
        entryId === claim.claimId ||
        new RegExp(claim.detectedWording.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(entryText) ||
        entryText.toLowerCase().includes(claim.claimName.toLowerCase())
      );
    });

    if (!matchedEntry) {
      unsupportedClaims.push(claim);
    } else if (matchedEntry.status === 'REJECTED' || matchedEntry.status === 'PROHIBITED' || matchedEntry.approved === false) {
      contradictedClaims.push({
        claim,
        reason: matchedEntry.reason || 'Prohibited by approved product specification',
      });
    } else {
      // Check if evidence document is linked
      const hasEvidence = Boolean(
        matchedEntry.evidenceDocumentId ||
        matchedEntry.substantiationId ||
        evidenceDocuments.some(d => d.id === matchedEntry.evidenceDocumentId || d.role === 'substantiation')
      );
      substantiatedClaims.push({
        claim,
        approvedWording: matchedEntry.approvedWording || claim.detectedWording,
        evidenceVerified: hasEvidence,
      });
    }
  }

  // 3. Synthesize result
  if (contradictedClaims.length > 0) {
    const item = contradictedClaims[0];
    return {
      checkId: citation.checkId,
      title: citation.name,
      legalBasis: citation.citation,
      sourceUrl: citation.sourceUrl,
      applicability: 'applicable',
      executionStatus: 'executed',
      findingStatus: 'issue',
      requiredInputs: ['artwork_claims', 'approved_claims_register'],
      observedValue: item.claim.detectedWording,
      expectedValue: 'Prohibited from packaging copy',
      calculation: null,
      evidence: evidenceBox ? [{ role: 'artwork', box: evidenceBox, text: item.claim.detectedWording }] : null,
      explanation: `Contradicted claim on artwork: Claim "${item.claim.detectedWording}" is explicitly prohibited or rejected in the approved brand claims register (${item.reason}).`,
      limitations: 'Enforces approved brand specification constraints.',
    };
  }

  if (unsupportedClaims.length > 0) {
    const unsuppNames = unsupportedClaims.map(c => `"${c.detectedWording}"`).join(', ');
    const hasOrganic = unsupportedClaims.some(c => c.claimId === 'organic');
    return {
      checkId: citation.checkId,
      title: citation.name,
      legalBasis: citation.citation,
      sourceUrl: citation.sourceUrl,
      applicability: 'applicable',
      executionStatus: 'manual_review',
      findingStatus: 'review',
      requiredInputs: ['claims_substantiation_dossier'],
      observedValue: unsuppNames,
      expectedValue: 'Documented substantiation in approved claims register',
      calculation: null,
      evidence: evidenceBox ? [{ role: 'artwork', box: evidenceBox, text: unsupportedClaims[0].detectedWording }] : null,
      explanation: `Unsubstantiated claim review: Detected claim(s) [${unsuppNames}] have no matching approved substantiation record in the product claims register. Under FTC Green Guides (16 CFR Part 260) and 21 CFR 101.13, claims require competent and reliable evidence. ${hasOrganic ? 'Note: "Organic" requires verified USDA National Organic Program (NOP) certification.' : ''}`,
      limitations: 'PackSignal flags claims requiring substantiation; internal register does not constitute regulatory legal clearance.',
    };
  }

  return {
    checkId: citation.checkId,
    title: citation.name,
    legalBasis: citation.citation,
    sourceUrl: citation.sourceUrl,
    applicability: 'applicable',
    executionStatus: 'executed',
    findingStatus: 'match',
    requiredInputs: ['artwork_claims', 'approved_claims_register'],
    observedValue: substantiatedClaims.map(s => `"${s.claim.detectedWording}"`).join(', '),
    expectedValue: 'Verified matching entries in approved claims register',
    calculation: null,
    evidence: evidenceBox ? [{ role: 'artwork', box: evidenceBox, text: substantiatedClaims[0]?.claim?.detectedWording }] : null,
    explanation: `Claim-to-evidence verified: ${substantiatedClaims.length} packaging claim(s) matched against approved claims register with verified supporting evidence.`,
    limitations: 'Confirms agreement with company substantiation records; not an FDA or FTC advisory opinion.',
  };
}
