/**
 * PackSignal 3D Packaging Studio (public/three/studio.js)
 * Unified module entry point for multi-format 3D packaging visualization,
 * physical materials, real artwork texture mapping, defect pin projection,
 * and camera kinematics.
 */

export { PackagingViewerController, isWebGLAvailable } from './viewer-controller.js';
export { CartonGeometryManager } from './carton-geometry.js';
export { CanGeometryManager } from './geometry/can.js';
export { BottleGeometryManager } from './geometry/bottle.js';
export { PouchGeometryManager, StandupPouchGeometryManager } from './geometry/standup-pouch.js';
export { TextureManager } from './texture-manager.js';
export { EvidencePinSystem, PIN_COLORS } from './evidence-pins.js';
export { CameraController } from './camera-controller.js';
export {
  checkCircumferenceMatch,
  mapNormalizedToCylinder,
  mapCylinderToNormalized,
  mapNormalizedToPouch,
} from './coordinate-mapper.js';
export { SUBSTRATES, FINISHES, FinishingEffectsManager } from './materials/finishes.js';
