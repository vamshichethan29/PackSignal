/**
 * Tests for India FSSAI Regulatory Engine (Labelling and Display Regulations, 2020)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateJurisdiction } from '../../lib/regulatory/evaluator.mjs';

test('1. India FSSAI: Valid 14-digit FSSAI license number matches Regulation 5(1)(d)', () => {
  const review = {
    documents: [
      {
        role: 'artwork',
        text: 'Crispy Snack. 100% Vegetarian.\nFSSAI Lic. No. 10019021000123\nNet Weight: 150 g\nMfg Date: 10/2026\nBest Before: 9 months from manufacture\nNutritional Information per 100g and per serve (30g) with %RDA',
      },
    ],
    facts: [],
  };

  const res = evaluateJurisdiction(review, 'india', { effectiveDate: '2026-10-23' });
  assert.equal(res.jurisdiction, 'india');

  const licFinding = res.findings.find(f => f.key.includes('REG5.1-LICENSE'));
  assert.ok(licFinding);
  assert.equal(licFinding.status, 'match');
  assert.match(licFinding.observed, /10019021000123/);
});

test('2. India FSSAI: Invalid digit count in FSSAI license flags issue', () => {
  const review = {
    documents: [
      {
        role: 'artwork',
        // Only 10 digits instead of required 14 digits
        text: 'FSSAI License No: 1234567890\nIngredients: Wheat flour.',
      },
    ],
    facts: [],
  };

  const res = evaluateJurisdiction(review, 'india');
  const licFinding = res.findings.find(f => f.key.includes('REG5.1-LICENSE'));
  assert.ok(licFinding);
  assert.equal(licFinding.status, 'issue');
  assert.match(licFinding.explanation, /10 digits instead of the required 14 digits/);
});

test('3. India FSSAI: Vegetarian/Non-Vegetarian text cue triggers human review of symbol geometry', () => {
  const review = {
    documents: [
      {
        role: 'artwork',
        text: '100% Vegetarian product.\nNet Quantity 200g',
      },
    ],
    facts: [],
  };

  const res = evaluateJurisdiction(review, 'india');
  const vegFinding = res.findings.find(f => f.key.includes('REG5.2-VEG-MARK'));
  assert.ok(vegFinding);
  assert.equal(vegFinding.status, 'review');
  assert.match(vegFinding.observed, /Text cue located/);
});

test('4. India FSSAI: Completely absent veg/non-veg mark flags non-compliance issue', () => {
  const review = {
    documents: [
      {
        role: 'artwork',
        text: 'Sparkling Soda Water. 500 mL.',
      },
    ],
    facts: [],
  };

  const res = evaluateJurisdiction(review, 'india');
  const vegFinding = res.findings.find(f => f.key.includes('REG5.2-VEG-MARK'));
  assert.ok(vegFinding);
  assert.equal(vegFinding.status, 'issue');
});

test('5. India FSSAI: First Amendment 2026 FOPNL rule is future_requirement in 2026, but active in 2027', () => {
  const review = {
    documents: [
      {
        role: 'artwork',
        text: 'FSSAI Lic. No. 10019021000123. Net Wt 100g. Vegetarian.',
      },
    ],
    facts: [],
  };

  // Oct 2026 evaluation: MUST be future_requirement
  const oct2026 = evaluateJurisdiction(review, 'india', { effectiveDate: '2026-10-23' });
  const fopnlOct = oct2026.findings.find(f => f.key.includes('FOPNL'));
  assert.ok(fopnlOct);
  assert.equal(fopnlOct.applicability, 'future_requirement');
  assert.match(fopnlOct.explanation, /2027-07-01/);

  // July 2027 evaluation: Commenced law
  const jul2027 = evaluateJurisdiction(review, 'india', { effectiveDate: '2027-07-01' });
  const fopnlJul = jul2027.findings.find(f => f.key.includes('FOPNL'));
  assert.ok(fopnlJul);
  assert.equal(fopnlJul.applicability, 'applicable');
});
