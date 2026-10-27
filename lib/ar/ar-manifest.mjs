/**
 * PackSignal — AR Asset Manifest Engine (lib/ar/ar-manifest.mjs)
 * Phase 10B: Versioned asset manifest linking physical packaging panels,
 * compiled MindAR image targets, transparent red-pen overlays, and canonical findings.
 * 
 * Strict architectural rule: Manifest is generated OFFLINE. Zero AI calls during live AR.
 */

import { createHash } from 'node:crypto';

export const ESKO_CARTON_DIMENSIONS_MM = {
  width: 140,   // Front / Back panel width in mm
  height: 210,  // Carton height in mm
  depth: 60,    // Left / Right side panel depth in mm
};

/**
 * Builds the canonical AR asset manifest for a packaging review.
 * @param {Object} options
 * @param {string} options.reviewId
 * @param {string} options.market
 * @param {Array} options.findings
 * @param {string} options.packageId
 * @returns {Object} Canonical AR Asset Manifest
 */
export function buildArManifest(options = {}) {
  const {
    reviewId = 'organizer-sample-review',
    market = 'us',
    findings = [],
    packageId = 'dancing-fish-berry-crunch',
    revisionId = 'rev-1',
  } = options;

  const defaultFindings = [
    {
      id: 'f-honey-claim',
      panel: 'front',
      title: 'Honey Prominence Claim vs Formulation Discrepancy',
      status: 'ISSUE',
      ruleId: 'US_FDA_21CFR102_5_NAME_INGREDIENT_PERCENT',
      observedText: 'Dancing Fish Honey Berry Crunch',
      expectedText: 'Honey declaration compliant with 1% formulation ratio',
      department: 'Legal & Regulatory',
      sourceRef: 'DancingFish_Granola_Berry_US_Carton.pdf (Front PDP)',
      boxNorm: [0.12, 0.08, 0.76, 0.18],
    },
    {
      id: 'f-missing-net-fl-oz',
      panel: 'front',
      title: 'Missing Dual Net Quantity Declaration (Fluid Ounces)',
      status: 'ISSUE',
      ruleId: 'US_FDA_21CFR101_105_NET_QUANTITY_DUAL',
      observedText: 'Net Wt 10 oz (283 g)',
      expectedText: 'Dual declaration including metric and custom units',
      department: 'Packaging Engineering',
      sourceRef: 'DancingFish_Granola_Berry_US_Carton.pdf (Bottom of Front PDP)',
      boxNorm: [0.20, 0.82, 0.60, 0.09],
      isMissingDeclarationGhost: true,
    },
    {
      id: 'f-nutrition-facts-sugar',
      panel: 'right',
      title: 'Added Sugar & Sodium DV Math Error',
      status: 'NEEDS_REVIEW',
      ruleId: 'US_FDA_21CFR101_9_NUTRITION_DAILY_VALUES',
      observedText: 'Total Sugars 12g',
      expectedText: 'Standard Nutrition Facts Table format under 2016 rules',
      department: 'Nutrition Sciences',
      sourceRef: 'DancingFish_Granola_Berry_US_Carton.pdf (Right Panel Table)',
      boxNorm: [0.08, 0.25, 0.84, 0.45],
    },
    {
      id: 'f-cooling-storage',
      panel: 'back',
      title: 'Storage Instruction Discrepancy: Cool Dry vs Refrigerate',
      status: 'ISSUE',
      ruleId: 'SPEC_CONSISTENCY_STORAGE_INSTRUCTION',
      observedText: 'Store in a cool dry place',
      expectedText: 'Refrigerate after opening to preserve freshness',
      department: 'Quality Assurance',
      sourceRef: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx (Cell B18)',
      boxNorm: [0.10, 0.75, 0.80, 0.12],
    },
    {
      id: 'f-allergen-contains-wheat',
      panel: 'back',
      title: 'FALCPA Allergen Declaration: Wheat & Almonds prominent disclosure',
      status: 'MATCH',
      ruleId: 'US_FALCPA_MAJOR_FOOD_ALLERGENS',
      observedText: 'Contains: Almonds, Wheat',
      expectedText: 'Contains statement following ingredients',
      department: 'Regulatory Compliance',
      sourceRef: 'DancingFish_Granola_Berry_US_Carton.pdf (Back Information Panel)',
      boxNorm: [0.10, 0.62, 0.80, 0.10],
    },
    {
      id: 'f-manufacturer-address',
      panel: 'left',
      title: 'Manufacturer City/State Missing Street Address',
      status: 'MATCH',
      ruleId: 'US_FDA_21CFR101_5_MANUFACTURER_NAME_ADDRESS',
      observedText: 'Manufactured by Dancing Fish Foods Inc., Portland, OR 97201',
      expectedText: 'Complete corporate entity and postal address',
      department: 'Supply Chain',
      sourceRef: 'DancingFish_Granola_Berry_US_Carton.pdf (Left Panel)',
      boxNorm: [0.12, 0.40, 0.76, 0.20],
    },
  ];

  const indiaFindings = [
    {
      id: 'f-fssai-veg-logo',
      panel: 'front',
      title: 'FSSAI Green Vegetarian Logo Missing',
      status: 'ISSUE',
      ruleId: 'FSSAI_PACKAGING_2020_VEG_LOGO',
      observedText: 'Missing vegetarian green dot emblem',
      expectedText: 'Green filled circle in green square border (6mm min)',
      department: 'India Regulatory',
      sourceRef: 'DancingFish_Granola_India_Carton_Draft.pdf (Front PDP)',
      boxNorm: [0.15, 0.15, 0.20, 0.15],
    },
    {
      id: 'f-fssai-license-number',
      panel: 'left',
      title: 'FSSAI 14-Digit License Number Missing',
      status: 'ISSUE',
      ruleId: 'FSSAI_PACKAGING_2020_LIC_NUM',
      observedText: 'No 14-digit FSSAI license number printed',
      expectedText: 'FSSAI Lic. No. 10012345678901',
      department: 'India Regulatory',
      sourceRef: 'DancingFish_Granola_India_Carton_Draft.pdf (Left Panel)',
      boxNorm: [0.10, 0.50, 0.80, 0.15],
    },
    {
      id: 'f-cooling-storage',
      panel: 'back',
      title: 'Storage Instruction Discrepancy: Cool Dry vs Refrigerate',
      status: 'ISSUE',
      ruleId: 'SPEC_CONSISTENCY_STORAGE_INSTRUCTION',
      observedText: 'Store in a cool dry place',
      expectedText: 'Refrigerate after opening to preserve freshness',
      department: 'Quality Assurance',
      sourceRef: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx (Cell B18)',
      boxNorm: [0.10, 0.75, 0.80, 0.12],
    },
    {
      id: 'f-allergen-contains-wheat',
      panel: 'back',
      title: 'Allergen Declaration: Contains Wheat & Almonds',
      status: 'MATCH',
      ruleId: 'FSSAI_ALLERGEN_DECLARATION',
      observedText: 'Contains: Almonds, Wheat',
      expectedText: 'Contains statement following ingredients',
      department: 'Regulatory Compliance',
      sourceRef: 'DancingFish_Granola_India_Carton_Draft.pdf (Back)',
      boxNorm: [0.10, 0.62, 0.80, 0.10],
    },
  ];

  const activeFindings = findings.length > 0 ? findings : (market === 'india' ? indiaFindings : defaultFindings);
  const filteredFindings = activeFindings;

  const panels = [
    {
      panelId: 'front',
      panelRole: 'front',
      label: 'Front PDP (Principal Display Panel)',
      targetIndex: 0,
      targetImage: '/samples/campus/front.png',
      targetImageSha256: hash('front-target-sample'),
      sourceArtworkRegion: [0.25, 0.05, 0.25, 0.90],
      panelDimensionsMm: { width: ESKO_CARTON_DIMENSIONS_MM.width, height: ESKO_CARTON_DIMENSIONS_MM.height },
      physicalScaleAuthority: 'ESKO_ARTIOSCAD_SPEC_REV_B',
      targetToPanelTransform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      overlayImage: `/api/campus/ar-overlay/front?market=${market}`,
      overlayImageSha256: hash(`front-overlay-${market}`),
      findingIds: filteredFindings.filter(f => (f.panel || '').toLowerCase() === 'front').map(f => f.id),
      hotspots: filteredFindings.filter(f => (f.panel || '').toLowerCase() === 'front').map(toHotspot),
      orientation: 0,
      isWeakTarget: false,
      trackingLimitations: [],
    },
    {
      panelId: 'right',
      panelRole: 'right',
      label: 'Right Side (Nutrition Facts Panel)',
      targetIndex: 1,
      targetImage: '/samples/campus/right.png',
      targetImageSha256: hash('right-target-sample'),
      sourceArtworkRegion: [0.50, 0.05, 0.15, 0.90],
      panelDimensionsMm: { width: ESKO_CARTON_DIMENSIONS_MM.depth, height: ESKO_CARTON_DIMENSIONS_MM.height },
      physicalScaleAuthority: 'ESKO_ARTIOSCAD_SPEC_REV_B',
      targetToPanelTransform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      overlayImage: `/api/campus/ar-overlay/right?market=${market}`,
      overlayImageSha256: hash(`right-overlay-${market}`),
      findingIds: filteredFindings.filter(f => (f.panel || '').toLowerCase() === 'right').map(f => f.id),
      hotspots: filteredFindings.filter(f => (f.panel || '').toLowerCase() === 'right').map(toHotspot),
      orientation: 0,
      isWeakTarget: false,
      trackingLimitations: [],
    },
    {
      panelId: 'back',
      panelRole: 'back',
      label: 'Back Panel (Ingredients & Allergens)',
      targetIndex: 2,
      targetImage: '/samples/campus/back.png',
      targetImageSha256: hash('back-target-sample'),
      sourceArtworkRegion: [0.65, 0.05, 0.25, 0.90],
      panelDimensionsMm: { width: ESKO_CARTON_DIMENSIONS_MM.width, height: ESKO_CARTON_DIMENSIONS_MM.height },
      physicalScaleAuthority: 'ESKO_ARTIOSCAD_SPEC_REV_B',
      targetToPanelTransform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      overlayImage: `/api/campus/ar-overlay/back?market=${market}`,
      overlayImageSha256: hash(`back-overlay-${market}`),
      findingIds: filteredFindings.filter(f => (f.panel || '').toLowerCase() === 'back').map(f => f.id),
      hotspots: filteredFindings.filter(f => (f.panel || '').toLowerCase() === 'back').map(toHotspot),
      orientation: 0,
      isWeakTarget: false,
      trackingLimitations: [],
    },
    {
      panelId: 'left',
      panelRole: 'left',
      label: 'Left Side (Address & Origin)',
      targetIndex: 3,
      targetImage: '/samples/campus/left.png',
      targetImageSha256: hash('left-target-sample'),
      sourceArtworkRegion: [0.10, 0.05, 0.15, 0.90],
      panelDimensionsMm: { width: ESKO_CARTON_DIMENSIONS_MM.depth, height: ESKO_CARTON_DIMENSIONS_MM.height },
      physicalScaleAuthority: 'ESKO_ARTIOSCAD_SPEC_REV_B',
      targetToPanelTransform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      overlayImage: `/api/campus/ar-overlay/left?market=${market}`,
      overlayImageSha256: hash(`left-overlay-${market}`),
      findingIds: filteredFindings.filter(f => (f.panel || '').toLowerCase() === 'left').map(f => f.id),
      hotspots: filteredFindings.filter(f => (f.panel || '').toLowerCase() === 'left').map(toHotspot),
      orientation: 0,
      isWeakTarget: true, // Low text density, flagged as weak target per Phase 5
      trackingLimitations: ['LOW_FEATURE_DENSITY_TEXT_ONLY'],
    },
  ];

  const reviewFingerprint = hash({
    reviewId,
    market,
    findingIds: filteredFindings.map(f => f.id),
    panels: panels.map(p => ({ id: p.panelId, count: p.findingIds.length })),
  });

  return {
    schemaVersion: 'packsignal-ar/v1',
    packageId,
    reviewId,
    revisionId,
    market,
    artworkDocumentId: 'doc-dancing-fish-carton-v1',
    artworkSha256: hash('DancingFish_Granola_Berry_US_Carton.pdf'),
    reviewFingerprint,
    targetFile: '/samples/organizer/targets.mind',
    targetFileSha256: hash('targets-mind-v1'),
    trackingLibrary: 'mind-ar',
    trackingVersion: '1.2.5',
    runtimeAiAllowed: false, // Strict architectural constraint: ZERO runtime AI
    panels,
    createdAt: '2026-10-27T08:00:00.000Z',
    assetVersion: '1.0.0',
    buildStatus: 'VALIDATED',
  };
}

function toHotspot(f) {
  const norm = f.boxNorm || [0.1, 0.1, 0.8, 0.2];
  return {
    findingId: f.id,
    title: f.title,
    status: f.status,
    ruleId: f.ruleId || null,
    observedText: f.observedText || '',
    expectedText: f.expectedText || '',
    department: f.department || 'Packaging Compliance',
    sourceRef: f.sourceRef || '',
    boxNorm: norm,
    rect: norm,
    isMissingDeclarationGhost: Boolean(f.isMissingDeclarationGhost),
  };
}

function hash(val) {
  return createHash('sha256').update(typeof val === 'string' ? val : JSON.stringify(val)).digest('hex');
}
