/**
 * PackSignal — Missing Statutory Declaration Classification Evaluator
 * lib/regulatory/missing-declarations.mjs
 *
 * Implements Phase 1 & Phase 8 of the Smart Ghost Bounding Boxes engine.
 * Evaluates packaging findings against statutory requirements, coverage limits,
 * launch dates, product applicability, and panel confidence.
 */

import {
  lookupPlacementRule,
  PLACEMENT_AUTHORITIES,
  LEGAL_STATUSES,
  REGION_TYPES,
  MAPPING_STATUSES,
} from './placement-rules.mjs';

export const DECLARATION_EVALUATION_STATES = {
  VERIFIED_MISSING: 'VERIFIED_MISSING',
  POSSIBLY_MISSING: 'POSSIBLY_MISSING',
  FOUND_IN_ALLOWED_PANEL: 'FOUND_IN_ALLOWED_PANEL',
  FOUND_WRONG_PANEL: 'FOUND_WRONG_PANEL',
  PANEL_UNCONFIRMED: 'PANEL_UNCONFIRMED',
  RULE_UNSUPPORTED: 'RULE_UNSUPPORTED',
  SOURCE_MISSING: 'SOURCE_MISSING',
  FUTURE_RULE_PENDING: 'FUTURE_RULE_PENDING',
  VOLUNTARY_CERTIFICATION: 'VOLUNTARY_CERTIFICATION',
  UNABLE_TO_VERIFY: 'UNABLE_TO_VERIFY',
};

/**
 * Checks if a declaration type represents voluntary certification rather than a statutory mandate.
 */
export function isVoluntaryCertification(declarationType, title = '') {
  const norm = `${declarationType || ''} ${title || ''}`.toUpperCase();
  return /ORGANIC|KOSHER|HALAL|RECYCLE|RECYCLING|FAIR_TRADE|NON_GMO|CARBON_NEUTRAL/.test(norm);
}

/**
 * Evaluates whether a missing declaration finding is eligible for a statutory ghost region.
 *
 * @param {Object} params
 * @param {Object} params.finding - Review finding
 * @param {Object} params.review - Full review context
 * @param {Object} [params.placementRule] - Matched placement rule
 * @param {Object} [params.panelState] - Resolved panels { pdpFace, infoFace, authority, zones }
 * @param {string|Date} [params.launchDate] - Effective launch date (for Regulatory Time Machine)
 */
export function evaluateMissingDeclaration({
  finding,
  review,
  placementRule = null,
  panelState = {},
  launchDate = null,
} = {}) {
  if (!finding) {
    return {
      eligible: false,
      state: DECLARATION_EVALUATION_STATES.UNABLE_TO_VERIFY,
      reason: 'No finding provided',
    };
  }

  const title = String(finding.title || '').trim();
  const field = String(finding.rule?.field || finding.field || '').trim();
  const ruleType = String(finding.type || finding.ruleType || finding.rule?.type || '').toUpperCase();

  // 1. Check for voluntary certification seals (e.g. Kosher, Organic, Halal)
  if (isVoluntaryCertification(field, title)) {
    return {
      eligible: false,
      state: DECLARATION_EVALUATION_STATES.VOLUNTARY_CERTIFICATION,
      authority: PLACEMENT_AUTHORITIES.ILLUSTRATIVE_SUGGESTION,
      legalStatus: LEGAL_STATUSES.VOLUNTARY_CERTIFICATION,
      reason: 'Voluntary certification or marketing claim; does not constitute a statutory mandatory declaration.',
    };
  }

  // 2. Identify or lookup placement rule
  let rule = placementRule;
  const market = String(review?.options?.marketPreset || review?.market || 'us').toLowerCase();
  const jurisdiction = market.includes('in') || market.includes('india') ? 'IN' : market.includes('ca') || market.includes('canada') ? 'CA' : 'US';

  if (!rule) {
    let declType = null;
    if (ruleType === 'STATUTORY_SYMBOL_PRESENCE' || (jurisdiction === 'IN' && /veg|vegetarian|logo|mark/i.test(title))) {
      declType = 'VEG_MARK';
    } else if (ruleType === 'MANUFACTURER_ADDRESS_DECLARATION' || field === 'business_details' || field === 'manufacturer' || /manufacturer|distributor|address|packer|business/i.test(title)) {
      declType = 'MANUFACTURER_ADDRESS';
    } else if (ruleType === 'STORAGE_INSTRUCTION_MANDATE' || /storage|refrigerat|frozen/i.test(title)) {
      declType = 'STORAGE_INSTRUCTIONS';
    } else if (ruleType === 'MULTILINGUAL_PAIR_REQUIREMENT' || /bilingual|french/i.test(title)) {
      declType = 'MULTILINGUAL_REQUIREMENT';
    } else if (field === 'net_quantity' || /net\s*quantity|volume|weight|net\s*wt/i.test(title)) {
      declType = 'NET_QUANTITY';
    } else if (field.startsWith('nutrition') && /panel|facts|missing/i.test(title)) {
      declType = 'NUTRITION_FACTS';
    } else if (/allergen|contains/i.test(title) || field === 'allergens') {
      declType = 'ALLERGEN_STATEMENT';
    }

    if (declType) {
      const targetLaunchDate = launchDate || review?.options?.targetLaunchDate || review?.launchDate;
      rule = lookupPlacementRule({ declarationType: declType, jurisdiction, launchDate: targetLaunchDate });
    }
  }

  if (!rule) {
    return {
      eligible: false,
      state: DECLARATION_EVALUATION_STATES.RULE_UNSUPPORTED,
      reason: 'No statutory placement rule configured for declaration type.',
    };
  }

  // 3. Regulatory Time Machine — check effective date against launch date
  if (rule.isProposedFutureRule || rule.activeLegalStatus === LEGAL_STATUSES.PROPOSED_FUTURE) {
    return {
      eligible: false,
      state: DECLARATION_EVALUATION_STATES.FUTURE_RULE_PENDING,
      rule,
      legalStatus: LEGAL_STATUSES.PROPOSED_FUTURE,
      reason: `Rule ${rule.ruleId} is proposed or becomes effective on ${rule.effectiveDate}, after selected launch date. Non-enforceable statutory mandate.`,
    };
  }

  // 4. Source input missing
  if (finding.rule?.supported === false || finding.method === 'review_input_gap') {
    if (!finding.expected || /missing reference/i.test(finding.expected)) {
      return {
        eligible: false,
        state: DECLARATION_EVALUATION_STATES.SOURCE_MISSING,
        rule,
        reason: 'Source specification missing reference declaration; cannot assert definitive statutory absence.',
      };
    }
  }

  // 5. Artwork evidence presence check
  const hasArtworkEvidence = (finding.evidence || []).some(
    e => e.role === 'artwork' && e.quote && !/not detected|missing/i.test(e.quote)
  );

  // If already satisfied
  if (finding.status === 'match') {
    return {
      eligible: false,
      state: DECLARATION_EVALUATION_STATES.FOUND_IN_ALLOWED_PANEL,
      rule,
      reason: 'Declaration is present on artwork in an authorized legal panel.',
    };
  }

  // 6. Check for misplaced declaration (present on wrong face)
  if (hasArtworkEvidence && finding.status === 'issue') {
    const text = `${finding.title} ${finding.explanation} ${finding.observed}`.toLowerCase();
    if (/panel|placement|location|wrong face|side panel/i.test(text)) {
      return {
        eligible: true,
        state: DECLARATION_EVALUATION_STATES.FOUND_WRONG_PANEL,
        rule,
        reason: 'Declaration detected on artwork but placed on an unapproved panel role.',
      };
    }
  }

  // 7. Panel confirmation check
  const requiresPdp = (rule.requiredPanelRoles || []).includes('principal_display_panel');
  if (requiresPdp && (!panelState?.pdpFace || panelState?.authority === 'UNKNOWN')) {
    return {
      eligible: true,
      state: DECLARATION_EVALUATION_STATES.PANEL_UNCONFIRMED,
      rule,
      reason: 'Principal Display Panel mapping is unconfirmed; region is tentative illustrative estimate.',
    };
  }

  // 8. Coverage completeness check — prevent false certainty
  const isCompleteCoverage = review?.options?.completeArtwork === true ||
    (review?.coverage?.completeArtwork === true);

  if (!isCompleteCoverage || finding.status === 'unable') {
    return {
      eligible: true,
      state: DECLARATION_EVALUATION_STATES.POSSIBLY_MISSING,
      rule,
      reason: 'Incomplete artwork inspection coverage or OCR limitation; declaration is possibly missing pending manual prepress check.',
    };
  }

  // 9. Verified missing declaration
  if (finding.status === 'issue' || finding.status === 'review') {
    return {
      eligible: true,
      state: DECLARATION_EVALUATION_STATES.VERIFIED_MISSING,
      rule,
      reason: 'Verified statutory declaration absence confirmed across complete artwork inspection.',
    };
  }

  return {
    eligible: false,
    state: DECLARATION_EVALUATION_STATES.UNABLE_TO_VERIFY,
    rule,
    reason: 'Unable to verify declaration state.',
  };
}

/**
 * Creates canonical ghost geometry contract object (Phase 8).
 */
export function buildCanonicalGhostRegion({
  ghostId,
  findingId,
  ruleId,
  artworkDocumentId = 'artwork-doc',
  page = 1,
  panelId = 'front',
  panelRole = 'principal_display_panel',
  regionType = REGION_TYPES.PERMITTED_REGION,
  normalizedBounds = [0.45, 0.65, 0.85, 0.85],
  placementAuthority = PLACEMENT_AUTHORITIES.VERIFIED_STATUTORY,
  coverageStatus = 'COMPLETE',
  mappingStatus = MAPPING_STATUSES.SOURCE_VERIFIED,
  legalSource = '',
  exceptions = [],
  revisionId = 'v1',
  limitations = [],
  fitAnalysis = null,
  suggestedPlacement = null,
} = {}) {
  const [x0, y0, x1, y1] = normalizedBounds;
  const normalizedPolygon = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];

  return {
    ghostId,
    findingId,
    ruleId,
    artworkDocumentId,
    page,
    panelId,
    panelRole,
    regionType,
    normalizedBounds,
    normalizedPolygon,
    placementAuthority,
    coverageStatus,
    mappingStatus,
    legalSource,
    exceptions,
    revisionId,
    limitations: limitations.length ? limitations : [
      'Ghost bounding box designates a statutory permitted placement region, not an observed artwork object.',
      'Dashed coordinates are illustrative layout proposals and do not modify underlying artwork.',
      'Compliance requires verified detection in artwork revision.',
    ],
    fitAnalysis,
    suggestedPlacement,
  };
}
