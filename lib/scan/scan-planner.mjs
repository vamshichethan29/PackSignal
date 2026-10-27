/**
 * PackSignal — Scan Planner Engine (lib/scan/scan-planner.mjs)
 * Phase 10A: Evaluates carton coverage, requirements map, and dictates "What to scan next".
 */

export const COVERAGE_STATUSES = {
  COMPLETE: 'SCAN_COVERAGE_COMPLETE',
  PARTIAL: 'PARTIALLY_COMPLETE',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  INSUFFICIENT: 'INSUFFICIENT_COVERAGE',
};

export const STANDARD_FACES = [
  { id: 'front', label: 'Front Panel (PDP)', required: true, elements: ['brand_name', 'net_quantity', 'marketing_claims'] },
  { id: 'right', label: 'Right Side Panel', required: true, elements: ['nutrition_facts', 'regulatory_badges'] },
  { id: 'back', label: 'Back Information Panel', required: true, elements: ['ingredients', 'allergens', 'storage_instructions'] },
  { id: 'left', label: 'Left Side Panel', required: true, elements: ['manufacturer_address', 'country_of_origin'] },
  { id: 'top', label: 'Top Flap', required: false, elements: ['branding', 'open_instructions'] },
  { id: 'bottom', label: 'Bottom Flap', required: true, elements: ['barcode_gtin', 'mrp_date_batch'] },
];

/**
 * Plans the next scanning steps based on current session state and regulatory jurisdiction.
 */
export function planNextScanSteps(scannedPanels = {}, options = {}) {
  const market = options.market || 'us'; // 'us' or 'in'
  const items = [];
  const requiredFaces = STANDARD_FACES.filter(f => f.required);
  let capturedRequiredCount = 0;

  for (const face of STANDARD_FACES) {
    const isCaptured = Boolean(scannedPanels[face.id]);
    const panel = scannedPanels[face.id] || null;

    let itemStatus = 'unscanned';
    let guidance = `Align the ${face.label} inside the viewfinder reticle.`;

    if (isCaptured) {
      if (panel.hasBlur) {
        itemStatus = 'needs_rescan';
        guidance = 'Blur detected. Retake this face for sharper character edges.';
      } else if (panel.hasGlare) {
        itemStatus = 'warning';
        guidance = 'Glare detected over declarations. Reposition packaging slightly away from direct light.';
      } else {
        itemStatus = 'verified';
        guidance = 'Face captured and verified.';
        if (face.required) capturedRequiredCount++;
      }
    }

    items.push({
      face: face.id,
      label: face.label,
      required: face.required,
      status: itemStatus,
      isCaptured,
      guidance,
      expectedElements: face.elements,
      dualReaderStatus: panel?.dualReader?.status || null,
      photoUrl: panel?.photoUrl || null,
    });
  }

  // Determine next priority step
  let nextAction = null;
  // First check if any captured panel needs rescan
  const rescanItem = items.find(i => i.status === 'needs_rescan');
  if (rescanItem) {
    nextAction = {
      type: 'RESCAN_FACE',
      face: rescanItem.face,
      title: `Retake ${rescanItem.label}`,
      instruction: rescanItem.guidance,
      priority: 'high',
    };
  } else {
    // Next required unscanned face
    const nextUnscanned = items.find(i => i.required && !i.isCaptured);
    if (nextUnscanned) {
      nextAction = {
        type: 'SCAN_FACE',
        face: nextUnscanned.face,
        title: `Scan ${nextUnscanned.label}`,
        instruction: nextUnscanned.guidance,
        priority: 'high',
      };
    } else {
      // All required faces captured!
      nextAction = {
        type: 'FINALIZE_SCAN',
        title: 'Review Observations & Generate Brief',
        instruction: 'All required packaging faces captured. Ready for regulatory synthesis.',
        priority: 'normal',
      };
    }
  }

  // Completeness categorization
  let completeness = COVERAGE_STATUSES.INSUFFICIENT;
  const totalRequired = requiredFaces.length;
  const capturedCount = Object.keys(scannedPanels).length;

  if (capturedRequiredCount === totalRequired) {
    const hasWarnings = items.some(i => i.status === 'warning' || i.status === 'needs_rescan');
    completeness = hasWarnings ? COVERAGE_STATUSES.REVIEW_REQUIRED : COVERAGE_STATUSES.COMPLETE;
  } else if (capturedCount > 0) {
    completeness = COVERAGE_STATUSES.PARTIAL;
  }

  return {
    market,
    completeness,
    capturedCount,
    requiredCount: totalRequired,
    capturedRequiredCount,
    checklist: items,
    nextAction,
    summaryMessage: completeness === COVERAGE_STATUSES.COMPLETE
      ? '✓ All mandatory package faces captured and corroborated.'
      : `Captured ${capturedRequiredCount} of ${totalRequired} mandatory faces.`,
  };
}

/**
 * Evaluates whether a statutory declaration can be legitimately marked missing,
 * or if it remains UNCERTAIN because candidate faces have not yet been scanned.
 */
export function evaluateRequirementCoverage(requirementKey, permittedPanels = [], scannedPanels = {}, options = {}) {
  // If permittedPanels is empty, assume any face could carry it
  const panelsToCheck = permittedPanels.length > 0 ? permittedPanels : ['front', 'back', 'right', 'left'];

  const scannedPermitted = panelsToCheck.filter(p => Boolean(scannedPanels[p]));
  const unscannedPermitted = panelsToCheck.filter(p => !scannedPanels[p]);

  const hasFoundOnAny = scannedPermitted.some(p => {
    const panel = scannedPanels[p];
    if (options.checkFn) return options.checkFn(panel);
    if (panel?.values && panel.values[requirementKey]) return true;
    if (panel?.text) {
      const normKey = requirementKey.toLowerCase().replace(/_/g, ' ');
      return panel.text.toLowerCase().includes(normKey);
    }
    return false;
  });

  if (hasFoundOnAny) {
    return {
      status: 'OBSERVED',
      explanation: 'Statutory declaration observed on captured packaging face.',
      canConcludeMissing: false,
    };
  }

  if (unscannedPermitted.length > 0) {
    return {
      status: 'COVERAGE_INCOMPLETE',
      explanation: `Cannot declare "${requirementKey}" missing: permitted panel(s) [${unscannedPermitted.join(', ')}] have not yet been photographed.`,
      canConcludeMissing: false,
      pendingPanels: unscannedPermitted,
    };
  }

  // All permitted panels have been scanned and declaration was not found
  return {
    status: 'MISSING_AFTER_FULL_COVERAGE',
    explanation: `Statutory declaration confirmed missing after comprehensive review of all permitted panels [${panelsToCheck.join(', ')}].`,
    canConcludeMissing: true,
  };
}
