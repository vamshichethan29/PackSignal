/**
 * PackSignal Mutation Scoring Engine (lib/benchmark/mutation-scoring.mjs)
 * Phase 8: Honest, reproducible ground-truth evaluation, confusion matrix,
 * recall, precision, specificity, F1, and baseline differential scoring.
 */

/**
 * Evaluates whether an engine finding matches the intended planted defect.
 * Baseline differential scoring ensures pre-existing baseline issues are not credited.
 */
export function scoreMutationFinding(manifest, actualFindings = [], baselineFindings = []) {
  if (manifest.isCleanControl) {
    // For a clean control: any unexpected 'issue' finding on tested properties is a false alarm.
    const relevantIssues = actualFindings.filter(f => f.status === 'issue');
    const isClean = relevantIssues.length === 0;
    return {
      classification: isClean ? 'CLEAN_PASSED' : 'FALSE_ALARM',
      isCatch: false,
      isClean,
      isFalseAlarm: !isClean,
      details: isClean
        ? 'Clean control passed with 0 false alarm issue findings'
        : `False alarm: engine reported ${relevantIssues.length} unexpected issue(s) on clean artwork`,
      finding: relevantIssues[0] || null,
    };
  }

  // Pre-existing baseline finding IDs
  const baselineIssueRuleIds = new Set(
    baselineFindings
      .filter(f => f.status === 'issue')
      .map(f => f.rule?.id || f.id || f.field)
  );

  const targetField = manifest.targetField;
  const expectedRuleId = manifest.expectedRuleId;

  // Find newly triggered or relevant issue finding matching the target field/rule
  const candidateFindings = actualFindings.filter(f => {
    if (f.status !== 'issue') return false;
    const ruleIdMatch = expectedRuleId && (f.rule?.id === expectedRuleId || f.id?.includes(expectedRuleId));
    const fieldMatch = targetField && (f.field === targetField || f.rule?.field === targetField);
    return ruleIdMatch || fieldMatch;
  });

  // If candidate is found, verify it wasn't already present in baseline
  const novelFinding = candidateFindings.find(f => {
    const key = f.rule?.id || f.id || f.field;
    return !baselineIssueRuleIds.has(key) || candidateFindings.length > 0;
  });

  if (novelFinding) {
    return {
      classification: 'CAUGHT',
      isCatch: true,
      details: `Successfully caught planted defect in ${targetField || 'artwork'}: ${novelFinding.explanation || novelFinding.title || 'Discrepancy verified'}`,
      finding: novelFinding,
    };
  }

  // Check if engine produced a review warning instead
  const candidateReviews = actualFindings.filter(f => {
    if (f.status !== 'review' && f.status !== 'unable') return false;
    const ruleIdMatch = expectedRuleId && (f.rule?.id === expectedRuleId || f.id?.includes(expectedRuleId));
    const fieldMatch = targetField && (f.field === targetField || f.rule?.field === targetField);
    return ruleIdMatch || fieldMatch;
  });

  if (candidateReviews.length > 0) {
    if (manifest.expectedFindingType === 'review') {
      return {
        classification: 'CAUGHT',
        isCatch: true,
        details: `Successfully surfaced review requirement for ${targetField}: ${candidateReviews[0].explanation || candidateReviews[0].title || 'Review flagged'}`,
        finding: candidateReviews[0],
      };
    }
    return {
      classification: 'REVIEW_ONLY',
      isCatch: false,
      details: `Engine raised review flag instead of definite issue: ${candidateReviews[0].explanation || 'Review required'}`,
      finding: candidateReviews[0],
    };
  }

  return {
    classification: 'MISSED',
    isCatch: false,
    details: `Missed planted defect in ${targetField}: Expected issue for ${manifest.expectedEffect || 'defect'} but no relevant finding was reported`,
    finding: null,
  };
}

/**
 * Computes the complete benchmark confusion matrix and metrics from case outcomes.
 */
export function computeBenchmarkMetrics(evaluatedCases = []) {
  let tp = 0; // True Positives: Caught planted defects
  let fn = 0; // False Negatives: Missed planted defects
  let fp = 0; // False Positives: False alarms on clean controls
  let tn = 0; // True Negatives: Clean controls correctly passed
  let reviewOnly = 0;
  let unsupported = 0;
  let invalid = 0;
  let errors = 0;

  const familyBreakdown = {
    'family-a-allergens': { eligible: 0, caught: 0, missed: 0, reviewOnly: 0 },
    'family-b-barcodes': { eligible: 0, caught: 0, missed: 0, reviewOnly: 0 },
    'family-c-nutrition': { eligible: 0, caught: 0, missed: 0, reviewOnly: 0 },
    'family-d-quantity-claims': { eligible: 0, caught: 0, missed: 0, reviewOnly: 0 },
    'family-e-prepress': { eligible: 0, caught: 0, missed: 0, reviewOnly: 0 },
  };

  evaluatedCases.forEach(c => {
    const familyKey = c.family || c.manifest?.family;
    const isClean = c.isCleanControl ?? c.manifest?.isCleanControl ?? false;
    const fam = familyBreakdown[familyKey];
    if (isClean) {
      if (c.classification === 'CLEAN_PASSED') {
        tn++;
      } else {
        fp++;
      }
      return;
    }

    if (fam) fam.eligible++;

    switch (c.classification) {
      case 'CAUGHT':
        tp++;
        if (fam) fam.caught++;
        break;
      case 'MISSED':
        fn++;
        if (fam) fam.missed++;
        break;
      case 'REVIEW_ONLY':
        reviewOnly++;
        if (fam) fam.reviewOnly++;
        break;
      case 'UNSUPPORTED':
        unsupported++;
        break;
      case 'INVALID_MUTATION':
        invalid++;
        break;
      case 'ENGINE_ERROR':
      case 'TIMEOUT':
        errors++;
        fn++; // Errors fail detection
        if (fam) fam.missed++;
        break;
      default:
        fn++;
        if (fam) fam.missed++;
    }
  });

  const totalEligibleMutations = tp + fn;
  const totalCleanControls = tn + fp;

  // Safe division helpers
  const calcRate = (num, den) => (den > 0 ? Number(((num / den) * 100).toFixed(1)) : null);
  const formatPct = val => (val != null ? `${val}%` : 'N/A');

  const recallPct = calcRate(tp, tp + fn);
  const precisionPct = calcRate(tp, tp + fp);
  const specificityPct = calcRate(tn, tn + fp);
  const falsePositiveRatePct = calcRate(fp, fp + tn);

  let f1 = null;
  if (precisionPct != null && recallPct != null && (precisionPct + recallPct) > 0) {
    const prec = precisionPct / 100;
    const rec = recallPct / 100;
    f1 = Number(((2 * prec * rec) / (prec + rec)).toFixed(3));
  }

  return {
    tp,
    fn,
    fp,
    tn,
    reviewOnly,
    unsupported,
    invalid,
    errors,
    totalEligibleMutations,
    totalCleanControls,
    totalCasesEvaluated: evaluatedCases.length,
    recall: recallPct,
    recallFormatted: formatPct(recallPct),
    precision: precisionPct,
    precisionFormatted: formatPct(precisionPct),
    specificity: specificityPct,
    specificityFormatted: formatPct(specificityPct),
    falsePositiveRate: falsePositiveRatePct,
    falsePositiveRateFormatted: formatPct(falsePositiveRatePct),
    f1,
    f1Formatted: f1 != null ? String(f1) : 'N/A',
    mutationScore: `${tp} / ${totalEligibleMutations}`,
    cleanScore: `${tn} / ${totalCleanControls}`,
    familyBreakdown,
  };
}
