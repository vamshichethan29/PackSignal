/**
 * PackSignal US Regulatory Preflight — Check US-001: Net Quantity
 * Legal Basis: 21 CFR 101.105, Fair Packaging and Labeling Act (15 U.S.C. 1453)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { executeUsNetQuantityCheck, convertQuantity, extractNetQuantityDeclarations } from '../../lib/regulatory/us/net-quantity.mjs';

test('US-001: Unit conversion accurately handles mass units (g <-> oz, kg <-> lb)', () => {
  // 1 oz is ~28.3495 g
  const gFromOz = convertQuantity(14, 'oz', 'g');
  assert.ok(Math.abs(gFromOz - 396.89) < 0.5);

  const ozFromG = convertQuantity(396.89, 'g', 'oz');
  assert.ok(Math.abs(ozFromG - 14) < 0.05);

  const lbFromKg = convertQuantity(1, 'kg', 'lb');
  assert.ok(Math.abs(lbFromKg - 2.20462) < 0.01);
});

test('US-001: Unit conversion accurately handles volume units (mL <-> fl oz, L <-> fl oz)', () => {
  const mlFromFlOz = convertQuantity(16, 'fl oz', 'ml');
  assert.ok(Math.abs(mlFromFlOz - 473.176) < 0.5);

  const flOzFromMl = convertQuantity(473.176, 'ml', 'fl oz');
  assert.ok(Math.abs(flOzFromMl - 16) < 0.05);
});

test('US-001: Rejects cross-dimension conversion (mass vs volume) without density', () => {
  const invalid = convertQuantity(500, 'g', 'ml');
  assert.equal(invalid, null);
});

test('US-001: Correct dual declaration (US Customary and Metric) matches against approved source', () => {
  const res = executeUsNetQuantityCheck({
    artworkText: 'ORGANIC CRUNCHY GRANOLA\nNET WT 14 OZ (396 g)\nBEST BEFORE 12/2026',
    approvedSourceQty: '14 oz (396 g)',
    pdpMapped: true,
    panelPlacement: { panel: 'PDP', normalizedY: 0.85 }, // bottom 15%
  });
  assert.equal(res.checkId, 'US-001');
  assert.equal(res.findingStatus, 'match');
  assert.match(res.explanation, /satisfies 21 CFR 101.105 dual declaration/i);
});

test('US-001: Verified mismatch between artwork and approved specification flags ISSUE', () => {
  const res = executeUsNetQuantityCheck({
    artworkText: 'NET WT 12 OZ (340 g)',
    approvedSourceQty: '14 oz (396 g)',
    pdpMapped: true,
  });
  assert.equal(res.checkId, 'US-001');
  assert.equal(res.findingStatus, 'issue');
  assert.match(res.explanation, /Net quantity declaration mismatch/i);
});

test('US-001: Single metric-only declaration flags ISSUE under FPLA dual declaration rules', () => {
  const res = executeUsNetQuantityCheck({
    artworkText: 'ORGANIC MUESLI\nNET CONTENTS 480 g',
    approvedSourceQty: '480 g',
    pdpMapped: true,
  });
  assert.equal(res.checkId, 'US-001');
  assert.equal(res.findingStatus, 'issue');
  assert.match(res.explanation, /Dual declaration violation under FPLA/i);
});

test('US-001: Unmapped PDP notes placement pending without failing a valid quantity declaration', () => {
  const res = executeUsNetQuantityCheck({
    artworkText: 'NET CONTENTS 16 FL OZ (473 mL)',
    approvedSourceQty: '16 fl oz',
    pdpMapped: false,
  });
  assert.equal(res.checkId, 'US-001');
  assert.equal(res.findingStatus, 'match');
  assert.match(res.explanation, /placement within bottom 30% of PDP requires dieline zone confirmation/i);
});

test('US-001: Declaration placed in upper half of PDP flags REVIEW under 21 CFR 101.105(f)', () => {
  const res = executeUsNetQuantityCheck({
    artworkText: 'NET WT 14 OZ (396 g)',
    approvedSourceQty: '14 oz (396 g)',
    pdpMapped: true,
    panelPlacement: { panel: 'PDP', normalizedY: 0.25 }, // upper 25%
  });
  assert.equal(res.checkId, 'US-001');
  assert.equal(res.findingStatus, 'review');
  assert.match(res.explanation, /bottom 30% of the Principal Display Panel/i);
});

test('US-001: Unlocated net quantity on unconfirmed artwork coverage returns UNABLE', () => {
  const res = executeUsNetQuantityCheck({
    artworkText: 'DELICIOUS OATS\nINGREDIENTS: OATS',
    approvedSourceQty: '14 oz (396 g)',
    coverageConfirmed: false,
  });
  assert.equal(res.checkId, 'US-001');
  assert.equal(res.findingStatus, 'unable');
  assert.match(res.explanation, /Extraction coverage is unconfirmed/i);
});
