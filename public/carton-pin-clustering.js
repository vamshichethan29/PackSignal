/**
 * PackSignal — Screen-Space Pin Clustering & Expansion Engine
 * De-clutters dense finding pins on packaging panels into intelligent count clusters.
 * Prioritizes issues, preserves full breakdowns, and provides deterministic expansion.
 */

import { STATUS_PRIORITY } from './carton-finding-pins.js';

export const DEFAULT_CLUSTER_DISTANCE = 30; // Screen pixels threshold (28-32 px range)

/**
 * Deterministically cluster projected pins by screen-space distance.
 * Crucial rule: ONLY cluster pins that belong to the SAME carton face!
 *
 * @param {Array<Object>} projectedPins - Pins with { screenX, screenY, panelId, visible, status, ... }
 * @param {Object} [options]
 * @param {number} [options.distanceThreshold=30] - Screen pixel radius for clustering
 * @param {boolean} [options.filterInvisible=true] - Exclude occluded/back-facing pins
 * @returns {{ clusters: Array<Object>, standalonePins: Array<Object>, allItems: Array<Object> }}
 */
export function clusterProjectedPins(projectedPins, options = {}) {
  const threshold = options.distanceThreshold || DEFAULT_CLUSTER_DISTANCE;
  const filterInvisible = options.filterInvisible !== false;

  const visiblePins = filterInvisible
    ? projectedPins.filter(p => p.visible)
    : projectedPins;

  if (visiblePins.length <= 1) {
    const standalonePins = visiblePins.map(p => ({
      type: 'pin',
      id: p.pinId,
      pin: p,
      screenX: p.screenX,
      screenY: p.screenY,
      panelId: p.panelId,
    }));
    return { clusters: [], standalonePins, allItems: standalonePins };
  }

  // Group pins by face first (never combine across faces)
  const pinsByFace = new Map();
  for (const pin of visiblePins) {
    const face = pin.panelId || 'unknown';
    if (!pinsByFace.has(face)) pinsByFace.set(face, []);
    pinsByFace.get(face).push(pin);
  }

  const clusters = [];
  const standalonePins = [];

  let clusterIndex = 0;

  for (const [faceId, facePins] of pinsByFace.entries()) {
    const unassigned = [...facePins];

    while (unassigned.length > 0) {
      const seed = unassigned.shift();
      const group = [seed];

      // Proximity search within threshold
      let i = 0;
      while (i < unassigned.length) {
        const candidate = unassigned[i];
        const dx = candidate.screenX - seed.screenX;
        const dy = candidate.screenY - seed.screenY;
        const dist = Math.hypot(dx, dy);

        if (dist <= threshold) {
          group.push(candidate);
          unassigned.splice(i, 1);
        } else {
          i++;
        }
      }

      if (group.length === 1) {
        standalonePins.push({
          type: 'pin',
          id: seed.pinId,
          pin: seed,
          screenX: seed.screenX,
          screenY: seed.screenY,
          panelId: faceId,
        });
      } else {
        // Compute centroid
        const sumX = group.reduce((acc, p) => acc + p.screenX, 0);
        const sumY = group.reduce((acc, p) => acc + p.screenY, 0);
        const centroidX = Math.round((sumX / group.length) * 10) / 10;
        const centroidY = Math.round((sumY / group.length) * 10) / 10;

        // Breakdown counts
        const breakdown = {
          issue: 0,
          review: 0,
          match: 0,
          unable: 0,
        };

        for (const p of group) {
          const s = (p.status || 'review').toLowerCase();
          if (breakdown[s] !== undefined) breakdown[s]++;
          else breakdown.review++;
        }

        // Dominant priority status: issue > review > match > unable
        let highestStatus = 'match';
        let highestPriority = -1;

        for (const p of group) {
          const s = (p.status || 'review').toLowerCase();
          const prio = STATUS_PRIORITY[s] ?? 0;
          if (prio > highestPriority) {
            highestPriority = prio;
            highestStatus = s;
          }
        }

        const clusterId = `cluster-${faceId}-${clusterIndex++}`;

        clusters.push({
          type: 'cluster',
          id: clusterId,
          clusterId,
          panelId: faceId,
          screenX: centroidX,
          screenY: centroidY,
          count: group.length,
          status: highestStatus,
          breakdown,
          pins: group,
          expanded: false,
        });
      }
    }
  }

  const allItems = [...clusters, ...standalonePins];
  return { clusters, standalonePins, allItems };
}

/**
 * Computes deterministic spiderfy expansion positions for a cluster.
 *
 * @param {Object} cluster - Cluster item containing pins and centroid
 * @param {Object} [viewport] - Viewport constraints { width, height, margin }
 * @returns {Array<Object>} Expanded pin items with { pin, x, y, angle, lineFrom: { x, y } }
 */
export function calculateSpiderfyPositions(cluster, viewport = { width: 500, height: 385, margin: 24 }) {
  const pins = cluster.pins || [];
  const N = pins.length;
  if (N === 0) return [];

  const cx = cluster.screenX;
  const cy = cluster.screenY;

  // Base radius: 45 px for 2-4 pins, up to 70 px for 8+ pins
  const radius = Math.min(80, Math.max(46, 28 + N * 5));

  // Determine starting angle (offset to avoid overlapping edges)
  const angleStep = (2 * Math.PI) / N;
  const startAngle = -Math.PI / 2; // Start from top

  const expandedPins = [];

  for (let i = 0; i < N; i++) {
    const angle = startAngle + i * angleStep;
    let targetX = cx + Math.cos(angle) * radius;
    let targetY = cy + Math.sin(angle) * radius;

    // Viewport clamping
    const margin = viewport.margin || 20;
    const maxX = (viewport.width || 500) - margin;
    const maxY = (viewport.height || 385) - margin;

    targetX = Math.max(margin, Math.min(maxX, targetX));
    targetY = Math.max(margin, Math.min(maxY, targetY));

    expandedPins.push({
      pin: pins[i],
      index: i,
      x: Math.round(targetX * 10) / 10,
      y: Math.round(targetY * 10) / 10,
      angle,
      lineFrom: { x: cx, y: cy },
    });
  }

  return expandedPins;
}

/**
 * Determines whether to use Spiderfy or List Popover based on viewport and cluster size.
 *
 * @param {number} count - Number of findings in cluster
 * @param {{ width: number, height: number }} viewport - Available scene dimensions
 * @returns {'spiderfy' | 'popover'}
 */
export function resolveClusterExpansionMode(count, viewport = { width: 500, height: 385 }) {
  const isMobileOrConstrained = (viewport.width < 420) || (viewport.height < 320);
  if (isMobileOrConstrained || count > 8) {
    return 'popover';
  }
  return 'spiderfy';
}
