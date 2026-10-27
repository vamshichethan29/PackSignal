import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseCaseFailure, FAILURE_CATEGORIES } from '../lib/evaluation/failure-analysis.mjs';

test('diagnoseCaseFailure categorizes unit normalization failure on missed quantity defect', () => {
  const evalCase = {
    caseId: 'tc-qty-fail',
    category: 'quantity',
    expectedOutcome: 'issue',
    expectedField: 'net_quantity',
    reference: '16 FL OZ (473 mL)',
  };
  const matchedResult = {
    classification: 'MISSED_DEFECT',
    matched: false,
    finding: { status: 'match', observed: '14 FL OZ' },
  };

  const diag = diagnoseCaseFailure(evalCase, matchedResult);
  assert.equal(diag.failureCategory, FAILURE_CATEGORIES.UNIT_NORMALIZATION_FAILURE);
  assert.ok(diag.diagnosticExplanation.includes('unit math'));
});

test('diagnoseCaseFailure categorizes quote validation failure on false alarms', () => {
  const evalCase = {
    caseId: 'tc-clean-fa',
    category: 'storage',
    expectedOutcome: 'match',
    expectedField: 'storage_statement',
    reference: 'Keep frozen',
  };
  const matchedResult = {
    classification: 'FALSE_POSITIVE',
    matched: false,
    finding: { status: 'issue', observed: 'Store frozen' },
  };

  const diag = diagnoseCaseFailure(evalCase, matchedResult);
  assert.equal(diag.failureCategory, FAILURE_CATEGORIES.QUOTE_VALIDATION_FAILURE);
  assert.ok(diag.diagnosticExplanation.includes('Clean packaging was incorrectly flagged'));
});

test('diagnoseCaseFailure identifies unknown cause honestly when no clear logs exist', () => {
  const evalCase = {
    caseId: 'tc-unknown',
    category: 'general',
    expectedOutcome: 'other',
  };
  const matchedResult = {
    classification: 'WRONG_ERROR_TYPE',
    matched: false,
  };

  const diag = diagnoseCaseFailure(evalCase, matchedResult);
  assert.equal(diag.failureCategory, FAILURE_CATEGORIES.UNKNOWN_CAUSE);
  assert.equal(diag.diagnosticExplanation, 'ROOT CAUSE NOT YET DETERMINED.');
});
