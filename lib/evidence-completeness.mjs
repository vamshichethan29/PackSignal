/**
 * PackSignal Evidence Completeness Engine
 * (lib/evidence-completeness.mjs)
 *
 * Implements Step 2, 3, 4, 5 of Phase 6:
 * Confidence-free, evidence-contract-based completeness assessment.
 * Shows exactly what PackSignal could verify against available evidence,
 * without AI confidence percentages, legal compliance scores, or print guarantees.
 */

export const EVIDENCE_CATEGORIES = {
  MACHINE_CHECK_COMPLETED: 'MACHINE_CHECK_COMPLETED',
  HUMAN_VERIFICATION_REQUIRED: 'HUMAN_VERIFICATION_REQUIRED',
  SOURCE_MISSING: 'SOURCE_MISSING',
  ARTWORK_UNREADABLE: 'ARTWORK_UNREADABLE',
  RULE_UNSUPPORTED: 'RULE_UNSUPPORTED',
  RULE_NOT_APPLICABLE: 'RULE_NOT_APPLICABLE'
};

export const IMPLEMENTATION_SUPPORT = {
  SUPPORTED: 'SUPPORTED',
  UNSUPPORTED: 'UNSUPPORTED'
};

export const APPLICABILITY_STATES = {
  APPLICABLE: 'APPLICABLE',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  UNDETERMINED: 'UNDETERMINED'
};

/**
 * Builds an explicit evidence contract for a check/finding.
 */
export function buildCheckEvidenceContract({
  checkId,
  ruleId = null,
  title = '',
  field = null,
  rule = null,
  finding = null,
  sourceDoc = null,
  artworkDoc = null,
  reviewOptions = {},
  isApplicable = true,
  isSupported = true,
  blockers = []
}) {
  const status = finding?.status || 'review';
  const hasSourceDoc = Boolean(sourceDoc || rule?.source?.documentId || (finding?.evidence || []).some(e => e.role === 'spec' || e.role === 'rules'));
  const hasArtworkDoc = Boolean(artworkDoc || (finding?.evidence || []).some(e => e.role === 'artwork'));

  const isImageArtwork = Boolean(
    artworkDoc?.pages?.some(p => ['ai_transcription', 'ocr_transcription', 'vision_needed'].includes(p.method) || p.unit === 'px')
  );

  const isCompleteCoverage = Boolean(reviewOptions.completeArtwork) && !isImageArtwork;
  const isSourceConfirmed = Boolean(reviewOptions.sourceConfirmed) || (sourceDoc && !/draft|unconfirmed/i.test(sourceDoc.data?.status || ''));

  // Determine specific evidence states
  const sourceEvidenceAvailable = hasSourceDoc && Boolean(finding?.expected || rule?.text);
  const artworkEvidenceAvailable = hasArtworkDoc && Boolean(finding?.observed && !finding.observed.includes('Not detected'));
  const sourceAuthorityEstablished = isSourceConfirmed;
  const artworkCoverageEstablished = isCompleteCoverage;

  const actualBlockers = [...blockers];

  if (!hasSourceDoc) actualBlockers.push('SOURCE_DOCUMENT_MISSING');
  if (!isSourceConfirmed) actualBlockers.push('SOURCE_AUTHORITY_UNCONFIRMED');
  if (isImageArtwork) actualBlockers.push('IMAGE_TRANSCRIPTION_UNVERIFIED');
  if (status === 'unable' && !hasSourceDoc) actualBlockers.push('MISSING_REFERENCE_VALUE');

  // Derive primary mutually exclusive category
  let primaryCategory;
  let humanVerificationRequired = false;

  if (!isApplicable) {
    primaryCategory = EVIDENCE_CATEGORIES.RULE_NOT_APPLICABLE;
  } else if (!isSupported || rule?.comparison === 'uncompiled') {
    primaryCategory = EVIDENCE_CATEGORIES.RULE_UNSUPPORTED;
  } else if (!hasSourceDoc || actualBlockers.includes('SOURCE_DOCUMENT_MISSING') || (finding?.key === 'missing-reference')) {
    primaryCategory = EVIDENCE_CATEGORIES.SOURCE_MISSING;
  } else if (isImageArtwork && status === 'unable') {
    primaryCategory = EVIDENCE_CATEGORIES.ARTWORK_UNREADABLE;
  } else if (status === 'review' || !sourceAuthorityEstablished || !isCompleteCoverage) {
    primaryCategory = EVIDENCE_CATEGORIES.HUMAN_VERIFICATION_REQUIRED;
    humanVerificationRequired = true;
  } else if (status === 'match' || status === 'issue') {
    primaryCategory = EVIDENCE_CATEGORIES.MACHINE_CHECK_COMPLETED;
  } else {
    primaryCategory = EVIDENCE_CATEGORIES.HUMAN_VERIFICATION_REQUIRED;
    humanVerificationRequired = true;
  }

  return {
    checkId: checkId || finding?.id || ruleId || 'unidentified-check',
    checkVersion: '1.0.0',
    ruleId: ruleId || rule?.id || null,
    title: title || finding?.title || rule?.title || 'Inspection Check',
    field: field || finding?.field || rule?.field || null,
    applicability: isApplicable ? APPLICABILITY_STATES.APPLICABLE : APPLICABILITY_STATES.NOT_APPLICABLE,
    implementationSupport: isSupported ? IMPLEMENTATION_SUPPORT.SUPPORTED : IMPLEMENTATION_SUPPORT.UNSUPPORTED,
    executionState: finding ? 'COMPLETED' : 'PENDING',
    sourceEvidenceRequired: true,
    artworkEvidenceRequired: true,
    sourceEvidenceAvailable,
    artworkEvidenceAvailable,
    sourceAuthorityEstablished,
    artworkCoverageEstablished,
    humanVerificationRequired,
    findingStatus: status,
    blockers: actualBlockers,
    primaryCategory
  };
}

/**
 * Computes evidence completeness across all review tasks and findings.
 */
export function computeEvidenceCompleteness(review = {}, findings = [], tasks = []) {
  const docs = review.documents || [];
  const artworkDoc = docs.find(d => d.role === 'artwork');
  const sourceDocs = docs.filter(d => ['spec', 'rules', 'claims'].includes(d.role));
  const options = review.options || {};

  const contracts = [];
  const processedFindingIds = new Set();

  // 1. Process explicit findings
  for (const finding of findings) {
    if (!finding) continue;
    processedFindingIds.add(finding.id);

    const rule = finding.rule || null;
    const ruleId = rule?.id || finding.key;
    const sDoc = sourceDocs.find(d => d.id === rule?.source?.documentId) || (sourceDocs.length === 1 ? sourceDocs[0] : null);

    const isSupported = finding.method !== 'unsupported_rule' && rule?.comparison !== 'uncompiled';
    const isApplicable = rule?.applicable !== false;

    const contract = buildCheckEvidenceContract({
      checkId: finding.id,
      ruleId,
      title: finding.title,
      field: finding.field,
      rule,
      finding,
      sourceDoc: sDoc,
      artworkDoc,
      reviewOptions: options,
      isApplicable,
      isSupported
    });

    contracts.push(contract);
  }

  // 2. Process tasks that didn't produce an explicit finding
  for (const task of tasks) {
    const taskFinding = findings.find(f => f.rule?.id === task.id || f.key === `rule:${task.id}`);
    if (taskFinding) continue; // already processed

    const isSupported = !['uncompiled'].includes(task.comparison);
    const isApplicable = task.applicable !== false;
    const sDoc = sourceDocs.find(d => d.id === task.source?.documentId);

    const contract = buildCheckEvidenceContract({
      checkId: `task:${task.id}`,
      ruleId: task.id,
      title: task.title || task.field,
      field: task.field,
      rule: task,
      finding: null,
      sourceDoc: sDoc,
      artworkDoc,
      reviewOptions: options,
      isApplicable,
      isSupported
    });

    contracts.push(contract);
  }

  // Group by category
  const groups = {
    [EVIDENCE_CATEGORIES.MACHINE_CHECK_COMPLETED]: [],
    [EVIDENCE_CATEGORIES.HUMAN_VERIFICATION_REQUIRED]: [],
    [EVIDENCE_CATEGORIES.SOURCE_MISSING]: [],
    [EVIDENCE_CATEGORIES.ARTWORK_UNREADABLE]: [],
    [EVIDENCE_CATEGORIES.RULE_UNSUPPORTED]: [],
    [EVIDENCE_CATEGORIES.RULE_NOT_APPLICABLE]: []
  };

  for (const c of contracts) {
    if (groups[c.primaryCategory]) {
      groups[c.primaryCategory].push(c);
    }
  }

  // Eligible checks: supported, applicable checks
  // (Excludes independently established NOT_APPLICABLE rules)
  const eligibleChecks = contracts.filter(c =>
    c.applicability === APPLICABILITY_STATES.APPLICABLE &&
    c.implementationSupport === IMPLEMENTATION_SUPPORT.SUPPORTED
  );

  const denominator = eligibleChecks.length;
  // Numerator: eligible checks completed with sufficient evidence
  const numerator = groups[EVIDENCE_CATEGORIES.MACHINE_CHECK_COMPLETED].filter(c =>
    c.applicability === APPLICABILITY_STATES.APPLICABLE &&
    c.implementationSupport === IMPLEMENTATION_SUPPORT.SUPPORTED
  ).length;

  const percentage = denominator > 0 ? Math.round((numerator / denominator) * 100) : null;
  const ratio = denominator > 0 ? `${numerator} / ${denominator}` : 'N/A';
  const display = denominator > 0
    ? `${numerator} / ${denominator} supported applicable checks evidence-complete`
    : 'N/A';

  return {
    schemaVersion: 'packsignal-evidence-completeness/v1',
    ratio,
    numerator,
    denominator,
    percentage,
    display,
    eligibleChecksCount: denominator,
    totalInspectedChecks: contracts.length,
    counts: {
      machineCheckCompleted: groups[EVIDENCE_CATEGORIES.MACHINE_CHECK_COMPLETED].length,
      humanVerificationRequired: groups[EVIDENCE_CATEGORIES.HUMAN_VERIFICATION_REQUIRED].length,
      sourceMissing: groups[EVIDENCE_CATEGORIES.SOURCE_MISSING].length,
      artworkUnreadable: groups[EVIDENCE_CATEGORIES.ARTWORK_UNREADABLE].length,
      ruleUnsupported: groups[EVIDENCE_CATEGORIES.RULE_UNSUPPORTED].length,
      ruleNotApplicable: groups[EVIDENCE_CATEGORIES.RULE_NOT_APPLICABLE].length
    },
    categories: groups,
    contracts,
    limitations: [
      'Evidence completeness measures the availability and execution of supported checks with verified evidence.',
      'It is NOT an overall safety score, legal compliance percentage, or production print certification.',
      'Absence of defects cannot be established for image-only artwork without verified text transcription.'
    ]
  };
}
