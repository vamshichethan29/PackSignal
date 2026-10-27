/**
 * PackSignal — Carton Pin 3D-to-Screen Projection & Occlusion
 * Computes exact screen-space coordinates and face visibility for finding pins.
 * Handles both CSS 3D transform perspective and WebGL camera projection.
 */

/**
 * Standard outward normals for rectangular carton faces in carton-local space.
 * Carton model center is (0, 0, 0).
 */
export const FACE_NORMALS = {
  front: [0, 0, 1],
  back: [0, 0, -1],
  right: [1, 0, 0],
  left: [-1, 0, 0],
  top: [0, -1, 0],     // Y points down in screen/DOM coordinates
  bottom: [0, 1, 0],
};

/**
 * Computes local 3D point [x, y, z] for a normalized (u, v) point on a given carton face.
 *
 * @param {string} panelId - 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'
 * @param {{ u: number, v: number }} panelPoint - Normalized point in [0, 1]
 * @param {{ width: number, height: number, depth: number }} dims - Carton dimensions in mm/px
 * @returns {[number, number, number]} [x, y, z]
 */
export function panelPointToLocal3D(panelId, panelPoint, dims) {
  const { width: W, height: H, depth: D } = dims;
  const hw = W / 2;
  const hh = H / 2;
  const hd = D / 2;
  const u = Math.max(0, Math.min(1, panelPoint?.u ?? 0.5));
  const v = Math.max(0, Math.min(1, panelPoint?.v ?? 0.5));

  switch (panelId) {
    case 'front':
      return [-hw + u * W, -hh + v * H, hd];
    case 'back':
      // Back panel is viewed from behind or folded: u goes right to left from the front viewpoint
      return [hw - u * W, -hh + v * H, -hd];
    case 'right':
      // Right panel: width corresponds to depth D
      return [hw, -hh + v * H, hd - u * D];
    case 'left':
      // Left panel: width corresponds to depth D
      return [-hw, -hh + v * H, -hd + u * D];
    case 'top':
      return [-hw + u * W, -hh, hd - v * D];
    case 'bottom':
      return [-hw + u * W, hh, -hd + v * D];
    default:
      return [-hw + u * W, -hh + v * H, hd];
  }
}

/**
 * Transforms a 3D vector [x, y, z] by carton pose: rotateX(tilt) then rotateY(angle).
 *
 * @param {[number, number, number]} vec - Vector [x, y, z]
 * @param {number} angleDeg - Yaw / rotation around Y in degrees
 * @param {number} tiltDeg - Pitch / rotation around X in degrees
 * @returns {[number, number, number]} Transformed vector [x', y', z']
 */
export function rotatePointByPose(vec, angleDeg, tiltDeg) {
  const [x, y, z] = vec;
  const radY = (angleDeg * Math.PI) / 180;
  const radX = (tiltDeg * Math.PI) / 180;

  const cosY = Math.cos(radY);
  const sinY = Math.sin(radY);
  const cosX = Math.cos(radX);
  const sinX = Math.sin(radX);

  // Rotate around Y by radY
  // x1 = x * cos(Y) + z * sin(Y)
  // y1 = y
  // z1 = -x * sin(Y) + z * cos(Y)
  const x1 = x * cosY + z * sinY;
  const y1 = y;
  const z1 = -x * sinY + z * cosY;

  // Rotate around X by radX
  // x2 = x1
  // y2 = y1 * cos(X) - z1 * sin(X)
  // z2 = y1 * sin(X) + z1 * cos(X)
  const x2 = x1;
  const y2 = y1 * cosX - z1 * sinX;
  const z2 = y1 * sinX + z1 * cosX;

  return [x2, y2, z2];
}

/**
 * Projects a single finding pin onto screen coordinates.
 *
 * @param {Object} params
 * @param {{ u: number, v: number }} params.panelPoint
 * @param {string} params.panelId
 * @param {{ width: number, height: number, depth: number }} [params.cartonDims]
 * @param {{ angle: number, tilt: number }} [params.cartonPose]
 * @param {{ width: number, height: number }} [params.sceneBounds]
 * @param {number} [params.perspective]
 * @param {Object} [params.webglCamera]
 * @param {Object} [params.webglMesh]
 * @returns {{ screenX: number, screenY: number, depth: number, visible: boolean, faceId: string, normalZ: number }}
 */
export function projectFindingToScreen({
  panelPoint,
  panelId,
  cartonDims = { width: 214, height: 282, depth: 64 },
  cartonPose = { angle: 0, tilt: 0 },
  sceneBounds = { width: 500, height: 385 },
  perspective = 900,
  webglCamera = null,
  webglMesh = null,
}) {
  // If Three.js WebGL mesh and camera are provided
  if (webglCamera && webglMesh && typeof webglMesh.localToWorld === 'function') {
    const THREE = webglCamera.constructor?.prototype ? globalThis.THREE : null;
    try {
      const local3d = panelPointToLocal3D(panelId, panelPoint, cartonDims);
      const worldPos = webglMesh.localToWorld(new webglCamera.constructor.Vector3(...local3d));
      const projected = worldPos.clone().project(webglCamera);

      const screenX = (projected.x * 0.5 + 0.5) * sceneBounds.width;
      const screenY = (-projected.y * 0.5 + 0.5) * sceneBounds.height;
      const depth = projected.z;

      // Normal dot camera direction
      const baseNormal = FACE_NORMALS[panelId] || [0, 0, 1];
      const worldNormal = new webglCamera.constructor.Vector3(...baseNormal)
        .transformDirection(webglMesh.matrixWorld)
        .normalize();
      const camDir = new webglCamera.constructor.Vector3();
      webglCamera.getWorldDirection(camDir);

      // Facing viewer if normal opposes camera direction (dot product < -0.05)
      const visible = worldNormal.dot(camDir) < -0.05 && depth < 1.0;

      return {
        screenX: Math.round(screenX * 10) / 10,
        screenY: Math.round(screenY * 10) / 10,
        depth,
        visible,
        faceId: panelId,
        normalZ: -worldNormal.dot(camDir),
      };
    } catch {
      // Fall through to CSS 3D projection if WebGL vector math fails
    }
  }

  // CSS 3D Perspective Projection
  const localPt = panelPointToLocal3D(panelId, panelPoint, cartonDims);
  const rotatedPt = rotatePointByPose(localPt, cartonPose.angle, cartonPose.tilt);

  // Compute rotated face normal to evaluate occlusion/visibility
  const baseNormal = FACE_NORMALS[panelId] || [0, 0, 1];
  const rotatedNormal = rotatePointByPose(baseNormal, cartonPose.angle, cartonPose.tilt);
  const normalZ = rotatedNormal[2];

  // A face is visible when its normal points toward the viewer (+Z direction in standard CSS 3D).
  // Conservative threshold (0.05) avoids clipping at glancing angles while hiding back faces cleanly.
  const visible = normalZ > 0.05;

  // Perspective projection formula
  const d = Math.max(100, perspective);
  const z = rotatedPt[2];
  // Distance from perspective eye: (d - z)
  const factor = d / Math.max(10, d - z);

  const centerX = sceneBounds.width * 0.5;
  const centerY = sceneBounds.height * 0.45; // Perspective origin is typically 50% 45%

  const screenX = centerX + rotatedPt[0] * factor;
  const screenY = centerY + rotatedPt[1] * factor;

  return {
    screenX: Math.round(screenX * 10) / 10,
    screenY: Math.round(screenY * 10) / 10,
    depth: Math.round(z * 10) / 10,
    visible,
    faceId: panelId,
    normalZ: Math.round(normalZ * 100) / 100,
  };
}

/**
 * Projects an array of finding pins to screen-space coordinates.
 *
 * @param {Array<Object>} pins - Canonical finding pin records
 * @param {Object} context - Projection context (pose, dims, bounds, etc.)
 * @returns {Array<Object>} Array of pins with projection properties { screenX, screenY, depth, visible }
 */
export function projectFindingPins(pins, context = {}) {
  if (!Array.isArray(pins)) return [];

  return pins.map(pin => {
    const projection = projectFindingToScreen({
      panelPoint: pin.normalizedPanelPoint || { u: 0.5, v: 0.5 },
      panelId: pin.panelId || 'front',
      cartonDims: context.cartonDims,
      cartonPose: context.cartonPose,
      sceneBounds: context.sceneBounds,
      perspective: context.perspective,
      webglCamera: context.webglCamera,
      webglMesh: context.webglMesh,
    });

    return {
      ...pin,
      projection,
      screenX: projection.screenX,
      screenY: projection.screenY,
      depth: projection.depth,
      visible: projection.visible,
    };
  });
}
