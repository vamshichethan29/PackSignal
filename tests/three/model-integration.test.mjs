import test from 'node:test';
import assert from 'node:assert/strict';
import { reconstructDxfCarton } from '../../public/cad-carton.js';
import { buildHingeTree, calculateFoldTransforms, calculatePanelNormal, mapArtworkPointToPanel } from '../../public/three/fold-engine.js';
import { workbenchArtwork } from '../../public/artwork-ui.js';

function createSampleDxfCarton() {
  const depth = 30;
  const bounds = { minX: 0, maxX: 160, minY: -depth, maxY: 100 + depth };
  const page = { number: 1, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY, image: 'dieline.svg', unit: 'millimeters' };
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
  return {
    name: 'rectangular-carton.dxf', pages: [page], vectorRegions,
    vectorGeometry: { format: 'DXF', units: 'millimeters', unsupportedEntities: [] },
    vectorLines: creasePoints.map(([x0,y0,x1,y1]) => ({ page: 1, kind: 'crease', points: [norm([x0,y0]), norm([x1,y1])] })),
  };
}

test('DEMO A — Validated DXF Carton: constructs CAD-accurate foldable shell from DXF dieline', () => {
  const dxfDoc = createSampleDxfCarton();
  const cadModel = reconstructDxfCarton(dxfDoc);
  assert.equal(cadModel.ok, true);
  assert.deepEqual(cadModel.dimensions, { width: 50, height: 100, depth: 30 });

  const tree = buildHingeTree(cadModel);
  assert.equal(tree.root, 'front');

  // Verify flat state (0%)
  const flatTransforms = calculateFoldTransforms(tree, 0);
  for (const face of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
    const pt = flatTransforms[face].transformPoint([0, 0, 0]);
    assert.ok(Math.abs(pt[2]) < 1e-4, `${face} must be flat at Z=0`);
    assert.deepEqual(calculatePanelNormal(face, 0, tree), [0, 0, 1]);
  }

  // Verify 100% folded state forms exact 50x100x30 box
  const foldedTransforms = calculateFoldTransforms(tree, 1);
  const frontPt = foldedTransforms.front.transformPoint([0, 0, 0]);
  const backPt = foldedTransforms.back.transformPoint([0, 0, 0]);
  const rightPt = foldedTransforms.right.transformPoint([0, 0, 0]);
  const leftPt = foldedTransforms.left.transformPoint([0, 0, 0]);
  const topPt = foldedTransforms.top.transformPoint([0, 0, 0]);
  const bottomPt = foldedTransforms.bottom.transformPoint([0, 0, 0]);

  assert.deepEqual(frontPt, [0, 0, 15]);
  assert.deepEqual(backPt, [0, 0, -15]);
  assert.deepEqual(rightPt, [25, 0, 0]);
  assert.deepEqual(leftPt, [-25, 0, 0]);
  assert.deepEqual(topPt, [0, 50, 0]);
  assert.deepEqual(bottomPt, [0, -50, 0]);
});

test('DEMO B — Artwork with Findings: projects net quantity, nutrition, and barcode findings to 3D faces', () => {
  const review = {
    id: 'demo-b-findings',
    name: 'Demo B Packaging',
    options: {
      packageType: 'carton',
      panelZones: {
        front: { page: 1, box: [0.02, 0.05, 0.48, 0.95] },
        back:  { page: 1, box: [0.52, 0.05, 0.98, 0.95] },
      },
    },
    findings: [
      {
        id: 'finding-net-qty',
        title: 'Net Quantity Mismatch',
        status: 'issue',
        evidence: [{ role: 'artwork', page: 1, box: [0.15, 0.80, 0.35, 0.88] }],
      },
      {
        id: 'finding-nutrition',
        title: 'Nutrition Facts Discrepancy',
        status: 'review',
        evidence: [{ role: 'artwork', page: 1, box: [0.60, 0.20, 0.90, 0.65] }],
      },
      {
        id: 'finding-barcode',
        title: 'Barcode Identifier Check',
        status: 'match',
        evidence: [{ role: 'artwork', page: 1, box: [0.65, 0.75, 0.85, 0.90] }],
      },
    ],
  };

  const frontZone = review.options.panelZones.front;
  const backZone = review.options.panelZones.back;
  const panelDims = { width: 50, height: 100 };

  // 1. Net Quantity is inside Front panel
  const qtyEvidence = review.findings[0].evidence[0];
  const qtyMapped = mapArtworkPointToPanel(
    [(qtyEvidence.box[0] + qtyEvidence.box[2]) / 2, (qtyEvidence.box[1] + qtyEvidence.box[3]) / 2],
    frontZone,
    panelDims
  );
  assert.equal(qtyMapped.inside, true);
  assert.ok(qtyMapped.localPoint[1] < 0, 'Net quantity is in lower portion of front panel');

  // 2. Nutrition is inside Back panel
  const nutEvidence = review.findings[1].evidence[0];
  const nutMapped = mapArtworkPointToPanel(
    [(nutEvidence.box[0] + nutEvidence.box[2]) / 2, (nutEvidence.box[1] + nutEvidence.box[3]) / 2],
    backZone,
    panelDims
  );
  assert.equal(nutMapped.inside, true);

  // 3. Barcode is inside Back panel
  const barEvidence = review.findings[2].evidence[0];
  const barMapped = mapArtworkPointToPanel(
    [(barEvidence.box[0] + barEvidence.box[2]) / 2, (barEvidence.box[1] + barEvidence.box[3]) / 2],
    backZone,
    panelDims
  );
  assert.equal(barMapped.inside, true);
});

test('DEMO C — Incomplete Dieline: transparently states illustrative geometry without claiming CAD accuracy', () => {
  const review = {
    id: 'demo-c-incomplete',
    name: 'Unmapped Artwork Review',
    options: {
      packageType: 'carton',
      panelZones: {}, // No confirmed panel zones
    },
    documents: [
      { id: 'art', role: 'artwork', name: 'artwork.png', pages: [{ number: 1, width: 800, height: 1200, image: 'art.png' }] },
    ],
    findings: [],
  };

  const html = workbenchArtwork(review, null, { mode: '3d' });
  assert.match(html, /illustrative front/i);
  assert.match(html, /data-geometry-source="illustrative"/);
  assert.match(html, /preview only/i);
  assert.doesNotMatch(html, /DXF-DIMENSIONED SHELL/);
});
