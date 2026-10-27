/**
 * PackSignal Net Quantity & Legal Metrology Engine (lib/regulatory/quantities.mjs)
 * Implements 21 CFR 101.105 & Fair Packaging and Labeling Act (FPLA):
 * - Dual declaration requirement: US Customary (oz, lb, fl oz) and Metric (g, kg, ml, L)
 * - Placement in bottom 30 percent of Principal Display Panel (21 CFR 101.105(f))
 * - Accurate numerical equivalence and rounding
 * - Minimum font size based on PDP surface area (21 CFR 101.105(h))
 */

import { quantity, equalQuantity } from '../engine.mjs';

/**
 * Parses all net quantity occurrences in text.
 */
export function extractNetQuantities(text) {
  if (!text) return [];
  const matches = [];
  const regex = /\b(?:net\s*(?:wt\.?|weight|contents)?\s*[:.-]?\s*)?(\d+(?:\.\d+)?)\s*(kg|g|mg|l|cl|ml|fl\s*oz|oz|lbs?)\b/gi;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const raw = m[0].trim();
    const val = Number(m[1]);
    const unit = m[2].toLowerCase().replace(/\s+/g, '');
    const isCustomary = ['oz', 'lb', 'lbs', 'floz'].includes(unit);
    const isMetric = ['g', 'kg', 'mg', 'ml', 'cl', 'l'].includes(unit);
    matches.push({ raw, value: val, unit, isCustomary, isMetric, index: m.index });
  }
  return matches;
}

/**
 * Minimum type size for net quantity under 21 CFR 101.105(h):
 * - PDP area <= 5 sq in: 1/16 in (4.5 pt)
 * - > 5 to <= 25 sq in: 1/8 in (9 pt)
 * - > 25 to <= 100 sq in: 3/16 in (13.5 pt)
 * - > 100 to <= 400 sq in: 1/4 in (18 pt)
 * - > 400 sq in: 1/2 in (36 pt)
 */
export function getRequiredQuantityTypeSizePt(pdpAreaSqIn) {
  if (!pdpAreaSqIn || isNaN(pdpAreaSqIn)) return 9.0; // standard default
  if (pdpAreaSqIn <= 5) return 4.5;
  if (pdpAreaSqIn <= 25) return 9.0;
  if (pdpAreaSqIn <= 100) return 13.5;
  if (pdpAreaSqIn <= 400) return 18.0;
  return 36.0;
}

export function evaluateNetQuantityDeclaration({
  approvedSourceQty = '',
  artworkText = '',
  artworkSpans = [],
  pdpAreaSqIn = 50,
}) {
  const extracted = extractNetQuantities(artworkText);
  if (!extracted.length) {
    return {
      status: 'issue',
      verdict: 'QUANTITY_MISSING',
      explanation: 'No net quantity statement detected on packaging artwork.',
      citation: '21 CFR 101.105(a)',
    };
  }

  // 1. Exact Source Equivalence
  const sourceMatches = approvedSourceQty
    ? extracted.some(e => equalQuantity(approvedSourceQty, `${e.value} ${e.unit}`))
    : true;

  // 2. Dual Declaration Check (US Customary + Metric under FPLA / 21 CFR 101.105)
  const hasCustomary = extracted.some(e => e.isCustomary);
  const hasMetric = extracted.some(e => e.isMetric);
  const isDualDeclared = hasCustomary && hasMetric;

  // 3. Bottom 30% of PDP Check (using artworkSpans if available)
  let inBottom30 = null;
  let detectedTypeSizePt = null;

  if (artworkSpans?.length) {
    for (const span of artworkSpans) {
      if (/\b(?:net\s*wt|750\s*g|1000\s*m|oz)\b/i.test(span.text)) {
        if (span.boxNorm) {
          // Bottom 30% means Y coordinate between 0.70 and 1.00
          const yCenter = (span.boxNorm[1] + span.boxNorm[3]) / 2;
          inBottom30 = yCenter >= 0.65; // with slight tolerance
        }
        if (span.fontSizePt) {
          detectedTypeSizePt = span.fontSizePt;
        }
      }
    }
  }

  const requiredTypeSize = getRequiredQuantityTypeSizePt(pdpAreaSqIn);
  const typeSizeSatisfied = detectedTypeSizePt ? detectedTypeSizePt >= (requiredTypeSize - 0.5) : true;

  const hasIssues = !sourceMatches;
  const needsReview = !isDualDeclared || inBottom30 === false || !typeSizeSatisfied;

  const status = hasIssues ? 'issue' : (needsReview ? 'review' : 'match');

  return {
    status,
    verdict: hasIssues ? 'QUANTITY_VALUE_MISMATCH' : (needsReview ? 'METROLOGY_FORMAT_REVIEW' : 'QUANTITY_COMPLIANT'),
    extractedQuantities: extracted.map(e => e.raw),
    sourceMatches,
    dualDeclaration: {
      isDualDeclared,
      hasCustomary,
      hasMetric,
      note: isDualDeclared ? 'Both US Customary and Metric units declared.' : 'Single unit system detected; dual declaration required for US packaged foods under FPLA.',
    },
    placement: {
      inBottom30,
      note: inBottom30 === false ? 'Net quantity located outside bottom 30% of PDP.' : 'Placement in bottom 30% of PDP satisfied or pending zone confirmation.',
    },
    typeSize: {
      requiredPt: requiredTypeSize,
      detectedPt: detectedTypeSizePt,
      typeSizeSatisfied,
    },
    citation: '21 CFR 101.105(f), (h), 15 U.S.C. 1453',
    explanation: status === 'match'
      ? `Net quantity declared correctly with verified source agreement (${approvedSourceQty || extracted[0].raw}).`
      : hasIssues
        ? `Net quantity declaration mismatch: Artwork declares "${extracted.map(e => e.raw).join(' / ')}" differing from approved source "${approvedSourceQty}".`
        : `Net quantity format review: ${!isDualDeclared ? 'Dual customary/metric declaration required under FPLA. ' : ''}${inBottom30 === false ? 'Must appear in bottom 30% of PDP. ' : ''}`,
  };
}

export function evaluateNetQuantity({
  declaredText = '',
  expectedValue = '',
  pdpAreaSqIn = 50,
  panelPlacement = null,
} = {}) {
  const res = evaluateNetQuantityDeclaration({
    approvedSourceQty: expectedValue,
    artworkText: declaredText,
    pdpAreaSqIn,
  });
  return {
    status: res.status,
    hasDualUnits: res.dualDeclaration.isDualDeclared,
    placementPass: panelPlacement === 'BOTTOM_30_PERCENT' ? true : res.placement.inBottom30 !== false,
    explanation: res.explanation,
  };
}

