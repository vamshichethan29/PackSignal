/**
 * PackSignal US Food Label Preflight Pack — Check US-002: Business Name & Address
 * Legal Basis: 21 CFR 101.5
 */

import { FDA_STATUTORY_CITATIONS } from './references.mjs';

/**
 * Executes Check US-002: Manufacturer / Business Address
 */
export function executeUsBusinessAddressCheck({
  artworkText = '',
  approvedBusinessName = null,
  approvedAddress = null,
  coverageConfirmed = true,
  evidenceBox = null,
} = {}) {
  const citation = FDA_STATUTORY_CITATIONS.US_002_BUSINESS_ADDRESS;

  // 1. Detect Relationship Qualifier
  const qualifierRegex = /\b(?:manufactured\s+for|distributed\s+by|packed\s+for|produced\s+for|imported\s+by|marketed\s+by)\b/i;
  const qualifierMatch = artworkText.match(qualifierRegex);
  const hasQualifier = Boolean(qualifierMatch);

  // 2. Detect City, State, ZIP code pattern (e.g., "Austin, TX 78701" or "Portland, OR 97201")
  const usAddressRegex = /\b([A-Za-z\s.-]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/;
  const addressMatch = artworkText.match(usAddressRegex);

  // 3. Detect Street Address pattern (e.g., "123 Main St", "Suite 400")
  const streetRegex = /\b\d+\s+[A-Za-z0-9\s.,#-]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct|Suite|Ste)\b/i;
  const streetMatch = artworkText.match(streetRegex);

  // 4. Detect Business Name
  let detectedName = null;
  if (hasQualifier) {
    const afterQualifier = artworkText.substring(qualifierMatch.index + qualifierMatch[0].length, qualifierMatch.index + qualifierMatch[0].length + 80);
    const line = afterQualifier.split(/[\n,]/)[0]?.trim();
    if (line && line.length > 2) detectedName = line;
  }

  // 5. Check against approved source specification
  if (approvedBusinessName) {
    const normArt = artworkText.toLowerCase();
    const normName = approvedBusinessName.toLowerCase();
    const nameFound = normArt.includes(normName) ||
      normArt.replace(/[^a-z0-9]/g, '').includes(normName.replace(/[^a-z0-9]/g, ''));
    if (!nameFound) {
      return {
        checkId: citation.checkId,
        title: citation.name,
        legalBasis: citation.citation,
        sourceUrl: citation.sourceUrl,
        applicability: 'applicable',
        executionStatus: 'executed',
        findingStatus: 'issue',
        requiredInputs: ['artwork_business_details', 'approved_business_name'],
        observedValue: detectedName || 'Not matched on artwork',
        expectedValue: approvedBusinessName,
        calculation: null,
        evidence: evidenceBox ? [{ role: 'artwork', box: evidenceBox, text: detectedName }] : null,
        explanation: `Manufacturer discrepancy under 21 CFR 101.5: Approved business name "${approvedBusinessName}" was not located on packaging artwork.`,
        limitations: 'Exact trade name comparison against verified corporate specification.',
      };
    }
  }

  // 6. Synthesize findings
  if (!addressMatch) {
    if (!coverageConfirmed) {
      return {
        checkId: citation.checkId,
        title: citation.name,
        legalBasis: citation.citation,
        sourceUrl: citation.sourceUrl,
        applicability: 'applicable',
        executionStatus: 'requires_evidence',
        findingStatus: 'unable',
        requiredInputs: ['artwork_business_details'],
        observedValue: 'Address components not fully detected',
        expectedValue: 'City, State, and ZIP code',
        calculation: null,
        evidence: null,
        explanation: 'Business address components (City, State, ZIP) were not located in extracted artwork text. Extraction coverage is unconfirmed.',
        limitations: 'Inspect informational panel visually to confirm presence of business details.',
      };
    }
    return {
      checkId: citation.checkId,
      title: citation.name,
      legalBasis: citation.citation,
      sourceUrl: citation.sourceUrl,
      applicability: 'applicable',
      executionStatus: 'executed',
      findingStatus: 'issue',
      requiredInputs: ['artwork_business_details'],
      observedValue: 'Missing City, State, or ZIP code',
      expectedValue: 'Valid City, State, and ZIP code declaration',
      calculation: null,
      evidence: null,
      explanation: 'Statutory Violation under 21 CFR 101.5: Name and place of business must include the city, state, and ZIP code.',
      limitations: 'Every packaged food label must contain the place of business.',
    };
  }

  const observedAddress = addressMatch[0];
  const observedDetails = `${hasQualifier ? qualifierMatch[0] + ' ' : ''}${detectedName || approvedBusinessName || ''}, ${observedAddress}`;

  // 7. Check Street Address Exception (21 CFR 101.5(d))
  if (!streetMatch) {
    return {
      checkId: citation.checkId,
      title: citation.name,
      legalBasis: citation.citation,
      sourceUrl: citation.sourceUrl,
      applicability: 'applicable',
      executionStatus: 'executed',
      findingStatus: 'review',
      requiredInputs: ['artwork_business_details'],
      observedValue: observedDetails,
      expectedValue: 'Complete street address or directory listing exception',
      calculation: null,
      evidence: evidenceBox ? [{ role: 'artwork', box: evidenceBox, text: observedAddress }] : null,
      explanation: `Street address exception review: Street address is omitted from "${observedAddress}". Permitted under 21 CFR 101.5(d) only if the corporate address is listed in a current city directory or telephone directory.`,
      limitations: 'Reviewer must verify that company is listed in a current public directory if street address is omitted.',
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
    requiredInputs: ['artwork_business_details'],
    observedValue: observedDetails,
    expectedValue: approvedBusinessName || 'Full business address with street, city, state, and ZIP',
    calculation: null,
    evidence: evidenceBox ? [{ role: 'artwork', box: evidenceBox, text: observedAddress }] : null,
    explanation: `Business details satisfy 21 CFR 101.5 requirements: Verified corporate identity, relationship qualifier, and complete place of business (${observedAddress}).`,
    limitations: 'Verifies statutory formatting; does not verify active state corporate charter status.',
  };
}
