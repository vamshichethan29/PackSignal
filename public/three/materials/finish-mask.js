/**
 * PackSignal Finish Mask Engine (public/three/materials/finish-mask.js)
 * Rasterizes, validates, and transforms selective finishing masks:
 * - Method A: Uploaded grayscale / transparent mask image
 * - Method B: Source finish separation / spot-color layer
 * - Method C: Reviewer-drawn rectangular or polygonal artwork selection
 *
 * All coordinates are normalized in source artwork space [0, 1].
 */

export const MASK_PROVENANCE = {
  SOURCE_SEPARATION: 'source_separation',
  UPLOADED_MASK: 'uploaded_mask',
  REVIEWER_DEFINED: 'reviewer_defined',
};

/**
 * Validates a bounding box [x0, y0, x1, y1] within normalized [0, 1] range.
 */
export function validateMaskBox(box) {
  if (!Array.isArray(box) || box.length !== 4) return [0.2, 0.2, 0.8, 0.5];
  const [x0, y0, x1, y1] = box.map(v => Math.max(0, Math.min(1, Number(v) || 0)));
  return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
}

/**
 * Validates an array of polygon points [[x0, y0], [x1, y1], ...].
 */
export function validatePolygon(points) {
  if (!Array.isArray(points) || points.length < 3) return null;
  const clamped = points.map(pt => {
    if (!Array.isArray(pt) || pt.length < 2) return [0, 0];
    return [Math.max(0, Math.min(1, Number(pt[0]) || 0)), Math.max(0, Math.min(1, Number(pt[1]) || 0))];
  });
  return clamped;
}

/**
 * Rasterizes a mask into a Three.js CanvasTexture.
 *
 * @param {Object} THREE
 * @param {Object} options
 * @param {Array<number>} [options.box] - [x0, y0, x1, y1]
 * @param {Array<Array<number>>} [options.polygon] - Array of [x, y] points
 * @param {HTMLImageElement|ImageBitmap} [options.imageMask] - Uploaded mask image
 * @param {number} [options.resolution=1024] - Target canvas dimension
 * @param {string} [options.provenance='reviewer_defined']
 * @returns {{ texture: THREE.CanvasTexture, canvas: HTMLCanvasElement, provenance: string }}
 */
export function createRasterMaskTexture(THREE, {
  box = null,
  polygon = null,
  imageMask = null,
  resolution = 1024,
  provenance = MASK_PROVENANCE.REVIEWER_DEFINED,
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d');

  // Black background (0 = unmasked / no finish)
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, resolution, resolution);

  ctx.fillStyle = '#ffffff';

  if (imageMask && imageMask.width > 0) {
    // Method A: Uploaded mask image
    ctx.drawImage(imageMask, 0, 0, resolution, resolution);
  } else if (polygon && polygon.length >= 3) {
    // Method C: Reviewer-drawn polygon
    ctx.beginPath();
    const [startX, startY] = polygon[0];
    ctx.moveTo(startX * resolution, startY * resolution);
    for (let i = 1; i < polygon.length; i++) {
      ctx.lineTo(polygon[i][0] * resolution, polygon[i][1] * resolution);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    // Method C: Reviewer-drawn rectangle
    const validBox = validateMaskBox(box || [0.2, 0.2, 0.8, 0.5]);
    const x = validBox[0] * resolution;
    const y = validBox[1] * resolution;
    const w = (validBox[2] - validBox[0]) * resolution;
    const h = (validBox[3] - validBox[1]) * resolution;
    ctx.fillRect(x, y, w, h);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return {
    texture,
    canvas,
    provenance,
  };
}

/**
 * Creates a bump/relief heightmap canvas texture for embossing and debossing.
 * White = raised, 50% Gray = neutral plane, Black = recessed.
 *
 * @param {Object} THREE
 * @param {HTMLCanvasElement} maskCanvas
 * @param {number} [resolution=1024]
 * @param {boolean} [invert=false] - True for debossing (recessed)
 * @returns {THREE.CanvasTexture}
 */
export function createReliefHeightTexture(THREE, maskCanvas, resolution = 1024, invert = false) {
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d');

  // Neutral 50% gray base
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, resolution, resolution);

  if (maskCanvas) {
    ctx.drawImage(maskCanvas, 0, 0, resolution, resolution);
    const imgData = ctx.getImageData(0, 0, resolution, resolution);
    const data = imgData.data;

    // Convert mask: white becomes raised (255) or recessed (0 for deboss), background stays 128
    for (let i = 0; i < data.length; i += 4) {
      const maskVal = data[i]; // 0 to 255
      let heightVal;
      if (invert) {
        // Deboss: 128 base minus relief
        heightVal = 128 - (maskVal / 255) * 128;
      } else {
        // Emboss: 128 base plus relief
        heightVal = 128 + (maskVal / 255) * 127;
      }
      data[i] = heightVal;
      data[i + 1] = heightVal;
      data[i + 2] = heightVal;
      data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}
