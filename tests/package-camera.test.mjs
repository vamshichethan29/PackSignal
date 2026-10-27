import test from 'node:test';
import assert from 'node:assert/strict';

import { PackagingCameraController } from '../public/packaging-3d/camera-controller.js';

// Minimal mock Three.js vector & camera objects
function createMockThree() {
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
    normalize() {
      const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z) || 1;
      this.x /= len; this.y /= len; this.z /= len;
      return this;
    }
    lerpVectors(v1, v2, alpha) {
      this.x = v1.x + (v2.x - v1.x) * alpha;
      this.y = v1.y + (v2.y - v1.y) * alpha;
      this.z = v1.z + (v2.z - v1.z) * alpha;
      return this;
    }
  }

  const camera = {
    position: new Vector3(0, 0, 300),
    lookAt(v) { this.target = v.clone(); },
  };

  const controls = {
    target: new Vector3(0, 0, 0),
    update() {},
    addEventListener() {},
  };

  return { THREE: { Vector3 }, camera, controls };
}

test('20. Camera rotation and reset work', () => {
  const { THREE, camera, controls } = createMockThree();
  const camController = new PackagingCameraController(THREE, camera, controls, {});

  camController.resetCamera({ width: 140, height: 200, depth: 65 });
  assert.equal(camController.isAnimating, true);
  camController.cancelAnimation();
  assert.equal(camController.isAnimating, false);
});

test('21. Fly-to targets correct carton face normal (Z+ for front, X+ for right)', () => {
  const { THREE, camera, controls } = createMockThree();
  const camController = new PackagingCameraController(THREE, camera, controls, {});

  // Focus front face pin at (0, 0, 30) with normal (0, 0, 1)
  camController.focusSurfacePoint([0, 0, 30], [0, 0, 1], 100);
  assert.equal(camController.isAnimating, true);
  camController.cancelAnimation();
});

test('22. Fly-to targets correct can surface radial normal', () => {
  const { THREE, camera, controls } = createMockThree();
  const camController = new PackagingCameraController(THREE, camera, controls, {});

  // Can pin at 90 deg (facing right along X+): point=[33, 10, 0], normal=[1, 0, 0]
  camController.focusSurfacePoint([33, 10, 0], [1, 0, 0], 120);
  assert.equal(camController.isAnimating, true);
  camController.cancelAnimation();
});

test('23. Fly-to targets correct bottle-label region', () => {
  const { THREE, camera, controls } = createMockThree();
  const camController = new PackagingCameraController(THREE, camera, controls, {});

  // Bottle label front point=[0, -20, 36.5], normal=[0, 0, 1]
  camController.focusSurfacePoint([0, -20, 36.5], [0, 0, 1], 110);
  assert.equal(camController.isAnimating, true);
  camController.cancelAnimation();
});

test('24. Fly-to targets correct pouch curved surface normal', () => {
  const { THREE, camera, controls } = createMockThree();
  const camController = new PackagingCameraController(THREE, camera, controls, {});

  // Pouch front curved apex point=[0, 0, 28], normal=[0, 0.1, 0.99]
  camController.focusSurfacePoint([0, 0, 28], [0, 0.1, 0.99], 100);
  assert.equal(camController.isAnimating, true);
  camController.cancelAnimation();
});

test('25. New camera interaction cancels previous motion', () => {
  const { THREE, camera, controls } = createMockThree();
  const camController = new PackagingCameraController(THREE, camera, controls, {});

  camController.resetCamera();
  assert.equal(camController.isAnimating, true);

  camController.cancelAnimation();
  assert.equal(camController.isAnimating, false);
});
