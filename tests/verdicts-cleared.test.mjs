import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFinding } from '../lib/checks/verdicts.mjs';
import { ClearedCheckLedger } from '../lib/checks/cleared.mjs';
import { evaluateTypedRule } from '../lib/checks/rulebook-apply.mjs';
import { FINDING_STATUSES, RULE_APPROVAL_STATUSES } from '../lib/contracts/review-contract.mjs';

test('Wave 1A: classifyFinding routes draft source discrepancies to REVIEW, not ISSUE', () => {
  const result = classifyFinding({
    checkId: 'check-honey',
    title: 'Honey mismatch',
    discrepancyDetected: true,
    sourceAuthority: 'draft',
    quoteVerified: true,
    evidenceComplete: true,
  });

  assert.equal(result.findingStatus, FINDING_STATUSES.REVIEW);
});

test('Wave 1A: classifyFinding produces ISSUE only when source is approved and discrepancy exists', () => {
  const result = classifyFinding({
    checkId: 'check-honey',
    title: 'Honey mismatch',
    discrepancyDetected: true,
    sourceAuthority: 'approved',
    quoteVerified: true,
    evidenceComplete: true,
  });

  assert.equal(result.findingStatus, FINDING_STATUSES.ISSUE);
});

test('Wave 1A: classifyFinding produces UNABLE when evidence is incomplete', () => {
  const result = classifyFinding({
    checkId: 'check-unreadable',
    title: 'Unreadable panel',
    evidenceComplete: false,
  });

  assert.equal(result.findingStatus, FINDING_STATUSES.UNABLE);
});

test('Wave 1A: ClearedCheckLedger records positive proof of MATCH check', () => {
  const ledger = new ClearedCheckLedger();
  const cleared = ledger.addClearedMatch({
    checkId: 'gtin-13-checksum',
    title: 'GTIN Check Digit Valid',
    proof: 'Modulo-10 check digit 5 verified.',
  });

  assert.equal(cleared.checkId, 'gtin-13-checksum');
  assert.ok(cleared.proof.includes('Modulo-10'));
  assert.equal(ledger.getAll().length, 1);
});

test('Wave 1A: evaluateTypedRule rejects execution of unapproved or proposed rule as failure', () => {
  const proposedRule = {
    ruleId: 'RULE-PROP-1',
    originalQuote: 'Keep Frozen',
    quoteVerification: 'verified',
    approvalStatus: RULE_APPROVAL_STATUSES.PROPOSED,
    checkType: 'REQUIRED_PHRASE',
  };

  const outcome = evaluateTypedRule({
    rule: proposedRule,
    artworkText: 'Refrigerate after opening',
  });

  assert.equal(outcome.executed, false);
  assert.equal(outcome.status, FINDING_STATUSES.REVIEW);
  assert.equal(outcome.finding, null);
});

test('Wave 1A: evaluateTypedRule executes approved REQUIRED_PHRASE rule with proof', () => {
  const approvedRule = {
    ruleId: '21 CFR §101.4',
    title: 'Designation of Ingredients',
    originalQuote: 'Ingredients:',
    quoteVerification: 'verified',
    approvalStatus: RULE_APPROVAL_STATUSES.APPROVED,
    checkType: 'REQUIRED_PHRASE',
    sourceDocumentId: 'doc-rules',
  };

  const outcome = evaluateTypedRule({
    rule: approvedRule,
    artworkText: 'Ingredients: Whole Grain Rolled Oats, Almonds.',
  });

  assert.equal(outcome.executed, true);
  assert.equal(outcome.status, FINDING_STATUSES.MATCH);
  assert.ok(outcome.proof.includes('detected in artwork text'));
});
