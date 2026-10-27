/**
 * PackSignal Packaging Geometry & Layout Intelligence — Master Engine Entrypoint
 * (lib/geometry/index.mjs)
 *
 * Implements Phase 4 master pipeline combining:
 * 1. Dieline structural analysis and closed panel polygon detection
 * 2. Evidence-backed panel face inference
 * 3. Topological fold adjacency graph
 * 4. Coordinate registration verification
 * 5. Printable / safe region derivation
 * 6. Panel-specific rule evaluation
 * 7. Bounded layout-fit assessment
 * 8. Coverage ledger and audit trail
 */

import { GEOMETRY_SCHEMA_VERSION, STRUCTURAL_CLASSIFICATIONS, VERIFICATION_STATES, SOURCE_TYPES } from './model.mjs';
import { classifyStructuralEdge } from './segments.mjs';
import { extractClosedPolygonsFromSegments } from './topology.mjs';
import { inferPanelFaces } from './panel-inference.mjs';
import { buildFoldGraph } from './fold-graph.mjs';
import { evaluateRegistration } from './registration.mjs';
import { computePanelPrintableRegion } from './printable-regions.mjs';
import { evaluatePanelRules } from './placement.mjs';
import { assessLayoutFit } from './layout-fit.mjs';
import { buildGeometryCoverageLedger } from './coverage.mjs';

export * from './model.mjs';
export * from './units.mjs';
export * from './coordinates.mjs';
export * from './polygons.mjs';
export * from './segments.mjs';
export * from './topology.mjs';
export * from './registration.mjs';
export * from './panel-inference.mjs';
export * from './fold-graph.mjs';
export * from './printable-regions.mjs';
export * from './placement.mjs';
export * from './layout-fit.mjs';
export * from './coverage.mjs';

/**
 * Extracts candidate structural segments from DXF or PDF dieline documents.
 */
function extractDielineSegments(dielineDoc) {
  const segments = [];
  if (!dielineDoc) return segments;

  // 1. From DXF vectorLines
  if (Array.isArray(dielineDoc.vectorLines)) {
    for (const vl of dielineDoc.vectorLines) {
      if (Array.isArray(vl.points) && vl.points.length >= 2) {
        const classification = classifyStructuralEdge(vl.layer, vl.kind);
        segments.push({
          points: vl.points,
          layer: vl.layer || '',
          kind: vl.kind || 'unclassified',
          structuralClassification: classification,
          sourceDocumentId: dielineDoc.id,
          sourceDocumentHash: dielineDoc.sha256
        });
      }
    }
  }

  // 2. From PDF drawings or structuralEdges
  if (Array.isArray(dielineDoc.structuralEdges)) {
    for (const se of dielineDoc.structuralEdges) {
      if (Array.isArray(se.points) && se.points.length >= 2) {
        const classification = classifyStructuralEdge(se.layer, se.kind);
        segments.push({
          points: se.points,
          layer: se.layer || '',
          kind: se.kind || 'unclassified',
          structuralClassification: classification,
          sourceDocumentId: dielineDoc.id,
          sourceDocumentHash: dielineDoc.sha256
        });
      }
    }
  }

  return segments;
}

/**
 * Main Packaging Geometry Analysis orchestrator.
 */
export function analyzePackagingGeometry({
  review,
  artworkDocument = null,
  dielineDocument = null,
  rules = [],
  facts = [],
  options = {}
}) {
  const artDoc = artworkDocument || review?.documents?.find(d => d.role === 'artwork');
  const dielineDoc = dielineDocument || review?.documents?.find(d => d.role === 'dieline') || artDoc;

  // 1. Coordinate Registration Evaluation
  const confirmedReg = options.registrationConfirmation || review?.options?.registrationConfirmation || null;
  const registration = evaluateRegistration({
    artworkDocument: artDoc,
    dielineDocument: dielineDoc,
    confirmedRegistration: confirmedReg,
    options
  });

  // 2. Extract structural segments
  const structuralSegments = extractDielineSegments(dielineDoc);

  // 3. Extract closed panel polygons
  // If dieline document already has pre-extracted vectorRegions (e.g. from DXF closed polylines):
  let polygons = [];
  const isPdfVector = dielineDoc?.vectorGeometry?.format === 'PDF';
  const defaultSourceType = isPdfVector ? SOURCE_TYPES.PDF_VECTOR : SOURCE_TYPES.DXF_VECTOR;

  if (Array.isArray(dielineDoc?.vectorRegions) && dielineDoc.vectorRegions.length > 0) {
    polygons = dielineDoc.vectorRegions.map((vr, idx) => ({
      polygonId: `poly_${idx + 1}`,
      points: vr.points,
      area: vr.area || 0,
      perimeter: 0,
      boundingBox: vr.box || [0, 0, 0, 0],
      closed: true,
      valid: true,
      layer: vr.layer,
      sourceLabel: vr.sourceLabel,
      face: vr.face,
      sourceType: defaultSourceType,
      limitations: []
    }));
  } else if (structuralSegments.length > 0) {
    // Only form panel boundaries from trusted structural lines (CUT, CREASE, FOLD, PANEL_BOUNDARY)
    // Decorative artwork, typography, and unverified borders are rejected as dieline panels
    const trustedStructuralSegments = structuralSegments.filter(s =>
      s.structuralClassification === STRUCTURAL_CLASSIFICATIONS.CUT ||
      s.structuralClassification === STRUCTURAL_CLASSIFICATIONS.CREASE ||
      s.structuralClassification === STRUCTURAL_CLASSIFICATIONS.FOLD ||
      s.structuralClassification === STRUCTURAL_CLASSIFICATIONS.PANEL_BOUNDARY
    );

    if (trustedStructuralSegments.length >= 3) {
      polygons = extractClosedPolygonsFromSegments(trustedStructuralSegments, {
        snapTolerance: 1e-3,
        minArea: 0.005
      }).map(p => ({
        ...p,
        sourceType: defaultSourceType
      }));
    }
  }

  // 4. Evidence-backed panel face inference
  const reviewerZones = review?.options?.panelZones || {};
  const panelLabels = dielineDoc?.panelLabels || [];
  const panels = inferPanelFaces({
    polygons,
    panelLabels,
    reviewerZones,
    options
  });

  // 5. Fold adjacency graph
  const foldGraph = buildFoldGraph({
    panels,
    structuralSegments,
    tolerance: 0.01,
    minSharedLength: 0.005
  });

  // 6. Printable & Safe regions calculation
  const pageDim = dielineDoc?.pages?.[0]
    ? { width: dielineDoc.pages[0].width || 300, height: dielineDoc.pages[0].height || 200 }
    : { width: 300, height: 200 };

  const glueExclusions = structuralSegments.filter(s => s.structuralClassification === STRUCTURAL_CLASSIFICATIONS.GLUE);
  const printableRegions = panels.map(p => computePanelPrintableRegion({
    panel: p,
    pageDimensionsMm: pageDim,
    cutMarginMm: 2.0,
    creaseMarginMm: 1.5,
    glueExclusionZones: glueExclusions
  }));

  // 7. Panel-specific rule evaluation
  const allRules = [...(rules || []), ...(review?.rules || [])];
  const ruleEvaluation = evaluatePanelRules({
    rules: allRules,
    artworkDocument: artDoc,
    panels,
    printableRegions,
    registration,
    facts
  });

  // 8. Bounded layout-fit assessment on designated panels
  const layoutFits = [];
  const rulesRequiringFit = allRules.filter(r =>
    ['REQUIRED_ON_PANEL', 'REQUIRED_PANEL_PLACEMENT', 'PANEL_PLACEMENT'].includes(r.checkType || r.comparison)
  );

  for (const r of rulesRequiringFit) {
    const targetFace = String(r.panel || r.targetPanel || '').toLowerCase();
    const targetRegion = printableRegions.find(pr => pr.face.toLowerCase() === targetFace);
    const copy = String(r.literal_expected || r.text || r.value || '');

    if (targetRegion && copy) {
      const fitResult = assessLayoutFit({
        panelPrintableRegion: targetRegion,
        requiredCopy: copy,
        minimumFontSizePt: Number(r.minimumFontSizePt || r.minFontSize || 6.0),
        pageDimensionsMm: pageDim,
        existingObstacles: []
      });
      layoutFits.push({
        ruleId: r.id,
        ruleTitle: r.title,
        ...fitResult
      });
    }
  }

  // 9. Geometry coverage ledger
  const coverage = buildGeometryCoverageLedger({
    panels,
    foldGraph,
    structuralSegments,
    printableRegions,
    registration,
    evaluatedRules: allRules,
    layoutFits,
    dielineDocument: dielineDoc
  });

  return {
    schemaVersion: GEOMETRY_SCHEMA_VERSION,
    registration,
    structuralSegments,
    panels,
    foldGraph,
    printableRegions,
    findings: ruleEvaluation.findings || [],
    layoutFits,
    coverage,
    limitations: [
      'Screening only: PackSignal geometry analysis evaluates dielines and placement against rules.',
      'Does not provide structural production certification or guaranteed press fit.'
    ]
  };
}
