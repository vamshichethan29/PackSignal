import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRuleDateStatus } from '../lib/rules/market-pack-loader.mjs';

describe('Phase 3 — Rule Effective Date & Launch Date Filter', () => {

  test('1. Rule is ACTIVE when launch date falls within effective window', () => {
    const res = evaluateRuleDateStatus('2026-10-16', '2020-01-01', null);
    assert.equal(res.status, 'ACTIVE');
    assert.ok(res.reason.includes('active'));
  });

  test('2. Future rule is NOT applied early (returns status FUTURE)', () => {
    const res = evaluateRuleDateStatus('2026-10-16', '2027-01-01', null);
    assert.equal(res.status, 'FUTURE');
    assert.ok(res.reason.includes('prior to effective date'));
  });

  test('3. Expired or superseded rule is flagged EXPIRED', () => {
    const res = evaluateRuleDateStatus('2026-10-16', '2016-01-01', '2020-01-01');
    assert.equal(res.status, 'EXPIRED');
    assert.ok(res.reason.includes('past expiration'));
  });

  test('4. Missing or invalid launch date returns APPLICABILITY_UNKNOWN', () => {
    const resNoDate = evaluateRuleDateStatus(null, '2020-01-01');
    assert.equal(resNoDate.status, 'APPLICABILITY_UNKNOWN');

    const resInvalid = evaluateRuleDateStatus('invalid-date', '2020-01-01');
    assert.equal(resInvalid.status, 'APPLICABILITY_UNKNOWN');
  });
});
