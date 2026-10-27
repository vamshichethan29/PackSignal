/**
 * @file regulatory-snapshots.test.mjs
 * 
 * PackSignal — Regulatory Snapshot & Audit Integrity Tests
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegulatorySnapshot, hashRuleRecord, REGULATORY_KNOWLEDGE_DATE } from '../lib/regulatory/regulatory-snapshot.mjs';

test('1. Creates immutable snapshot with knowledge date and SHA-256 fingerprint', () => {
  const sampleRules = [
    { id: 'RULE-1', effectiveDate: '2026-01-01', citation: '21 CFR 101.3' },
    { id: 'RULE-2', effectiveDate: '2027-07-01', citation: 'FSSAI Reg 5(3)' }
  ];

  const snap = createRegulatorySnapshot({
    market: 'india',
    productCategory: 'food',
    launchDate: '2027-07-01',
    rules: sampleRules
  });

  assert.ok(snap.snapshotId.startsWith('reg-snap-'));
  assert.equal(snap.knowledgeDate, REGULATORY_KNOWLEDGE_DATE);
  assert.equal(snap.market, 'india');
  assert.equal(snap.productCategory, 'food');
  assert.equal(snap.launchDate, '2027-07-01');
  assert.equal(snap.ruleCount, 2);
  assert.ok(snap.ruleRecordHashes['RULE-1']);
  assert.ok(snap.ruleRecordHashes['RULE-2']);
});

test('2. Hashing single rule record is deterministic', () => {
  const rule = { id: 'TEST-100', effectiveDate: '2027-07-01', citation: 'Act 2026' };
  const h1 = hashRuleRecord(rule);
  const h2 = hashRuleRecord(rule);
  assert.equal(h1, h2);
  assert.equal(typeof h1, 'string');
  assert.equal(h1.length, 16);
});

test('3. Changing rule content changes the resulting rule hash', () => {
  const r1 = { id: 'TEST-100', effectiveDate: '2027-07-01', citation: 'Original' };
  const r2 = { id: 'TEST-100', effectiveDate: '2027-07-01', citation: 'Amended' };
  assert.notEqual(hashRuleRecord(r1), hashRuleRecord(r2));
});
