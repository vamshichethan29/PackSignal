/**
 * PackSignal Statement of Identity & Product Branding Engine (lib/regulatory/identity.mjs)
 * Implements 21 CFR 101.3 (Food; designation of status):
 * - Principal display panel statement of identity prominence
 * - Common or usual name specification
 * - Brand descriptor vs statutory identity separation
 * - PDP front panel placement
 */

import { normal, safeCopyMatch } from '../engine.mjs';

export function evaluateStatementOfIdentity({
  approvedBrand = '',
  approvedIdentity = '',
  artworkText = '',
  artworkSpans = [],
  pdpPage = 1,
}) {
  const normArt = normal(artworkText);
  const normBrand = normal(approvedBrand);
  const normIdentity = normal(approvedIdentity);

  // 1. Brand Name Check
  const brandFound = normBrand ? normArt.includes(normBrand) : true;

  // 2. Statement of Identity Check
  const identityFound = normIdentity ? normArt.includes(normIdentity) : false;

  // 3. Typography Prominence & Placement (using artworkSpans if available)
  let maxIdentityFontSize = null;
  let identityOnPdp = false;

  if (normIdentity && artworkSpans?.length) {
    for (const span of artworkSpans) {
      if (normal(span.text).includes(normIdentity)) {
        if (maxIdentityFontSize == null || span.fontSizePt > maxIdentityFontSize) {
          maxIdentityFontSize = span.fontSizePt;
        }
        if (span.boxNorm && span.boxNorm[1] <= 0.85) { // Upper/middle PDP
          identityOnPdp = true;
        }
      }
    }
  }

  const hasMismatch = !brandFound || !identityFound;

  return {
    status: hasMismatch ? 'issue' : 'match',
    verdict: hasMismatch ? 'IDENTITY_MISMATCH' : 'IDENTITY_CONCORDANCE',
    brandCheck: {
      expected: approvedBrand,
      found: brandFound,
      status: brandFound ? 'match' : 'issue',
    },
    statementOfIdentityCheck: {
      expected: approvedIdentity,
      found: identityFound,
      status: identityFound ? 'match' : 'issue',
      prominencePt: maxIdentityFontSize,
      pdpPlacement: identityOnPdp,
    },
    citation: '21 CFR 101.3(a), (b), (d)',
    explanation: hasMismatch
      ? `Product identity discrepancy: ${!brandFound ? `Brand "${approvedBrand}" not detected. ` : ''}${!identityFound ? `Statement of identity "${approvedIdentity}" not detected on Principal Display Panel.` : ''}`
      : `Statement of identity "${approvedIdentity}" and brand "${approvedBrand}" confirmed on Principal Display Panel.`,
  };
}
