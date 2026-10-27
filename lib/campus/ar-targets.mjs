/**
 * PackSignal — Live AR on Real Box (lib/campus/ar-targets.mjs)
 * Phase 10B: Target descriptors and red-pen overlays for physical carton AR tracking.
 * Projects verified compliance markings in real time without AI calls during AR.
 */

export const ESKO_CARTON_DIMENSIONS_MM = {
  width: 140,  // Front panel width in mm
  height: 210, // Front panel height in mm
  depth: 60,   // Side panel depth in mm
};

/**
 * Generates transparent red-pen SVG overlay for a specific packaging panel.
 * Draws bounding boxes, callout pins, and error descriptions directly in panel coordinates.
 * @param {string} panel - 'front' | 'right' | 'back' | 'left' | 'top' | 'bottom'
 * @param {Array} findings - Findings mapped to this panel
 * @param {number} width - Viewport width in pixels (e.g. 1000)
 * @param {number} height - Viewport height in pixels (e.g. 1500)
 */
export function generatePanelRedPenOverlay(panel, findings = [], width = 1000, height = 1500) {
  const panelFindings = (findings || []).filter(f => {
    const p = f.panel || f.location?.panel || f.face;
    return p ? p.toLowerCase() === panel.toLowerCase() : true;
  });

  let svgElements = '';

  for (let i = 0; i < panelFindings.length; i++) {
    const f = panelFindings[i];
    const box = f.box || f.coordinates || f.location?.box || [0.15, 0.70, 0.40, 0.12]; // [xNorm, yNorm, wNorm, hNorm]
    const [xNorm, yNorm, wNorm, hNorm] = box;

    const x = Math.round(xNorm * width);
    const y = Math.round(yNorm * height);
    const w = Math.round(wNorm * width);
    const h = Math.round(hNorm * height);

    const isIssue = (f.status || f.verdict || '').toLowerCase() === 'issue';
    const strokeColor = isIssue ? '#ef4444' : '#f59e0b'; // Red for issue, amber for review
    const fillColor = isIssue ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)';
    const labelText = f.title || f.field || `Finding #${i + 1}`;

    svgElements += `
      <!-- Finding ${i + 1} Anchor Group -->
      <g class="ar-red-pen-mark" data-finding-id="${f.id || i + 1}">
        <!-- Highlight Box with Hand-Drawn Wobble Illusion -->
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4"
              fill="${fillColor}" stroke="${strokeColor}" stroke-width="4"
              stroke-dasharray="8 4" />
        
        <!-- Corner Reticles for High-Contrast Tracking -->
        <path d="M${x - 6},${y + 12} L${x - 6},${y - 6} L${x + 12},${y - 6}" fill="none" stroke="${strokeColor}" stroke-width="3" />
        <path d="M${x + w + 6},${y + 12} L${x + w + 6},${y - 6} L${x + w - 12},${y - 6}" fill="none" stroke="${strokeColor}" stroke-width="3" />
        <path d="M${x - 6},${y + h - 12} L${x - 6},${y + h + 6} L${x + 12},${y + h + 6}" fill="none" stroke="${strokeColor}" stroke-width="3" />
        <path d="M${x + w + 6},${y + h - 12} L${x + w + 6},${y + h + 6} L${x + w - 12},${y + h + 6}" fill="none" stroke="${strokeColor}" stroke-width="3" />

        <!-- Floating Badge Pin -->
        <circle cx="${x + 16}" cy="${y - 14}" r="12" fill="${strokeColor}" />
        <text x="${x + 16}" y="${y - 9}" font-family="-apple-system, sans-serif" font-size="12" font-weight="900" fill="#ffffff" text-anchor="middle">!</text>

        <!-- Tooltip Label Tag -->
        <rect x="${x + 34}" y="${y - 28}" width="${Math.min(300, labelText.length * 10 + 20)}" height="26" rx="4" fill="#0f172a" />
        <text x="${x + 44}" y="${y - 11}" font-family="-apple-system, sans-serif" font-size="13" font-weight="700" fill="#ffffff">${escapeXml(labelText)}</text>
      </g>
    `;
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="position:absolute;inset:0;pointer-events:none;background:transparent;">
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.4"/>
        </filter>
      </defs>
      ${svgElements}
    </svg>
  `.trim();
}

/**
 * Returns MindAR target compiler configurations for the 6 faces.
 */
export function getMindArTargetConfig(sampleId = 'dancing-fish') {
  return {
    sampleId,
    physicalCarton: ESKO_CARTON_DIMENSIONS_MM,
    targets: [
      {
        index: 0,
        face: 'front',
        label: 'Front Face (Berry Crunch Granola)',
        widthMm: ESKO_CARTON_DIMENSIONS_MM.width,
        heightMm: ESKO_CARTON_DIMENSIONS_MM.height,
        targetFile: `/samples/organizer/targets/front-target.mind`,
        fallbackAnchor: { x: 0, y: 0, z: 0 },
      },
      {
        index: 1,
        face: 'right',
        label: 'Right Side (Nutrition Facts)',
        widthMm: ESKO_CARTON_DIMENSIONS_MM.depth,
        heightMm: ESKO_CARTON_DIMENSIONS_MM.height,
        targetFile: `/samples/organizer/targets/right-target.mind`,
        fallbackAnchor: { x: ESKO_CARTON_DIMENSIONS_MM.width / 2, y: 0, z: -ESKO_CARTON_DIMENSIONS_MM.depth / 2 },
      },
      {
        index: 2,
        face: 'back',
        label: 'Back Panel (Story & Ingredients)',
        widthMm: ESKO_CARTON_DIMENSIONS_MM.width,
        heightMm: ESKO_CARTON_DIMENSIONS_MM.height,
        targetFile: `/samples/organizer/targets/back-target.mind`,
        fallbackAnchor: { x: 0, y: 0, z: -ESKO_CARTON_DIMENSIONS_MM.depth },
      },
      {
        index: 3,
        face: 'left',
        label: 'Left Side (Address & Origin)',
        widthMm: ESKO_CARTON_DIMENSIONS_MM.depth,
        heightMm: ESKO_CARTON_DIMENSIONS_MM.height,
        targetFile: `/samples/organizer/targets/left-target.mind`,
        fallbackAnchor: { x: -ESKO_CARTON_DIMENSIONS_MM.width / 2, y: 0, z: -ESKO_CARTON_DIMENSIONS_MM.depth / 2 },
      },
    ],
  };
}

function escapeXml(unsafe) {
  return String(unsafe || '').replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}
