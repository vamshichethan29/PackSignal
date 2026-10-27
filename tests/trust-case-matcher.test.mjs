import test from 'node:test';
import assert from 'node:assert/strict';
import { matchCaseOutcome } from '../lib/evaluation/case-matcher.mjs';

test('Case Matcher correctly detects a planted defect with valid evidence', () => {
  const evalCase = {
    caseId: 'tc-match-01',
    expectedOutcome: 'issue',
    expectedField: 'net_quantity',
    expectedRuleId: 'rules:EVAL-QTY',
  };

  const reviewResult = {
    findings: [{
      field: 'net_quantity',
      status: 'issue',
      observed: '14 FL OZ',
      explanation: 'Net quantity mismatch',
    }],
  };

  const matched = matchCaseOutcome(evalCase, reviewResult);
  assert.equal(matched.classification, 'CORRECT_DETECTION');
  assert.equal(matched.matched, true);
});

test('Case Matcher does NOT credit a finding on an unrelated field as caught', () => {
  const evalCase = {
    caseId: 'tc-match-02',
    expectedOutcome: 'issue',
    expectedField: 'net_quantity',
    expectedRuleId: 'rules:EVAL-QTY',
  };

  const reviewResult = {
    findings: [{
      field: 'storage_statement', // Wrong field!
      status: 'issue',
      observed: 'Ambient storage',
      explanation: 'Storage error',
    }],
  };

  const matched = matchCaseOutcome(evalCase, reviewResult);
  assert.equal(matched.classification, 'WRONG_ERROR_TYPE');
  assert.equal(matched.matched, false);
});

test('Case Matcher correctly identifies clean control match and false positive', () => {
  const cleanCase = {
    caseId: 'tc-clean-01',
    expectedOutcome: 'match',
    expectedField: 'storage_statement',
  };

  // Scenario A: Clean match
  const cleanResult = {
    findings: [{ field: 'storage_statement', status: 'match', observed: 'Refrigerate after opening.' }],
  };
  const matchedClean = matchCaseOutcome(cleanCase, cleanResult);
  assert.equal(matchedClean.classification, 'TRUE_NEGATIVE');
  assert.equal(matchedClean.matched, true);

  // Scenario B: False alarm
  const falseAlarmResult = {
    findings: [{ field: 'storage_statement', status: 'issue', observed: 'Refrigerate', explanation: 'False alarm' }],
  };
  const matchedFP = matchCaseOutcome(cleanCase, falseAlarmResult);
  assert.equal(matchedFP.classification, 'FALSE_POSITIVE');
  assert.equal(matchedFP.matched, false);
});

test('Case Matcher correctly handles ambiguous abstention routing', () => {
  const ambCase = {
    caseId: 'tc-amb-01',
    expectedOutcome: 'review',
    expectedField: 'storage_statement',
  };

  const reviewRes = {
    findings: [{ field: 'storage_statement', status: 'review', observed: 'Draft conflict' }],
  };
  const res = matchCaseOutcome(ambCase, reviewRes);
  assert.equal(res.classification, 'CORRECT_ABSTENTION');
  assert.equal(res.matched, true);
});
