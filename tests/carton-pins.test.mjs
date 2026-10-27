import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCartonFindingPins,
  resolvePanelForPoint,
  STATUS_LABELS,
  STATUS_SYMBOLS,
  STATUS_PRIORITY,
} from '../public/carton-finding-pins.js';

const samplePanelZones = {
  front: { page: 1, box: [0.0, 0.0, 0.5, 1.0] },
  back: { page: 1, box: [0.5, 0.0, 1.0, 1.0] },
  left: { page: 2, box: [0.0, 0.0, 0.5, 1.0] },
  right: { page: 2, box: [0.5, 0.0, 1.0, 1.0] },
};

test('1. Issue badge classified correctly with label and symbol', () => {
  const review = {
    id: 'rev-001',
    findings: [
      {
        id: 'f-issue-1',
        status: 'issue',
        title: 'Sodium DV Mismatch',
        evidence: [{ role: 'artwork', page: 1, box: [0.1, 0.2, 0.3, 0.4] }],
      },
    ],
  };

  const { pins } = extractCartonFindingPins(review, { panelZones: samplePanelZones });
  assert.equal(pins.length, 1);
  assert.equal(pins[0].status, 'issue');
  assert.equal(pins[0].statusLabel, 'ISSUE');
  assert.equal(pins[0].statusSymbol, '!');
});

test('2. Review badge classified correctly with label and symbol', () => {
  const review = {
    id: 'rev-002',
    findings: [
      {
        id: 'f-rev-1',
        status: 'review',
        title: 'Allergen Declaration Font Size',
        evidence: [{ role: 'artwork', page: 1, box: [0.15, 0.25, 0.35, 0.45] }],
      },
    ],
  };

  const { pins } = extractCartonFindingPins(review, { panelZones: samplePanelZones });
  assert.equal(pins.length, 1);
  assert.equal(pins[0].status, 'review');
  assert.equal(pins[0].statusLabel, 'REVIEW');
  assert.equal(pins[0].statusSymbol, '?');
});

test('3. Match badge classified correctly with label and symbol', () => {
  const review = {
    id: 'rev-003',
    findings: [
      {
        id: 'f-match-1',
        status: 'match',
        title: 'Net Quantity Conformance',
        evidence: [{ role: 'artwork', page: 1, box: [0.05, 0.8, 0.45, 0.9] }],
      },
    ],
  };

  const { pins } = extractCartonFindingPins(review, { panelZones: samplePanelZones });
  assert.equal(pins.length, 1);
  assert.equal(pins[0].status, 'match');
  assert.equal(pins[0].statusLabel, 'MATCH');
  assert.equal(pins[0].statusSymbol, '✓');
});

test('4. Unable state handled properly without fabricating data', () => {
  const review = {
    id: 'rev-004',
    findings: [
      {
        id: 'f-unable-1',
        status: 'unable',
        title: 'Unresolvable Barcode Contrast',
        evidence: [{ role: 'artwork', page: 1, box: [0.6, 0.1, 0.8, 0.3] }],
      },
    ],
  };

  const { pins } = extractCartonFindingPins(review, { panelZones: samplePanelZones });
  assert.equal(pins.length, 1);
  assert.equal(pins[0].status, 'unable');
  assert.equal(pins[0].statusLabel, 'UNABLE');
  assert.equal(pins[0].statusSymbol, '—');
});

test('15. Actual finding ID retained in canonical pin record', () => {
  const findingId = 'FINDING-XYZ-789';
  const review = {
    id: 'rev-005',
    findings: [
      {
        id: findingId,
        status: 'issue',
        title: 'Serving Size Error',
        evidence: [{ role: 'artwork', page: 1, box: [0.1, 0.1, 0.2, 0.2] }],
      },
    ],
  };

  const { pins } = extractCartonFindingPins(review, { panelZones: samplePanelZones });
  assert.equal(pins[0].findingId, findingId);
  assert.ok(pins[0].pinId.includes(findingId));
});

test('16. Unknown artwork location does not create a fake pin', () => {
  const review = {
    id: 'rev-006',
    findings: [
      {
        id: 'f-no-coords',
        status: 'issue',
        title: 'Missing FOP Warning',
        evidence: [{ role: 'source', quote: 'Missing warning text' }], // No artwork box!
      },
      {
        id: 'f-out-of-bounds',
        status: 'review',
        title: 'Margin Note',
        evidence: [{ role: 'artwork', page: 99, box: [0.9, 0.9, 0.95, 0.95] }], // Page 99 not in panel zones
      },
    ],
  };

  const { pins, unlocatedFindings } = extractCartonFindingPins(review, { panelZones: samplePanelZones });
  assert.equal(pins.length, 0, 'No fake pins should be generated');
  assert.equal(unlocatedFindings.length, 2, 'Unmapped findings must appear in unlocatedFindings');
  assert.equal(unlocatedFindings[0].findingId, 'f-no-coords');
  assert.equal(unlocatedFindings[1].findingId, 'f-out-of-bounds');
});

test('29. 2D/3D selection references the same finding and page coordinates', () => {
  const originalBox = [0.12, 0.34, 0.45, 0.67];
  const review = {
    id: 'rev-007',
    findings: [
      {
        id: 'sync-finding-01',
        status: 'issue',
        title: 'Ingredient Typography',
        evidence: [{ role: 'artwork', page: 1, box: originalBox }],
      },
    ],
  };

  const { pins } = extractCartonFindingPins(review, { panelZones: samplePanelZones });
  assert.equal(pins[0].findingId, 'sync-finding-01');
  assert.deepEqual(pins[0].artworkBoundingBox, originalBox);
  assert.equal(pins[0].artworkPage, 1);
});

test('32. Historical revision pins use correct artwork version', () => {
  const review = {
    id: 'rev-008',
    version: 'rev_b_final',
    documents: [{ role: 'artwork', id: 'art-doc-b', version: 'rev_b' }],
    findings: [
      {
        id: 'f-rev-b',
        status: 'issue',
        title: 'Barcode Rescaling',
        evidence: [{ role: 'artwork', page: 1, box: [0.1, 0.1, 0.3, 0.3] }],
      },
    ],
  };

  const { pins } = extractCartonFindingPins(review, { panelZones: samplePanelZones });
  assert.equal(pins[0].artworkVersion, 'rev_b');
  assert.equal(pins[0].artworkDocumentId, 'art-doc-b');
});

test('33. Unlocated findings stay accessible in returned report', () => {
  const review = {
    id: 'rev-009',
    findings: [
      { id: 'f-valid', status: 'issue', title: 'Valid Pin', evidence: [{ role: 'artwork', page: 1, box: [0.1, 0.1, 0.2, 0.2] }] },
      { id: 'f-missing', status: 'review', title: 'Unlocated Item', evidence: [] },
    ],
  };

  const { pins, unlocatedFindings } = extractCartonFindingPins(review, { panelZones: samplePanelZones });
  assert.equal(pins.length, 1);
  assert.equal(unlocatedFindings.length, 1);
  assert.equal(unlocatedFindings[0].findingId, 'f-missing');
});

test('34. No additional review decision is created by selection or pin extraction', () => {
  const review = {
    id: 'rev-010',
    decisions: { 'f-1': { decision: 'approved_override' } },
    findings: [
      { id: 'f-1', status: 'issue', title: 'Overridden Issue', evidence: [{ role: 'artwork', page: 1, box: [0.1, 0.1, 0.2, 0.2] }] },
      { id: 'f-2', status: 'issue', title: 'Unresolved Issue', evidence: [{ role: 'artwork', page: 1, box: [0.2, 0.2, 0.3, 0.3] }] },
    ],
  };

  const { pins } = extractCartonFindingPins(review, { panelZones: samplePanelZones });
  // Ensure decisions object was not modified
  assert.equal(Object.keys(review.decisions).length, 1);
  // Status remains issue even if human decision approved_override exists
  assert.equal(pins[0].status, 'issue');
  assert.equal(pins[0].reviewerDecisionId, 'approved_override');
});

test('35. No external AI call is required for navigation or pin extraction', () => {
  const review = {
    id: 'rev-011',
    findings: [
      { id: 'f-local', status: 'issue', title: 'Offline finding', evidence: [{ role: 'artwork', page: 1, box: [0.1, 0.1, 0.2, 0.2] }] },
    ],
  };

  const t0 = performance.now();
  const { pins } = extractCartonFindingPins(review, { panelZones: samplePanelZones });
  const elapsed = performance.now() - t0;

  assert.equal(pins.length, 1);
  assert.ok(elapsed < 20, 'Pin extraction is synchronous and local without external network delays');
});
