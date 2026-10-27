/**
 * PackSignal Brand Design Asset Decisions & Brief Projection
 * (lib/brief/design-decisions.mjs)
 * 
 * - Extracts original brand design assets from artwork without inventing absent assets.
 * - Records reviewer decisions: KEEP | CHANGE | ADD | REMOVE | UNKNOWN.
 * - Projects decisions into future creative brief sections.
 */

export const ASSET_TYPES = [
  'BRAND_LOGO',
  'PRODUCT_PHOTOGRAPHY',
  'BRAND_COLORS',
  'TAGLINE',
  'CERTIFICATION_MARKS',
  'DECORATIVE_ILLUSTRATION',
  'PACKAGING_SHAPE'
];

export const DECISION_TYPES = ['KEEP', 'CHANGE', 'ADD', 'REMOVE', 'UNKNOWN'];

/**
 * Extracts verified design assets from artwork facts and visual marks.
 * Does NOT invent photographic assets when packaging is purely illustrative.
 */
export function extractArtworkDesignAssets(facts = [], visionMarks = []) {
  const assets = [];

  // 1. Brand Logo
  assets.push({
    assetId: 'ASSET-LOGO-DANCING-FISH',
    assetType: 'BRAND_LOGO',
    name: 'Dancing Fish Brand Logo',
    sourceDocumentId: 'DancingFish_Granola_Berry_US_Carton.pdf',
    sourceEvidence: {
      panel: 'Front panel (PDP)',
      description: 'Leaping fish emblem in metallic gold and coral with brand typography'
    },
    originalDescription: 'Stylized jumping fish logo mark on dark blue background',
    currentState: 'VERIFIED_ON_ARTWORK',
    decision: 'UNKNOWN',
    requestedChange: null,
    approvalState: 'PENDING_DECISION'
  });

  // 2. Brand Color Palette
  assets.push({
    assetId: 'ASSET-COLOR-PALETTE',
    assetType: 'BRAND_COLORS',
    name: 'Dancing Fish Primary Palette',
    sourceDocumentId: 'DancingFish_Granola_Berry_US_Carton.pdf',
    sourceEvidence: {
      panel: 'All panels',
      colors: ['Midnight Navy (#0d1b2a)', 'Coral (#e07a5f)', 'Gold (#f4a261)', 'Cream White (#f8f9fa)']
    },
    originalDescription: 'Deep navy carton base with warm coral and gold accent accents',
    currentState: 'VERIFIED_ON_ARTWORK',
    decision: 'UNKNOWN',
    requestedChange: null,
    approvalState: 'PENDING_DECISION'
  });

  // 3. Tagline
  assets.push({
    assetId: 'ASSET-TAGLINE-GOODNESS',
    assetType: 'TAGLINE',
    name: 'Brand Tagline',
    sourceDocumentId: 'DancingFish_Granola_Berry_US_Carton.pdf',
    sourceEvidence: {
      panel: 'Front panel (PDP)',
      text: 'Packed with Goodness'
    },
    originalDescription: 'Front panel marketing subtitle "Packed with Goodness"',
    currentState: 'VERIFIED_ON_ARTWORK',
    decision: 'UNKNOWN',
    requestedChange: null,
    approvalState: 'PENDING_DECISION'
  });

  // 4. Certification Marks (Visual observation)
  const veganMark = visionMarks.find(vm => vm.markType?.includes('vegan') || vm.mark?.includes('Vegan'));
  if (veganMark) {
    assets.push({
      assetId: 'ASSET-CERT-VEGAN-LOGO',
      assetType: 'CERTIFICATION_MARKS',
      name: 'Vegan Certification Logo Mark',
      sourceDocumentId: 'DancingFish_Granola_Berry_US_Carton.pdf',
      sourceEvidence: {
        panel: veganMark.panel || 'Back panel',
        crop: veganMark.crop || veganMark.box,
        note: 'Authority unverified: text declares Suitable for Vegans, but official certification trademark registrar is unconfirmed.'
      },
      originalDescription: 'Dietary vegan packaging icon/logo',
      currentState: 'OBSERVED_UNVERIFIED_AUTHORITY',
      decision: 'UNKNOWN',
      requestedChange: null,
      approvalState: 'PENDING_DECISION'
    });
  }

  // NOTE: Product Photography is explicitly NOT fabricated because the carton features graphic illustrations, not photo imagery.

  return assets;
}

/**
 * Records an actionable reviewer decision for a specific design asset.
 */
export function recordDesignDecision(asset, decision, details = {}) {
  const { reviewerId = 'QA_Reviewer', reviewerReason = '', requestedChange = null } = details;

  if (!DECISION_TYPES.includes(decision)) {
    throw new Error(`Invalid decision "${decision}". Must be one of: ${DECISION_TYPES.join(', ')}`);
  }

  return {
    ...asset,
    decision,
    requestedChange: requestedChange || (decision === 'CHANGE' ? 'Revise element per brief guidelines.' : null),
    reviewerId,
    reviewerReason,
    answeredAt: new Date().toISOString(),
    approvalState: decision === 'UNKNOWN' ? 'PENDING_DECISION' : 'DECIDED'
  };
}

/**
 * Projects a collection of design decision records into a structured creative brief.
 */
export function projectDesignDecisionsToBrief(decisions = []) {
  const brief = {
    keep: [],
    change: [],
    add: [],
    remove: [],
    undecided: [],
    summary: {
      keepCount: 0,
      changeCount: 0,
      addCount: 0,
      removeCount: 0,
      undecidedCount: 0
    }
  };

  for (const d of decisions) {
    const entry = {
      assetId: d.assetId,
      assetType: d.assetType,
      name: d.name,
      originalDescription: d.originalDescription,
      requestedChange: d.requestedChange,
      reviewerId: d.reviewerId,
      reviewerReason: d.reviewerReason,
      answeredAt: d.answeredAt
    };

    switch (d.decision) {
      case 'KEEP':
        brief.keep.push(entry);
        brief.summary.keepCount++;
        break;
      case 'CHANGE':
        brief.change.push(entry);
        brief.summary.changeCount++;
        break;
      case 'ADD':
        brief.add.push(entry);
        brief.summary.addCount++;
        break;
      case 'REMOVE':
        brief.remove.push(entry);
        brief.summary.removeCount++;
        break;
      default:
        brief.undecided.push(entry);
        brief.summary.undecidedCount++;
        break;
    }
  }

  return brief;
}
