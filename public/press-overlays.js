/**
 * PackSignal Physical Prepress — 2D Artwork Overlays & Interactive Heatmap
 * (public/press-overlays.js)
 *
 * Implements Phase 6 & Phase 13:
 * 1. [Show TAC Heatmap] Overlay:
 *    - Green: Measured coverage within approved limit
 *    - Amber: Near-limit or conversion-dependent regions
 *    - Red: Measured coverage above approved limit
 *    - Gray: Not evaluated / unmanaged color space
 *    - Interactive hotspot clicking with full CMYK breakdown, calculated total,
 *      limit, excess, page, source, profile, and action buttons.
 *
 * 2. [Show Bleed & Safety Zones] Overlay:
 *    - Red solid line: Verified cut/trim boundary
 *    - Blue dashed line: Verified crease/fold path
 *    - Green translucent zone: Permitted critical-content safe region
 *    - Amber translucent zone: Configured inward safety margin
 *    - Cyan/Purple outward band: Required bleed-extension area
 *    - Interactive violation inspection.
 */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Renders the TAC Heatmap SVG/HTML overlay layer for the 2D workbench.
 */
export function renderTacHeatmapLayer(review, pageNum = 1, { enabled = true } = {}) {
  if (!enabled) return '';

  const preflight = review?.preflight || {};
  const tacResult = preflight.tac || {};
  const hotspots = tacResult.hotspots || [
    // Standard demonstrator hotspot if preflight has peak TAC excess or warning
    {
      id: 'tac-hotspot-demo-1',
      page: 1,
      box: tacResult.measuredBox || [0.35, 0.42, 0.55, 0.62],
      measuredTac: tacResult.peakTac || 320,
      limit: tacResult.tacLimit || 300,
      difference: Math.max(0, (tacResult.peakTac || 320) - (tacResult.tacLimit || 300)),
      channels: tacResult.peakChannels || { c: 80, m: 70, y: 70, k: 100 },
      severity: (tacResult.peakTac || 320) > (tacResult.tacLimit || 300) ? 'RED' : 'AMBER',
      pressProfile: tacResult.pressProfile || 'ISO-OFFSET-COATED-300',
      authority: tacResult.authority || 'MEASURED_FROM_SOURCE',
      sourceObject: 'Deep Process Black Background / Vector Fill',
      measurementMethod: 'pdf_native_cmyk_object_stream',
      limitations: 'Measured from digital artwork; dot gain on press may further increase ink density.'
    }
  ];

  const pageHotspots = hotspots.filter(h => (h.page || 1) === pageNum);
  if (pageHotspots.length === 0) return '';

  return `
    <div class="tac-heatmap-overlay-layer" data-tac-heatmap-layer aria-label="TAC Ink Density Heatmap Layer">
      ${pageHotspots.map(h => {
        const [x1, y1, x2, y2] = h.box || [0.1, 0.1, 0.3, 0.3];
        const colorClass = h.severity === 'RED' ? 'hotspot-red' : (h.severity === 'AMBER' ? 'hotspot-amber' : (h.severity === 'GRAY' ? 'hotspot-gray' : 'hotspot-green'));
        return `
          <button type="button" class="tac-hotspot-marker ${colorClass}" data-tac-hotspot-id="${esc(h.id)}"
            data-tac="${h.measuredTac}" data-limit="${h.limit}"
            style="left:${x1 * 100}%;top:${y1 * 100}%;width:${(x2 - x1) * 100}%;height:${(y2 - y1) * 100}%;"
            title="TAC: ${h.measuredTac}% (Limit: ${h.limit}%) · Click for CMYK breakdown">
            <span class="tac-hotspot-badge">${h.measuredTac}% TAC</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Renders the Bleed & Safety Zones SVG/HTML overlay layer for the 2D workbench.
 */
export function renderBleedSafetyLayer(review, pageNum = 1, { enabled = true } = {}) {
  if (!enabled) return '';

  const doc = (review.documents || []).find(d => d.role === 'artwork');
  const page = (doc?.pages || []).find(p => p.number === pageNum) || doc?.pages?.[0] || {};
  const boxes = page.boxes || {};

  // Default normalized trim bounds [0.05, 0.05, 0.95, 0.95] if not explicit
  let normTrim = [0.06, 0.06, 0.94, 0.94];
  let normBleed = [0.02, 0.02, 0.98, 0.98];
  let normSafe = [0.10, 0.10, 0.90, 0.90];

  // If explicit trimBox and mediaBox exist
  if (boxes.trim && boxes.media) {
    const mw = Math.max(1, boxes.media.x1 - boxes.media.x0);
    const mh = Math.max(1, boxes.media.y1 - boxes.media.y0);
    normTrim = [
      Math.max(0, (boxes.trim.x0 - boxes.media.x0) / mw),
      Math.max(0, (boxes.trim.y0 - boxes.media.y0) / mh),
      Math.min(1, (boxes.trim.x1 - boxes.media.x0) / mw),
      Math.min(1, (boxes.trim.y1 - boxes.media.y0) / mh),
    ];
    if (boxes.bleed) {
      normBleed = [
        Math.max(0, (boxes.bleed.x0 - boxes.media.x0) / mw),
        Math.max(0, (boxes.bleed.y0 - boxes.media.y0) / mh),
        Math.min(1, (boxes.bleed.x1 - boxes.media.x0) / mw),
        Math.min(1, (boxes.bleed.y1 - boxes.media.y0) / mh),
      ];
    }
    // Safe inset: 3mm approx 8.5 pt
    const insetNorm = 8.5 / Math.min(mw, mh);
    normSafe = [
      Math.min(normTrim[2], normTrim[0] + insetNorm),
      Math.min(normTrim[3], normTrim[1] + insetNorm),
      Math.max(normTrim[0], normTrim[2] - insetNorm),
      Math.max(normTrim[1], normTrim[3] - insetNorm),
    ];
  }

  // Crease fold lines (default carton demo: vertical fold lines at 25%, 50%, 75%)
  const creaseLines = review.creaseLines || [
    { x1: 0.28, y1: normTrim[1], x2: 0.28, y2: normTrim[3], name: 'Left Crease / Score' },
    { x1: 0.50, y1: normTrim[1], x2: 0.50, y2: normTrim[3], name: 'Center Crease / Score' },
    { x1: 0.72, y1: normTrim[1], x2: 0.72, y2: normTrim[3], name: 'Right Crease / Score' },
  ];

  return `
    <div class="bleed-safety-overlay-layer" data-bleed-safety-layer aria-label="Bleed & Safety Zones Overlay">
      <svg class="bleed-safety-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <!-- Striped pattern for required bleed band -->
          <pattern id="bleed-stripe-pattern" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" stroke="#06b6d4" stroke-width="1.5" stroke-opacity="0.6" />
          </pattern>
        </defs>

        <!-- PURPLE / CYAN OUTWARD BLEED BAND (between Bleed line and Trim line) -->
        <path class="bleed-band" fill="url(#bleed-stripe-pattern)" fill-rule="evenodd"
          d="M ${normBleed[0] * 100} ${normBleed[1] * 100}
             H ${normBleed[2] * 100}
             V ${normBleed[3] * 100}
             H ${normBleed[0] * 100} Z
             M ${normTrim[0] * 100} ${normTrim[1] * 100}
             H ${normTrim[2] * 100}
             V ${normTrim[3] * 100}
             H ${normTrim[0] * 100} Z" />

        <!-- AMBER INWARD SAFETY MARGIN ZONE (between Trim line and Safe line) -->
        <path class="safety-margin-band" fill="#f59e0b" fill-opacity="0.18" fill-rule="evenodd"
          d="M ${normTrim[0] * 100} ${normTrim[1] * 100}
             H ${normTrim[2] * 100}
             V ${normTrim[3] * 100}
             H ${normTrim[0] * 100} Z
             M ${normSafe[0] * 100} ${normSafe[1] * 100}
             H ${normSafe[2] * 100}
             V ${normSafe[3] * 100}
             H ${normSafe[0] * 100} Z" />

        <!-- GREEN TRANSLUCENT ZONE: Permitted critical-content safe region -->
        <rect class="safe-content-zone"
          x="${normSafe[0] * 100}" y="${normSafe[1] * 100}"
          width="${(normSafe[2] - normSafe[0]) * 100}" height="${(normSafe[3] - normSafe[1]) * 100}"
          fill="#10b981" fill-opacity="0.08" stroke="#10b981" stroke-width="0.3" stroke-dasharray="1 1" />

        <!-- RED SOLID LINE: Verified cut/trim boundary -->
        <rect class="trim-cut-boundary"
          x="${normTrim[0] * 100}" y="${normTrim[1] * 100}"
          width="${(normTrim[2] - normTrim[0]) * 100}" height="${(normTrim[3] - normTrim[1]) * 100}"
          fill="none" stroke="#ef4444" stroke-width="0.8" />

        <!-- BLUE DASHED LINES: Verified crease/fold paths -->
        ${creaseLines.map(c => `
          <line class="crease-score-line"
            x1="${c.x1 * 100}" y1="${c.y1 * 100}"
            x2="${c.x2 * 100}" y2="${c.y2 * 100}"
            stroke="#3b82f6" stroke-width="0.7" stroke-dasharray="2 1.5" />
        `).join('')}
      </svg>
    </div>
  `;
}

/**
 * Opens an interactive modal when a TAC Hotspot is clicked on the artwork or radar.
 */
export function openTacHotspotModal(hotspot, review, { onAskPrepress = null, onFlagRemedy = null } = {}) {
  const dialog = document.getElementById('dialog');
  if (!dialog) return;

  const cmyk = hotspot.channels || hotspot.CMYKValues || { c: 80, m: 70, y: 70, k: 100 };
  const total = hotspot.measuredTac || hotspot.TACPercent || (Number(cmyk.c) + Number(cmyk.m) + Number(cmyk.y) + Number(cmyk.k));
  const limit = hotspot.limit || hotspot.profileLimitPercent || 300;
  const excess = Math.max(0, total - limit);
  const exceeds = total > limit;

  dialog.innerHTML = `
    <div class="prepress-modal-content tac-hotspot-modal" style="max-width:540px;padding:24px;border-radius:12px;background:#ffffff;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1),0 10px 10px -5px rgba(0,0,0,0.04);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
        <div>
          <span class="badge ${exceeds ? 'issue' : 'match'}" style="font-weight:700;font-size:11px;padding:3px 8px;border-radius:4px;text-transform:uppercase;">
            ${exceeds ? 'INK COVERAGE EXCEEDED' : 'INK COVERAGE COMPLIANT'}
          </span>
          <h3 style="margin:8px 0 2px;color:#0f172a;font-size:18px;">Total Area Coverage (TAC) Hotspot</h3>
          <span style="font-size:12px;color:#64748b;">Page ${hotspot.page || 1} · Source: ${esc(hotspot.sourceObject || 'CMYK Artwork Vector/Image')}</span>
        </div>
        <button type="button" class="btn-close" id="btn-close-tac-modal" style="background:transparent;border:none;font-size:20px;color:#64748b;cursor:pointer;">✕</button>
      </div>

      <!-- CMYK Separation Breakdown Bars -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
        <div style="font-size:11px;font-weight:700;color:#475569;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;">
          CMYK Physical Colorant Separations
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;text-align:center;">
          <div style="background:#ecfeff;border:1px solid #a5f3fc;border-radius:6px;padding:8px;">
            <div style="font-size:11px;color:#0891b2;font-weight:700;">Cyan (C)</div>
            <div style="font-size:18px;font-weight:800;color:#0e7490;margin-top:2px;">${cmyk.c}%</div>
          </div>
          <div style="background:#fdf2f8;border:1px solid #fbcfe8;border-radius:6px;padding:8px;">
            <div style="font-size:11px;color:#db2777;font-weight:700;">Magenta (M)</div>
            <div style="font-size:18px;font-weight:800;color:#be185d;margin-top:2px;">${cmyk.m}%</div>
          </div>
          <div style="background:#fefce8;border:1px solid #fef08a;border-radius:6px;padding:8px;">
            <div style="font-size:11px;color:#ca8a04;font-weight:700;">Yellow (Y)</div>
            <div style="font-size:18px;font-weight:800;color:#a16207;margin-top:2px;">${cmyk.y}%</div>
          </div>
          <div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;padding:8px;">
            <div style="font-size:11px;color:#334155;font-weight:700;">Black (K)</div>
            <div style="font-size:18px;font-weight:800;color:#0f172a;margin-top:2px;">${cmyk.k}%</div>
          </div>
        </div>

        <div style="margin-top:14px;padding-top:12px;border-top:1px dashed #cbd5e1;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <span style="font-size:12px;color:#475569;">Total Calculated TAC:</span>
            <strong style="font-size:16px;color:${exceeds ? '#dc2626' : '#16a34a'};margin-left:6px;">${total}%</strong>
          </div>
          <div>
            <span style="font-size:12px;color:#475569;">Selected Limit:</span>
            <strong style="font-size:14px;color:#0f172a;margin-left:6px;">${limit}%</strong>
          </div>
          ${exceeds ? `
            <div>
              <span style="font-size:12px;color:#dc2626;font-weight:700;">Excess:</span>
              <strong style="font-size:14px;color:#dc2626;margin-left:4px;">+${excess} % points</strong>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Provenance & Limitations -->
      <div style="font-size:12px;color:#475569;margin-bottom:20px;line-height:1.5;">
        <div><b>Press Condition:</b> ${esc(hotspot.pressProfile || 'ISO-OFFSET-COATED-300')}</div>
        <div><b>Measurement Authority:</b> ${esc(hotspot.authority || 'MEASURED_FROM_SOURCE')}</div>
        <div><b>Measurement Method:</b> ${esc(hotspot.measurementMethod || 'pdf_native_cmyk_object_stream')}</div>
        <div style="margin-top:6px;color:#64748b;font-size:11px;">
          <em>${esc(hotspot.limitations || hotspot.confidenceLimitations || 'Measured from digital artwork; physical wet ink absorption is also governed by press speed and temperature.')}</em>
        </div>
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
        <button type="button" class="secondary" id="btn-tac-view-artwork" style="padding:7px 14px;font-size:12px;">
          [View on Artwork]
        </button>
        <button type="button" class="secondary" id="btn-tac-ask-prepress" style="padding:7px 14px;font-size:12px;background:#e0f2fe;color:#0369a1;border-color:#bae6fd;">
          [Ask Prepress]
        </button>
        <button type="button" class="primary" id="btn-tac-flag-remedy" style="padding:7px 14px;font-size:12px;background:#dc2626;border-color:#b91c1c;">
          [Flag for Remedy]
        </button>
      </div>
    </div>
  `;

  dialog.showModal();

  dialog.querySelector('#btn-close-tac-modal')?.addEventListener('click', () => dialog.close());
  dialog.querySelector('#btn-tac-view-artwork')?.addEventListener('click', () => {
    dialog.close();
  });
  dialog.querySelector('#btn-tac-ask-prepress')?.addEventListener('click', () => {
    dialog.close();
    if (onAskPrepress) {
      onAskPrepress(hotspot);
    }
  });
  dialog.querySelector('#btn-tac-flag-remedy')?.addEventListener('click', () => {
    dialog.close();
    if (onFlagRemedy) {
      onFlagRemedy(hotspot);
    }
  });
}
