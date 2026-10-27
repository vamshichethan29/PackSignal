/**
 * PackSignal — Carton Camera & Fly-To Controller
 * Smoothly coordinates package rotation and tilt into perpendicular front-on face views.
 * Handles shortest-path angular wraparound, cubic easing, cancellation, and continuity.
 */

export const FACE_TARGET_POSES = {
  front: { angle: 0, tilt: -8 },
  back: { angle: 180, tilt: -8 },
  right: { angle: -90, tilt: -8 },
  left: { angle: 90, tilt: -8 },
  top: { angle: 0, tilt: -78 },
  bottom: { angle: 0, tilt: 78 },
};

/**
 * Normalizes an angle into the [-180, 180] range.
 */
export function wrapAngle(value) {
  return ((Number(value) + 180) % 360 + 360) % 360 - 180;
}

/**
 * Calculates the shortest signed angular difference from current to target angle.
 * Prevents unnecessary 350-degree spins across the +/- 180 boundary.
 */
export function shortestAngleDelta(current, target) {
  return wrapAngle(target - current);
}

/**
 * Standard cubic easeInOut curve for natural inspection movement.
 */
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Easing out cubic for brisk responsive motion.
 */
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export class CartonCameraController {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.scene - Carton scene element
   * @param {HTMLElement} options.model - Carton model element
   * @param {Function} options.onPoseChange - Callback with (angle, tilt, isComplete)
   * @param {Function} [options.syncControls] - Callback to sync UI controls
   */
  constructor({ scene, model, onPoseChange, syncControls }) {
    this.scene = scene;
    this.model = model;
    this.onPoseChange = onPoseChange;
    this.syncControls = syncControls;

    this.activeAnimation = null;
    this.isAnimating = false;

    this.raf = (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
      ? (cb => window.requestAnimationFrame(cb))
      : (typeof requestAnimationFrame === 'function'
        ? (cb => requestAnimationFrame(cb))
        : (cb => setTimeout(() => cb(Date.now()), 16)));

    this.caf = (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function')
      ? (id => window.cancelAnimationFrame(id))
      : (typeof cancelAnimationFrame === 'function'
        ? (id => cancelAnimationFrame(id))
        : (id => clearTimeout(id)));

    this.reducedMotion = typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  }

  /**
   * Cancel any active fly-to animation cleanly.
   */
  cancel() {
    if (this.activeAnimation) {
      this.caf(this.activeAnimation.frameId);
      this.activeAnimation = null;
    }
    this.isAnimating = false;
  }

  /**
   * Smoothly animates carton pose to face a carton panel squarely.
   *
   * @param {Object} params
   * @param {string} params.faceId - 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'
   * @param {number} [params.duration=650] - Animation duration in ms
   * @param {Function} [params.onComplete] - Callback once animation finishes
   * @param {boolean} [params.immediate=false] - Skip animation and snap directly
   * @returns {Promise<void>}
   */
  flyToFace({ faceId, duration = 650, onComplete, immediate = false }) {
    const targetPose = FACE_TARGET_POSES[faceId] || FACE_TARGET_POSES.front;

    const currentAngle = Number(this.scene?.dataset?.angle) || 0;
    const currentTilt = Number(this.scene?.dataset?.tilt) || -8;

    // Shortest path angle wraparound
    const deltaAngle = shortestAngleDelta(currentAngle, targetPose.angle);
    const finalAngle = currentAngle + deltaAngle;
    const finalTilt = targetPose.tilt;

    if (this.reducedMotion || immediate || duration <= 0) {
      this.cancel();
      this.applyPose(wrapAngle(finalAngle), finalTilt, true);
      onComplete?.();
      return Promise.resolve();
    }

    return new Promise(resolve => {
      this.cancel();
      this.isAnimating = true;

      const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const startAngle = currentAngle;
      const startTilt = currentTilt;

      const tick = now => {
        if (!this.isAnimating) {
          resolve();
          return;
        }

        const elapsed = Math.max(0, now - startTime);
        const progress = Math.min(1, elapsed / duration);
        const eased = easeInOutCubic(progress);

        const curA = startAngle + (finalAngle - startAngle) * eased;
        const curT = startTilt + (finalTilt - startTilt) * eased;

        const isLast = progress >= 1;
        this.applyPose(wrapAngle(curA), curT, isLast);

        if (!isLast) {
          this.activeAnimation.frameId = this.raf(tick);
        } else {
          this.isAnimating = false;
          this.activeAnimation = null;
          onComplete?.();
          resolve();
        }
      };

      this.activeAnimation = {
        frameId: this.raf(tick),
      };
    });
  }

  /**
   * Fly to a specific finding and its associated face.
   *
   * @param {Object} pin - Pin record containing panelId and normalized point
   * @param {Object} [options]
   */
  flyToFinding(pin, options = {}) {
    if (!pin) return Promise.resolve();
    const faceId = pin.panelId || 'front';
    return this.flyToFace({
      faceId,
      duration: options.duration || 650,
      onComplete: () => {
        options.onComplete?.(pin);
      },
    });
  }

  /**
   * Applies the pose directly to the DOM model and notifies observers.
   */
  applyPose(angle, tilt, isFinal = false) {
    const wrapped = wrapAngle(angle);
    if (this.scene) {
      this.scene.dataset.angle = String(wrapped);
      this.scene.dataset.tilt = String(tilt);
    }

    if (this.model) {
      this.model.style.transform = `rotateX(${tilt}deg) rotateY(${wrapped}deg)`;
    }

    this.onPoseChange?.(wrapped, tilt, isFinal);
    if (isFinal) {
      this.syncControls?.(wrapped, tilt);
    }
  }
}
