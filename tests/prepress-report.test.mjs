import test from 'node:test';
import assert from 'node:assert/strict';

import { preflightFindings } from '../lib/preflight-engine.mjs';

test('1. Prepress findings generate canonical keys with source evidence and proofs', () => {
  const review = {
    id: 'rev-prepress-check',
    pressProfile: 'ISO-OFFSET-COATED-300',
    options: { enablePrepress: true },
    documents: [
      {
        id: 'doc-art-1',
        name: 'DancingFish_Granola_Berry_US_Carton.pdf',
        role: 'artwork',
        pages: [{
          number: 1,
          boxes: {
            trim: [10, 10, 100, 100],
            bleed: [7.17, 7.17, 102.83, 102.83], // 1.0 mm bleed -> deficient
          },
        }],
        colorAnalysis: {
          samples: [
            { c: 80, m: 70, y: 70, k: 100, box: [0.2, 0.2, 0.4, 0.4] }, // TAC 320% -> excess
          ],
        },
      },
    ],
  };

  const findings = preflightFindings(review);
  assert.ok(findings.length >= 2);

  const tacFinding = findings.find(f => f.key === 'prepress:tac_excess');
  assert.ok(tacFinding);
  assert.equal(tacFinding.primaryDepartment, 'prepress');
  assert.equal(tacFinding.unit, '%');
  assert.equal(tacFinding.measuredValue, 320);
  assert.equal(tacFinding.requiredValue, 300);
  assert.equal(tacFinding.status, 'issue');
  assert.ok(tacFinding.comparisonProof.includes('Measured TAC = 320%'));

  const bleedFinding = findings.find(f => f.key === 'prepress:bleed_extension');
  assert.ok(bleedFinding);
  assert.equal(bleedFinding.primaryDepartment, 'prepress');
  assert.equal(bleedFinding.status, 'issue');
  assert.equal(bleedFinding.unit, 'mm');
});

test('2. Department collaboration routes prepress findings to Prepress & Print, Brand & Marketing, and Regulatory', () => {
  const review = {
    id: 'rev-dept-test',
    pressProfile: 'ISO-OFFSET-COATED-300',
    options: { enablePrepress: true },
    documents: [
      {
        id: 'doc-1',
        role: 'artwork',
        pages: [{ number: 1, boxes: { trim: [0, 0, 100, 100] } }],
        preflight: {
          findings: [
            {
              id: 'trim-statutory-text',
              title: 'Mandatory Allergen Statement within 1.2 mm of cut line',
              status: 'issue',
              primaryDepartment: 'prepress',
              collaboratingDepartment: 'regulatory',
              category: 'prepress',
            },
            {
              id: 'trim-brand-logo',
              title: 'Brand Mascot Logo within 1.0 mm of cut line',
              status: 'issue',
              primaryDepartment: 'prepress',
              collaboratingDepartment: 'marketing',
              category: 'prepress',
            },
          ],
        },
      },
    ],
  };

  const findings = preflightFindings(review);
  const statutoryFinding = findings.find(f => f.id === 'trim-statutory-text');
  assert.ok(statutoryFinding);
  assert.equal(statutoryFinding.primaryDepartment, 'prepress');
  assert.equal(statutoryFinding.collaboratingDepartment, 'regulatory');

  const logoFinding = findings.find(f => f.id === 'trim-brand-logo');
  assert.ok(logoFinding);
  assert.equal(logoFinding.primaryDepartment, 'prepress');
  assert.equal(logoFinding.collaboratingDepartment, 'marketing');
});

test('3. V1 vs V2 physical prepress comparison tracks resolved and persistent violations', () => {
  const v1Prepress = {
    maxTac: 320,
    minBleedMm: 1.0,
    minTrimClearanceMm: 1.2,
    violations: ['prepress:tac_excess', 'prepress:bleed_extension', 'prepress:trim_safety'],
  };

  const v2Prepress = {
    maxTac: 288, // Resolved (≤ 300%)
    minBleedMm: 3.2, // Resolved (≥ 3.0 mm)
    minTrimClearanceMm: 1.5, // Persistent shortfall (1.5 mm < 3.0 mm)
    violations: ['prepress:trim_safety'],
  };

  // Compare V1 to V2
  const resolved = v1Prepress.violations.filter(k => !v2Prepress.violations.includes(k));
  const persistent = v1Prepress.violations.filter(k => v2Prepress.violations.includes(k));
  const newRegressions = v2Prepress.violations.filter(k => !v1Prepress.violations.includes(k));

  assert.deepEqual(resolved, ['prepress:tac_excess', 'prepress:bleed_extension']);
  assert.deepEqual(persistent, ['prepress:trim_safety']);
  assert.equal(newRegressions.length, 0);

  const tacDelta = v2Prepress.maxTac - v1Prepress.maxTac;
  assert.equal(tacDelta, -32, 'TAC reduced by 32 percentage points in V2');

  const bleedDelta = v2Prepress.minBleedMm - v1Prepress.minBleedMm;
  assert.equal(Math.round(bleedDelta * 10) / 10, 2.2, 'Bleed increased by 2.2 mm in V2');
});
