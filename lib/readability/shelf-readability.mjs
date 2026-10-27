/**
 * Shelf-Distance Readability Simulation & Statutory Typography Screening Engine.
 * (lib/readability/shelf-readability.mjs)
 *
 * Implements PackSignal Upgrade #43:
 * 1. Mode A: Shelf Readability Simulation (estimated visual-design review based on
 *    physical text dimensions, viewing distance 30 cm - 2 m, angular size in arcmin,
 *    and vision profiles).
 * 2. Mode B: Legal Typography Inspection (statutory type-height requirements under
 *    21 CFR 101.2(c), 21 CFR 101.105(h), 21 CFR 101.9).
 *
 * CRITICAL SEPARATION PRINCIPLE:
 * Readability simulation (Mode A) and Legal Typography (Mode B) are completely independent:
 * - A legal font size violation remains an ISSUE at 30 cm, 1 m, or 2 m.
 * - Text that is legal at 1/16 inch on a small carton may still be unreadable at 2 meters.
 * - Moving the distance slider NEVER mutates the underlying regulatory finding status!
 */

import {
  calculateVisualAngle,
  DISTANCE_BOUNDS_CM,
  DISTANCE_PRESETS_CM,
  PT_TO_MM
} from './visual-angle.mjs';

import {
  READABILITY_PROFILES,
  READABILITY_RISK,
  classifyReadabilityRisk
} from './readability-profiles.mjs';

import {
  estimateTextRunContrast
} from './text-contrast.mjs';

import {
  calculatePdpArea,
  PACKAGE_TYPES,
  PDP_SOURCE_AUTHORITY
} from '../print/pdp-area.mjs';

import {
  getNetQuantityMinimumHeight,
  evaluateTypography
} from '../font-preflight.mjs';

/**
 * Packaging declaration classifications.
 */
export const DECLARATION_TYPES = Object.freeze({
  LEGALLY_REQUIRED_ELEMENT: 'LEGALLY_REQUIRED_ELEMENT',
  COMPANY_REQUIRED_ELEMENT: 'COMPANY_REQUIRED_ELEMENT',
  MARKETING_CLAIM: 'MARKETING_CLAIM',
  DECORATIVE_TEXT: 'DECORATIVE_TEXT',
  BRAND_LOGO: 'BRAND_LOGO'
});

/**
 * Classifies a text category into its regulatory declaration type.
 *
 * @param {string} category
 * @param {string} [text='']
 * @returns {string}
 */
export function classifyDeclarationType(category, text = '') {
  const cat = String(category || '').toLowerCase();
  const t = String(text || '').toLowerCase();

  if (['net_quantity', 'ingredients', 'allergen', 'nutrition', 'identity', 'warning', 'contact', 'storage'].includes(cat)) {
    return DECLARATION_TYPES.LEGALLY_REQUIRED_ELEMENT;
  }
  if (t.includes('net wt') || t.includes('contains:') || t.includes('nutrition facts') || t.includes('ingredients:')) {
    return DECLARATION_TYPES.LEGALLY_REQUIRED_ELEMENT;
  }
  if (cat === 'claim' || t.includes('vegan') || t.includes('no added sugar') || t.includes('organic') || t.includes('gluten free')) {
    return DECLARATION_TYPES.MARKETING_CLAIM;
  }
  if (cat === 'brand' || t.includes('dancing fish') || t.includes('trademark')) {
    return DECLARATION_TYPES.BRAND_LOGO;
  }
  if (cat === 'company_standard' || t.includes('quality guarantee') || t.includes('batch:')) {
    return DECLARATION_TYPES.COMPANY_REQUIRED_ELEMENT;
  }
  return DECLARATION_TYPES.DECORATIVE_TEXT;
}

/**
 * Evaluates the independent statutory typography compliance of a text region (Mode B).
 *
 * @param {Object} textRegion
 * @param {Object} [pdpEvaluation]
 * @returns {Object} Legal typography record
 */
export function evaluateLegalTypographyCompliance(textRegion, pdpEvaluation = null) {
  if (!textRegion) {
    return {
      evaluated: false,
      status: 'UNABLE',
      requiredHeightMm: null,
      measuredHeightMm: null,
      ruleCitation: '21 CFR 101.2(c)',
      explanation: 'No text region provided for typography inspection.'
    };
  }

  // Hidden text can never satisfy statutory labeling
  if (textRegion.visibility === 'hidden' || textRegion.excludedFromCompliance) {
    return {
      evaluated: true,
      status: 'ISSUE',
      checkVerdict: 'TEXT_HIDDEN_OCCLUDED',
      measuredHeightMm: 0,
      requiredHeightMm: 1.5875,
      differenceMm: -1.5875,
      ruleCitation: '21 CFR 101.2(c)',
      ruleName: 'General Mandatory Information Letter Height',
      isIndependentOfDistance: true,
      explanation: 'Text is occluded by vector artwork layers. Hidden text cannot satisfy mandatory labeling laws.'
    };
  }

  const category = (textRegion.category || '').toLowerCase();
  const text = (textRegion.originalText || '').toLowerCase();

  // 1. Net Quantity: 21 CFR 101.105(h) schedule based on PDP area
  if (category === 'net_quantity' || text.includes('net wt') || text.includes('net weight') || /\b\d+\s*(?:g|oz|kg|lb|ml|fl\s*oz)\b/i.test(text)) {
    if (!pdpEvaluation || pdpEvaluation.status === 'PDP_AREA_UNVERIFIED' || pdpEvaluation.pdpAreaSqIn == null) {
      return {
        evaluated: true,
        status: 'UNABLE',
        checkVerdict: 'PDP_AREA_UNVERIFIED',
        measuredHeightMm: textRegion.measuredGlyphHeightMm || textRegion.physicalGlyphHeightMm,
        requiredHeightMm: null,
        ruleCitation: '21 CFR 101.105(h)',
        ruleName: 'Net Quantity Letter Height Schedule',
        isIndependentOfDistance: true,
        explanation: 'Statutory minimum type height cannot be verified: Principal Display Panel (PDP) dimensions are unconfirmed.',
        limitations: 'Provide confirmed carton or can dimensions to establish statutory type size bracket under 21 CFR 101.105(h).'
      };
    }

    const netQtyReq = getNetQuantityMinimumHeight(pdpEvaluation.pdpAreaSqIn, { isEmbossedOrMolded: Boolean(textRegion.isEmbossed) });
    const measuredMm = textRegion.measuredGlyphHeightMm || textRegion.physicalGlyphHeightMm || (textRegion.nominalFontSizePt ? textRegion.nominalFontSizePt * PT_TO_MM * 0.70 : null);
    const requiredMm = netQtyReq.minimumMm;

    if (measuredMm == null) {
      return {
        evaluated: true,
        status: 'UNABLE',
        checkVerdict: 'GLYPH_UNMEASURABLE',
        measuredHeightMm: null,
        requiredHeightMm: requiredMm,
        ruleCitation: '21 CFR 101.105(h)',
        isIndependentOfDistance: true,
        explanation: 'Could not extract vector glyph outline height from PDF stream.'
      };
    }

    const diffMm = measuredMm - requiredMm;
    const passes = diffMm >= -0.05; // 0.05 mm tolerance for digital rounding

    return {
      evaluated: true,
      status: passes ? 'MATCH' : 'ISSUE',
      checkVerdict: passes ? 'STATUTORY_COMPLIANT' : 'TYPOGRAPHY_DEFICIENT',
      measuredHeightMm: Math.round(measuredMm * 1000) / 1000,
      requiredHeightMm: requiredMm,
      differenceMm: Math.round(diffMm * 1000) / 1000,
      pdpAreaSqIn: pdpEvaluation.pdpAreaSqIn,
      bracketLabel: netQtyReq.bracketLabel,
      fractionText: netQtyReq.fractionText,
      ruleCitation: '21 CFR 101.105(h)',
      ruleName: 'Net Quantity Letter Height Schedule',
      isIndependentOfDistance: true,
      explanation: passes
        ? `Measured letter height (${measuredMm.toFixed(2)} mm) meets or exceeds statutory minimum of ${requiredMm.toFixed(2)} mm (${netQtyReq.fractionText}) for ${pdpEvaluation.pdpAreaSqIn} sq in PDP.`
        : `Measured letter height (${measuredMm.toFixed(2)} mm) is below the statutory minimum of ${requiredMm.toFixed(2)} mm (${netQtyReq.fractionText}) required under 21 CFR 101.105(h).`
    };
  }

  // 2. General Mandatory Information: 21 CFR 101.2(c) (≥ 1/16 in = 1.5875 mm)
  if (['ingredients', 'allergen', 'nutrition', 'contact', 'storage'].includes(category)) {
    const requiredMm = 1.5875; // 1/16"
    const measuredMm = textRegion.measuredGlyphHeightMm || textRegion.physicalGlyphHeightMm || (textRegion.nominalFontSizePt ? textRegion.nominalFontSizePt * PT_TO_MM * 0.50 : null);

    if (measuredMm == null) {
      return {
        evaluated: true,
        status: 'UNABLE',
        checkVerdict: 'GLYPH_UNMEASURABLE',
        measuredHeightMm: null,
        requiredHeightMm: requiredMm,
        ruleCitation: '21 CFR 101.2(c)',
        isIndependentOfDistance: true,
        explanation: 'Glyph height could not be extracted.'
      };
    }

    const diffMm = measuredMm - requiredMm;
    const passes = diffMm >= -0.05;

    return {
      evaluated: true,
      status: passes ? 'MATCH' : 'ISSUE',
      checkVerdict: passes ? 'STATUTORY_COMPLIANT' : 'TYPOGRAPHY_DEFICIENT',
      measuredHeightMm: Math.round(measuredMm * 1000) / 1000,
      requiredHeightMm: requiredMm,
      differenceMm: Math.round(diffMm * 1000) / 1000,
      ruleCitation: '21 CFR 101.2(c)',
      ruleName: 'General Mandatory Information Letter Height',
      isIndependentOfDistance: true,
      explanation: passes
        ? `Measured lowercase letter height (${measuredMm.toFixed(2)} mm) complies with 21 CFR 101.2(c) minimum of 1/16" (1.59 mm).`
        : `Measured lowercase letter height (${measuredMm.toFixed(2)} mm) is below the 1/16" (1.59 mm) minimum required by 21 CFR 101.2(c).`
    };
  }

  // Non-mandatory marketing or decorative copy
  return {
    evaluated: false,
    status: 'REVIEW',
    checkVerdict: 'NOT_REGULATED_ELEMENT',
    measuredHeightMm: textRegion.measuredGlyphHeightMm || textRegion.physicalGlyphHeightMm,
    requiredHeightMm: null,
    ruleCitation: 'FDA General Conspicuousness (21 CFR 101.15)',
    ruleName: 'Prominence and Conspicuousness',
    isIndependentOfDistance: true,
    explanation: 'Element is not subject to a fixed physical type-height schedule; subject to general conspicuousness criteria.'
  };
}

/**
 * Primary analysis function implementing PackSignal Upgrade #43.
 *
 * @param {Object} options
 * @param {Object} [options.artwork] - Artwork document with pages, vectorTypography, pdpDimensions
 * @param {Array} [options.textRegions] - Text run records (from native font inspector or manual input)
 * @param {number} [options.distanceCm=100] - Simulated viewing distance in cm (30 - 200)
 * @param {string} [options.viewingProfile='STANDARD_20_20'] - Profile ID
 * @param {Object} [options.packageGeometry] - Physical packaging geometry (carton, can, bottle, pouch)
 * @param {Array} [options.typographyResults] - Pre-evaluated findings from preflight
 * @param {string} [options.shopperPersona=null] - Active shopper persona ID (nut-allergy, vegan, sugar-watcher)
 * @returns {Object} Comprehensive Shelf-Distance Readability analysis record
 */
export function analyzeShelfReadability({
  artwork = null,
  textRegions = null,
  distanceCm = DISTANCE_BOUNDS_CM.DEFAULT,
  viewingProfile = 'STANDARD_20_20',
  packageGeometry = null,
  typographyResults = [],
  shopperPersona = null
} = {}) {
  // Clamp distance between 30 cm and 200 cm
  const rawDist = Number(distanceCm);
  const clampedDistanceCm = Math.min(
    DISTANCE_BOUNDS_CM.MAX,
    Math.max(DISTANCE_BOUNDS_CM.MIN, Number.isFinite(rawDist) ? rawDist : DISTANCE_BOUNDS_CM.DEFAULT)
  );

  const profile = READABILITY_PROFILES[viewingProfile] || READABILITY_PROFILES.STANDARD_20_20;

  // Resolve text regions to evaluate
  let runs = [];
  if (Array.isArray(textRegions) && textRegions.length > 0) {
    runs = textRegions;
  } else if (artwork?.vectorTypography?.textRuns) {
    runs = artwork.vectorTypography.textRuns;
  } else if (artwork?.details?.vector_typography?.textRuns) {
    runs = artwork.details.vector_typography.textRuns;
  }

  // Calculate PDP area if package dimensions available
  const pdpDims = artwork?.pdpDimensions || packageGeometry?.dimensions || {};
  const pkgType = packageGeometry?.packageType || artwork?.packageType || PACKAGE_TYPES.RECTANGULAR_CARTON;
  const pdpEval = calculatePdpArea({
    dimensions: pdpDims,
    packageType: pkgType,
    sourceAuthority: pdpDims.sourceAuthority || PDP_SOURCE_AUTHORITY.REVIEWER_CONFIRMED
  });

  const evaluatedRegions = [];

  for (let i = 0; i < runs.length; i++) {
    const tr = runs[i];

    // Determine physical height in mm
    // Priority: measuredLowercaseOHeightMm > measuredGlyphHeightMm > nominal pt conversion > box height
    let physicalHeightMm = tr.measuredLowercaseOHeightMm || tr.measuredGlyphHeightMm || tr.physicalGlyphHeightMm;
    let measurementMethod = tr.measurementMethod || 'NATIVE_CHARACTER_GEOMETRY';

    if (!physicalHeightMm && tr.nominalFontSizePt) {
      physicalHeightMm = tr.nominalFontSizePt * PT_TO_MM * 0.70;
      measurementMethod = 'NOMINAL_PT_CONVERTED';
    } else if (!physicalHeightMm && tr.boundingBox && artwork?.pages?.[0]?.height) {
      const pageHeightPt = artwork.pages[0].height;
      const boxHeightNorm = Math.abs(tr.boundingBox[3] - tr.boundingBox[1]);
      physicalHeightMm = boxHeightNorm * pageHeightPt * PT_TO_MM;
      measurementMethod = 'RASTER_HEIGHT_ESTIMATE';
    }

    // Determine surface viewing angle if package geometry exists
    let viewingAngleDeg = 0;
    if (packageGeometry && (pkgType === PACKAGE_TYPES.CYLINDRICAL_CAN || pkgType === PACKAGE_TYPES.NEARLY_CYLINDRICAL_BOTTLE)) {
      // Curved cylinder surface: approximate angle based on horizontal position across the label
      if (Array.isArray(tr.boundingBox)) {
        const centerX = (tr.boundingBox[0] + tr.boundingBox[2]) / 2.0;
        // Map 0 -> -70 deg, 0.5 -> 0 deg (center facing), 1.0 -> +70 deg
        viewingAngleDeg = Math.abs((centerX - 0.5) * 140.0);
      }
    }

    // 1. Calculate Visual Angle (Mode A)
    const angularResult = calculateVisualAngle({
      physicalHeightMm,
      distanceCm: clampedDistanceCm,
      viewingAngleDeg,
      measurementMethod
    });

    // 2. Estimate Contrast where supported
    const contrastResult = estimateTextRunContrast(tr, {
      assumeWhiteSubstrate: true
    });

    // 3. Classify Declaration Type
    const declarationType = classifyDeclarationType(tr.category, tr.originalText);
    const isMandatory = declarationType === DECLARATION_TYPES.LEGALLY_REQUIRED_ELEMENT;

    // 4. Classify Readability Risk (Mode A)
    const riskResult = classifyReadabilityRisk({
      angularHeightArcMin: angularResult.angularHeightArcMin,
      profileId: profile.id,
      contrastRecord: contrastResult,
      isMandatory
    });

    // 5. Evaluate Independent Legal Typography (Mode B)
    const legalResult = evaluateLegalTypographyCompliance(tr, pdpEval);

    // 6. Check Shopper Persona Relevance (Upgrade #42 Integration)
    let isPersonaRelevant = false;
    let personaTag = null;
    const lowerText = String(tr.originalText || '').toLowerCase();
    if (shopperPersona === 'nut-allergy') {
      if (tr.category === 'allergen' || tr.category === 'ingredients' || lowerText.includes('almond') || lowerText.includes('pecan') || lowerText.includes('walnut') || lowerText.includes('may contain')) {
        isPersonaRelevant = true;
        personaTag = 'NUT_ALLERGY';
      }
    } else if (shopperPersona === 'vegan') {
      if (lowerText.includes('vegan') || lowerText.includes('honey') || lowerText.includes('cholesterol') || tr.category === 'claim') {
        isPersonaRelevant = true;
        personaTag = 'VEGAN';
      }
    } else if (shopperPersona === 'sugar-watcher') {
      if (lowerText.includes('sugar') || lowerText.includes('honey') || lowerText.includes('0g added') || lowerText.includes('no added')) {
        isPersonaRelevant = true;
        personaTag = 'SUGAR_WATCHER';
      }
    }

    evaluatedRegions.push({
      regionId: tr.textRunId || `region-${i + 1}`,
      originalText: tr.originalText || '',
      category: tr.category || 'general',
      declarationType,
      isMandatory,
      page: tr.page || 1,
      boundingBox: tr.boundingBox || null,
      fontName: tr.fontName || tr.fontResource || 'Unknown',
      nominalFontSizePt: tr.nominalFontSizePt || null,
      physicalGlyphHeightMm: physicalHeightMm != null ? Math.round(physicalHeightMm * 1000) / 1000 : null,
      measurementMethod,
      visibility: tr.visibility || 'visible',

      // Mode A: Shelf Distance Simulation
      distanceCm: clampedDistanceCm,
      distanceMeters: Math.round((clampedDistanceCm / 100.0) * 100) / 100,
      angularHeightArcMin: angularResult.angularHeightArcMin,
      angularHeightDeg: angularResult.angularHeightDeg,
      readabilityRisk: riskResult.riskLevel,
      riskExplanation: riskResult.explanation,
      recommendation: riskResult.recommendation,

      // Contrast
      contrast: contrastResult,

      // Surface Geometry
      viewingAngleDeg: Math.round(viewingAngleDeg * 10) / 10,
      effectiveHeightMm: angularResult.effectiveHeightMm,

      // Mode B: Legal Typography Inspection
      legalTypography: legalResult,

      // Persona Link
      isPersonaRelevant,
      personaTag
    });
  }

  // 7. Track First Dropout Element:
  // The mandatory element that drops out earliest has the smallest angular height
  const highRiskMandatory = evaluatedRegions
    .filter(r => r.isMandatory && r.readabilityRisk === READABILITY_RISK.HIGH_READABILITY_RISK)
    .sort((a, b) => (a.angularHeightArcMin ?? 999) - (b.angularHeightArcMin ?? 999));

  const firstDropout = highRiskMandatory[0] || null;
  const firstDropoutElement = firstDropout ? (firstDropout.originalText || firstDropout.category) : null;
  const firstDropoutDistanceMeters = firstDropout ? clampedDistanceCm / 100.0 : null;

  // Summary Metrics
  const lowRiskCount = evaluatedRegions.filter(r => r.readabilityRisk === READABILITY_RISK.LOW_VISUAL_SIZE_RISK).length;
  const elevatedRiskCount = evaluatedRegions.filter(r => r.readabilityRisk === READABILITY_RISK.ELEVATED_READABILITY_RISK).length;
  const highRiskCount = evaluatedRegions.filter(r => r.readabilityRisk === READABILITY_RISK.HIGH_READABILITY_RISK).length;
  const uncertainCount = evaluatedRegions.filter(r => r.readabilityRisk === READABILITY_RISK.INSUFFICIENT_DATA).length;

  const riskRegions = evaluatedRegions.filter(r => r.readabilityRisk === READABILITY_RISK.HIGH_READABILITY_RISK || r.readabilityRisk === READABILITY_RISK.ELEVATED_READABILITY_RISK);
  const criticalDeclarations = evaluatedRegions.filter(r => r.isMandatory);

  return {
    distanceCm: clampedDistanceCm,
    distanceMm: clampedDistanceCm * 10,
    distanceMeters: Math.round((clampedDistanceCm / 100.0) * 100) / 100,
    profileId: profile.id,
    viewingProfile: profile,
    pdpEvaluation: pdpEval,
    packageType: pkgType,
    evaluatedRegions,
    riskRegions,
    uncertainRegions: evaluatedRegions.filter(r => r.readabilityRisk === READABILITY_RISK.INSUFFICIENT_DATA),
    criticalDeclarations,
    metrics: {
      totalEvaluated: evaluatedRegions.length,
      lowRiskCount,
      elevatedRiskCount,
      highRiskCount,
      uncertainCount,
      firstDropoutElement: firstDropoutElement || (highRiskCount > 0 ? evaluatedRegions.find(r => r.readabilityRisk === READABILITY_RISK.HIGH_READABILITY_RISK)?.originalText : null),
      firstDropoutDistanceMeters: firstDropoutDistanceMeters || (highRiskCount > 0 ? clampedDistanceCm / 100.0 : null)
    },
    limitations: [
      'Heuristic visual-angle screening model based on standard geometrical optics (2 * atan(h / 2d)).',
      'Not a substitute for empirical human-subject readability trials or clinical acuity testing.',
      'Legal type-height compliance under 21 CFR 101.105(h) and 101.2(c) is evaluated independently of simulated viewing distance.',
      'Display screen pixel dimensions are uncalibrated; visual scale provides an approximate relative preview.'
    ]
  };
}

/**
 * Builds an evidence-backed "Ask Prepress" collaboration message for a readability concern.
 *
 * @param {Object} region - Evaluated text region
 * @param {string} [filename='Artwork.pdf']
 * @returns {string}
 */
export function buildAskPrepressMessage(region, filename = 'Artwork.pdf') {
  if (!region) return '';
  const legal = region.legalTypography || {};
  const reqStr = legal.requiredHeightMm != null ? `${legal.requiredHeightMm.toFixed(2)} mm (${legal.ruleCitation})` : 'Not subject to fixed statutory schedule';

  return (
    `Hi Prepress Team,\n\n` +
    `PackSignal identified a text region with potential readability concerns during shelf simulation.\n\n` +
    `Document: ${filename}\n` +
    `Text: "${region.originalText}"\n` +
    `Category: ${region.category} (${region.declarationType})\n` +
    `Font: ${region.fontName} (nominal ${region.nominalFontSizePt || '—'} pt)\n` +
    `Measured physical height: ${region.physicalGlyphHeightMm != null ? region.physicalGlyphHeightMm.toFixed(2) : '—'} mm\n` +
    `Viewing distance: ${region.distanceCm} cm (${region.distanceMeters} m)\n` +
    `Subtended angular height: ${region.angularHeightArcMin != null ? region.angularHeightArcMin.toFixed(2) : '—'} arcminutes\n` +
    `Estimated visual risk: ${region.readabilityRisk}\n` +
    `Applicable legal requirement: ${reqStr}\n` +
    `Current statutory status: ${legal.status || 'UNVERIFIED'}\n\n` +
    `Could you review the typography, contrast backing, and panel placement before plate release?`
  );
}

/**
 * Generates smart typography correction suggestions for a text region.
 *
 * @param {Object} region
 * @returns {Array<string>}
 */
export function getSmartCorrectionSuggestions(region) {
  if (!region) return [];
  const suggestions = [];
  const legal = region.legalTypography || {};

  // Statutory shortfall
  if (legal.status === 'ISSUE' && legal.requiredHeightMm != null && region.physicalGlyphHeightMm != null) {
    const neededIncreaseMm = legal.requiredHeightMm - region.physicalGlyphHeightMm;
    suggestions.push(
      `STATUTORY REMEDIATION: Increase printed letter height by at least +${neededIncreaseMm.toFixed(2)} mm to satisfy ${legal.ruleCitation} minimum of ${legal.requiredHeightMm.toFixed(2)} mm for this PDP.`
    );
  }

  // Visual size risk
  if (region.readabilityRisk === READABILITY_RISK.HIGH_READABILITY_RISK) {
    suggestions.push('DESIGN RECOMMENDATION: Enlarge font size or select a typeface with a higher x-height proportion (e.g. 0.55+ x-height).');
    if (region.isMandatory) {
      suggestions.push('PANEL HIERARCHY: Move or duplicate this mandatory declaration on the principal display panel to improve shopper shelf glanceability.');
    }
  }

  // Contrast risk
  if (region.contrast && region.contrast.contrastRatio != null && region.contrast.contrastRatio < 3.0) {
    suggestions.push(
      `CONTRAST ENHANCEMENT: Current estimated contrast is ${region.contrast.contrastRatio}:1. Place an opaque white or high-contrast backing box behind the text block to improve legibility.`
    );
  }

  return suggestions;
}

/**
 * Compares shelf readability results between V1 and V2 artwork revisions.
 *
 * @param {Object} v1Analysis
 * @param {Object} v2Analysis
 * @returns {Object} Revision comparison record
 */
export function compareReadabilityRevisions(v1Analysis, v2Analysis) {
  if (!v1Analysis || !v2Analysis) {
    return {
      status: 'UNAVAILABLE',
      explanation: 'Both V1 and V2 readability analyses are required for comparison.'
    };
  }

  const v1Regions = v1Analysis.evaluatedRegions || [];
  const v2Regions = v2Analysis.evaluatedRegions || [];

  const matchedComparisons = [];

  for (const r1 of v1Regions) {
    // Match by category and text similarity
    const r2 = v2Regions.find(item => item.category === r1.category || item.originalText === r1.originalText);
    if (!r2) continue;

    const heightDeltaMm = (r2.physicalGlyphHeightMm != null && r1.physicalGlyphHeightMm != null)
      ? Math.round((r2.physicalGlyphHeightMm - r1.physicalGlyphHeightMm) * 1000) / 1000
      : null;

    const angularDeltaArcMin = (r2.angularHeightArcMin != null && r1.angularHeightArcMin != null)
      ? Math.round((r2.angularHeightArcMin - r1.angularHeightArcMin) * 100) / 100
      : null;

    const legalResolved = r1.legalTypography?.status === 'ISSUE' && r2.legalTypography?.status === 'MATCH';
    const visualImproved = r1.readabilityRisk === READABILITY_RISK.HIGH_READABILITY_RISK &&
      (r2.readabilityRisk === READABILITY_RISK.LOW_VISUAL_SIZE_RISK || r2.readabilityRisk === READABILITY_RISK.ELEVATED_READABILITY_RISK);

    matchedComparisons.push({
      text: r1.originalText,
      category: r1.category,
      v1HeightMm: r1.physicalGlyphHeightMm,
      v2HeightMm: r2.physicalGlyphHeightMm,
      heightDeltaMm,
      v1AngularArcMin: r1.angularHeightArcMin,
      v2AngularArcMin: r2.angularHeightArcMin,
      angularDeltaArcMin,
      v1Risk: r1.readabilityRisk,
      v2Risk: r2.readabilityRisk,
      v1LegalStatus: r1.legalTypography?.status,
      v2LegalStatus: r2.legalTypography?.status,
      legalResolved,
      visualImproved,
      verdict: legalResolved
        ? 'RESOLVED_STATUTORY_DEFICIENCY'
        : (visualImproved ? 'IMPROVED_SHELF_READABILITY' : (heightDeltaMm < 0 ? 'REGRESSION' : 'PERSISTENT'))
    });
  }

  return {
    status: 'COMPARISON_COMPLETE',
    distanceCm: v1Analysis.distanceCm,
    profileId: v1Analysis.profileId,
    comparisons: matchedComparisons,
    summary: {
      totalCompared: matchedComparisons.length,
      statutoryResolvedCount: matchedComparisons.filter(c => c.legalResolved).length,
      visualImprovedCount: matchedComparisons.filter(c => c.visualImproved).length
    }
  };
}
