/**
 * PackSignal — Ghost Bounding Box & X-Ray Region Model
 * lib/ghost-regions.mjs
 *
 * Derives canonical, rule-backed ghost placement regions for missing
 * and misplaced packaging declarations in 2D and 3D.
 */

import { getPlacementRule } from './placement-rules.mjs';
import { isVoluntaryCertification } from './regulatory/missing-declarations.mjs';
import {
  calculatePanelArea,
  computeLegalRegion,
  computeSuggestedPlacement,
  checkPlacementFit,
  mapPageBoxToPanelLocal,
  calculatePdpGeometry,
} from './placement-geometry.mjs';

/**
 * Classifies the verification state of a required packaging declaration.
 *
 * @param {Object} finding
 * @param {Object} review
 * @param {Object} placementRule
 * @param {Object} panelState
 */
export function classifyDeclarationState(finding, review, placementRule, panelState) {
  if (!placementRule) {
    return 'RULE_UNSUPPORTED';
  }

  // 1. If rule or check is unsupported / disabled
  if (finding.rule?.supported === false || finding.method === 'review_input_gap') {
    if (!finding.expected || /missing reference/i.test(finding.expected)) {
      return 'SOURCE_MISSING';
    }
  }

  // 2. Check if declaration is actually present on artwork
  const hasArtworkEvidence = (finding.evidence || []).some(
    e => e.role === 'artwork' && e.quote && !/not detected/i.test(e.quote)
  );

  // If check status is 'match', requirement is satisfied in an allowed region
  if (finding.status === 'match') {
    return 'FOUND_IN_ALLOWED_PANEL';
  }

  // 3. Panel authority check
  const isPdpRequired = (placementRule.requiredPanelRoles || []).includes('principal_display_panel');
  if (isPdpRequired && (!panelState?.pdpFace || panelState.authority === 'UNKNOWN')) {
    return 'PANEL_UNCONFIRMED';
  }

  // 4. If declaration was found, check if it's placed on the wrong panel
  if (hasArtworkEvidence && finding.status === 'issue') {
    // Check if the finding indicates placement or location mismatch
    const text = `${finding.title} ${finding.explanation} ${finding.observed}`.toLowerCase();
    if (/panel|placement|location|wrong face|side panel/i.test(text)) {
      return 'FOUND_WRONG_PANEL';
    }
  }

  // 5. Incomplete artwork inspection coverage (e.g. OCR miss, unconfirmed panels)
  const isCompleteCoverage = review.options?.completeArtwork === true ||
    (review.coverage?.completeArtwork === true);

  if (!isCompleteCoverage || finding.status === 'unable') {
    return 'POSSIBLY_MISSING';
  }

  // 6. Definite verified missing
  if (finding.status === 'issue' || finding.status === 'review') {
    return 'VERIFIED_MISSING';
  }

  return 'UNABLE_TO_VERIFY';
}

/**
 * Resolves panel roles (PDP, Information Panel, Back, Side, Flaps) from review options,
 * dieline layout, and reviewer confirmations.
 */
export function resolvePanelRoles(review) {
  const options = review?.options || {};
  const confirmedRoles = options.panelRoles || {};
  const zones = options.panelZones || {};

  // Find confirmed or suggested PDP
  let pdpFace = confirmedRoles.principal_display_panel ||
    (zones.front ? 'front' : null);

  let infoFace = confirmedRoles.information_panel ||
    (zones.back ? 'back' : zones.right ? 'right' : null);

  let authority = 'UNKNOWN';
  if (options.panelRolesConfirmed === true || options.packageMappingConfirmed === true) {
    authority = 'REVIEWER_CONFIRMED';
  } else if (review.documents?.some(d => d.role === 'dieline' && d.vectorGeometry?.format === 'DXF')) {
    authority = 'VERIFIED_FROM_SOURCE';
  } else if (zones.front || zones.back) {
    authority = 'SUGGESTED';
  }

  return {
    pdpFace,
    infoFace,
    authority,
    zones,
    confirmedRoles,
  };
}

/**
 * Generates canonical ghost placement records for all eligible findings in a review.
 *
 * @param {Object} options
 * @param {Object} options.review
 * @param {string} [options.selectedFindingId]
 * @param {Object} [options.customPlacements] - Reviewer adjusted suggested boxes map: ghostId -> [x0, y0, x1, y1]
 */
export function generateGhostRegions({
  review,
  selectedFindingId = null,
  customPlacements = {},
} = {}) {
  if (!review?.findings?.length) return [];

  const market = String(review.options?.marketPreset || review.market || 'us').toLowerCase();
  const jurisdiction = market.includes('in') || market.includes('india') ? 'IN' : 'US';
  const panelState = resolvePanelRoles(review);
  const artworkDoc = review.documents?.find(d => d.role === 'artwork');
  const page = artworkDoc?.pages?.[0] || { width: 612, height: 792, number: 1 };

  const ghostRecords = [];

  for (const finding of review.findings) {
    const field = String(finding.rule?.field || finding.field || '').toLowerCase();
    const title = String(finding.title || '').toLowerCase();

    // Exclude voluntary certification marks (e.g. Organic, Kosher, Halal, Recycling) from statutory missing declarations
    if (isVoluntaryCertification(field, title)) {
      continue;
    }

    // Determine declaration type
    let declarationType = null;
    const ruleType = String(finding.type || finding.ruleType || finding.rule?.type || '').toUpperCase();

    if (ruleType === 'STATUTORY_SYMBOL_PRESENCE' || (jurisdiction === 'IN' && /veg|vegetarian|logo|mark/i.test(title))) {
      declarationType = 'VEG_MARK';
    } else if (ruleType === 'MANUFACTURER_ADDRESS_DECLARATION' || field === 'business_details' || field === 'manufacturer' || /manufacturer|distributor|address|packer|business/i.test(title)) {
      declarationType = 'MANUFACTURER_ADDRESS';
    } else if (ruleType === 'STORAGE_INSTRUCTION_MANDATE' || /storage|refrigerat|frozen/i.test(title)) {
      declarationType = 'STORAGE_INSTRUCTIONS';
    } else if (ruleType === 'MULTILINGUAL_PAIR_REQUIREMENT' || /bilingual|french/i.test(title)) {
      declarationType = 'BILINGUAL_PAIR';
    } else if (field === 'net_quantity' || /net\s*quantity|volume|weight|net\s*wt/i.test(title)) {
      declarationType = 'NET_QUANTITY';
    } else if (field.startsWith('nutrition') && /panel|facts|missing/i.test(title)) {
      declarationType = 'NUTRITION_FACTS';
    } else if (/allergen|contains/i.test(title) || field === 'allergens') {
      declarationType = 'ALLERGEN_STATEMENT';
    }

    if (!declarationType) continue;

    const placementRule = getPlacementRule(declarationType, jurisdiction);
    if (!placementRule) continue;

    const verificationState = classifyDeclarationState(finding, review, placementRule, panelState);

    // If requirement is already met in an allowed panel, do not display a missing ghost
    if (verificationState === 'FOUND_IN_ALLOWED_PANEL') continue;

    // Determine applicable target panels
    const applicablePanels = [];
    if (placementRule.allowedPanelRoles.includes('principal_display_panel') && panelState.pdpFace) {
      applicablePanels.push({ role: 'principal_display_panel', face: panelState.pdpFace });
    }
    if (placementRule.allowedPanelRoles.includes('information_panel') && panelState.infoFace) {
      applicablePanels.push({ role: 'information_panel', face: panelState.infoFace });
    }
    if (applicablePanels.length === 0 && panelState.pdpFace) {
      applicablePanels.push({ role: 'principal_display_panel', face: panelState.pdpFace });
    }

    // Determine primary selected panel
    const primaryPanel = (placementRule.preferredPanelRole === 'information_panel' && panelState.infoFace)
      ? { role: 'information_panel', face: panelState.infoFace }
      : applicablePanels[0] || { role: 'principal_display_panel', face: 'front' };

    const selectedFace = primaryPanel.face;
    const panelZone = panelState.zones[selectedFace] || {
      page: page.number || 1,
      // Default fallback crop if unmapped
      box: selectedFace === 'front' ? [0.45, 0.15, 0.85, 0.85] : [0.05, 0.15, 0.40, 0.85],
    };

    const packageOrientation = panelZone.orientation || review.options?.packageOrientation || 0;
    const panelGeometry = calculatePanelArea(panelZone.box, page);
    const legalRegion = computeLegalRegion({
      panelBox: panelZone.box,
      constraint: placementRule.regionConstraint,
      panelGeometry,
      exceptions: placementRule.exceptions || [],
      packageOrientation,
    });

    if (!legalRegion) continue;

    const ghostId = `ghost-${declarationType.toLowerCase()}-${finding.id}`;

    // Candidate regions for all allowed panels (e.g. Address allowed on PDP or Info panel)
    const candidateRegions = applicablePanels.map(p => {
      const z = panelState.zones[p.face] || { page: page.number, box: p.face === 'front' ? [0.45, 0.15, 0.85, 0.85] : [0.05, 0.15, 0.40, 0.85] };
      const geom = calculatePanelArea(z.box, page);
      const leg = computeLegalRegion({
        panelBox: z.box,
        constraint: p.role === 'principal_display_panel' ? 'panel_lower_region' : placementRule.regionConstraint,
        panelGeometry: geom,
        exceptions: placementRule.exceptions || [],
      });
      return {
        panelRole: p.role,
        panelFace: p.face,
        legalBounds: leg?.normalizedBounds,
        description: leg?.description,
      };
    });

    // Suggested placement proposal
    let suggestedPlacement = computeSuggestedPlacement(legalRegion.normalizedBounds, declarationType);

    // Apply custom reviewer adjustment if available
    if (customPlacements[ghostId] && Array.isArray(customPlacements[ghostId])) {
      suggestedPlacement = {
        normalizedBounds: customPlacements[ghostId],
        isCustomReviewerPlacement: true,
        disclaimer: 'Custom reviewer layout proposal — verify compliance with statutory permitted zone.',
      };
    }

    // Existing evidence boxes for collision check
    const existingBoxes = (finding.evidence || [])
      .filter(e => e.role === 'artwork' && Array.isArray(e.box))
      .map(e => e.box);

    const fitAnalysis = checkPlacementFit({
      suggestedBox: suggestedPlacement.normalizedBounds,
      legalRegion: legalRegion.normalizedBounds,
      existingBoxes,
    });

    // 3D face-local UV coordinates
    const local3dBox = mapPageBoxToPanelLocal(suggestedPlacement.normalizedBounds, panelZone.box);

    const record = {
      ghostId,
      reviewId: review.id,
      findingId: finding.id,
      checkId: finding.rule?.id || finding.id,
      ruleId: placementRule.ruleId,
      ruleVersion: placementRule.ruleVersion,
      declarationType,
      declarationLabel: placementRule.declarationLabel,
      jurisdiction,
      productSku: review.options?.productVariant || 'Dancing Fish Berry Crunch',
      artworkDocumentId: artworkDoc?.id || 'artwork-doc',
      artworkHash: artworkDoc?.sha256 || 'hash-art',
      applicablePanels: applicablePanels.map(p => p.role),
      applicableFaces: applicablePanels.map(p => p.face),
      selectedPanel: primaryPanel.role,
      selectedFace,
      panelAuthority: panelState.authority,
      placementAuthority: placementRule.placementAuthority || (
        panelState.authority === 'REVIEWER_CONFIRMED'
          ? 'VERIFIED_STATUTORY'
          : 'VERIFIED_STATUTORY'
      ),
      regionType: 'LEGAL_ALLOWED_REGION',
      statutoryRegionType: applicablePanels.length > 1 ? 'ALTERNATIVE_PERMITTED_REGION' : 'PERMITTED_REGION',
      legalRegion,
      candidateRegions,
      suggestedPlacement,
      local3dBox,
      pageNumber: panelZone.page || 1,
      coordinateSystem: 'normalized_page',
      units: 'normalized',
      normalizedPolygon: [
        [legalRegion.normalizedBounds[0], legalRegion.normalizedBounds[1]],
        [legalRegion.normalizedBounds[2], legalRegion.normalizedBounds[1]],
        [legalRegion.normalizedBounds[2], legalRegion.normalizedBounds[3]],
        [legalRegion.normalizedBounds[0], legalRegion.normalizedBounds[3]],
      ],
      mappingStatus: panelState.authority === 'REVIEWER_CONFIRMED'
        ? 'REVIEWER_CONFIRMED'
        : panelState.authority === 'VERIFIED_FROM_SOURCE'
        ? 'SOURCE_VERIFIED'
        : 'ILLUSTRATIVE',
      geometrySource: panelState.authority === 'REVIEWER_CONFIRMED'
        ? 'CONFIRMED_PANEL'
        : panelState.authority === 'VERIFIED_FROM_SOURCE'
        ? 'DIELINE_DXF'
        : 'APPROXIMATE_ILLUSTRATIVE',
      sourceCoverage: review.options?.sourceConfirmed ? 'CONFIRMED' : 'DRAFT',
      coverageStatus: review.options?.completeArtwork ? 'COMPLETE' : 'PARTIAL',
      artworkCoverage: review.options?.completeArtwork ? 'COMPLETE' : 'PARTIAL',
      legalSource: placementRule.sourceCitation || placementRule.authority,
      revisionId: review.reviewRevision ? `v${review.reviewRevision}` : (review.revision?.kind || 'v1'),
      verificationState,
      fitAnalysis,
      authorityCitation: placementRule.sourceCitation,
      authorityURL: placementRule.sourceURL || null,
      typeSizeGuidance: placementRule.typeSizeTiers?.[0]?.label || null,
      reviewerConfirmation: {
        confirmed: review.options?.ghostConfirmations?.[ghostId]?.confirmed || false,
        confirmedAt: review.options?.ghostConfirmations?.[ghostId]?.at || null,
        confirmedBy: review.options?.ghostConfirmations?.[ghostId]?.by || null,
      },
      limitations: [
        'The highlighted region represents statutory permitted placement derived from regulatory rules, not an authorized design approval.',
        'The dashed box is an illustrative layout proposal; its coordinates are not legally mandated.',
        'Placement confirmation does not certify production compliance or modify the underlying artwork.',
      ],
    };

    ghostRecords.push(record);
  }

  // Support sample address candidate if review.sample has not already matched a missing address
  if (review.sample && !ghostRecords.some(r => r.declarationType === 'MANUFACTURER_ADDRESS')) {
    const placementRule = getPlacementRule('MANUFACTURER_ADDRESS', 'US');
    const pBox = panelState.zones?.back?.box || [0.05, 0.15, 0.40, 0.85];
    const [px0, py0, px1, py1] = pBox;
    const pHeight = Math.max(0.01, py1 - py0);
    const top40 = py1 - pHeight * 0.40;
    const legalBounds = [px0, top40, px1, py1];
    const defaultSuggested = [0.05, 0.68, 0.32, 0.745];
    const custom = customPlacements['ghost-mfr-address-info'];
    const suggestedBounds = custom?.normalizedBounds || defaultSuggested;

    const candidateRegions = [
      {
        panelRole: 'information_panel',
        panelFace: 'back',
        description: 'Information Panel (21 CFR §101.2 & §101.5)',
        bounds: pBox,
      },
      {
        panelRole: 'principal_display_panel',
        panelFace: 'front',
        description: 'Principal Display Panel (21 CFR §101.2(b))',
        bounds: panelState.zones?.front?.box || [0.45, 0.15, 0.85, 0.85],
      }
    ];

    const legalRegion = {
      normalizedBounds: legalBounds,
      description: 'Lower region of Information Panel or PDP (21 CFR §101.2 & §101.5)',
      constraint: 'panel_lower_region',
    };

    const suggestedPlacement = {
      normalizedBounds: suggestedBounds,
      isCustomReviewerPlacement: Boolean(custom),
      disclaimer: 'Suggested layout proposal — not an exact statutory position.',
    };

    const fitAnalysis = checkPlacementFit({
      suggestedBox: suggestedPlacement.normalizedBounds,
      legalRegion: legalRegion.normalizedBounds,
      existingBoxes: [],
    });

    const local3dBox = mapPageBoxToPanelLocal(suggestedPlacement.normalizedBounds, pBox);

    ghostRecords.push({
      ghostId: 'ghost-mfr-address-info',
      reviewId: review.id,
      findingId: 'finding-sample-mfr-address',
      checkId: 'US-FDA-MFR-01',
      ruleId: placementRule.ruleId,
      ruleVersion: placementRule.ruleVersion,
      declarationType: 'MANUFACTURER_ADDRESS',
      declarationLabel: placementRule.declarationLabel,
      jurisdiction: 'US',
      productSku: review.options?.productVariant || 'Dancing Fish Berry Crunch',
      artworkDocumentId: artworkDoc?.id || 'artwork-doc',
      artworkHash: artworkDoc?.sha256 || 'hash-art',
      applicablePanels: ['information_panel', 'principal_display_panel'],
      applicableFaces: ['back', 'front'],
      selectedPanel: 'information_panel',
      selectedFace: 'back',
      panelAuthority: panelState.authority,
      regionType: 'LEGAL_ALLOWED_REGION',
      legalRegion,
      candidateRegions,
      suggestedPlacement,
      local3dBox,
      pageNumber: 1,
      coordinateSystem: 'normalized_page',
      units: 'normalized',
      geometrySource: 'APPROXIMATE_ILLUSTRATIVE',
      sourceCoverage: 'CONFIRMED',
      artworkCoverage: 'COMPLETE',
      verificationState: 'VERIFIED_MISSING',
      fitAnalysis,
      authorityCitation: placementRule.sourceCitation,
      authorityURL: placementRule.sourceURL || null,
      typeSizeGuidance: placementRule.typeSizeTiers?.[0]?.label || null,
      reviewerConfirmation: {
        confirmed: false,
        confirmedAt: null,
        confirmedBy: null,
      },
      limitations: [
        'The highlighted region represents statutory permitted placement derived from regulatory rules, not an authorized design approval.',
        'The dashed box is an illustrative layout proposal; its coordinates are not legally mandated.',
        'Placement confirmation does not certify production compliance or modify the underlying artwork.',
      ],
    });
  }

  return ghostRecords;
}
