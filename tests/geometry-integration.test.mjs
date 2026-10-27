import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePackagingGeometry } from '../lib/geometry/index.mjs';
import { evaluateRegistration } from '../lib/geometry/registration.mjs';
import { reconstructDxfCarton } from '../public/cad-carton.js';
import { REGISTRATION_STATES } from '../lib/geometry/model.mjs';

test('24 & 25. Unregistered artwork and dieline returns REGISTRATION_REQUIRED', () => {
  const artwork = { id: 'art-001', sha256: 'sha-art-111' };
  const dieline = { id: 'die-002', sha256: 'sha-die-222' };

  const reg = evaluateRegistration({
    artworkDocument: artwork,
    dielineDocument: dieline,
    confirmedRegistration: null
  });

  assert.equal(reg.status, REGISTRATION_STATES.REGISTRATION_REQUIRED);
  assert.equal(reg.verified, false);
});

test('14. Changed dieline source hash invalidates historical registration', () => {
  const artwork = { id: 'art-001', sha256: 'sha-art-111' };
  const dieline = { id: 'die-002', sha256: 'sha-die-NEW-HASH' }; // Hash changed!

  const priorRegistration = {
    artworkHash: 'sha-art-111',
    dielineHash: 'sha-die-OLD-HASH', // Old dieline hash
    transformationMatrix: [1, 0, 0, 1, 0, 0]
  };

  const reg = evaluateRegistration({
    artworkDocument: artwork,
    dielineDocument: dieline,
    confirmedRegistration: priorRegistration
  });

  assert.equal(reg.status, REGISTRATION_STATES.REGISTRATION_REQUIRED, 'Changed dieline hash must invalidate registration');
});

test('Full analyzePackagingGeometry pipeline execution on structured dieline', () => {
  const dielineDoc = {
    id: 'die-carton',
    name: 'carton-dieline.dxf',
    role: 'dieline',
    sha256: 'sha-die-123',
    pages: [{ number: 1, width: 300, height: 200, unit: 'millimeters' }],
    vectorGeometry: {
      format: 'DXF',
      units: 'millimeters'
    },
    vectorRegions: [
      {
        page: 1,
        box: [0.1, 0.2, 0.4, 0.8],
        points: [[0.1, 0.2], [0.4, 0.2], [0.4, 0.8], [0.1, 0.8]],
        layer: 'PANELS',
        sourceLabel: 'Front Panel',
        face: 'front',
        area: 0.18
      },
      {
        page: 1,
        box: [0.4, 0.2, 0.7, 0.8],
        points: [[0.4, 0.2], [0.7, 0.2], [0.7, 0.8], [0.4, 0.8]],
        layer: 'PANELS',
        sourceLabel: 'Back Panel',
        face: 'back',
        area: 0.18
      }
    ],
    panelLabels: [
      { text: 'Front Panel', point: [0.25, 0.5] },
      { text: 'Back Panel', point: [0.55, 0.5] }
    ],
    vectorLines: [
      { points: [[0.4, 0.2], [0.4, 0.8]], layer: 'CREASE', kind: 'crease' }
    ]
  };

  const artworkDoc = {
    id: 'art-carton',
    role: 'artwork',
    sha256: 'sha-art-123',
    lines: [
      { text: 'Organic Granola 500g', box: [0.15, 0.3, 0.35, 0.4], page: 1 }
    ]
  };

  const rule = {
    id: 'rule-front-title',
    checkType: 'REQUIRED_ON_PANEL',
    panel: 'front',
    literal_expected: 'Organic Granola 500g',
    title: 'Brand Title on Front Face'
  };

  const result = analyzePackagingGeometry({
    artworkDocument: artworkDoc,
    dielineDocument: dielineDoc,
    rules: [rule],
    options: {
      panelZones: {
        front: { page: 1, box: [0.1, 0.2, 0.4, 0.8], confirmed: true }
      },
      registrationConfirmation: {
        artworkHash: 'sha-art-123',
        dielineHash: 'sha-die-123',
        transformationMatrix: [1, 0, 0, 1, 0, 0]
      }
    }
  });

  assert.equal(result.schemaVersion, 'packsignal-geometry/v1');
  assert.equal(result.panels.length, 2);
  assert.equal(result.panels[0].face, 'front');
  assert.equal(result.panels[1].face, 'back');
  assert.equal(result.foldGraph.edges.length, 1);
  assert.equal(result.foldGraph.edges[0].boundaryType, 'CREASE');
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].status, 'match');
});

test('47 & 48. Existing CAD carton reconstruction and illustrative fallback remain functional', () => {
  const depth = 30;
  const bounds = { minX: 0, maxX: 160, minY: -depth, maxY: 100 + depth };
  const page = { number: 1, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY, unit: 'millimeters' };
  const rect = (face, sourceLabel, x0, y0, x1, y1) => ({
    page: 1, face, sourceLabel, layer: 'PANEL', area: (x1 - x0) * (y1 - y0) / (page.width * page.height),
    box: [(x0 - bounds.minX) / page.width, 1 - (y1 - bounds.minY) / page.height, (x1 - bounds.minX) / page.width, 1 - (y0 - bounds.minY) / page.height],
    points: [[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y]) => [(x-bounds.minX)/page.width, 1-(y-bounds.minY)/page.height]),
  });
  const vectorRegions = [
    rect('front', 'FRONT PANEL', 0, 0, 50, 100),
    rect('right', 'RIGHT SIDE', 50, 0, 50 + depth, 100),
    rect('back', 'BACK PANEL', 50 + depth, 0, 100 + depth, 100),
    rect('left', 'LEFT SIDE', 100 + depth, 0, 100 + 2 * depth, 100),
    rect('top', 'TOP PANEL', 0, 100, 50, 100 + depth),
    rect('bottom', 'BOTTOM PANEL', 0, -depth, 50, 0),
  ];
  const norm = ([x,y]) => [(x-bounds.minX)/page.width, 1-(y-bounds.minY)/page.height];
  const creasePoints = [[50,0,50,100],[50+depth,0,50+depth,100],[100+depth,0,100+depth,100],[0,0,50,0],[0,100,50,100]];
  const doc = {
    vectorGeometry: { format: 'DXF', units: 'millimeters' },
    pages: [page],
    vectorRegions,
    vectorLines: creasePoints.map(([x0,y0,x1,y1]) => ({ page: 1, kind: 'crease', points: [norm([x0,y0]), norm([x1,y1])] }))
  };

  const res = reconstructDxfCarton(doc, 'carton');
  assert.equal(res.ok, true);
  assert.deepEqual(res.dimensions, { width: 50, height: 100, depth: 30 });
  assert.equal(res.creaseCount, 5);
});
