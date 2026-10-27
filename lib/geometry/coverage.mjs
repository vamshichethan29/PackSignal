/**
 * PackSignal Packaging Geometry — Geometry Coverage Ledger
 * (lib/geometry/coverage.mjs)
 *
 * Implements Step 1 & Step 29: Geometry coverage metrics, audit metadata, and explicit limitations.
 */

export function buildGeometryCoverageLedger({
  panels = [],
  foldGraph = null,
  structuralSegments = [],
  printableRegions = [],
  registration = null,
  evaluatedRules = [],
  layoutFits = [],
  dielineDocument = null
}) {
  const confirmedPanels = panels.filter(p => p.verificationState === 'REVIEWER_CONFIRMED');
  const labeledPanels = panels.filter(p => p.verificationState === 'EXPLICITLY_LABELED');
  const candidatePanels = panels.filter(p => p.verificationState === 'GEOMETRIC_CANDIDATE');
  const unresolvedPanels = panels.filter(p => p.verificationState === 'UNRESOLVED' || p.verificationState === 'AMBIGUOUS');

  const lineKinds = {
    cut: structuralSegments.filter(s => s.structuralClassification === 'CUT').length,
    crease: structuralSegments.filter(s => s.structuralClassification === 'CREASE').length,
    glue: structuralSegments.filter(s => s.structuralClassification === 'GLUE').length,
    bleed: structuralSegments.filter(s => s.structuralClassification === 'BLEED_GUIDE').length,
    unknown: structuralSegments.filter(s => s.structuralClassification === 'UNKNOWN').length
  };

  const totalLines = structuralSegments.length;
  const isRegistered = Boolean(registration?.verified);

  const limitations = [
    'Geometry screening is a prepress inspection aid; it does not certify physical foldability or die manufacturing tolerances.',
    'Glue areas are recognized only when explicitly defined on dedicated CAD layers or confirmed by reviewers; glue tabs are not assumed automatically.',
    'Layout-fit assessment is a bounded feasibility screen using font approximations; it does not replace human typography approval.',
    'Statutory Principal Display Panel (PDP) status is never inferred from carton geometry alone.'
  ];

  if (!isRegistered) {
    limitations.unshift('Artwork-to-dieline registration is unconfirmed; panel placement findings require human confirmation.');
  }

  return {
    dielineDocumentId: dielineDocument?.id || null,
    dielineHash: dielineDocument?.sha256 || null,
    dielineFormat: dielineDocument?.vectorGeometry?.format || 'PDF/CAD',
    units: dielineDocument?.vectorGeometry?.units || dielineDocument?.pages?.[0]?.unit || 'unverified',
    panelCounts: {
      total: panels.length,
      confirmed: confirmedPanels.length,
      labeled: labeledPanels.length,
      candidate: candidatePanels.length,
      unresolved: unresolvedPanels.length
    },
    lineCounts: {
      total: totalLines,
      ...lineKinds
    },
    foldGraph: {
      nodes: foldGraph?.nodes?.length || 0,
      edges: foldGraph?.edges?.length || 0,
      isFullyConnected: Boolean(foldGraph?.isFullyConnected),
      componentCount: foldGraph?.componentCount || 0
    },
    registration: {
      status: registration?.status || 'UNKNOWN',
      method: registration?.registrationMethod || 'NONE',
      verified: isRegistered
    },
    ruleCounts: {
      evaluated: evaluatedRules.length,
      layoutFitScreens: layoutFits.length
    },
    limitations
  };
}
