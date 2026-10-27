/**
 * PackSignal 3D Carton Fold Animation Engine
 * (public/carton-fold-animation.js)
 *
 * Implements Phase 7A Phase 6 & Phase 7:
 * - Real hinge-driven fold animation
 * - 0% (flat dieline) to 100% (closed rectangular carton)
 * - Interactive controls: [Fold to 3D], [Unfold], [Play], [Pause], [Reset], [Fold: 0–100%]
 * - Scrubbable slider support
 * - prefers-reduced-motion support
 * - Event callbacks for UI synchronization
 */

import { buildHingeTree, calculateFoldTransforms, Mat4 } from './three/fold-engine.js';

export class CartonFoldAnimationController {
  constructor({
    dimensions = { width: 142.88, height: 160.16, depth: 77.61 },
    durationMs = 1500,
    onProgress = null,
    onStateChange = null,
    onComplete = null,
    reducedMotion = false,
  } = {}) {
    this.dimensions = dimensions;
    this.durationMs = durationMs;
    this.onProgress = onProgress;
    this.onStateChange = onStateChange;
    this.onComplete = onComplete;
    this.reducedMotion = reducedMotion || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

    this.hingeTree = buildHingeTree({ dimensions: this.dimensions });
    this.progress = 0.0; // 0.0 = Flat, 1.0 = Closed Box
    this.targetProgress = 0.0;
    this.isPlaying = false;
    this.animationFrameId = null;
    this.startTime = null;
    this.startProgress = 0.0;
  }

  /**
   * Set fold progress directly (e.g. from scrubber slider 0 - 100).
   */
  setProgress(normalizedProgress) {
    this.pause();
    this.progress = Math.max(0, Math.min(1, Number(normalizedProgress) || 0));
    this.notifyProgress();
  }

  /**
   * Fold carton to 100% closed 3D state.
   */
  foldTo3D() {
    this.animateTo(1.0);
  }

  /**
   * Unfold carton to 0% flat dieline state.
   */
  unfold() {
    this.animateTo(0.0);
  }

  /**
   * Toggle between flat and folded.
   */
  toggle() {
    if (this.progress > 0.5) {
      this.unfold();
    } else {
      this.foldTo3D();
    }
  }

  /**
   * Reset carton to initial flat state.
   */
  reset() {
    this.pause();
    this.progress = 0.0;
    this.notifyProgress();
  }

  /**
   * Animate smoothly from current progress to targetProgress.
   */
  animateTo(target) {
    this.targetProgress = Math.max(0, Math.min(1, target));

    if (this.reducedMotion) {
      this.progress = this.targetProgress;
      this.notifyProgress();
      if (this.onComplete) this.onComplete(this.progress);
      return;
    }

    if (Math.abs(this.progress - this.targetProgress) < 1e-4) {
      return;
    }

    this.isPlaying = true;
    this.startProgress = this.progress;
    this.startTime = performance.now();
    if (this.onStateChange) this.onStateChange({ isPlaying: true, targetProgress: this.targetProgress });

    this.tick();
  }

  tick() {
    if (!this.isPlaying) return;

    this.animationFrameId = requestAnimationFrame((timestamp) => {
      const elapsed = timestamp - this.startTime;
      const t = Math.min(1.0, elapsed / this.durationMs);

      // Smooth cubic easeInOut curve
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.progress = this.startProgress + (this.targetProgress - this.startProgress) * eased;

      this.notifyProgress();

      if (t >= 1.0) {
        this.progress = this.targetProgress;
        this.isPlaying = false;
        this.notifyProgress();
        if (this.onStateChange) this.onStateChange({ isPlaying: false, progress: this.progress });
        if (this.onComplete) this.onComplete(this.progress);
      } else {
        this.tick();
      }
    });
  }

  pause() {
    if (this.isPlaying) {
      this.isPlaying = false;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      if (this.onStateChange) this.onStateChange({ isPlaying: false, progress: this.progress });
    }
  }

  play() {
    if (!this.isPlaying) {
      const nextTarget = this.progress >= 0.99 ? 0.0 : 1.0;
      this.animateTo(nextTarget);
    }
  }

  notifyProgress() {
    const transforms = calculateFoldTransforms(this.hingeTree, this.progress);
    if (this.onProgress) {
      this.onProgress({
        progress: this.progress,
        percent: Math.round(this.progress * 100),
        transforms,
        isFlat: this.progress <= 0.001,
        isClosed: this.progress >= 0.999,
      });
    }
  }

  getCurrentTransforms() {
    return calculateFoldTransforms(this.hingeTree, this.progress);
  }
}
