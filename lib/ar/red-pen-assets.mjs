/**
 * PackSignal — Red-Pen AR Overlay Asset Generator (lib/ar/red-pen-assets.mjs)
 * Phase 10B: Generates high-contrast transparent reviewer markups per panel.
 * 
 * Features:
 * - Hand-drawn wobble aesthetic for human reviewer feel.
 * - Distinction between confirmed ISSUE (red #ef4444) and review/proposal (amber #f59e0b).
 * - Dashed amber Ghost Box for missing required text without fabricating coordinates.
 * - Interactive hotspot geometry mapping for client-side tap detection.
 */

import { buildArManifest } from './ar-manifest.mjs';

/**
 * Renders transparent SVG markup for an individual packaging panel.
 * @param {string} panelId - 'front' | 'right' | 'back' | 'left'
 * @param {Object} options - { market, width, height, findings }
 * @returns {string} Clean transparent SVG markup string
 */
export function generatePanelOverlaySvg(panelId, options = {}) {
  const {
    market = 'us',
    width = 1000,
    height = 1500,
  } = options;

  const manifest = buildArManifest({ market, findings: options.findings });
  const panel = manifest.panels.find(p => p.panelId.toLowerCase() === panelId.toLowerCase());
  
  if (!panel) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"></svg>`;
  }

  const hotspots = panel.hotspots || [];
  let marksSvg = '';

  for (let i = 0; i < hotspots.length; i++) {
    const h = hotspots[i];
    const [nx, ny, nw, nh] = h.boxNorm;

    const x = Math.round(nx * width);
    const y = Math.round(ny * height);
    const w = Math.round(nw * width);
    const hPx = Math.round(nh * height);

    if (h.isMissingDeclarationGhost) {
      // Missing text Ghost Box: Dashed amber bounding box indicating proposed placement
      marksSvg += `
        <!-- Finding Hotspot: Missing Item Ghost Box -->
        <g class="ar-hotspot ar-hotspot-item" data-finding-id="${h.findingId}" data-status="GHOST_PROPOSAL">
          <rect x="${x}" y="${y}" width="${w}" height="${hPx}" rx="6"
                fill="rgba(245, 158, 11, 0.12)" stroke="#f59e0b" stroke-width="4" stroke-dasharray="8 4" />
          <rect x="${x + 8}" y="${y - 24}" width="${Math.min(520, (h.title || '').length * 8 + 82)}" height="22" rx="4" fill="#0f172a" />
          <text x="${x + 14}" y="${y - 9}" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#fbbf24">
            ⚠️ ${escapeXml(h.title || 'Required declaration missing')}
          </text>
        </g>
      `;
    } else {
      const isIssue = (h.status || '').toUpperCase() === 'ISSUE';
      const stroke = isIssue ? '#ef4444' : '#f59e0b';
      const fill = isIssue ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)';
      const badgeText = isIssue ? '!' : '?';

      marksSvg += `
        <!-- Finding Hotspot: ${h.findingId} -->
        <g class="ar-hotspot ar-hotspot-item" data-finding-id="${h.findingId}" data-status="${h.status}">
          <!-- Hand-drawn style red box with soft fill -->
          <rect x="${x}" y="${y}" width="${w}" height="${hPx}" rx="6"
                fill="${fill}" stroke="${stroke}" stroke-width="5" stroke-dasharray="10 5" />
          
          <!-- Corner brackets for high-visibility visual lock -->
          <path d="M${x - 8},${y + 14} L${x - 8},${y - 8} L${x + 14},${y - 8}" fill="none" stroke="${stroke}" stroke-width="4" />
          <path d="M${x + w + 8},${y + 14} L${x + w + 8},${y - 8} L${x + w - 14},${y - 8}" fill="none" stroke="${stroke}" stroke-width="4" />
          <path d="M${x - 8},${y + hPx - 14} L${x - 8},${y + hPx + 8} L${x + 14},${y + hPx + 8}" fill="none" stroke="${stroke}" stroke-width="4" />
          <path d="M${x + w + 8},${y + hPx - 14} L${x + w + 8},${y + hPx + 8} L${x + w - 14},${y + hPx + 8}" fill="none" stroke="${stroke}" stroke-width="4" />

          <!-- Circular Warning Pin Badge -->
          <circle cx="${x + 18}" cy="${y - 14}" r="14" fill="${stroke}" />
          <text x="${x + 18}" y="${y - 8}" font-family="-apple-system, sans-serif" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle">
            ${badgeText}
          </text>

          <!-- Label Ribbon -->
          <rect x="${x + 38}" y="${y - 28}" width="${Math.min(360, (h.title || '').length * 9 + 24)}" height="26" rx="4" fill="#0f172a" />
          <text x="${x + 48}" y="${y - 11}" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" fill="#ffffff">
            ${escapeXml(h.title || `Finding #${i + 1}`)}
          </text>
        </g>
      `;
    }
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"
         style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;background:transparent;">
      <defs>
        <filter id="ar-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.5"/>
        </filter>
      </defs>
      ${marksSvg}
    </svg>
  `.trim();
}

/**
 * Returns finding details for a specific hotspot tap in the mobile AR UI.
 * Pure static data lookup — ZERO runtime AI.
 */
export function getFindingDetailsForHotspot(findingId, options = {}) {
  const manifest = buildArManifest(options);
  for (const panel of manifest.panels) {
    const match = (panel.hotspots || []).find(h => h.findingId === findingId);
    if (match) {
      return {
        found: true,
        findingId: match.findingId,
        id: match.findingId,
        status: match.status,
        panel: panel.panelId,
        panelId: panel.panelId,
        panelLabel: panel.label,
        title: match.title,
        observedText: match.observedText,
        expectedValue: match.expectedValue || match.expectedText,
        expectedText: match.expectedText || match.expectedValue,
        ruleId: match.ruleId,
        evidenceRef: match.sourceRef,
        sourceRef: match.sourceRef,
        reviewerDepartment: match.department,
        department: match.department,
        finding: match,
      };
    }
  }
  return null;
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
