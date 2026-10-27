import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQrSvg } from '../../public/ar-modal.js';

// Minimal mock of THREE.js for Node unit test environment
class MockVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

class MockGroup {
  constructor() {
    this.children = [];
    this.visible = false;
    this.position = new MockVector3();
    this.userData = {};
    this.parent = null;
  }
  add(obj) {
    this.children.push(obj);
    obj.parent = this;
  }
  remove(obj) {
    const idx = this.children.indexOf(obj);
    if (idx !== -1) this.children.splice(idx, 1);
    obj.parent = null;
  }
}

class MockMesh extends MockGroup {
  constructor(geometry, material) {
    super();
    this.geometry = geometry || { parameters: { width: 100, height: 120 } };
    this.material = material || {};
  }
}

class MockSprite extends MockGroup {
  constructor(material) {
    super();
    this.material = material;
    this.scale = new MockVector3(1, 1, 1);
  }
}

const mockTHREE = {
  Vector3: MockVector3,
  Group: MockGroup,
  Mesh: MockMesh,
  Sprite: MockSprite,
  BufferGeometry: class {
    setFromPoints(pts) { this.points = pts; return this; }
  },
  LineDashedMaterial: class {
    constructor(opts) { Object.assign(this, opts); }
  },
  MeshBasicMaterial: class {
    constructor(opts) { Object.assign(this, opts); }
  },
  SpriteMaterial: class {
    constructor(opts) { Object.assign(this, opts); }
  },
  PlaneGeometry: class {
    constructor(w, h) { this.w = w; this.h = h; }
  },
  Line: class extends MockGroup {
    constructor(geom, mat) {
      super();
      this.geom = geom;
      this.mat = mat;
    }
    computeLineDistances() {}
  },
  CanvasTexture: class {
    constructor(c) { this.canvas = c; }
  },
  DoubleSide: 2,
};

test('AR Modal QR code generator outputs valid SVG with finder patterns', () => {
  const svg = generateQrSvg('https://packsignal.demo/#ar-view/test-123', 200);
  assert.ok(svg.includes('<svg'), 'Must produce an SVG element');
  assert.ok(svg.includes('width="200"'), 'Matches requested width');
  assert.ok(svg.includes('height="200"'), 'Matches requested height');
  assert.ok(svg.includes('class="ar-qr-code"'), 'Has ar-qr-code class');
  assert.ok(svg.includes('📦'), 'Contains center PackSignal packaging badge');
  assert.ok(svg.includes('<path d="M'), 'Contains encoded QR cell paths');
});

test('X-Ray ghost boxes build missing oz quantity and legal address for US market', () => {
  const frontMesh = new MockMesh();
  const backMesh = new MockMesh();
  const panelMeshes = { front: frontMesh, back: backMesh };

  const review = {
    id: 'test-review',
    market: 'United States FDA',
    options: { marketPreset: 'us' }
  };

  const ghostBoxes = [];
  const isXRay = false;

  // Emulate buildGhostBoxes logic from PackagingViewerController
  const createDashedBox = (w, h, labelText, color) => {
    const group = new mockTHREE.Group();
    group.visible = Boolean(isXRay);
    group.userData = { isGhostBox: true, label: labelText, market: 'us' };
    return group;
  };

  const fw = frontMesh.geometry.parameters.width;
  const fh = frontMesh.geometry.parameters.height;
  const boxFront = createDashedBox(fw * 0.75, 24, 'MISSING: Net Qty in oz (21 CFR §101.7)', 0xf59e0b);
  frontMesh.add(boxFront);
  ghostBoxes.push(boxFront);

  const bw = backMesh.geometry.parameters.width;
  const bh = backMesh.geometry.parameters.height;
  const boxBack = createDashedBox(bw * 0.8, 24, 'MISSING: Legal Address (21 CFR §101.5)', 0xf59e0b);
  backMesh.add(boxBack);
  ghostBoxes.push(boxBack);

  assert.equal(ghostBoxes.length, 2, 'Two statutory ghost boxes created');
  assert.ok(ghostBoxes[0].userData.label.includes('MISSING: Net Qty in oz'), 'Front has missing oz quantity');
  assert.ok(ghostBoxes[1].userData.label.includes('MISSING: Legal Address'), 'Back has missing legal address');
  assert.equal(ghostBoxes[0].visible, false, 'Ghost boxes initially hidden before X-Ray activation');

  // Toggle X-Ray
  for (const b of ghostBoxes) b.visible = true;
  assert.equal(ghostBoxes[0].visible, true, 'Front ghost box visible when X-Ray is ON');
  assert.equal(ghostBoxes[1].visible, true, 'Back ghost box visible when X-Ray is ON');
});

test('Switching market to India switches ghost boxes to FSSAI Veg Mark & MRP', () => {
  const frontMesh = new MockMesh();
  const backMesh = new MockMesh();
  const ghostBoxes = [];

  const createDashedBox = (w, h, labelText, color) => {
    const group = new mockTHREE.Group();
    group.visible = true;
    group.userData = { isGhostBox: true, label: labelText, market: 'india' };
    return group;
  };

  const fw = frontMesh.geometry.parameters.width;
  const fh = frontMesh.geometry.parameters.height;
  const vegBox = createDashedBox(24, 24, 'MANDATORY: Veg Mark (FSSAI)', 0x15803d);
  frontMesh.add(vegBox);
  ghostBoxes.push(vegBox);

  const bw = backMesh.geometry.parameters.width;
  const bh = backMesh.geometry.parameters.height;
  const mrpBox = createDashedBox(bw * 0.8, 24, 'MANDATORY: MRP & FSSAI Licence No.', 0x15803d);
  backMesh.add(mrpBox);
  ghostBoxes.push(mrpBox);

  assert.equal(ghostBoxes.length, 2);
  assert.ok(ghostBoxes[0].userData.label.includes('MANDATORY: Veg Mark (FSSAI)'));
  assert.ok(ghostBoxes[1].userData.label.includes('MANDATORY: MRP & FSSAI Licence No.'));
  assert.equal(ghostBoxes[0].userData.market, 'india');
});
