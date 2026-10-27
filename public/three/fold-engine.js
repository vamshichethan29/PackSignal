/**
 * PackSignal 3D Carton Folding Kinematics Engine
 * Pure mathematical forward-kinematics tree for rectangular folding cartons.
 * Supports:
 *  - 0% flat dieline layout
 *  - Continuous 0% -> 100% interpolated folding around physical crease axes
 *  - 100% closed rectangular carton shell
 *  - Panel world transforms & normal calculations
 *  - Local-to-world evidence coordinate mapping
 *  - Validation of geometry and crease connectivity
 */

export const CARTON_FACES = ['front', 'back', 'left', 'right', 'top', 'bottom'];

export const FACE_TITLES = {
  front: 'Front Panel',
  back: 'Back Panel',
  left: 'Left Side Panel',
  right: 'Right Side Panel',
  top: 'Top Panel',
  bottom: 'Bottom Panel',
};

// 4x4 Matrix operations (column-major order compatible with WebGL / Three.js)
export class Mat4 {
  constructor(elements) {
    this.elements = elements ? new Float32Array(elements) : new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  }

  static identity() {
    return new Mat4();
  }

  static translation(x, y, z) {
    return new Mat4([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      x, y, z, 1,
    ]);
  }

  static rotationX(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Mat4([
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1,
    ]);
  }

  static rotationY(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Mat4([
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1,
    ]);
  }

  static rotationZ(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Mat4([
      c, s, 0, 0,
      -s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  }

  static rotationAxis(axis, rad) {
    const [x, y, z] = axis;
    const len = Math.hypot(x, y, z) || 1;
    const nx = x / len, ny = y / len, nz = z / len;
    const c = Math.cos(rad), s = Math.sin(rad), t = 1 - c;
    return new Mat4([
      t * nx * nx + c,        t * nx * ny + s * nz,    t * nx * nz - s * ny,    0,
      t * nx * ny - s * nz,    t * ny * ny + c,        t * ny * nz + s * nx,    0,
      t * nx * nz + s * ny,    t * ny * nz - s * nx,    t * nz * nz + c,        0,
      0,                      0,                      0,                      1,
    ]);
  }

  multiply(other) {
    const a = this.elements;
    const b = other.elements;
    const out = new Float32Array(16);

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        let sum = 0;
        for (let i = 0; i < 4; i++) {
          sum += a[row + i * 4] * b[i + col * 4];
        }
        out[row + col * 4] = sum;
      }
    }
    return new Mat4(out);
  }

  transformPoint(pt) {
    const m = this.elements;
    const x = pt[0], y = pt[1], z = pt[2] || 0;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
    return [
      (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
      (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
      (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
    ];
  }

  transformNormal(normal) {
    const m = this.elements;
    const x = normal[0], y = normal[1], z = normal[2];
    // Direction vector transformation (using 3x3 upper matrix)
    const nx = m[0] * x + m[4] * y + m[8] * z;
    const ny = m[1] * x + m[5] * y + m[9] * z;
    const nz = m[2] * x + m[6] * y + m[10] * z;
    const len = Math.hypot(nx, ny, nz) || 1;
    return [nx / len, ny / len, nz / len];
  }
}

/**
 * Validates carton geometry input before generating fold hierarchy.
 */
export function validateFoldGeometry(geometry) {
  const errors = [];
  if (!geometry || typeof geometry !== 'object') {
    return { ok: false, errors: ['Geometry definition must be an object.'] };
  }

  const { width, height, depth } = geometry.dimensions || {};
  if (!Number.isFinite(width) || width <= 0) errors.push('Invalid width: must be a positive finite number.');
  if (!Number.isFinite(height) || height <= 0) errors.push('Invalid height: must be a positive finite number.');
  if (!Number.isFinite(depth) || depth <= 0) errors.push('Invalid depth: must be a positive finite number.');

  if (geometry.panels) {
    for (const face of CARTON_FACES) {
      const p = geometry.panels[face];
      if (p) {
        if (p.width !== undefined && (!Number.isFinite(p.width) || p.width <= 0)) {
          errors.push(`Panel ${face} has invalid width: ${p.width}`);
        }
        if (p.height !== undefined && (!Number.isFinite(p.height) || p.height <= 0)) {
          errors.push(`Panel ${face} has invalid height: ${p.height}`);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Build the hierarchical hinge tree for a rectilinear carton.
 *
 * Kinematic Hierarchy:
 *   ROOT: FRONT
 *     ├── RIGHT (folds backward -90° around vertical right crease)
 *     │     └── BACK (folds backward -90° around right panel's outer crease)
 *     ├── LEFT (folds backward +90° around vertical left crease)
 *     ├── TOP (folds backward -90° around horizontal top crease)
 *     └── BOTTOM (folds backward +90° around horizontal bottom crease)
 *
 * At progress 0 (flat dieline):
 *   All panels are aligned in Z=0 plane and lie adjacent to each other along flat offsets.
 *
 * At progress 1 (folded carton):
 *   Panels form a watertight 3D box of size (width x height x depth) centered at (0, 0, 0),
 *   with external faces pointing outward.
 */
export function buildHingeTree(geometry) {
  const { width, height, depth } = geometry.dimensions;

  // Panel definitions with width and height in panel-local space
  const panels = {
    front: {
      id: 'front',
      faceName: 'front',
      width,
      height,
      parent: null,
      children: ['right', 'left', 'top', 'bottom'],
      flatCenter: [0, 0, 0],
    },
    right: {
      id: 'right',
      faceName: 'right',
      width: depth,
      height,
      parent: 'front',
      children: ['back'],
      hingeOnParent: [width / 2, 0, 0],
      hingeAxis: [0, 1, 0],
      targetAngle: Math.PI / 2,
      pivotOffset: [depth / 2, 0, 0],
      flatCenter: [(width + depth) / 2, 0, 0],
    },
    back: {
      id: 'back',
      faceName: 'back',
      width,
      height,
      parent: 'right',
      children: [],
      hingeOnParent: [depth / 2, 0, 0],
      hingeAxis: [0, 1, 0],
      targetAngle: Math.PI / 2,
      pivotOffset: [width / 2, 0, 0],
      flatCenter: [width + depth, 0, 0],
    },
    left: {
      id: 'left',
      faceName: 'left',
      width: depth,
      height,
      parent: 'front',
      children: [],
      hingeOnParent: [-width / 2, 0, 0],
      hingeAxis: [0, 1, 0],
      targetAngle: -Math.PI / 2,
      pivotOffset: [-depth / 2, 0, 0],
      flatCenter: [-(width + depth) / 2, 0, 0],
    },
    top: {
      id: 'top',
      faceName: 'top',
      width,
      height: depth,
      parent: 'front',
      children: [],
      hingeOnParent: [0, height / 2, 0],
      hingeAxis: [1, 0, 0],
      targetAngle: -Math.PI / 2,
      pivotOffset: [0, depth / 2, 0],
      flatCenter: [0, (height + depth) / 2, 0],
    },
    bottom: {
      id: 'bottom',
      faceName: 'bottom',
      width,
      height: depth,
      parent: 'front',
      children: [],
      hingeOnParent: [0, -height / 2, 0],
      hingeAxis: [1, 0, 0],
      targetAngle: Math.PI / 2,
      pivotOffset: [0, -depth / 2, 0],
      flatCenter: [0, -(height + depth) / 2, 0],
    },
  };

  // Center of flat dieline bounding box (so flat view is nicely centered on screen)
  const flatMinX = -(width / 2 + depth);
  const flatMaxX = width / 2 + depth + width;
  const flatMinY = -(height / 2 + depth);
  const flatMaxY = height / 2 + depth;
  const flatCenter = [(flatMinX + flatMaxX) / 2, (flatMinY + flatMaxY) / 2, 0];

  return {
    root: 'front',
    dimensions: { width, height, depth },
    panels,
    flatCenter,
  };
}

/**
 * Calculates world transformation matrices for every panel at fold progress t ∈ [0, 1].
 * Uses continuous forward kinematics.
 */
export function calculateFoldTransforms(tree, progress) {
  const t = Math.max(0, Math.min(1, Number(progress) || 0));
  const { dimensions, panels, flatCenter } = tree;
  const { depth } = dimensions;

  // Root (front) panel transform:
  // At t=0, shifts by -flatCenter to keep dieline centered.
  // At t=1, front moves to Z = +depth / 2 so closed carton is centered at (0, 0, 0).
  const rootX = -flatCenter[0] * (1 - t);
  const rootY = -flatCenter[1] * (1 - t);
  const rootZ = (depth / 2) * t;

  const worldMatrices = {};
  worldMatrices.front = Mat4.translation(rootX, rootY, rootZ);

  function computeChild(nodeId, parentMatrix) {
    const node = panels[nodeId];
    if (!node) return;

    // Relative hinge transform:
    // 1. Translate to hinge line on parent
    const mHinge = Mat4.translation(...node.hingeOnParent);
    // 2. Rotate around hinge axis by interpolated angle
    const mRot = Mat4.rotationAxis(node.hingeAxis, node.targetAngle * t);
    // 3. Translate from hinge line to child's center
    const mPivot = Mat4.translation(...node.pivotOffset);

    // Full local matrix relative to parent
    const mLocal = mHinge.multiply(mRot).multiply(mPivot);
    const mWorld = parentMatrix.multiply(mLocal);
    worldMatrices[nodeId] = mWorld;

    for (const childId of node.children) {
      // Child hinges are located relative to this node's center
      computeChild(childId, mWorld);
    }
  }

  for (const childId of panels.front.children) {
    computeChild(childId, worldMatrices.front);
  }

  return worldMatrices;
}

/**
 * Convenience function to return the 4x4 matrix for a single panel at progress t.
 */
export function calculatePanelWorldMatrix(panelId, progress, tree) {
  const transforms = calculateFoldTransforms(tree, progress);
  return transforms[panelId] || Mat4.identity();
}

/**
 * Calculate the outward unit normal vector of a panel at progress t.
 * Initially, each panel's local face normal is [0, 0, 1].
 */
export function calculatePanelNormal(panelId, progress, tree) {
  const mat = calculatePanelWorldMatrix(panelId, progress, tree);
  return mat.transformNormal([0, 0, 1]);
}

/**
 * Maps a normalized 2D artwork point [x, y] ∈ [0, 1]² to local panel coordinates.
 * Returns { inside: boolean, u: number, v: number, localPoint: [x, y, z] }
 */
export function mapArtworkPointToPanel(point, panelZone, panelDimensions, zOffset = 0.5) {
  if (!point || !panelZone?.box || !panelDimensions) return null;

  const [x, y] = point;
  const [x0, y0, x1, y1] = panelZone.box;
  const zoneW = Math.max(1e-6, x1 - x0);
  const zoneH = Math.max(1e-6, y1 - y0);

  const u = (x - x0) / zoneW;
  const v = (y - y0) / zoneH;
  const inside = u >= -0.05 && u <= 1.05 && v >= -0.05 && v <= 1.05;

  const pw = panelDimensions.width;
  const ph = panelDimensions.height;

  // Local coordinates centered on the face:
  // u=0 (left) -> -pw/2, u=1 (right) -> +pw/2
  // v=0 (top)  -> +ph/2, v=1 (bottom) -> -ph/2
  const localX = (u - 0.5) * pw;
  const localY = (0.5 - v) * ph;
  const localZ = zOffset;

  return {
    inside,
    u,
    v,
    localPoint: [localX, localY, localZ],
  };
}
