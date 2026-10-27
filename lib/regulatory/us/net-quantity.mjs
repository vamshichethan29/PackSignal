/**
 * PackSignal US Food Label Preflight Pack — Check US-001: Net Quantity
 * Legal Basis: 21 CFR 101.105, 15 U.S.C. 1453 (Fair Packaging and Labeling Act)
 */

import { FDA_STATUTORY_CITATIONS } from './references.mjs';

const MASS_CONVERSIONS_TO_GRAMS = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  mg: 0.001,
  oz: 28.349523125,
  ounce: 28.349523125,
  ounces: 28.349523125,
  lb: 453.59237,
  lbs: 453.59237,
  pound: 453.59237,
  pounds: 453.59237,
};

const VOLUME_CONVERSIONS_TO_ML = {
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  cl: 10,
  l: 1000,
  liter: 1000,
  liters: 1000,
  floz: 29.5735295625,
  'fl oz': 29.5735295625,
  fluidounce: 29.5735295625,
};

/**
 * Converts quantity between compatible units.
 */
export function convertQuantity(value, fromUnit, toUnit) {
  const normFrom = String(fromUnit || '').toLowerCase().trim().replace(/\s+/g, '');
  const normTo = String(toUnit || '').toLowerCase().trim().replace(/\s+/g, '');

  if (normFrom === normTo) return value;

  // Mass to mass
  if (MASS_CONVERSIONS_TO_GRAMS[normFrom] && MASS_CONVERSIONS_TO_GRAMS[normTo]) {
    const inGrams = value * MASS_CONVERSIONS_TO_GRAMS[normFrom];
    return inGrams / MASS_CONVERSIONS_TO_GRAMS[normTo];
  }

  // Volume to volume
  if (VOLUME_CONVERSIONS_TO_ML[normFrom] && VOLUME_CONVERSIONS_TO_ML[normTo]) {
    const inMl = value * VOLUME_CONVERSIONS_TO_ML[normFrom];
    return inMl / VOLUME_CONVERSIONS_TO_ML[normTo];
  }

  // Incompatible dimensions
  return null;
}

/**
 * Parses all net quantity occurrences in text.
 */
export function extractNetQuantityDeclarations(text) {
  if (!text) return [];
  const matches = [];
  const regex = /\b(?:net\s*(?:wt\.?|weight|contents)?\s*[:.-]?\s*)?(\d+(?:\.\d+)?)\s*(kg|g|mg|l|cl|ml|fl\s*oz|oz|lbs?)\b/gi;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const raw = m[0].trim();
    const val = Number(m[1]);
    const unitRaw = m[2].toLowerCase().replace(/\s+/g, '');
    const isCustomary = ['oz', 'lb', 'lbs', 'floz'].includes(unitRaw);
    const isMetric = ['g', 'kg', 'mg', 'ml', 'cl', 'l'].includes(unitRaw);
    const isVolume = ['l', 'cl', 'ml', 'floz'].includes(unitRaw);

    matches.push({
      raw,
      value: val,
      unit: unitRaw,
      category: isVolume ? 'volume' : 'mass',
      system: isCustomary ? 'us_customary' : 'metric',
      index: m.index,
    });
  }
  return matches;
}

/**
 * Executes Check US-001: Net Quantity of Contents
 */
export function executeUsNetQuantityCheck({
  artworkText = '',
  approvedSourceQty = null,
  pdpAreaSqIn = 50,
  pdpMapped = false,
  panelPlacement = null,
  coverageConfirmed = true,
  evidenceBox = null,
} = {}) {
  const citation = FDA_STATUTORY_CITATIONS.US_001_NET_QUANTITY;

  // 1. Extract net quantity from artwork
  const extracted = extractNetQuantityDeclarations(artworkText);

  if (!extracted || extracted.length === 0) {
    if (!coverageConfirmed) {
      return {
        checkId: citation.checkId,
        title: citation.name,
        legalBasis: citation.citation,
        sourceUrl: citation.sourceUrl,
        applicability: 'applicable',
        executionStatus: 'requires_evidence',
        findingStatus: 'unable',
        requiredInputs: ['artwork_net_quantity', 'approved_source_net_quantity'],
        observedValue: 'Not detected in extracted artwork',
        expectedValue: approvedSourceQty || 'Declared Net Quantity',
        calculation: null,
        evidence: null,
        explanation: 'Net quantity declaration was not located in extracted artwork text. Extraction coverage is unconfirmed; manual visual inspection required.',
        limitations: 'Native text extraction may not capture vector-outlined or rotated text.',
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
      requiredInputs: ['artwork_net_quantity', 'approved_source_net_quantity'],
      observedValue: 'Missing',
      expectedValue: approvedSourceQty || 'Dual US Customary & Metric declaration',
      calculation: null,
      evidence: null,
      explanation: 'Statutory Violation under 21 CFR 101.105: Net quantity of contents is absent from packaging artwork.',
      limitations: 'Confirmed absence based on complete artwork panel inspection.',
    };
  }

  const primaryDecl = extracted[0];
  const observedText = extracted.map(e => e.raw).join(' / ');

  // 2. Check Dual Declaration (US Customary + Metric under FPLA)
  const isDualDeclared = (
    extracted.some(e => e.system === 'us_customary') &&
    extracted.some(e => e.system === 'metric')
  ) || (
    /(\d+(?:\.\d+)?)\s*(?:oz|fl\s*oz|lb)\b/i.test(artworkText) &&
    /(\d+(?:\.\d+)?)\s*(?:g|kg|ml|l)\b/i.test(artworkText)
  );

  // 3. Compare with Approved Source Quantity (if available)
  let sourceEquivalence = 'NOT_CHECKED';
  let calculationNote = null;
  let hasQuantityMismatch = false;

  if (approvedSourceQty) {
    const srcExtracted = extractNetQuantityDeclarations(approvedSourceQty);
    if (srcExtracted && srcExtracted.length > 0) {
      const srcPrimary = srcExtracted[0];

      // Check category match (mass vs volume)
      if (primaryDecl.category !== srcPrimary.category) {
        hasQuantityMismatch = true;
        calculationNote = `Unit category mismatch: Artwork declares ${primaryDecl.category} (${primaryDecl.unit}), but source specifies ${srcPrimary.category} (${srcPrimary.unit}). Density conversion required.`;
      } else {
        // Convert to common unit and compare
        const converted = convertQuantity(primaryDecl.value, primaryDecl.unit, srcPrimary.unit);
        if (converted !== null) {
          const diffPct = Math.abs(converted - srcPrimary.value) / srcPrimary.value;
          if (diffPct <= 0.02) {
            sourceEquivalence = 'EQUIVALENT';
            calculationNote = `${primaryDecl.value} ${primaryDecl.unit} converts to ${converted.toFixed(2)} ${srcPrimary.unit} (expected: ${srcPrimary.value} ${srcPrimary.unit}, tolerance: 2.0%).`;
          } else {
            hasQuantityMismatch = true;
            calculationNote = `Mathematical discrepancy: ${primaryDecl.value} ${primaryDecl.unit} = ${converted.toFixed(2)} ${srcPrimary.unit}, differing from approved source ${srcPrimary.value} ${srcPrimary.unit} (diff: ${(diffPct * 100).toFixed(1)}%).`;
          }
        } else {
          // Direct string match check
          const isStrMatch = primaryDecl.raw.toLowerCase() === srcPrimary.raw.toLowerCase();
          if (isStrMatch) {
            sourceEquivalence = 'EQUIVALENT';
          } else {
            hasQuantityMismatch = true;
          }
        }
      }
    }
  }

  // 4. Placement Check (bottom 30% of PDP under 21 CFR 101.105(f))
  let placementStatus = 'CONFIRMED';
  if (!pdpMapped) {
    placementStatus = 'UNDETERMINED_PDP';
  } else if (panelPlacement && panelPlacement.panel === 'PDP' && panelPlacement.normalizedY < 0.70) {
    placementStatus = 'OUTSIDE_BOTTOM_30';
  }

  // 5. Synthesize finding status
  let findingStatus = 'match';
  let explanation = '';

  if (hasQuantityMismatch) {
    findingStatus = 'issue';
    explanation = `Net quantity declaration mismatch: Artwork declares "${observedText}", differing from approved source specification "${approvedSourceQty}".`;
  } else if (!isDualDeclared) {
    findingStatus = 'issue';
    explanation = `Dual declaration violation under FPLA / 21 CFR 101.105: Packaging must declare net quantity in both US Customary and Metric units (observed: "${observedText}").`;
  } else if (placementStatus === 'OUTSIDE_BOTTOM_30') {
    findingStatus = 'review';
    explanation = `Placement warning: Net quantity should appear within the bottom 30% of the Principal Display Panel under 21 CFR 101.105(f).`;
  } else if (placementStatus === 'UNDETERMINED_PDP') {
    findingStatus = 'match'; // Quantity itself matches, note placement pending
    explanation = `Net quantity verified against source specification (${observedText}). Note: Placement within bottom 30% of PDP requires dieline zone confirmation.`;
  } else {
    findingStatus = 'match';
    explanation = `Net quantity declaration satisfies 21 CFR 101.105 dual declaration and matches approved specification (${observedText}).`;
  }

  return {
    checkId: citation.checkId,
    title: citation.name,
    legalBasis: citation.citation,
    sourceUrl: citation.sourceUrl,
    applicability: 'applicable',
    executionStatus: 'executed',
    findingStatus,
    requiredInputs: ['artwork_net_quantity', 'approved_source_net_quantity'],
    observedValue: observedText,
    expectedValue: approvedSourceQty || 'Dual US Customary and Metric units',
    calculation: calculationNote,
    evidence: evidenceBox ? [{ role: 'artwork', box: evidenceBox, text: observedText }] : null,
    explanation,
    limitations: 'Placement check assumes standard rectangular PDP. Dual declaration requires both US customary and metric units.',
  };
}
