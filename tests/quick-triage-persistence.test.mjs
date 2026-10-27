import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendAuditEvent } from '../lib/audit-chain.mjs';

const hashValue = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const findingDependencyFingerprint = (r, finding) => hashValue({ id: finding.id, quote: finding.evidence?.[0]?.quote, status: finding.status });
const audit = (r, action, detail, actor = null) => appendAuditEvent(r, { action, safeDetails: detail }, actor, true);

test('Quick Triage Persistence: Records acknowledged, needs_changes, and needs_evidence dispositions with audit trail', () => {
  const finding = {
    id: 'f-net-wt',
    title: 'Net quantity check',
    status: 'issue',
    evidence: [{ documentId: 'art-1', role: 'artwork', name: 'front.pdf', location: 'Page 1', quote: '750g' }]
  };

  const review = {
    id: 'rev-triage-persist',
    findings: [finding],
    decisions: {},
    audit: [],
    options: {}
  };

  const actor = { id: 'rev-lead', displayName: 'Lead Reviewer', role: 'reviewer' };

  // 1. Action 1: Acknowledge
  const ackDisposition = 'acknowledged';
  const ackNote = 'Acknowledged finding during triage.';
  const hash = findingDependencyFingerprint(review, finding);

  review.decisions[finding.id] = {
    disposition: ackDisposition,
    note: ackNote,
    at: new Date().toISOString(),
    decidedBy: actor.id,
    reviewerName: actor.displayName,
    dependencyHash: hash,
    requestedEvidenceType: null
  };
  audit(review, 'reviewer_decision', `${finding.id}: ${ackDisposition} — ${ackNote}`, actor);

  assert.equal(review.decisions['f-net-wt'].disposition, 'acknowledged');
  assert.equal(review.audit.length, 1);
  assert.equal(review.audit[0].action, 'reviewer_decision');
  assert.match(review.audit[0].detail, /f-net-wt: acknowledged/);

  // Original engine verdict is preserved!
  assert.equal(finding.status, 'issue');

  // 2. Action 2: Flag for Remedy (needs_changes)
  const remedyDisposition = 'needs_changes';
  const remedyNote = 'Change weight font size to meet 3.2mm FDA minimum PDP requirement.';
  review.decisions[finding.id] = {
    disposition: remedyDisposition,
    note: remedyNote,
    at: new Date().toISOString(),
    decidedBy: actor.id,
    reviewerName: actor.displayName,
    dependencyHash: hash,
    requestedEvidenceType: null
  };
  audit(review, 'reviewer_decision', `${finding.id}: ${remedyDisposition} — ${remedyNote}`, actor);

  assert.equal(review.decisions['f-net-wt'].disposition, 'needs_changes');
  assert.equal(review.audit.length, 2);
  assert.match(review.audit[1].detail, /f-net-wt: needs_changes/);

  // 3. Action 3: Needs Evidence (needs_evidence)
  const evidenceDisposition = 'needs_evidence';
  const evidenceNote = 'Please provide the laboratory certificate of analysis for sodium content.';
  const requestedEvidenceType = 'Nutritional Analysis / Lab Certificate';

  review.decisions[finding.id] = {
    disposition: evidenceDisposition,
    note: evidenceNote,
    at: new Date().toISOString(),
    decidedBy: actor.id,
    reviewerName: actor.displayName,
    dependencyHash: hash,
    requestedEvidenceType
  };
  audit(review, 'reviewer_decision', `${finding.id}: ${evidenceDisposition} — ${evidenceNote} [evidence requested: ${requestedEvidenceType}]`, actor);

  assert.equal(review.decisions['f-net-wt'].disposition, 'needs_evidence');
  assert.equal(review.decisions['f-net-wt'].requestedEvidenceType, 'Nutritional Analysis / Lab Certificate');
  assert.equal(review.audit.length, 3);
  assert.match(review.audit[2].detail, /evidence requested: Nutritional Analysis/);
});

test('Quick Triage Persistence: Source dependency change marks prior decisions stale without deleting history', () => {
  const finding = {
    id: 'f-cal',
    title: 'Calories count',
    status: 'issue',
    evidence: [{ documentId: 'art-1', role: 'artwork', name: 'back.pdf', location: 'Page 1', quote: '150 kcal' }]
  };

  const review = {
    id: 'rev-stale-test',
    findings: [finding],
    decisions: {},
    audit: [],
    options: {}
  };

  const initialHash = findingDependencyFingerprint(review, finding);
  review.decisions[finding.id] = {
    disposition: 'acknowledged',
    note: 'Acknowledged based on v1 specification.',
    dependencyHash: initialHash,
    stale: false
  };

  // Modify source or finding evidence
  finding.evidence[0].quote = '210 kcal';
  const nextHash = findingDependencyFingerprint(review, finding);

  // Check staleness
  if (review.decisions[finding.id].dependencyHash !== nextHash) {
    review.decisions[finding.id].stale = true;
  }

  assert.equal(review.decisions['f-cal'].stale, true);
  // History preserved
  assert.equal(review.decisions['f-cal'].disposition, 'acknowledged');
  assert.equal(review.decisions['f-cal'].note, 'Acknowledged based on v1 specification.');
});
