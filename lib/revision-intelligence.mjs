/**
 * PackSignal Revision Intelligence Engine (lib/revision-intelligence.mjs)
 * High-precision packaging change control, semantic finding correspondence,
 * regression detection, barcode relocation analysis, and multi-version comparison.
 */

import { diffTextBlocks } from './text-revision-diff.mjs';
import { createHash } from 'node:crypto';
export { compareArtworkRevisions, evaluateComparisonBasis, check3DGeometryCompatibility } from './revision/index.mjs';

export const REVISION_CHANGE_TYPES = {
  RESOLVED: 'RESOLVED',
  REGRESSION: 'REGRESSION',
  NEW_ISSUE: 'NEW_ISSUE',
  UNCHANGED: 'UNCHANGED',
  VISUAL_CHANGE: 'VISUAL_CHANGE',
  REMOVED_CONTENT: 'REMOVED_CONTENT',
  ADDED_CONTENT: 'ADDED_CONTENT',
  UNVERIFIED_CHANGE: 'UNVERIFIED_CHANGE',
  NOT_COMPARABLE: 'NOT_COMPARABLE',
};

export const REVISION_CASES = {
  CASE_1_ARTWORK_CHANGED_SPECS_UNCHANGED: 'CASE_1_ARTWORK_CHANGED_SPECS_UNCHANGED',
  CASE_2_ARTWORK_CHANGED_SPECS_CHANGED: 'CASE_2_ARTWORK_CHANGED_SPECS_CHANGED',
  CASE_3_ONLY_SPECS_CHANGED: 'CASE_3_ONLY_SPECS_CHANGED',
  CASE_4_RULES_CHANGED: 'CASE_4_RULES_CHANGED',
  CASE_5_DIFFERENT_SKUS_MISMATCH: 'CASE_5_DIFFERENT_SKUS_MISMATCH',
  CASE_6_DIFFERENT_LAYOUTS: 'CASE_6_DIFFERENT_LAYOUTS',
};

function sha256(val) {
  return createHash('sha256').update(String(val || '')).digest('hex');
}

/**
 * Robust Page Matching between two artwork documents (Phase 2)
 */
export function matchArtworkPages(prevDoc = {}, currDoc = {}, reviewerMapping = null) {
  const prevPages = prevDoc.pages || [];
  const currPages = currDoc.pages || [];

  if (reviewerMapping && Array.isArray(reviewerMapping) && reviewerMapping.length > 0) {
    return reviewerMapping.map(m => ({
      prevPageNumber: m.prevPageNumber,
      currPageNumber: m.currPageNumber,
      confidence: 1.0,
      basis: 'REVIEWER_CONFIRMED',
      requiresConfirmation: false,
      prevPage: prevPages.find(p => p.number === m.prevPageNumber) || null,
      currPage: currPages.find(p => p.number === m.currPageNumber) || null,
    }));
  }

  const pairs = [];
  const usedCurrPages = new Set();

  for (const prevP of prevPages) {
    let bestMatch = null;
    let highestScore = -1;
    let matchBasis = 'PAGE_INDEX';

    for (const currP of currPages) {
      if (usedCurrPages.has(currP.number)) continue;

      let score = 0;

      // 1. Exact page label / title match
      if (prevP.label && currP.label && prevP.label.toLowerCase() === currP.label.toLowerCase()) {
        score += 50;
        matchBasis = 'PAGE_LABEL';
      }

      // 2. Physical dimension match
      const wDiff = Math.abs((prevP.width || 0) - (currP.width || 0));
      const hDiff = Math.abs((prevP.height || 0) - (currP.height || 0));
      if (wDiff < 2 && hDiff < 2) {
        score += 30;
      } else if (Math.abs((prevP.width || 0) - (currP.height || 0)) < 2 && Math.abs((prevP.height || 0) - (currP.width || 0)) < 2) {
        score += 20; // 90 degree rotated
        matchBasis = 'ROTATED_DIMENSION';
      }

      // 3. Extracted text token overlap (Jaccard similarity)
      const prevTokens = new Set((prevP.text || '').toLowerCase().split(/\s+/).filter(Boolean));
      const currTokens = new Set((currP.text || '').toLowerCase().split(/\s+/).filter(Boolean));
      if (prevTokens.size > 0 && currTokens.size > 0) {
        let intersection = 0;
        for (const t of prevTokens) {
          if (currTokens.has(t)) intersection++;
        }
        const union = new Set([...prevTokens, ...currTokens]).size;
        const jaccard = union > 0 ? intersection / union : 0;
        score += Math.round(jaccard * 40);
        if (jaccard > 0.4) matchBasis = 'TEXT_CORRESPONDENCE';
      }

      // 4. Fallback sequential index
      if (prevP.number === currP.number) {
        score += 15;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = currP;
      }
    }

    if (bestMatch) {
      usedCurrPages.add(bestMatch.number);
      const requiresConfirmation = highestScore < 35 || (prevPages.length !== currPages.length);
      pairs.push({
        prevPageNumber: prevP.number,
        currPageNumber: bestMatch.number,
        confidence: Math.min(1.0, Math.round((highestScore / 100) * 100) / 100),
        basis: matchBasis,
        requiresConfirmation,
        prevPage: prevP,
        currPage: bestMatch,
      });
    } else {
      pairs.push({
        prevPageNumber: prevP.number,
        currPageNumber: null,
        confidence: 0,
        basis: 'UNMATCHED_REMOVED_PAGE',
        requiresConfirmation: true,
        prevPage: prevP,
        currPage: null,
      });
    }
  }

  // Any leftover currPages are newly added pages
  for (const currP of currPages) {
    if (!usedCurrPages.has(currP.number)) {
      pairs.push({
        prevPageNumber: null,
        currPageNumber: currP.number,
        confidence: 0,
        basis: 'NEW_ADDED_PAGE',
        requiresConfirmation: true,
        prevPage: null,
        currPage: currP,
      });
    }
  }

  return pairs;
}

/**
 * Semantic Finding Correspondence Layer (Phase 7)
 * Correlates findings between revisions even if finding IDs changed after re-extraction.
 */
export function correlateFindings(prevFindings = [], currFindings = []) {
  const correlated = [];
  const usedCurrIds = new Set();

  for (const prevF of prevFindings) {
    // 1. Exact ID match
    let match = currFindings.find(f => f.id === prevF.id && !usedCurrIds.has(f.id));
    let matchBasis = 'EXACT_ID';

    // 2. Rule & Field match
    if (!match && prevF.rule?.id) {
      match = currFindings.find(f => f.rule?.id === prevF.rule.id && !usedCurrIds.has(f.id));
      if (match) matchBasis = 'RULE_ID';
    }

    // 3. Field & Title match
    if (!match && prevF.rule?.field) {
      match = currFindings.find(f => f.rule?.field === prevF.rule.field && !usedCurrIds.has(f.id));
      if (match) matchBasis = 'PRODUCT_FIELD';
    }

    // 4. Expected value match
    if (!match && prevF.expected && prevF.expected !== 'Missing reference value') {
      match = currFindings.find(f => f.expected === prevF.expected && !usedCurrIds.has(f.id));
      if (match) matchBasis = 'EXPECTED_VALUE';
    }

    // 5. Source quotation match
    if (!match && prevF.evidence?.[0]?.quote) {
      const q = prevF.evidence[0].quote;
      match = currFindings.find(f => f.evidence?.some(e => e.quote === q) && !usedCurrIds.has(f.id));
      if (match) matchBasis = 'SOURCE_QUOTE';
    }

    if (match) {
      usedCurrIds.add(match.id);
      correlated.push({
        previousFinding: prevF,
        currentFinding: match,
        matchBasis,
        previousStatus: prevF.status,
        currentStatus: match.status,
      });
    } else {
      correlated.push({
        previousFinding: prevF,
        currentFinding: null,
        matchBasis: 'NOT_IN_CURRENT_REVISION',
        previousStatus: prevF.status,
        currentStatus: null,
      });
    }
  }

  // Findings in V2 that were not in V1
  for (const currF of currFindings) {
    if (!usedCurrIds.has(currF.id)) {
      correlated.push({
        previousFinding: null,
        currentFinding: currF,
        matchBasis: 'NEWLY_DISCOVERED',
        previousStatus: null,
        currentStatus: currF.status,
      });
    }
  }

  return correlated;
}

/**
 * Barcode Relocation Regression Analysis (Phase 9)
 */
export function analyzeBarcodeRelocation(prevReview = {}, currReview = {}) {
  const prevCodes = (prevReview.documents?.find(d => d.role === 'artwork')?.pages || []).flatMap(p => p.codes || []);
  const currCodes = (currReview.documents?.find(d => d.role === 'artwork')?.pages || []).flatMap(p => p.codes || []);

  const results = [];

  for (const pCode of prevCodes) {
    const cCode = currCodes.find(c => c.value === pCode.value || c.type === pCode.type);
    if (!cCode) {
      results.push({
        barcode: pCode.value,
        type: pCode.type,
        change: 'REMOVED_BARCODE',
        isRegression: true,
        reason: `Barcode ${pCode.value} present in V1 was removed or unreadable in V2.`,
      });
      continue;
    }

    // Calculate displacement if box coordinates exist
    if (pCode.box && cCode.box) {
      const pCenter = [(pCode.box[0] + pCode.box[2]) / 2, (pCode.box[1] + pCode.box[3]) / 2];
      const cCenter = [(cCode.box[0] + cCode.box[2]) / 2, (cCode.box[1] + cCode.box[3]) / 2];

      const dxNorm = cCenter[0] - pCenter[0];
      const dyNorm = cCenter[1] - pCenter[1];
      const distNorm = Math.sqrt(dxNorm * dxNorm + dyNorm * dyNorm);

      // Convert to estimated physical millimeters (assume standard 150mm dieline scale if uncalibrated)
      const estimatedScaleMm = 150.0;
      const distMm = Math.round(distNorm * estimatedScaleMm * 10) / 10;

      const hasMoved = distNorm > 0.02; // More than 2% displacement
      const inGlueFlap = cCenter[0] > 0.88 || cCenter[0] < 0.12; // Typical glue flap margins

      results.push({
        barcode: pCode.value,
        type: pCode.type,
        change: hasMoved ? 'RELOCATED' : 'STABLE',
        hasMoved,
        displacementMm: distMm,
        displacementNorm: [dxNorm, dyNorm],
        previousBox: pCode.box,
        currentBox: cCode.box,
        inExclusionZone: inGlueFlap,
        isRegression: hasMoved && inGlueFlap,
        reason: hasMoved
          ? `Barcode moved ${distMm} mm${inGlueFlap ? ' into packaging glue flap exclusion zone!' : ' across panel'}`
          : 'Barcode placement remains stable.',
      });
    }
  }

  return results;
}

/**
 * Native Font Size Reduction Regression Analysis (Phase 10)
 */
export function analyzeFontSizeReduction(prevReview = {}, currReview = {}) {
  const prevTypography = prevReview.deepVerification?.preflightReport?.checks?.find(c => c.category === 'typography' || c.id?.includes('font'));
  const currTypography = currReview.deepVerification?.preflightReport?.checks?.find(c => c.category === 'typography' || c.id?.includes('font'));

  if (!prevTypography || !currTypography) return null;

  const prevPt = prevTypography.details?.fontSizePt || prevTypography.details?.measuredPt;
  const currPt = currTypography.details?.fontSizePt || currTypography.details?.measuredPt;
  const minRequiredPt = prevTypography.details?.minPt || 6.0;

  if (typeof prevPt === 'number' && typeof currPt === 'number') {
    const ptDelta = currPt - prevPt;
    const isReducedBelowMin = currPt < minRequiredPt && prevPt >= minRequiredPt;

    return {
      previousPt: prevPt,
      currentPt: currPt,
      ptDelta: Math.round(ptDelta * 10) / 10,
      minRequiredPt,
      isRegression: isReducedBelowMin,
      reason: isReducedBelowMin
        ? `Statutory copy font size was reduced from ${prevPt} pt to ${currPt} pt (violates required minimum ${minRequiredPt} pt).`
        : ptDelta < 0
        ? `Font size reduced by ${Math.abs(ptDelta)} pt (currently ${currPt} pt).`
        : 'Font size maintained or increased.',
    };
  }
  return null;
}

/**
 * Packaging Geometry Revision Comparison (Step 28)
 */
export function compareGeometryRevisions(prevReview = {}, currReview = {}) {
  const geomChanges = [];
  const prevGeom = prevReview.packagingGeometry;
  const currGeom = currReview.packagingGeometry;

  const prevZones = prevReview.options?.panelZones || {};
  const currZones = currReview.options?.panelZones || {};

  // Check for panel mapping changes
  const allFaces = new Set([...Object.keys(prevZones), ...Object.keys(currZones)]);
  for (const face of allFaces) {
    const pz = prevZones[face];
    const cz = currZones[face];
    if (!pz && cz) {
      geomChanges.push({
        id: `geom-panel-added-${face}`,
        title: `Panel Mapping Added · ${face.toUpperCase()}`,
        type: 'PANEL_MAPPING_CHANGED',
        description: `Face ${face.toUpperCase()} was mapped in current revision.`
      });
    } else if (pz && !cz) {
      geomChanges.push({
        id: `geom-panel-removed-${face}`,
        title: `Panel Mapping Removed · ${face.toUpperCase()}`,
        type: 'PANEL_MAPPING_CHANGED',
        description: `Face ${face.toUpperCase()} mapping was removed in current revision.`
      });
    } else if (pz && cz && Array.isArray(pz.box) && Array.isArray(cz.box)) {
      const boxDiff = Math.max(...pz.box.map((v, i) => Math.abs(v - cz.box[i])));
      if (boxDiff > 0.02) {
        geomChanges.push({
          id: `geom-panel-moved-${face}`,
          title: `Panel Boundary Shifted · ${face.toUpperCase()}`,
          type: 'PANEL_BOUNDARY_CHANGED',
          description: `Face ${face.toUpperCase()} boundary shifted by ${(boxDiff * 100).toFixed(1)}%.`
        });
      }
    }
  }

  // Check for layout fit overflow changes
  const prevOverflows = (prevGeom?.layoutFits || []).filter(lf => lf.outcome === 'OVERFLOW_RISK');
  const currOverflows = (currGeom?.layoutFits || []).filter(lf => lf.outcome === 'OVERFLOW_RISK');

  if (prevOverflows.length === 0 && currOverflows.length > 0) {
    geomChanges.push({
      id: 'geom-new-overflow',
      title: 'New Layout Overflow Risk Detected',
      type: 'NEW_OVERFLOW_RISK',
      description: `Current revision has ${currOverflows.length} text copy blocks exceeding available panel space.`
    });
  } else if (prevOverflows.length > 0 && currOverflows.length === 0) {
    geomChanges.push({
      id: 'geom-cleared-overflow',
      title: 'Layout Overflow Cleared',
      type: 'CLEARED_OVERFLOW',
      description: 'Previous copy overflow risks have been resolved within panel boundaries.'
    });
  }

  return geomChanges;
}

/**
 * Master Revision Intelligence Analyzer (Phase 1)
 * Compares two review snapshots and builds the comprehensive Revision Intelligence Studio payload.
 */
export function analyzeRevisionIntelligence(prevReview = {}, currReview = {}, options = {}) {
  const prevArtDoc = prevReview.documents?.find(d => d.role === 'artwork') || {};
  const currArtDoc = currReview.documents?.find(d => d.role === 'artwork') || {};

  const prevArtSha = prevArtDoc.sha256 || prevArtDoc.id || 'sha-v1';
  const currArtSha = currArtDoc.sha256 || currArtDoc.id || 'sha-v2';

  const prevSources = (prevReview.documents || []).filter(d => d.role === 'spec' || d.role === 'rules');
  const currSources = (currReview.documents || []).filter(d => d.role === 'spec' || d.role === 'rules');

  const prevSourceHash = sha256(prevSources.map(s => `${s.id}:${s.sha256}`).join('|'));
  const currSourceHash = sha256(currSources.map(s => `${s.id}:${s.sha256}`).join('|'));

  const artworkChanged = prevArtSha !== currArtSha;
  const sourcesChanged = prevSourceHash !== currSourceHash;

  // Case Classification (Phase 1)
  let caseClassification = REVISION_CASES.CASE_1_ARTWORK_CHANGED_SPECS_UNCHANGED;
  let caseExplanation = 'Artwork file was updated while approved specifications and rules remained unchanged.';

  if (artworkChanged && sourcesChanged) {
    caseClassification = REVISION_CASES.CASE_2_ARTWORK_CHANGED_SPECS_CHANGED;
    caseExplanation = 'Both artwork and reference specifications changed simultaneously.';
  } else if (!artworkChanged && sourcesChanged) {
    caseClassification = REVISION_CASES.CASE_3_ONLY_SPECS_CHANGED;
    caseExplanation = 'Artwork is unchanged; reference specifications or rulebooks were updated.';
  }

  // SKU Check: Accidental different product comparison check
  const prevBrand = prevReview.facts?.find(f => f.field === 'brand_name')?.value?.toLowerCase();
  const currBrand = currReview.facts?.find(f => f.field === 'brand_name')?.value?.toLowerCase();
  if (prevBrand && currBrand && prevBrand !== currBrand) {
    caseClassification = REVISION_CASES.CASE_5_DIFFERENT_SKUS_MISMATCH;
    caseExplanation = `Warning: Different brand identities detected (${prevBrand} vs ${currBrand}). Confirm that both files belong to the same packaging project.`;
  }

  // 1. Page Matching
  const pageMappings = matchArtworkPages(prevArtDoc, currArtDoc, options.reviewerPageMapping);

  // 2. Semantic Finding Correspondence
  const findingCorrelations = correlateFindings(prevReview.findings || [], currReview.findings || []);

  // Classify changes into Resolved, Regressions, New Issues, Unchanged
  const changes = [];
  let resolvedCount = 0;
  let regressionCount = 0;
  let newIssueCount = 0;
  let unchangedCount = 0;
  let unverifiedCount = 0;

  for (const cor of findingCorrelations) {
    const pf = cor.previousFinding;
    const cf = cor.currentFinding;

    // Check Case: Was an issue resolved?
    if (pf && cf && pf.status !== 'match' && cf.status === 'match') {
      const isUnchangedSource = !sourcesChanged;
      changes.push({
        id: `rev-chg-${pf.id}`,
        title: pf.title,
        classification: REVISION_CHANGE_TYPES.RESOLVED,
        statusColor: 'green',
        previousStatus: pf.status,
        currentStatus: cf.status,
        observedV1: pf.observed,
        observedV2: cf.observed,
        expected: cf.expected,
        ruleId: cf.rule?.id || pf.rule?.id,
        evidenceV1: pf.evidence?.[0] || null,
        evidenceV2: cf.evidence?.[0] || null,
        reason: isUnchangedSource
          ? `Resolved against unchanged approved reference "${cf.expected}". Discrepancy successfully fixed.`
          : 'Status changed to match; note that reference specifications also changed between revisions.',
        verifiedAgainstReference: isUnchangedSource,
      });
      resolvedCount++;
      continue;
    }

    // Check Case: Regression (was match, now issue)
    if (pf && cf && pf.status === 'match' && cf.status !== 'match') {
      changes.push({
        id: `rev-chg-${cf.id}`,
        title: cf.title,
        classification: REVISION_CHANGE_TYPES.REGRESSION,
        statusColor: 'red',
        previousStatus: pf.status,
        currentStatus: cf.status,
        observedV1: pf.observed,
        observedV2: cf.observed,
        expected: cf.expected,
        ruleId: cf.rule?.id,
        evidenceV1: pf.evidence?.[0] || null,
        evidenceV2: cf.evidence?.[0] || null,
        reason: `REGRESSION: Previously matching check now fails. Observed: "${cf.observed}" (Expected: "${cf.expected}").`,
      });
      regressionCount++;
      continue;
    }

    // Check Case: Finding in V1 disappeared in V2 (Content removed or check missed)
    if (pf && !cf) {
      changes.push({
        id: `rev-chg-${pf.id}`,
        title: pf.title,
        classification: REVISION_CHANGE_TYPES.REMOVED_CONTENT,
        statusColor: 'amber',
        previousStatus: pf.status,
        currentStatus: 'NOT_CHECKED',
        observedV1: pf.observed,
        observedV2: '[Content removed or unread in V2]',
        expected: pf.expected,
        evidenceV1: pf.evidence?.[0] || null,
        evidenceV2: null,
        reason: 'Finding was present in V1 but not detected in V2. Verify whether packaging copy was intentionally removed or missed during extraction.',
      });
      unverifiedCount++;
      continue;
    }

    // Check Case: New finding in V2
    if (!pf && cf) {
      const isDefect = cf.status !== 'match';
      changes.push({
        id: `rev-chg-${cf.id}`,
        title: cf.title,
        classification: isDefect ? REVISION_CHANGE_TYPES.NEW_ISSUE : REVISION_CHANGE_TYPES.ADDED_CONTENT,
        statusColor: isDefect ? 'red' : 'blue',
        previousStatus: null,
        currentStatus: cf.status,
        observedV1: '[Not present in V1]',
        observedV2: cf.observed,
        expected: cf.expected,
        evidenceV1: null,
        evidenceV2: cf.evidence?.[0] || null,
        reason: isDefect
          ? `NEW ISSUE: Discrepancy introduced in V2 not present in prior artwork. Observed: "${cf.observed}".`
          : `Added content in V2 verified against reference: "${cf.observed}".`,
      });
      if (isDefect) newIssueCount++;
      continue;
    }

    // Check Case: Unchanged issue or unchanged match
    if (pf && cf) {
      changes.push({
        id: `rev-chg-${cf.id}`,
        title: cf.title,
        classification: REVISION_CHANGE_TYPES.UNCHANGED,
        statusColor: cf.status === 'match' ? 'green' : 'gray',
        previousStatus: pf.status,
        currentStatus: cf.status,
        observedV1: pf.observed,
        observedV2: cf.observed,
        expected: cf.expected,
        evidenceV1: pf.evidence?.[0] || null,
        evidenceV2: cf.evidence?.[0] || null,
        reason: cf.status === 'match'
          ? 'Check remains verified and matching in both versions.'
          : 'Discrepancy remains unresolved between versions.',
      });
      unchangedCount++;
    }
  }

  // 3. Barcode Relocation Analysis
  const barcodeRelocations = analyzeBarcodeRelocation(prevReview, currReview);
  for (const b of barcodeRelocations) {
    if (b.isRegression) {
      changes.unshift({
        id: `chg-bc-regr-${b.barcode}`,
        title: `Barcode Position Regression (${b.barcode})`,
        classification: REVISION_CHANGE_TYPES.REGRESSION,
        statusColor: 'red',
        previousStatus: 'match',
        currentStatus: 'issue',
        observedV1: 'Standard print area',
        observedV2: `Displaced ${b.displacementMm}mm into glue flap`,
        evidenceV1: { page: 1, box: b.previousBox },
        evidenceV2: { page: 1, box: b.currentBox },
        reason: b.reason,
      });
      regressionCount++;
    }
  }

  // 4. Native Font Size Reduction Analysis
  const fontReduction = analyzeFontSizeReduction(prevReview, currReview);
  if (fontReduction && fontReduction.isRegression) {
    changes.unshift({
      id: 'chg-font-regr',
      title: 'Mandatory Text Font Size Reduction Regression',
      classification: REVISION_CHANGE_TYPES.REGRESSION,
      statusColor: 'red',
      previousStatus: 'match',
      currentStatus: 'issue',
      observedV1: `${fontReduction.previousPt} pt`,
      observedV2: `${fontReduction.currentPt} pt`,
      expected: `>= ${fontReduction.minRequiredPt} pt`,
      reason: fontReduction.reason,
    });
    regressionCount++;
  }

  // 5. Packaging Geometry Revision Comparison (Step 28)
  const geometryChanges = compareGeometryRevisions(prevReview, currReview);
  for (const gc of geometryChanges) {
    changes.push({
      id: gc.id,
      title: gc.title,
      classification: gc.type === 'NEW_OVERFLOW_RISK' ? REVISION_CHANGE_TYPES.REGRESSION : REVISION_CHANGE_TYPES.VISUAL_CHANGE,
      statusColor: gc.type === 'NEW_OVERFLOW_RISK' ? 'red' : 'blue',
      previousStatus: 'match',
      currentStatus: gc.type === 'NEW_OVERFLOW_RISK' ? 'issue' : 'review',
      reason: gc.description,
    });
    if (gc.type === 'NEW_OVERFLOW_RISK') regressionCount++;
  }

  const comparisonId = `cmp-${prevReview.id || 'v1'}-${currReview.id || 'v2'}-${Date.now().toString(36)}`;

  return {
    comparisonId,
    previousReviewId: prevReview.id,
    currentReviewId: currReview.id,
    previousArtworkSha256: prevArtSha,
    currentArtworkSha256: currArtSha,
    previousSourceHash: prevSourceHash,
    currentSourceHash: currSourceHash,
    created: new Date().toISOString(),
    caseClassification,
    caseExplanation,
    pageMappings,
    changes,
    barcodeRelocations,
    fontReduction,
    geometryChanges,
    counts: {
      totalChanges: changes.length,
      resolvedCount,
      regressionCount,
      newIssueCount,
      unchangedCount,
      unverifiedCount,
    },
    summaryText: `${resolvedCount} resolved issues · ${regressionCount} regressions · ${newIssueCount} new issues · ${unchangedCount} unchanged`,
    requiresHumanReview: true,
  };
}
