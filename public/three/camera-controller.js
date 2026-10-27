/**
 * PackSignal 3D Camera Controller
 * Manages OrbitControls and smooth camera fly-to animations
 * for carton panels, defect pins, flat dielines, and isometric resets.
 */

export class CameraController {
  constructor(THREE, camera, controls, domElement) {
    this.THREE = THREE;
    this.camera = camera;
    this.controls = controls;
    this.domElement = domElement;

    this.animating = false;
    this.tween = null;

    // Default 3/4 packaging perspective angles
    this.defaultState = {
      position: new this.THREE.Vector3(0, 40, 220),
      target: new this.THREE.Vector3(0, 0, 0),
    };

    // User drag interruption detection
    this.controls.addEventListener('start', () => {
      this.cancelAnimation();
    });

    this.reducedMotion = typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  }

  /**
   * Smoothly animates camera position and OrbitControls target using cubic easing.
   */
  animateTo({ targetPos, targetLookAt, duration = 600 }) {
    if (this.reducedMotion || duration <= 0) {
      this.camera.position.copy(targetPos);
      this.controls.target.copy(targetLookAt);
      this.controls.update();
      this.cancelAnimation();
      return;
    }

    this.cancelAnimation();
    this.animating = true;

    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const startTime = performance.now();

    const tick = (now) => {
      if (!this.animating) return;

      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);

      this.camera.position.lerpVectors(startPos, targetPos, eased);
      this.controls.target.lerpVectors(startTarget, targetLookAt, eased);
      this.controls.update();

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        this.animating = false;
      }
    };

    requestAnimationFrame(tick);
  }

  cancelAnimation() {
    this.animating = false;
  }

  /**
   * Reset camera to default perspective inspection angle.
   */
  resetCamera(dimensions = { width: 50, height: 100, depth: 30 }) {
    const maxDim = Math.max(dimensions.width, dimensions.height, dimensions.depth);
    const dist = maxDim * 2.4;

    const targetPos = new this.THREE.Vector3(-dist * 0.45, dist * 0.35, dist * 0.85);
    const targetLookAt = new this.THREE.Vector3(0, 0, 0);

    this.animateTo({ targetPos, targetLookAt, duration: 500 });
  }

  /**
   * Focus flat dieline from front perspective (t = 0%).
   */
  focusFlatDieline(flatWidth = 200, flatHeight = 150) {
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const distY = (flatHeight / 2) / Math.tan(fovRad / 2);
    const distX = (flatWidth / 2) / (Math.tan(fovRad / 2) * this.camera.aspect);
    const dist = Math.max(distX, distY) * 1.25;

    const targetPos = new this.THREE.Vector3(0, 0, dist);
    const targetLookAt = new this.THREE.Vector3(0, 0, 0);

    this.animateTo({ targetPos, targetLookAt, duration: 600 });
  }

  /**
   * Fly camera to face a carton panel squarely along its outward normal.
   *
   * @param {THREE.Mesh} panelMesh
   * @param {Object} options
   * @param {number} [options.panelWidth=50]
   * @param {number} [options.panelHeight=100]
   * @param {THREE.Vector3} [options.localPoint] - Specific target point on the panel
   */
  flyToPanel(panelMesh, { panelWidth = 50, panelHeight = 100, localPoint = null } = {}) {
    if (!panelMesh) return;

    panelMesh.updateMatrixWorld(true);

    // Compute panel world center (or specific local point)
    const targetWorld = new this.THREE.Vector3();
    if (localPoint) {
      targetWorld.copy(localPoint);
      panelMesh.localToWorld(targetWorld);
    } else {
      panelMesh.getWorldPosition(targetWorld);
    }

    // Outward face normal in world coordinates
    const normal = new this.THREE.Vector3(0, 0, 1);
    normal.transformDirection(panelMesh.matrixWorld).normalize();

    // Calculate framing distance based on panel size and FOV
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const panelSize = Math.max(panelWidth, panelHeight);
    const dist = Math.max(60, (panelSize / 2) / Math.tan(fovRad / 2) * 1.55);

    const targetPos = targetWorld.clone().addScaledVector(normal, dist);

    this.animateTo({ targetPos, targetLookAt: targetWorld, duration: 550 });
  }

  /**
   * Fly camera to a specific 3D evidence pin.
   */
  flyToPin(pinData, panelDims) {
    if (!pinData?.panelMesh) return;
    const width = panelDims?.width || 50;
    const height = panelDims?.height || 100;

    if (pinData.normal && pinData.localPoint) {
      pinData.panelMesh.updateMatrixWorld(true);
      const targetWorld = new this.THREE.Vector3(...pinData.localPoint);
      pinData.panelMesh.localToWorld(targetWorld);

      const normal = new this.THREE.Vector3(...pinData.normal);
      normal.transformDirection(pinData.panelMesh.matrixWorld).normalize();

      const dist = 120;
      const targetPos = targetWorld.clone().addScaledVector(normal, dist);
      this.animateTo({ targetPos, targetLookAt: targetWorld, duration: 550 });
      return;
    }

    const localPt = pinData.localPoint ? new this.THREE.Vector3(...pinData.localPoint) : null;
    this.flyToPanel(pinData.panelMesh, { panelWidth: width, panelHeight: height, localPoint: localPt });
  }
}
