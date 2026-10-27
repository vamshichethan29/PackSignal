import test from 'node:test';
import assert from 'node:assert/strict';

// Mock Three.js primitives for pure node testing of geometry logic
class MockVector2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
}

class MockVector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  clone() { return new MockVector3(this.x, this.y, this.z); }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  normalize() {
    const l = Math.hypot(this.x, this.y, this.z) || 1;
    this.x /= l; this.y /= l; this.z /= l;
    return this;
  }
}

class MockGroup {
  constructor() {
    this.children = [];
    this.position = new MockVector3();
  }
  add(child) { this.children.push(child); child.parent = this; }
  remove(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
  }
}

class MockMesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.position = new MockVector3();
    this.rotation = new MockVector3();
    this.name = '';
    this.visible = true;
  }
  rotateY() {}
}

class MockColor {
  constructor(c = 0) {
    this.value = c;
  }
  setHex(h) { this.value = h; return this; }
}

class MockMaterial {
  constructor(opts = {}) {
    this.color = new MockColor(opts.color);
    this.map = opts.map !== undefined ? opts.map : {
      repeat: { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } },
      offset: { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } },
      needsUpdate: false,
    };
    for (const [k, v] of Object.entries(opts)) {
      if (k !== 'color') this[k] = v;
    }
  }
  dispose() {}
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
    constructor(w, h, segX = 1, segY = 1) {
      super();
      const count = (segX + 1) * (segY + 1);
      this.attributes.position = new MockAttribute(count, 3);
      this.attributes.uv = new MockAttribute(count, 2);
      // Fill positions
      let idx = 0;
      for (let y = 0; y <= segY; y++) {
        for (let x = 0; x <= segX; x++) {
          const px = -w / 2 + (x / segX) * w;
          const py = -h / 2 + (y / segY) * h;
          this.attributes.position.setX(idx, px);
          this.attributes.position.setY(idx, py);
          this.attributes.position.setZ(idx, 0);
          idx++;
        }
      }
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
  Vector2: MockVector2,
  Vector3: MockVector3,
  DoubleSide: 2,
};

import { CanGeometryManager } from '../../public/three/geometry/can.js';
import { BottleGeometryManager } from '../../public/three/geometry/bottle.js';
import { PouchGeometryManager } from '../../public/three/geometry/pouch.js';

test('CanGeometryManager constructs cylindrical body, chimes, and seam', () => {
  const can = new CanGeometryManager(mockTHREE);
  const result = can.buildCan({ radius: 33, height: 122 });

  assert.ok(result.rootGroup);
  assert.equal(result.dimensions.radius, 33);
  assert.equal(result.dimensions.height, 122);
  assert.ok(result.bodyMesh);
  assert.equal(result.bodyMesh.name, 'can_body');
  assert.ok(can.metalParts.length >= 4, 'Includes top rim, lid, pull tab, and base dome');
});

test('CanGeometryManager maps flat 2D [u, v] to cylindrical surface [x, y, z]', () => {
  const can = new CanGeometryManager(mockTHREE);
  can.buildCan({ radius: 30, height: 120 });

  // Center of artwork u=0.5 should map to front along +Z (x ~ 0, z > 0)
  const frontPt = can.mapPointToCylinder(0.5, 0.5);
  assert.ok(Math.abs(frontPt.point[0]) < 1e-4, 'Front x coordinate should be centered at 0');
  assert.ok(frontPt.point[2] > 29, 'Front z coordinate should be at radius ~ 30');
  assert.equal(frontPt.normal[2], 1, 'Front normal faces +Z');

  // Left side u=0.25 (angle -pi/2, along -X)
  const leftPt = can.mapPointToCylinder(0.25, 0.5);
  assert.ok(leftPt.point[0] < -29, 'Left x coordinate should be at -radius');
  assert.ok(Math.abs(leftPt.point[2]) < 1e-4, 'Left z coordinate should be near 0');

  // Top (v=0) vs bottom (v=1)
  const topPt = can.mapPointToCylinder(0.5, 0.0);
  const btmPt = can.mapPointToCylinder(0.5, 1.0);
  assert.ok(topPt.point[1] > btmPt.point[1], 'Top point Y must be strictly greater than bottom point Y');
});

test('BottleGeometryManager constructs lathed body profile and separate label cylinder', () => {
  const bottle = new BottleGeometryManager(mockTHREE);
  const result = bottle.buildBottle({ radius: 36, height: 190, bottleType: 'glass' });

  assert.ok(result.rootGroup);
  assert.equal(result.dimensions.radius, 36);
  assert.equal(result.dimensions.height, 190);
  assert.ok(result.bodyMesh);
  assert.ok(result.labelMesh);
  assert.ok(result.capMesh);
});

test('BottleGeometryManager maps label [u, v] to bottle label surface correctly', () => {
  const bottle = new BottleGeometryManager(mockTHREE);
  bottle.buildBottle({ radius: 36, height: 190 });

  const centerPt = bottle.mapPointToBottle(0.5, 0.5);
  assert.ok(Math.abs(centerPt.point[0]) < 1e-4, 'Center label point X should be 0');
  assert.ok(centerPt.point[2] > 36, 'Center label point Z should be slightly outside glass radius');
  assert.equal(centerPt.normal[2], 1, 'Center label normal faces +Z');
});

test('PouchGeometryManager constructs front, back, and heat seal borders', () => {
  const pouch = new PouchGeometryManager(mockTHREE);
  const result = pouch.buildPouch({ width: 140, height: 200, depth: 60, inflation: 0.8 });

  assert.ok(result.rootGroup);
  assert.equal(result.dimensions.width, 140);
  assert.equal(result.dimensions.height, 200);
  assert.ok(result.frontMesh);
  assert.ok(result.backMesh);
  assert.ok(pouch.sealMeshes.length >= 3, 'Top and side heat seal flanges created');
});

test('PouchGeometryManager inflates and maps surface points with proper convexity', () => {
  const pouch = new PouchGeometryManager(mockTHREE);
  pouch.buildPouch({ width: 140, height: 200, depth: 60, inflation: 1.0 });

  const frontCenter = pouch.mapPointToPouch(0.5, 0.5, 'front');
  const backCenter = pouch.mapPointToPouch(0.5, 0.5, 'back');

  assert.ok(frontCenter.point[2] > 0, 'Front pouch surface protrudes forward (+Z)');
  assert.ok(backCenter.point[2] < 0, 'Back pouch surface protrudes backward (-Z)');

  // Change inflation to 0.0 (flat)
  pouch.setInflation(0.0);
  const flatFront = pouch.mapPointToPouch(0.5, 0.5, 'front');
  assert.ok(Math.abs(flatFront.point[2] - 0.6) < 1e-4, 'Flat pouch has only surface offset');
});

test('CanGeometryManager adjusts seam angle, toggles seam highlight, and changes wrap mode', () => {
  const can = new CanGeometryManager(mockTHREE);
  const mockTex = {
    repeat: { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } },
    offset: { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } },
    needsUpdate: false,
  };
  can.buildCan({ radius: 33, height: 122, labelTexture: mockTex });

  assert.equal(can.seamAngleDeg, 0);
  can.setSeamAngle(90);
  assert.equal(can.seamAngleDeg, 90);
  assert.ok(Math.abs(can.bodyMesh.rotation.y - Math.PI / 2) < 1e-4);

  // Toggle seam highlight
  const isHighlighted = can.toggleSeamHighlight(true);
  assert.equal(isHighlighted, true);
  assert.equal(can.seamMesh.visible, true);

  // Wrap mode
  can.setWrapMode('partial');
  assert.equal(can.wrapMode, 'partial');
  assert.equal(can.bodyMesh.material.map.repeat.x, 0.5);

  can.setWrapMode('full');
  assert.equal(can.wrapMode, 'full');
  assert.equal(can.bodyMesh.material.map.repeat.x, 1);
});

test('BottleGeometryManager supports substrate switching and label placement modes', () => {
  const bottle = new BottleGeometryManager(mockTHREE);
  const mockTex = {
    repeat: { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } },
    offset: { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } },
    needsUpdate: false,
  };
  bottle.buildBottle({ radius: 36, height: 190, labelTexture: mockTex });

  bottle.setBottleSubstrate('amber');
  assert.equal(bottle.bottleType, 'amber');
  assert.equal(bottle.bodyMesh.material.color.value, 0x8b4513);

  bottle.setBottleSubstrate('plastic');
  assert.equal(bottle.bottleType, 'plastic');
  assert.equal(bottle.bodyMesh.material.color.value, 0xf3f4f6);

  bottle.setBottleSubstrate('glass');
  assert.equal(bottle.bottleType, 'glass');

  // Label placement
  bottle.setLabelPlacement('front');
  assert.equal(bottle.labelMesh.material.map.repeat.x, 0.5);

  bottle.setLabelPlacement('wrap');
  assert.equal(bottle.labelMesh.material.map.repeat.x, 1);
});

test('PouchGeometryManager toggles bottom gusset and heat seal flanges', () => {
  const pouch = new PouchGeometryManager(mockTHREE);
  pouch.buildPouch({ width: 140, height: 200, depth: 60, inflation: 0.8 });

  assert.ok(pouch.bottomGussetMesh);
  assert.equal(pouch.bottomGussetMesh.visible, true);

  pouch.toggleGusset(false);
  assert.equal(pouch.bottomGussetMesh.visible, false);

  pouch.toggleGusset(true);
  assert.equal(pouch.bottomGussetMesh.visible, true);

  // Seals
  pouch.toggleSeals(false);
  assert.ok(pouch.sealMeshes.every(m => m.visible === false));

  pouch.toggleSeals(true);
  assert.ok(pouch.sealMeshes.every(m => m.visible === true));
});
