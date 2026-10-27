/**
 * PackSignal Business Details & Distributor Engine (lib/regulatory/business-details.mjs)
 * Implements 21 CFR 101.5 (Food; name and place of business of manufacturer, packer, or distributor):
 * - Legal entity name
 * - Physical place of business (City, State, ZIP code)
 * - Mandatory qualifying phrase ("Manufactured for", "Distributed by", "Packed for") if not direct manufacturer
 */

export function evaluateBusinessDetails({
  approvedManufacturer = '',
  artworkText = '',
}) {
  const normArt = (artworkText || '').toLowerCase();
  const normSource = (approvedManufacturer || '').toLowerCase();

  // 1. Qualifying Phrase Check (21 CFR 101.5(a))
  const qualifierMatch = normArt.match(/\b(manufactured for|distributed by|packed for|imported by)\s*[:.-]?\s*([^,\n]+)/i);
  const hasQualifier = Boolean(qualifierMatch);

  // 2. City, State, ZIP Check (21 CFR 101.5(d))
  // Matches e.g. "Seattle, WA 98101" or "Portland, OR 97201"
  const locationMatch = normArt.match(/([a-z\s]+),\s*([a-z]{2})\s*(\d{5}(?:-\d{4})?)/i);
  const hasAddressAndZip = Boolean(locationMatch);

  // 3. Entity Name Concordance
  let nameMatched = false;
  if (normSource) {
    nameMatched = normArt.includes(normSource.slice(0, Math.min(normSource.length, 12)));
  } else {
    nameMatched = Boolean(qualifierMatch);
  }

  const isSatisfied = hasAddressAndZip && (hasQualifier || nameMatched);

  return {
    status: isSatisfied ? 'match' : 'review',
    verdict: isSatisfied ? 'BUSINESS_DETAILS_VERIFIED' : 'BUSINESS_DETAILS_INCOMPLETE',
    hasQualifier,
    qualifierFound: qualifierMatch ? qualifierMatch[1] : null,
    hasAddressAndZip,
    addressSnippet: locationMatch ? locationMatch[0] : null,
    citation: '21 CFR 101.5(a), (d)',
    explanation: isSatisfied
      ? `Name and place of business verified under 21 CFR 101.5 (${locationMatch ? locationMatch[0] : 'City/State/ZIP present'}).`
      : 'Business details require verification: Ensure complete corporate name, qualification ("Distributed by"), and physical city, state, and ZIP are present.',
  };
}
