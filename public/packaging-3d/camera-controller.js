/**
 * PackSignal 3D Packaging Studio — Camera Kinematics & Curved Surface Fly-To
 * (public/packaging-3d/camera-controller.js)
 */

export class PackagingCameraController {
  constructor(THREE, camera, controls, domElement) {
    this.THREE = THREE;
    this.camera = camera;
    this.controls = controls;
    this.domElement = domElement;

    this.isAnimating = false;
    this.animationId = null;
    this.turntableActive = false;
    this.turntableSpeed = 0.008;

    this.defaultDistance = 280;
    this.defaultTarget = new this.THREE.Vector3(0, 0, 0);

    // Cancel animation on user manual interaction
    if (this.controls) {
      this.controls.addEventListener('start', () => {
        this.cancelAnimation();
        this.stopTurntable();
      });
    }
  }

  cancelAnimation() {
    this.isAnimating = false;
    if (this.animationId) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.animationId);
      } else {
        clearTimeout(this.animationId);
      }
      this.animationId = null;
    }
  }

  resetCamera(dimensions = { width: 140, height: 200, depth: 65 }) {
    this.cancelAnimation();
    this.stopTurntable();

    const maxDim = Math.max(dimensions.width || 140, dimensions.height || 200, dimensions.depth || 65);
    const dist = maxDim * 1.8;

    const targetPos = new this.THREE.Vector3(0, 15, dist);
    const targetLook = new this.THREE.Vector3(0, 0, 0);

    this.animateTo(targetPos, targetLook, 600);
  }

  setPresetView(view = 'front', dimensions = { width: 140, height: 200, depth: 65 }) {
    this.cancelAnimation();
    this.stopTurntable();

    const maxDim = Math.max(dimensions.width || 140, dimensions.height || 200, dimensions.depth || 65);
    const dist = maxDim * 1.7;

    let targetPos;
    switch (view) {
      case 'back':
        targetPos = new this.THREE.Vector3(0, 5, -dist);
        break;
      case 'left':
        targetPos = new this.THREE.Vector3(-dist, 5, 0);
        break;
      case 'right':
        targetPos = new this.THREE.Vector3(dist, 5, 0);
        break;
      case 'top':
        targetPos = new this.THREE.Vector3(0, dist, 10);
        break;
      case 'front':
      default:
        targetPos = new this.THREE.Vector3(0, 5, dist);
        break;
    }

    this.animateTo(targetPos, new this.THREE.Vector3(0, 0, 0), 500);
  }

  /**
   * Fly-to on curved packaging surfaces.
   * Calculates local surface normal to ensure the finding region is clearly framed.
   */
  focusSurfacePoint(point, normal = [0, 0, 1], distance = 110) {
    this.cancelAnimation();
    this.stopTurntable();

    const [px, py, pz] = point;
    const [nx, ny, nz] = normal;

    const normalVec = new this.THREE.Vector3(nx, ny, nz).normalize();
    const surfaceTarget = new this.THREE.Vector3(px, py, pz);

    // Position camera along the local surface normal
    const cameraPos = surfaceTarget.clone().add(normalVec.clone().multiplyScalar(distance));

    // Slight vertical eye offset for pleasant framing
    cameraPos.y += 10;

    this.animateTo(cameraPos, surfaceTarget, 750);
  }

  toggleTurntable() {
    this.turntableActive = !this.turntableActive;
    return this.turntableActive;
  }

  stopTurntable() {
    this.turntableActive = false;
  }

  update() {
    if (this.turntableActive && this.controls) {
      // Rotate camera around target Y-axis
      const offset = this.camera.position.clone().sub(this.controls.target);
      const angle = this.turntableSpeed;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const newX = offset.x * cosA - offset.z * sinA;
      const newZ = offset.x * sinA + offset.z * cosA;

      this.camera.position.x = this.controls.target.x + newX;
      this.camera.position.z = this.controls.target.z + newZ;
      this.camera.lookAt(this.controls.target);
    }
  }

  animateTo(targetPos, targetLookAt, durationMs = 600) {
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

    if (prefersReducedMotion) {
      this.camera.position.copy(targetPos);
      if (this.controls) {
        this.controls.target.copy(targetLookAt);
        this.controls.update();
      }
      this.camera.lookAt(targetLookAt);
      return;
    }

    this.isAnimating = true;
    const startPos = this.camera.position.clone();
    const startTarget = this.controls ? this.controls.target.clone() : new this.THREE.Vector3();
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const raf = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (cb) => setTimeout(cb, 16);

    const step = (now) => {
      if (!this.isAnimating) return;

      const elapsed = (now || (typeof performance !== 'undefined' ? performance.now() : Date.now())) - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(progress);

      this.camera.position.lerpVectors(startPos, targetPos, eased);

      if (this.controls) {
        this.controls.target.lerpVectors(startTarget, targetLookAt, eased);
        this.controls.update();
      } else {
        this.camera.lookAt(targetLookAt);
      }

      if (progress < 1) {
        this.animationId = raf(step);
      } else {
        this.isAnimating = false;
        this.animationId = null;
      }
    };

    this.animationId = raf(step);
  }

  dispose() {
    this.cancelAnimation();
    this.stopTurntable();
  }
}
