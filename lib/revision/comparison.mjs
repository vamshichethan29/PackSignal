/**
 * PackSignal Master Revision Comparison Orchestrator (lib/revision/comparison.mjs)
 * High-precision packaging change control, semantic finding correspondence,
 * 3D packaging geometry compatibility, and multi-version comparison.
 */

import { correlateFindings } from './finding-matcher.mjs';
import { evaluateComparisonBasis } from './source-impact.mjs';
import { check3DGeometryCompatibility, analyzeBarcodeRelocation, analyzeFontSizeReduction } from './geometry-impact.mjs';
import { classifyFindingChange, REVISION_CHANGE_TYPES } from './change-classifier.mjs';
import { generateComparisonId, saveComparison } from './comparison-store.mjs';
import { diffTextBlocks, comparePackagingSections } from '../text-revision-diff.mjs';
import { matchArtworkPages } from '../revision-intelligence.mjs';

/**
 * Executes a full revision comparison between Revision A and Revision B
 */
export function compareArtworkRevisions(reviewA = {}, reviewB = {}, options = {}) {
  const revAId = reviewA.id || 'rev-a';
  const revBId = reviewB.id || 'rev-b';

  const docA = reviewA.documents?.find(d => d.role === 'artwork') || {};
  const docB = reviewB.documents?.find(d => d.role === 'artwork') || {};

  const artworkAHash = docA.sha256 || docA.id || 'art-a-sha';
  const artworkBHash = docB.sha256 || docB.id || 'art-b-sha';

  // 1. Evaluate Comparison Basis (Frozen vs Changed References / SKU Mismatch)
  const basis = evaluateComparisonBasis(reviewA, reviewB);

  // 2. Check 3D Packaging Geometry Compatibility
  const geometryCompatibility = check3DGeometryCompatibility(reviewA, reviewB);

  // 3. Correlate Findings deterministically
  const correlations = correlateFindings(reviewA.findings || [], reviewB.findings || [], options);

  // 4. Match Artwork Pages
  const pageMappings = matchArtworkPages(docA, docB, options.reviewerPageMapping);

  // 5. Classify each finding change
  const changes = [];
  let verifiedFixes = 0;
  let regressions = 0;
  let newIssues = 0;
  let neutralChanges = 0;
  let unverifiedChanges = 0;
  let unchangedCount = 0;

  for (const cor of correlations) {
    const pf = cor.previousFinding;
    const cf = cor.currentFinding;
    const cl = classifyFindingChange(cor, basis);

    const changeId = `rev-chg-${(cf || pf)?.id}`;
    const changeEntry = {
      id: changeId,
      findingId: cf?.id || pf?.id,
      title: (cf || pf)?.title,
      classification: cl.classification,
      statusColor: cl.statusColor,
      previousStatus: pf?.status || null,
      currentStatus: cf?.status || null,
      observedV1: pf?.observed || '[Not present in V1]',
      observedV2: cf?.observed || '[Not detected in V2]',
      expected: cf?.expected || pf?.expected || null,
      ruleId: cf?.rule?.id || pf?.rule?.id,
      field: cf?.rule?.field || pf?.rule?.field,
      evidenceV1: pf?.evidence?.[0] || null,
      evidenceV2: cf?.evidence?.[0] || null,
      reason: cl.reason,
      verifiedAgainstReference: cl.verifiedAgainstReference ?? false,
      matchBasis: cor.matchBasis,
      confidence: cor.confidence,
    };

    // Link remediation proposals if present in Revision A
    if (reviewA.remediationProposals) {
      const prop = reviewA.remediationProposals[pf?.id];
      if (prop) {
        changeEntry.linkedRemediation = {
          proposalId: prop.id,
          proposedText: prop.proposedText,
          status: prop.status,
          isImplemented: cf?.status === 'match',
        };
      }
    }

    changes.push(changeEntry);

    if (cl.classification === REVISION_CHANGE_TYPES.VERIFIED_RESOLVED || cl.classification === REVISION_CHANGE_TYPES.RESOLVED) {
      verifiedFixes++;
    } else if (cl.classification === REVISION_CHANGE_TYPES.REGRESSION) {
      regressions++;
    } else if (cl.classification === REVISION_CHANGE_TYPES.NEW_ISSUE) {
      newIssues++;
    } else if (cl.classification === REVISION_CHANGE_TYPES.NEUTRAL_VISUAL_CHANGE || cl.classification === REVISION_CHANGE_TYPES.VISUAL_CHANGE) {
      neutralChanges++;
    } else if (cl.classification === REVISION_CHANGE_TYPES.UNVERIFIED_CHANGE || cl.classification === REVISION_CHANGE_TYPES.SOURCE_BASIS_CHANGED) {
      unverifiedChanges++;
    } else {
      unchangedCount++;
    }
  }

  // 6. Barcode and Typography checks
  const barcodeRelocations = analyzeBarcodeRelocation(reviewA, reviewB);
  for (const b of barcodeRelocations) {
    if (b.isRegression) {
      regressions++;
      changes.push({
        id: `rev-chg-barcode-${b.barcode}`,
        title: `Barcode Relocation Regression (${b.barcode})`,
        classification: REVISION_CHANGE_TYPES.REGRESSION,
        statusColor: 'red',
        previousStatus: 'match',
        currentStatus: 'issue',
        observedV1: `Stable placement on panel`,
        observedV2: `Moved into glue flap (${b.displacementMm} mm displacement)`,
        expected: 'Barcode must not impinge upon packaging glue flap margins',
        ruleId: 'preflight-barcode-quiet-zone',
        evidenceV1: { box: b.previousBox },
        evidenceV2: { box: b.currentBox },
        reason: b.reason,
      });
    }
  }

  const fontReduction = analyzeFontSizeReduction(reviewA, reviewB);
  if (fontReduction?.isRegression) {
    regressions++;
    changes.push({
      id: `rev-chg-font-reduction`,
      title: `Mandatory Copy Font Size Reduction`,
      classification: REVISION_CHANGE_TYPES.REGRESSION,
      statusColor: 'red',
      previousStatus: 'match',
      currentStatus: 'issue',
      observedV1: `${fontReduction.previousPt} pt`,
      observedV2: `${fontReduction.currentPt} pt`,
      expected: `Minimum ${fontReduction.minRequiredPt} pt required by statutory standard`,
      ruleId: 'preflight-typography-min-size',
      reason: fontReduction.reason,
    });
  }

  // 7. Text Section Diff
  const packagingSectionDiffs = comparePackagingSections(reviewA, reviewB);

  // 8. Build complete snapshot
  const comparisonId = generateComparisonId(revAId, revBId);
  const comparisonSnapshot = {
    comparisonId,
    revisionA: {
      reviewId: revAId,
      name: reviewA.name || 'Revision A',
      artworkHash: artworkAHash,
      documentsCount: reviewA.documents?.length || 0,
      findingsCount: reviewA.findings?.length || 0,
    },
    revisionB: {
      reviewId: revBId,
      name: reviewB.name || 'Revision B',
      artworkHash: artworkBHash,
      documentsCount: reviewB.documents?.length || 0,
      findingsCount: reviewB.findings?.length || 0,
    },
    sourceBasis: basis.mode,
    basisEvaluation: basis,
    packageType: reviewB.options?.packageType || reviewA.options?.packageType || 'carton',
    geometryCompatibility,
    pageMappings,
    changes,
    packagingSectionDiffs,
    summary: {
      totalChanges: changes.length,
      verifiedFixes,
      regressions,
      newIssues,
      neutralChanges,
      unverifiedChanges,
      unchangedCount,
    },
    createdAt: new Date().toISOString(),
    analysisVersion: '2.5.0',
  };

  saveComparison(comparisonSnapshot);
  return comparisonSnapshot;
}
