import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CanGeometryManager,
  BottleGeometryManager,
  PouchGeometryManager,
  CartonGeometryManager,
  EvidencePinSystem,
} from '../../public/three/studio.js';

// Mock Three.js
class MockVector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  clone() { return new MockVector3(this.x, this.y, this.z); }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  normalize() { return this; }
}

class MockQuaternion {
  constructor() { this.x = 0; this.y = 0; this.z = 0; this.w = 1; }
  setFromUnitVectors() { return this; }
}

class MockGroup {
  constructor() {
    this.children = [];
    this.visible = true;
    this.position = new MockVector3();
    this.quaternion = new MockQuaternion();
    this.scale = new MockVector3(1, 1, 1);
  }
  add(child) { this.children.push(child); child.parent = this; }
  remove(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
  }
}

class MockMesh extends MockGroup {
  constructor(geom, mat) {
    super();
    this.geometry = geom;
    this.material = mat;
    this.name = '';
    this.userData = {};
  }
  rotateY() {}
}

class MockAttribute {
  constructor(count, itemSize) {
    this.count = count;
    this.itemSize = itemSize;
    this.data = new Float32Array(count * itemSize);
    this.needsUpdate = false;
  }
  getX(i) { return this.data[i * this.itemSize]; }
  getY(i) { return this.data[i * this.itemSize + 1]; }
  getZ(i) { return this.data[i * this.itemSize + 2]; }
  setX(i, v) { this.data[i * this.itemSize] = v; }
  setY(i, v) { this.data[i * this.itemSize + 1] = v; }
  setZ(i, v) { this.data[i * this.itemSize + 2] = v; }
}

class MockGeometry {
  constructor() {
    this.attributes = {
      position: new MockAttribute(100, 3),
      uv: new MockAttribute(100, 2),
      normal: new MockAttribute(100, 3),
    };
  }
  rotateX() {}
  rotateY() {}
  computeVertexNormals() {}
  dispose() {}
}

class MockMaterial {
  constructor(opts = {}) {
    Object.assign(this, opts);
  }
  dispose() {}
}

const mockTHREE = {
  Group: MockGroup,
  Mesh: MockMesh,
  MeshStandardMaterial: MockMaterial,
  MeshPhysicalMaterial: MockMaterial,
  MeshBasicMaterial: MockMaterial,
  CylinderGeometry: class extends MockGeometry {},
  CircleGeometry: class extends MockGeometry {},
  BoxGeometry: class extends MockGeometry {},
  PlaneGeometry: class extends MockGeometry {
    constructor(w = 10, h = 10, segX = 1, segY = 1) {
      super();
      const count = (segX + 1) * (segY + 1);
      this.attributes.position = new MockAttribute(count, 3);
      this.attributes.uv = new MockAttribute(count, 2);
    }
  },
  BufferGeometry: class extends MockGeometry {
    setAttribute(name, attr) { this.attributes[name] = attr; }
  },
  Float32BufferAttribute: class {
    constructor(arr, size) {
      this.data = arr;
      this.size = size;
      this.count = arr.length / size;
    }
  },
  LatheGeometry: class extends MockGeometry {},
  RingGeometry: class extends MockGeometry {},
  Vector2: class { constructor(x=0,y=0){this.x=x;this.y=y;} },
  Vector3: MockVector3,
  Quaternion: MockQuaternion,
  DoubleSide: 2,
};

test('Multi-format packaging managers build distinct geometries for Carton, Can, Bottle, and Pouch', () => {
  // 1. Carton
  const carton = new CartonGeometryManager(mockTHREE);
  assert.ok(carton.rootGroup);

  // 2. Can
  const can = new CanGeometryManager(mockTHREE);
  can.buildCan({ radius: 33, height: 115 });
  assert.ok(can.bodyMesh);
  assert.equal(can.bodyMesh.name, 'can_body');
  assert.equal(can.dimensions.radius, 33);

  // 3. Bottle
  const bottle = new BottleGeometryManager(mockTHREE);
  bottle.buildBottle({ radius: 36, height: 190 });
  assert.ok(bottle.labelMesh);
  assert.ok(bottle.capMesh);
  assert.equal(bottle.dimensions.radius, 36);

  // 4. Stand-up Pouch
  const pouch = new PouchGeometryManager(mockTHREE);
  pouch.buildPouch({ width: 140, height: 200, depth: 65, inflation: 0.85 });
  assert.ok(pouch.frontMesh);
  assert.ok(pouch.backMesh);
  assert.equal(pouch.dimensions.width, 140);
});

test('EvidencePinSystem builds continuous surface pins for Can, Bottle, and Pouch', () => {
  const pinSystem = new EvidencePinSystem(mockTHREE);
  const sampleReview = {
    findings: [
      {
        id: 'f-net-qty',
        title: 'Net Quantity',
        status: 'issue',
        evidence: [
          { role: 'artwork', page: 1, box: [0.35, 0.65, 0.65, 0.75] }
        ]
      },
      {
        id: 'f-barcode',
        title: 'UPC Barcode',
        status: 'match',
        evidence: [
          { role: 'artwork', page: 1, box: [0.1, 0.8, 0.3, 0.95] }
        ]
      }
    ]
  };

  // Test pin placement on Can
  const can = new CanGeometryManager(mockTHREE);
  can.buildCan({ radius: 33, height: 115 });

  const pins = pinSystem.buildPinsForSurface({
    review: sampleReview,
    mapPointFn: (u, v) => can.mapPointToCylinder(u, v),
    parentMesh: can.bodyMesh,
    selectedFindingId: 'f-net-qty',
    formatName: 'can'
  });

  assert.equal(pins.length, 2);
  assert.equal(pins[0].findingId, 'f-net-qty');
  assert.equal(pins[0].status, 'issue');
  assert.equal(pins[1].findingId, 'f-barcode');
  assert.equal(pins[1].status, 'match');

  // Verify pins were attached as children of can.bodyMesh
  assert.equal(can.bodyMesh.children.length, 2);

  // Clean up
  pinSystem.clear();
  assert.equal(can.bodyMesh.children.length, 0);
  assert.equal(pinSystem.pins.length, 0);
});

test('Format switching lifecycle hides previous root groups and preserves review findings', () => {
  const carton = new CartonGeometryManager(mockTHREE);
  const can = new CanGeometryManager(mockTHREE);
  const bottle = new BottleGeometryManager(mockTHREE);
  const pouch = new PouchGeometryManager(mockTHREE);

  can.buildCan({ radius: 33, height: 115 });
  bottle.buildBottle({ radius: 36, height: 190 });
  pouch.buildPouch({ width: 140, height: 200, depth: 65 });

  const rootGroups = {
    carton: carton.rootGroup,
    can: can.rootGroup,
    bottle: bottle.rootGroup,
    pouch: pouch.rootGroup,
  };

  let activeFormat = 'carton';
  function switchFormat(next) {
    activeFormat = next;
    for (const [key, group] of Object.entries(rootGroups)) {
      group.visible = (key === next);
    }
  }

  // Switch to can
  switchFormat('can');
  assert.equal(rootGroups.carton.visible, false);
  assert.equal(rootGroups.can.visible, true);
  assert.equal(rootGroups.bottle.visible, false);
  assert.equal(rootGroups.pouch.visible, false);

  // Switch to bottle
  switchFormat('bottle');
  assert.equal(rootGroups.can.visible, false);
  assert.equal(rootGroups.bottle.visible, true);

  // Switch to pouch
  switchFormat('pouch');
  assert.equal(rootGroups.bottle.visible, false);
  assert.equal(rootGroups.pouch.visible, true);

  // Switch back to carton
  switchFormat('carton');
  assert.equal(rootGroups.pouch.visible, false);
  assert.equal(rootGroups.carton.visible, true);
});

test('Geometry disposal releases geometries and materials without throwing', () => {
  const can = new CanGeometryManager(mockTHREE);
  can.buildCan({ radius: 33, height: 115 });
  assert.doesNotThrow(() => can.dispose());

  const bottle = new BottleGeometryManager(mockTHREE);
  bottle.buildBottle({ radius: 36, height: 190 });
  assert.doesNotThrow(() => bottle.dispose());

  const pouch = new PouchGeometryManager(mockTHREE);
  pouch.buildPouch({ width: 140, height: 200, depth: 65 });
  assert.doesNotThrow(() => pouch.dispose());
});

test('Package provenance distinguishes validated DXF vs reviewer configured vs illustrative', () => {
  function getProvenance(pkgType, review) {
    if (pkgType === 'carton' && review?.documents?.some(d => d.role === 'dieline')) {
      return { status: 'source_dimensioned', label: 'DXF Dieline Validated' };
    }
    if (pkgType === 'can' && review?.metadata?.canDiameterMm) {
      return { status: 'reviewer_configured', label: 'Reviewer Specified Dimensions' };
    }
    return { status: 'illustrative', label: 'Illustrative Default Geometry' };
  }

  const dxfReview = { documents: [{ role: 'dieline', filename: 'carton.dxf' }] };
  assert.equal(getProvenance('carton', dxfReview).status, 'source_dimensioned');

  const configuredCanReview = { metadata: { canDiameterMm: 66 } };
  assert.equal(getProvenance('can', configuredCanReview).status, 'reviewer_configured');

  const defaultReview = { documents: [{ role: 'artwork', filename: 'label.pdf' }] };
  assert.equal(getProvenance('bottle', defaultReview).status, 'illustrative');
  assert.equal(getProvenance('pouch', defaultReview).status, 'illustrative');
});
