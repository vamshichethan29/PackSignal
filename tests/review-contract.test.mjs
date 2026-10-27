/**
 * PackSignal Canonical Contract Validation Test Suite (tests/review-contract.test.mjs)
 * Step 2: Quality Gate 0 — Validates all 10 contract invariants before parallel track execution.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createFinding,
  createEvidence,
  createRulebookRule,
  createClearedCheck,
  createReviewDecision,
  canonicalSourceRole,
  FINDING_STATUSES,
  RULE_APPROVAL_STATUSES,
  DECISION_TYPES,
  SOURCE_ROLES,
} from '../lib/contracts/review-contract.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('Contract Test 1: Existing reviews load and deserialize correctly into canonical shape', async () => {
  const fixturePath = resolve(__dirname, 'fixtures/frontend-contract-fixture.json');
  const raw = await readFile(fixturePath, 'utf8');
  const parsed = JSON.parse(raw);

  assert.equal(parsed.reviewId, 'review-fixture-001');
  assert.equal(parsed.findings.length, 10);
  assert.equal(parsed.rules.length, 2);
  assert.equal(parsed.cleared.length, 2);
  assert.equal(parsed.decisions.length, 1);
});

test('Contract Test 2: Existing findings remain compatible with new contract schema', () => {
  const legacyFinding = {
    id: 'legacy-fnd-01',
    key: 'ingredients-order',
    status: 'issue',
    title: 'Ingredients mismatch',
    explanation: 'Sugar position changed',
    observed: 'Sugar, Oats',
    expected: 'Oats, Sugar',
  };

  const canonical = createFinding(legacyFinding);
  assert.equal(canonical.findingId, 'legacy-fnd-01');
  assert.equal(canonical.checkId, 'ingredients-order');
  assert.equal(canonical.findingStatus, FINDING_STATUSES.ISSUE);
  assert.equal(canonical.whyItMatters, 'Sugar position changed');
});

test('Contract Test 3: New fields have safe deterministic defaults without failing', () => {
  const minimalFinding = createFinding({
    findingId: 'fnd-minimal',
    checkId: 'check-min',
    status: 'match'
  });

  assert.equal(minimalFinding.kind, 'general');
  assert.equal(minimalFinding.findingStatus, FINDING_STATUSES.MATCH);
  assert.equal(minimalFinding.reviewRevision, 1);
  assert.ok(Array.isArray(minimalFinding.sourceEvidenceIds));
  assert.ok(Array.isArray(minimalFinding.artworkEvidenceIds));
  assert.ok(minimalFinding.limitations.includes('Does not certify print production'));
});

test('Contract Test 4: Missing evidence coordinates are never fabricated', () => {
  const evidence = createEvidence({
    evidenceId: 'evi-unlocated',
    documentId: 'doc-spec',
    documentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    quote: 'Unlocated statement',
  });

  assert.equal(evidence.page, null);
  assert.equal(evidence.panel, null);
  assert.equal(evidence.boundingBox, null);
  assert.equal(evidence.sheet, null);
  assert.equal(evidence.cell, null);
});

test('Contract Test 5: Finding statuses are strictly constrained to issue, review, match, or unable', () => {
  const fIssue = createFinding({ findingId: '1', checkId: 'c', status: 'issue' });
  const fReview = createFinding({ findingId: '2', checkId: 'c', status: 'review' });
  const fMatch = createFinding({ findingId: '3', checkId: 'c', status: 'match' });
  const fUnable = createFinding({ findingId: '4', checkId: 'c', status: 'unable' });
  const fGarbage = createFinding({ findingId: '5', checkId: 'c', status: 'unknown_garbage' });

  assert.equal(fIssue.findingStatus, 'issue');
  assert.equal(fReview.findingStatus, 'review');
  assert.equal(fMatch.findingStatus, 'match');
  assert.equal(fUnable.findingStatus, 'unable');
  assert.equal(fGarbage.findingStatus, 'unable', 'Unrecognized status safely defaults to unable');
});

test('Contract Test 6: Reviewer decisions do not overwrite deterministic engine outcomes', () => {
  const finding = createFinding({
    findingId: 'fnd-001',
    checkId: 'nutrition-math',
    status: 'issue',
    observed: '10 kcal',
    expected: '40 kcal',
  });

  const decision = createReviewDecision({
    findingId: finding.findingId,
    actorId: 'lead-designer@packsignal.local',
    decision: DECISION_TYPES.NOT_A_PROBLEM,
    note: 'Marked acceptable for marketing prototype.',
  });

  // Engine outcome remains unchanged
  assert.equal(finding.findingStatus, 'issue');
  assert.equal(decision.decision, 'NOT_A_PROBLEM');
  assert.notEqual(finding.findingStatus, decision.decision);
});

test('Contract Test 7: Proposed rules are not automatically marked as approved or executed', () => {
  const rule = createRulebookRule({
    ruleId: 'RULE-PROPOSED-1',
    originalQuote: 'Optional marketing claim',
    approvalStatus: 'PROPOSED',
  });

  assert.equal(rule.approvalStatus, RULE_APPROVAL_STATUSES.PROPOSED);
  assert.notEqual(rule.approvalStatus, RULE_APPROVAL_STATUSES.APPROVED);
  assert.equal(rule.executionStatus, 'PENDING');
});

test('Contract Test 8: Cleared checks require valid proof and reference real check IDs', () => {
  const cleared = createClearedCheck({
    clearedId: 'clr-001',
    checkId: 'net-quantity-dual-unit',
    proof: 'Calculated 480 g equals 16.9 oz avoirdupois within allowable commercial tolerance.',
  });

  assert.equal(cleared.checkId, 'net-quantity-dual-unit');
  assert.ok(cleared.proof.includes('480 g equals 16.9 oz'));

  assert.throws(() => {
    createClearedCheck({ clearedId: 'clr-invalid', checkId: 'c', proof: '' });
  }, /proof is required for cleared check/);
});

test('Contract Test 9: Evidence locations remain structurally sound', () => {
  const evidence = createEvidence({
    evidenceId: 'evi-box',
    documentId: 'doc-carton',
    documentHash: 'c633ab2f9d227c14aee4f9065cee980cf2efe1a602db963b1cf5e474fec929be',
    page: 1,
    panel: 'Back Panel',
    boundingBox: [0.1, 0.2, 0.5, 0.6],
    quote: 'Ingredients: Whole grain oats',
    quoteVerified: true,
  });

  assert.equal(evidence.page, 1);
  assert.equal(evidence.panel, 'Back Panel');
  assert.deepEqual(evidence.boundingBox, [0.1, 0.2, 0.5, 0.6]);
  assert.equal(evidence.quoteVerified, true);
});

test('Contract Test 10: Canonical source roles map cleanly without breaking existing keys', () => {
  assert.equal(canonicalSourceRole('ARTWORK'), SOURCE_ROLES.ARTWORK);
  assert.equal(canonicalSourceRole('PRODUCT_SPECIFICATION'), SOURCE_ROLES.PRODUCT_SPECIFICATION);
  assert.equal(canonicalSourceRole('RULEBOOK'), SOURCE_ROLES.RULEBOOK);
  assert.equal(canonicalSourceRole('SUPPORTING_DOCUMENT'), SOURCE_ROLES.SUPPORTING_DOCUMENT);
  assert.equal(canonicalSourceRole('reference'), 'reference');
  assert.equal(canonicalSourceRole('rules'), 'rules');
  assert.equal(canonicalSourceRole('unrecognized_role'), 'other');
});
