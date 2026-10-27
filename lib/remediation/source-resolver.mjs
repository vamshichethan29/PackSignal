/**
 * PackSignal Remediation Source Resolver (lib/remediation/source-resolver.mjs)
 * Resolves authoritative source facts, detects conflicts, and extracts evidence.
 */

export function resolveSourceEvidence(finding, review = {}, options = {}) {
  const documents = review.documents || [];
  const findings = review.findings || [];
  const optionsState = review.options || {};

  // Check 1: Detect explicit unresolved source conflict on this finding
  const isConflicted = findings.some(f =>
    (f.key?.startsWith('conflict:') || f.id?.includes('conflict')) &&
    (f.field === finding.field || (finding.field && f.key?.includes(finding.field)))
  ) || /conflicting sources|source conflict/i.test(finding.title || '') ||
     /conflicting sources|source conflict/i.test(finding.explanation || '');

  if (isConflicted) {
    return {
      hasConflict: true,
      isAuthoritative: false,
      blockerReason: 'Conflicting source specifications detected. Select the authoritative source before generating automated copy.',
      requiredEvidence: ['Single confirmed authoritative reference specification.'],
      sourceDocument: null,
      sourceEvidence: [],
      ruleEvidence: [],
    };
  }

  // Check 2: Check for draft or unconfirmed source status
  const draftSources = documents.filter(d =>
    /draft\s*(?:\/|or)?\s*(?:in\s*review)?|unconfirmed/i.test(d.data?.status || d.text || '')
  );
  if (draftSources.length > 0 && !optionsState.sourceConfirmed) {
    return {
      hasConflict: false,
      isAuthoritative: false,
      isDraft: true,
      blockerReason: 'Supplied source specification is marked DRAFT or UNCONFIRMED. Confirm source authority before relying on values.',
      requiredEvidence: ['Approved product specification signed off by regulatory QA.'],
      sourceDocument: draftSources[0],
      sourceEvidence: [],
      ruleEvidence: [],
    };
  }

  // Find most authoritative source document
  const specDoc = documents.find(d => d.role === 'spec') ||
                  documents.find(d => d.role === 'rules') ||
                  documents.find(d => d.role === 'claims') ||
                  documents.find(d => d.role === 'register') ||
                  documents[0] || null;

  // Extract source evidence items
  const sourceEvidence = [];
  if (finding.evidence && Array.isArray(finding.evidence)) {
    for (const ev of finding.evidence) {
      if (ev.role && ev.role !== 'artwork') {
        sourceEvidence.push(ev);
      }
    }
  }

  if (sourceEvidence.length === 0 && specDoc) {
    sourceEvidence.push({
      documentId: specDoc.id,
      name: specDoc.name,
      role: specDoc.role,
      quote: finding.expected || 'Approved specification reference',
      location: specDoc.name,
    });
  }

  // Extract rule evidence
  const ruleEvidence = [];
  if (finding.rule) {
    ruleEvidence.push(finding.rule);
  }

  return {
    hasConflict: false,
    isAuthoritative: true,
    isDraft: false,
    sourceDocument: specDoc,
    sourceEvidence,
    ruleEvidence,
    expectedValue: finding.expected || null,
    observedValue: finding.observed || null,
  };
}
