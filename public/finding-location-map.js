/**
 * @file public/finding-location-map.js
 * 
 * PackSignal Phase 5A — Frontend Finding Location Map
 * Handles coordinate transformation, zoom/pan invariance,
 * panel mapping, and pin position calculations on the 2D artwork canvas.
 */

export function normalizeBoxCoordinates(box) {
  if (!box || !Array.isArray(box) || box.length !== 4) return null;
  let [x0, y0, x1, y1] = box.map(Number);
  if (isNaN(x0) || isNaN(y0) || isNaN(x1) || isNaN(y1)) return null;

  // Clamp to [0, 1] range if coordinates are in normalized space
  const minX = Math.max(0, Math.min(x0, x1));
  const maxX = Math.min(1, Math.max(x0, x1));
  const minY = Math.max(0, Math.min(y0, y1));
  const maxY = Math.min(1, Math.max(y0, y1));

  return [minX, minY, maxX, maxY];
}

/**
 * Converts a normalized box [x0, y0, x1, y1] to percentage-based CSS positioning.
 */
export function boxToCssStyles(box) {
  const norm = normalizeBoxCoordinates(box);
  if (!norm) return null;
  const [x0, y0, x1, y1] = norm;

  return {
    left: `${(x0 * 100).toFixed(2)}%`,
    top: `${(y0 * 100).toFixed(2)}%`,
    width: `${((x1 - x0) * 100).toFixed(2)}%`,
    height: `${((y1 - y0) * 100).toFixed(2)}%`
  };
}

/**
 * Calculates center coordinates of a box as percentages.
 */
export function getBoxCenter(box) {
  const norm = normalizeBoxCoordinates(box);
  if (!norm) return { xPercent: 50, yPercent: 50 };
  const [x0, y0, x1, y1] = norm;
  return {
    xPercent: ((x0 + x1) / 2) * 100,
    yPercent: ((y0 + y1) / 2) * 100
  };
}

/**
 * Formats physical millimeters for UI display or falls back cleanly.
 */
export function formatPhysicalPosition(loc) {
  if (!loc || !loc.physicalPositionMm) {
    return 'Physical mm unconfirmed (scale required)';
  }
  const { xMm, yMm, widthMm, heightMm } = loc.physicalPositionMm;
  return `${widthMm} × ${heightMm} mm at (${xMm}, ${yMm}) mm`;
}
