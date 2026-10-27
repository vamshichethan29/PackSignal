import test from 'node:test';
import assert from 'node:assert/strict';
import { inferPanelFaces, extractFaceFromLabelText } from '../lib/geometry/panel-inference.mjs';
import { evaluatePanelRules, mapContentToPanels } from '../lib/geometry/placement.mjs';
import { computePanelPrintableRegion } from '../lib/geometry/printable-regions.mjs';
import { VERIFICATION_STATES, REGISTRATION_STATES } from '../lib/geometry/model.mjs';

test('9. Explicitly labeled front panel inferred with EXPLICITLY_LABELED status', () => {
  const poly = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const labels = [{ text: 'Front Panel', point: [50, 50] }];
  const panels = inferPanelFaces({
    polygons: [{ polygonId: 'p1', points: poly, boundingBox: [0, 0, 100, 100], area: 10000 }],
    panelLabels: labels
  });
  assert.equal(panels[0].face, 'front');
  assert.equal(panels[0].verificationState, VERIFICATION_STATES.EXPLICITLY_LABELED);
  assert.ok(panels[0].inferenceReason.includes('Front Panel'));
});

test('10. Unlabeled panel marked as UNRESOLVED without guessing', () => {
  const poly = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const panels = inferPanelFaces({
    polygons: [{ polygonId: 'p1', points: poly, boundingBox: [0, 0, 100, 100], area: 10000 }],
    panelLabels: []
  });
  assert.equal(panels[0].face, 'unknown_panel');
  assert.equal(panels[0].verificationState, VERIFICATION_STATES.UNRESOLVED);
});

test('11. Ambiguous face mapping when multiple panels claim the same face', () => {
  const poly1 = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const poly2 = [[100, 0], [200, 0], [200, 100], [100, 100]];
  const labels = [
    { text: 'Front', point: [50, 50] },
    { text: 'Front Panel', point: [150, 50] }
  ];
  const panels = inferPanelFaces({
    polygons: [
      { polygonId: 'p1', points: poly1, boundingBox: [0, 0, 100, 100], area: 10000 },
      { polygonId: 'p2', points: poly2, boundingBox: [100, 0, 200, 100], area: 10000 }
    ],
    panelLabels: labels
  });
  assert.equal(panels[0].verificationState, VERIFICATION_STATES.AMBIGUOUS);
  assert.equal(panels[1].verificationState, VERIFICATION_STATES.AMBIGUOUS);
});

test('12. Reviewer-confirmed panel mapping overrides candidate status', () => {
  const poly = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const reviewerZones = {
    front: { page: 1, box: [0, 0, 100, 100], confirmed: true }
  };
  const panels = inferPanelFaces({
    polygons: [{ polygonId: 'p1', points: poly, boundingBox: [0, 0, 100, 100], area: 10000 }],
    panelLabels: [],
    reviewerZones
  });
  assert.equal(panels[0].face, 'front');
  assert.equal(panels[0].verificationState, VERIFICATION_STATES.REVIEWER_CONFIRMED);
  assert.ok(panels[0].inferenceReason.includes('Reviewer confirmed'));
});

test('28 & 31. Text fully inside panel matches placement requirement', () => {
  const panelFront = {
    panelId: 'p_front',
    face: 'front',
    polygon: [[0, 0], [1.0, 0], [1.0, 1.0], [0, 1.0]],
    boundingBox: [0, 0, 1.0, 1.0],
    verificationState: VERIFICATION_STATES.REVIEWER_CONFIRMED
  };
  const artwork = {
    id: 'art-1',
    lines: [
      { text: 'NET WT 12 OZ (340g)', box: [0.3, 0.8, 0.7, 0.9], page: 1 }
    ]
  };
  const rule = {
    id: 'rule-net-quantity',
    checkType: 'REQUIRED_ON_PANEL',
    panel: 'front',
    literal_expected: 'NET WT 12 OZ (340g)',
    title: 'Net Quantity on Front Panel'
  };

  const reg = { verified: true, status: REGISTRATION_STATES.REVIEWER_CONFIRMED };
  const res = evaluatePanelRules({
    rules: [rule],
    artworkDocument: artwork,
    panels: [panelFront],
    registration: reg
  });

  assert.equal(res.findings.length, 1);
  assert.equal(res.findings[0].status, 'match');
});

test('29 & 30. Text crossing panel / fold boundary triggers boundary-crossing issue', () => {
  const panelFront = {
    panelId: 'p_front',
    face: 'front',
    polygon: [[0, 0], [0.5, 0], [0.5, 1.0], [0, 1.0]],
    boundingBox: [0, 0, 0.5, 1.0],
    verificationState: VERIFICATION_STATES.REVIEWER_CONFIRMED
  };
  // Text starts at 0.4 and ends at 0.6 (crossing the 0.5 crease boundary!)
  const artwork = {
    id: 'art-1',
    lines: [
      { text: 'Warning: Contains Peanuts', box: [0.4, 0.2, 0.6, 0.3], page: 1 }
    ]
  };
  const rule = {
    id: 'rule-warn',
    checkType: 'REQUIRED_ON_PANEL',
    panel: 'front',
    literal_expected: 'Warning: Contains Peanuts',
    title: 'Allergen Warning Placement'
  };

  const reg = { verified: true, status: REGISTRATION_STATES.REVIEWER_CONFIRMED };
  const res = evaluatePanelRules({
    rules: [rule],
    artworkDocument: artwork,
    panels: [panelFront],
    registration: reg
  });

  assert.equal(res.findings.length, 1);
  assert.equal(res.findings[0].status, 'issue');
  assert.ok(res.findings[0].title.includes('Text crosses panel boundary'));
});

test('32. Net quantity on wrong confirmed panel yields issue', () => {
  const panelBack = {
    panelId: 'p_back',
    face: 'back',
    polygon: [[0, 0], [0.5, 0], [0.5, 1.0], [0, 1.0]],
    boundingBox: [0, 0, 0.5, 1.0],
    verificationState: VERIFICATION_STATES.REVIEWER_CONFIRMED
  };
  const panelFront = {
    panelId: 'p_front',
    face: 'front',
    polygon: [[0.5, 0], [1.0, 0], [1.0, 1.0], [0.5, 1.0]],
    boundingBox: [0.5, 0, 1.0, 1.0],
    verificationState: VERIFICATION_STATES.REVIEWER_CONFIRMED
  };
  // Net quantity placed on BACK panel [0.1, 0.8, 0.3, 0.9]
  const artwork = {
    id: 'art-1',
    lines: [
      { text: 'NET WT 16 OZ', box: [0.1, 0.8, 0.3, 0.9], page: 1 }
    ]
  };
  const rule = {
    id: 'rule-net-qty',
    checkType: 'REQUIRED_ON_PANEL',
    panel: 'front',
    literal_expected: 'NET WT 16 OZ',
    title: 'Net Quantity Front Display'
  };

  const reg = { verified: true, status: REGISTRATION_STATES.REVIEWER_CONFIRMED };
  const res = evaluatePanelRules({
    rules: [rule],
    artworkDocument: artwork,
    panels: [panelBack, panelFront],
    registration: reg
  });

  assert.equal(res.findings.length, 1);
  assert.equal(res.findings[0].status, 'issue');
  assert.ok(res.findings[0].title.includes('Incorrect panel location'));
});

test('33. Product name with unconfirmed panel mapping yields review without false issue', () => {
  const panelCandidate = {
    panelId: 'p_cand',
    face: 'front',
    polygon: [[0, 0], [1.0, 0], [1.0, 1.0], [0, 1.0]],
    boundingBox: [0, 0, 1.0, 1.0],
    verificationState: VERIFICATION_STATES.UNRESOLVED // Not confirmed!
  };
  const artwork = {
    id: 'art-1',
    lines: [
      { text: 'Granola Berry Crisp', box: [0.2, 0.2, 0.8, 0.3], page: 1 }
    ]
  };
  const rule = {
    id: 'rule-pdp-title',
    checkType: 'REQUIRED_ON_PANEL',
    panel: 'front',
    literal_expected: 'Granola Berry Crisp',
    title: 'Product Title Placement'
  };

  const reg = { verified: true, status: REGISTRATION_STATES.REVIEWER_CONFIRMED };
  const res = evaluatePanelRules({
    rules: [rule],
    artworkDocument: artwork,
    panels: [panelCandidate],
    registration: reg
  });

  assert.equal(res.findings.length, 1);
  assert.equal(res.findings[0].status, 'review');
  assert.ok(res.findings[0].title.includes('Target panel "front" unconfirmed'));
});

test('36 & 37. Safe region calculation insets panel by 2mm cut setback and crease setback', () => {
  const panel = {
    panelId: 'p1',
    face: 'front',
    polygon: [[0, 0], [1.0, 0], [1.0, 1.0], [0, 1.0]],
    boundingBox: [0, 0, 1.0, 1.0]
  };
  const pageDim = { width: 200, height: 100 }; // 200mm x 100mm
  const printable = computePanelPrintableRegion({
    panel,
    pageDimensionsMm: pageDim,
    cutMarginMm: 2.0, // 2mm / 200mm = 0.01 normX
    creaseMarginMm: 1.5 // 1.5mm / 100mm = 0.015 normY
  });

  assert.equal(printable.hasPositiveSafeRegion, true);
  assert.ok(printable.safeCopyBox[0] >= 0.01);
  assert.ok(printable.safeCopyBox[1] >= 0.015);
  assert.ok(printable.safeCopyBox[2] <= 0.99);
  assert.ok(printable.safeCopyBox[3] <= 0.985);
});
