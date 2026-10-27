import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  determineRemediationEligibility,
  classifyFindingCategory,
  REMEDIATION_PATHS,
  FINDING_CATEGORIES,
} from '../../lib/remediation/eligibility.mjs';

test('Remediation Eligibility: CASE 1 — Net quantity mismatch with approved source selects DETERMINISTIC_EXACT_FIX', () => {
  const finding = {
    id: 'f-net-qty',
    title: 'Net Quantity Mismatch',
    observed: 'NET 750 mL',
    expected: 'NET 1000 mL',
  };
  const review = {
    documents: [{ id: 'spec-1', role: 'spec', name: 'Spec.pdf' }],
    findings: [finding],
  };

  const eligibility = determineRemediationEligibility(finding, review);
  assert.equal(eligibility.eligible, true);
  assert.equal(eligibility.isTextFix, true);
  assert.equal(eligibility.path, REMEDIATION_PATHS.DETERMINISTIC_EXACT_FIX);
  assert.equal(eligibility.category, FINDING_CATEGORIES.NET_QUANTITY);
});

test('Remediation Eligibility: CASE 2 — Conflicting quantity references blocks automatic replacement', () => {
  const finding = {
    id: 'f-conflict-qty',
    title: 'Conflicting sources · Net quantity',
    observed: '750 mL ↔ 1000 mL',
    explanation: 'Conflicting source specifications detected. Choose which source is authoritative.',
  };
  const review = {
    documents: [
      { id: 'spec-a', role: 'spec', name: 'Spec A.xlsx' },
      { id: 'spec-b', role: 'spec', name: 'Spec B.xlsx' },
    ],
    findings: [finding],
  };

  const eligibility = determineRemediationEligibility(finding, review);
  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.isTextFix, false);
  assert.equal(eligibility.path, REMEDIATION_PATHS.BLOCKED_OR_NEEDS_EVIDENCE);
  assert.ok(eligibility.reason.includes('Conflicting source specifications'));
  assert.ok(eligibility.blockers.length > 0);
});

test('Remediation Eligibility: CASE 11 — Barcode quiet zone failure routes to DESIGN_ONLY_TICKET not text rewrite', () => {
  const finding = {
    id: 'f-barcode-qz',
    title: 'Barcode Quiet Zone Margin Failure',
    explanation: 'Leading quiet zone margin is 2.1mm, below the 3.63mm required margin.',
    observed: 'Quiet zone margin insufficient',
  };
  const review = { documents: [], findings: [finding] };

  const eligibility = determineRemediationEligibility(finding, review);
  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.isTextFix, false);
  assert.equal(eligibility.path, REMEDIATION_PATHS.DESIGN_ONLY_TICKET);
  assert.equal(eligibility.category, FINDING_CATEGORIES.DESIGN_PREPRESS);
  assert.ok(eligibility.reason.includes('prepress geometry'));
});

test('Remediation Eligibility: Bleed and trim geometry findings route to DESIGN_ONLY_TICKET', () => {
  const finding = {
    id: 'f-bleed',
    title: 'Bleed Guide Undersized on Flap 4',
    observed: '1.2mm bleed',
  };
  const review = { documents: [], findings: [finding] };

  const eligibility = determineRemediationEligibility(finding, review);
  assert.equal(eligibility.path, REMEDIATION_PATHS.DESIGN_ONLY_TICKET);
});

test('Remediation Eligibility: Unreadable artwork text blocks automated remediation', () => {
  const finding = {
    id: 'f-unread',
    title: 'Review unreadable artwork text',
    status: 'unable',
    explanation: 'These image pages are available in the 2D proof, but copy could not be read.',
  };
  const review = { documents: [], findings: [finding] };

  const eligibility = determineRemediationEligibility(finding, review);
  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.path, REMEDIATION_PATHS.BLOCKED_OR_NEEDS_EVIDENCE);
  assert.ok(eligibility.reason.includes('unconfirmed'));
});

test('Remediation Eligibility: Draft unconfirmed source blocks automated copy remediation', () => {
  const finding = {
    id: 'f-draft',
    title: 'Source approval needs confirmation',
    explanation: 'Draft or unconfirmed source supplied. Confirm source authority before release.',
  };
  const review = { documents: [], findings: [finding] };

  const eligibility = determineRemediationEligibility(finding, review);
  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.path, REMEDIATION_PATHS.BLOCKED_OR_NEEDS_EVIDENCE);
  assert.ok(eligibility.reason.includes('DRAFT or UNCONFIRMED'));
});
