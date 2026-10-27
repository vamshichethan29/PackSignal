/**
 * PackSignal 3D Carton Camera Navigation & Fly-To Controller
 * (public/carton-camera-navigation.js)
 *
 * Implements Phase 7A Phase 16:
 * - Smooth camera fly-to when clicking a 3D finding pin
 * - Dynamic outward face normal calculation at any fold state
 * - Avoids interior carton clipping
 * - Controls: [Back to Full Package], [Next Finding], [Previous Finding]
 */

import { calculatePanelNormal, calculateFoldTransforms } from './three/fold-engine.js';

export class CartonCameraNavigationController {
  constructor({
    camera = null,
    controls = null,
    hingeTree = null,
    onFindingSelected = null,
    defaultDistance = 380,
    findingFocusDistance = 220,
  } = {}) {
    this.camera = camera;
    this.controls = controls;
    this.hingeTree = hingeTree;
    this.onFindingSelected = onFindingSelected;
    this.defaultDistance = defaultDistance;
    this.findingFocusDistance = findingFocusDistance;

    this.isFlying = false;
    this.activeFindingId = null;
    this.findingList = [];
    this.currentIndex = -1;

    // Default isometric package overview pose
    this.overviewPose = {
      position: [240, 180, 320],
      target: [0, 0, 0],
    };
  }

  setFindingList(findings = []) {
    this.findingList = Array.isArray(findings) ? findings : [];
    this.currentIndex = -1;
  }

  /**
   * Fly camera to perpendicular view of a specific finding pin on its carton face.
   */
  async flyToFinding(finding, foldProgress = 1.0, durationMs = 800) {
    if (!finding) return;

    this.activeFindingId = finding.id;
    this.currentIndex = this.findingList.findIndex(f => f.id === finding.id);

    const face = finding.panel || 'front';
    const normal = this.hingeTree
      ? calculatePanelNormal(face, foldProgress, this.hingeTree)
      : [0, 0, 1];

    // Compute pin world position if transforms available
    let targetPoint = [0, 0, 0];
    if (this.hingeTree) {
      const transforms = calculateFoldTransforms(this.hingeTree, foldProgress);
      const faceMat = transforms[face];
      if (faceMat) {
        // Local pin coordinates on face
        const width = this.hingeTree.dimensions?.width || 142.88;
        const height = this.hingeTree.dimensions?.height || 160.16;
        const lx = ((finding.x ?? 0.5) - 0.5) * width;
        const ly = (0.5 - (finding.y ?? 0.5)) * height;
        const lz = 2.0; // Surface offset
        targetPoint = faceMat.transformPoint([lx, ly, lz]);
      }
    }

    // Camera destination = targetPoint + normal * distance
    const dist = this.findingFocusDistance;
    const destPosition = [
      targetPoint[0] + normal[0] * dist,
      targetPoint[1] + normal[1] * dist,
      targetPoint[2] + normal[2] * dist,
    ];

    await this.animateCamera(destPosition, targetPoint, durationMs);

    if (this.onFindingSelected) {
      this.onFindingSelected(finding);
    }
  }

  /**
   * Return camera to standard full package isometric view.
   */
  async backToFullPackage(durationMs = 800) {
    this.activeFindingId = null;
    await this.animateCamera(this.overviewPose.position, this.overviewPose.target, durationMs);
  }

  /**
   * Navigate to next finding in the registered list.
   */
  async nextFinding(foldProgress = 1.0) {
    if (this.findingList.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.findingList.length;
    await this.flyToFinding(this.findingList[this.currentIndex], foldProgress);
  }

  /**
   * Navigate to previous finding in the registered list.
   */
  async previousFinding(foldProgress = 1.0) {
    if (this.findingList.length === 0) return;
    this.currentIndex = (this.currentIndex - 1 + this.findingList.length) % this.findingList.length;
    await this.flyToFinding(this.findingList[this.currentIndex], foldProgress);
  }

  /**
   * Interpolate camera position and controls target.
   */
  animateCamera(destPos, destTarget, durationMs = 800) {
    return new Promise((resolve) => {
      if (!this.camera) {
        resolve();
        return;
      }

      if (durationMs <= 0 || typeof requestAnimationFrame === 'undefined') {
        this.camera.position.x = destPos[0];
        this.camera.position.y = destPos[1];
        this.camera.position.z = destPos[2];
        if (this.controls) {
          this.controls.target.x = destTarget[0];
          this.controls.target.y = destTarget[1];
          this.controls.target.z = destTarget[2];
          this.controls.update();
        }
        resolve();
        return;
      }

      this.isFlying = true;
      const startPos = [this.camera.position.x, this.camera.position.y, this.camera.position.z];
      const startTarget = this.controls
        ? [this.controls.target.x, this.controls.target.y, this.controls.target.z]
        : [0, 0, 0];

      const startTime = performance.now();

      const tick = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(1.0, elapsed / durationMs);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // Quad easeInOut

        this.camera.position.x = startPos[0] + (destPos[0] - startPos[0]) * ease;
        this.camera.position.y = startPos[1] + (destPos[1] - startPos[1]) * ease;
        this.camera.position.z = startPos[2] + (destPos[2] - startPos[2]) * ease;

        if (this.controls) {
          this.controls.target.x = startTarget[0] + (destTarget[0] - startTarget[0]) * ease;
          this.controls.target.y = startTarget[1] + (destTarget[1] - startTarget[1]) * ease;
          this.controls.target.z = startTarget[2] + (destTarget[2] - startTarget[2]) * ease;
          this.controls.update();
        }

        if (t >= 1.0) {
          this.isFlying = false;
          resolve();
        } else {
          requestAnimationFrame(tick);
        }
      };

      requestAnimationFrame(tick);
    });
  }
}
