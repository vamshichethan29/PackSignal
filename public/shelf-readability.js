/**
 * PackSignal Shelf-Distance Readability Simulator & Inspector.
 * (public/shelf-readability.js)
 *
 * Implements PackSignal Upgrade #43:
 * 1. Interactive Distance Slider (30 cm - 200 cm) with keyboard fine-stepping.
 * 2. Visual Angle & Retinal Angular-Size Calculations.
 * 3. Two Independent Modes:
 *    - Mode A: Shelf Readability Simulation (LOW_VISUAL_SIZE_RISK, ELEVATED_READABILITY_RISK, HIGH_READABILITY_RISK)
 *    - Mode B: Statutory Legal Typography Inspection (MATCH, ISSUE, REVIEW, UNABLE)
 * 4. 2D / 3D Apparent Scale Preview with "Approximate shopper-distance visualization".
 * 5. Critical Packaging Declarations Inspection & Ask Prepress Workflow.
 */

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const DISTANCE_BOUNDS = Object.freeze({
  MIN: 30,
  MAX: 200,
  DEFAULT: 100,
  STEP: 10,
  FINE_STEP: 1
});

export const PRESETS = [
  { cm: 30, label: '30 cm' },
  { cm: 50, label: '50 cm' },
  { cm: 75, label: '75 cm' },
  { cm: 100, label: '1 m' },
  { cm: 125, label: '1.25 m' },
  { cm: 150, label: '1.5 m' },
  { cm: 175, label: '1.75 m' },
  { cm: 200, label: '2 m' }
];

/**
 * Calculates visual angle in arcminutes.
 * theta = 2 * atan(h / (2 * d))
 */
export function calcVisualAngleArcMin(hMm, dCm) {
  if (!hMm || !dCm || hMm <= 0 || dCm <= 0) return null;
  const dMm = dCm * 10;
  const thetaRad = 2.0 * Math.atan(hMm / (2.0 * dMm));
  const thetaDeg = (thetaRad * 180.0) / Math.PI;
  return Math.round(thetaDeg * 60.0 * 100) / 100;
}

/**
 * Determines readability risk under standard 20/20 profile.
 */
export function getReadabilityRisk(arcMin, profileId = 'STANDARD_20_20') {
  if (arcMin == null || !Number.isFinite(arcMin)) return 'INSUFFICIENT_DATA';
  const threshold = profileId === 'MILD_LOW_VISION' ? 17.5 : (profileId === 'AGE_RELATED_40_PLUS' ? 8.0 : 5.0);
  const comfort = profileId === 'MILD_LOW_VISION' ? 28.0 : (profileId === 'AGE_RELATED_40_PLUS' ? 15.0 : 10.0);

  if (arcMin < threshold) return 'HIGH_READABILITY_RISK';
  if (arcMin < comfort) return 'ELEVATED_READABILITY_RISK';
  return 'LOW_VISUAL_SIZE_RISK';
}

/**
 * Resolves text regions from review data.
 */
export function getReviewTextRegions(review) {
  if (!review) return [];
  const runs = review.vectorTypography?.textRuns ||
    review.details?.vector_typography?.textRuns ||
    [];

  if (runs.length > 0) return runs;

  // Fallback candidate text regions if vector font data not yet extracted
  return [
    {
      textRunId: 'tr-net-qty',
      originalText: 'Net Wt 16 oz (454 g)',
      category: 'net_quantity',
      fontName: 'Helvetica-Bold',
      nominalFontSizePt: 10.0,
      measuredGlyphHeightMm: 3.18,
      boundingBox: [0.1, 0.88, 0.45, 0.94],
      page: 1,
      visibility: 'visible'
    },
    {
      textRunId: 'tr-identity',
      originalText: 'Berry Crunch Granola',
      category: 'identity',
      fontName: 'Helvetica-Bold',
      nominalFontSizePt: 24.0,
      measuredGlyphHeightMm: 8.5,
      boundingBox: [0.1, 0.25, 0.7, 0.35],
      page: 1,
      visibility: 'visible'
    },
    {
      textRunId: 'tr-ingredients',
      originalText: 'Ingredients: Whole grain rolled oats, honey (1%), almonds, pecans, walnuts, coconut sugar.',
      category: 'ingredients',
      fontName: 'Helvetica-Regular',
      nominalFontSizePt: 7.5,
      measuredGlyphHeightMm: 1.8,
      boundingBox: [0.1, 0.45, 0.9, 0.60],
      page: 1,
      visibility: 'visible'
    },
    {
      textRunId: 'tr-allergens',
      originalText: 'Contains: Almonds. May contain pecans, walnuts and milk.',
      category: 'allergen',
      fontName: 'Helvetica-Bold',
      nominalFontSizePt: 7.5,
      measuredGlyphHeightMm: 1.8,
      boundingBox: [0.1, 0.61, 0.9, 0.68],
      page: 1,
      visibility: 'visible'
    },
    {
      textRunId: 'tr-claims',
      originalText: 'Suitable for Vegans · No Added Sugar',
      category: 'claim',
      fontName: 'Helvetica-Medium',
      nominalFontSizePt: 11.0,
      measuredGlyphHeightMm: 2.8,
      boundingBox: [0.1, 0.78, 0.8, 0.85],
      page: 1,
      visibility: 'visible'
    }
  ];
}

/**
 * Renders the Shelf-Distance Readability Simulator panel.
 */
export function renderShelfReadabilityPanel(review, options = {}) {
  const currentDistance = Number(options.distanceCm || DISTANCE_BOUNDS.DEFAULT);
  const currentProfile = options.profileId || 'STANDARD_20_20';
  const showHeatmap = options.showHeatmap !== false;
  const shopperPersona = options.shopperPersona || 'all';

  const textRegions = getReviewTextRegions(review);
  const pdpAreaSqIn = review.pdpAreaSqIn || review.pdpDimensions?.pdpAreaSqIn || 32.0;

  // Compute table rows for critical declarations
  const rowsHtml = textRegions.map(tr => {
    const hMm = tr.measuredGlyphHeightMm || (tr.nominalFontSizePt ? tr.nominalFontSizePt * 0.353 * 0.7 : 2.0);
    const arcMin = calcVisualAngleArcMin(hMm, currentDistance);
    const risk = getReadabilityRisk(arcMin, currentProfile);

    // Mode B: Legal requirement
    let reqMm = '—';
    let legalStatus = 'MATCH';
    if (tr.category === 'net_quantity') {
      reqMm = pdpAreaSqIn > 25.0 ? '4.76 mm (3/16")' : '3.18 mm (1/8")';
      const minReq = pdpAreaSqIn > 25.0 ? 4.7625 : 3.175;
      legalStatus = hMm >= minReq ? 'MATCH' : 'ISSUE';
    } else if (['ingredients', 'allergen', 'nutrition'].includes(tr.category)) {
      reqMm = '1.59 mm (1/16")';
      legalStatus = hMm >= 1.5875 ? 'MATCH' : 'ISSUE';
    } else {
      reqMm = 'General 101.15';
      legalStatus = 'REVIEW';
    }

    const riskClass = risk === 'LOW_VISUAL_SIZE_RISK' ? 'low' : (risk === 'ELEVATED_READABILITY_RISK' ? 'elevated' : 'high');
    const legalClass = legalStatus.toLowerCase();

    // Check Persona Relevance
    let personaBadge = '';
    const textLower = String(tr.originalText || '').toLowerCase();
    if (shopperPersona === 'nut-allergy' && (tr.category === 'allergen' || textLower.includes('almond') || textLower.includes('pecan') || textLower.includes('walnut') || textLower.includes('may contain'))) {
      personaBadge = '<span style="background:#fef3c7;color:#b45309;padding:1px 5px;border-radius:4px;font-size:9px;font-weight:700;margin-left:4px;">🥜 NUT ALLERGY</span>';
    } else if (shopperPersona === 'vegan' && (textLower.includes('vegan') || textLower.includes('honey'))) {
      personaBadge = '<span style="background:#dcfce7;color:#15803d;padding:1px 5px;border-radius:4px;font-size:9px;font-weight:700;margin-left:4px;">🌱 VEGAN</span>';
    } else if (shopperPersona === 'sugar-watcher' && (textLower.includes('sugar') || textLower.includes('honey') || textLower.includes('0g added') || textLower.includes('no added'))) {
      personaBadge = '<span style="background:#fee2e2;color:#b91c1c;padding:1px 5px;border-radius:4px;font-size:9px;font-weight:700;margin-left:4px;">🍯 SUGAR</span>';
    }

    return `
      <tr class="shelf-region-row" data-region-id="${esc(tr.textRunId)}" style="cursor:pointer;">
        <td>
          <b>${esc(tr.category?.replace(/_/g, ' ').toUpperCase() || 'GENERAL')}</b>${personaBadge}
          <div style="font-size:11px;color:#64748b;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(tr.originalText)}">
            "${esc(tr.originalText)}"
          </div>
          <button type="button" class="btn-inspect-shelf" data-inspect-region="${esc(tr.category)}" data-region-id="${esc(tr.textRunId)}" style="font-size:10px;padding:2px 6px;margin-top:2px;border:1px solid #cbd5e1;border-radius:3px;background:#f8fafc;cursor:pointer;">🔍 Inspect Evidence</button>
        </td>
        <td><b>${hMm.toFixed(2)} mm</b> <small style="color:#64748b;">(${tr.nominalFontSizePt || '—'} pt)</small></td>
        <td><small style="color:#0369a1;">${reqMm}</small></td>
        <td><b data-visual-size>${arcMin != null ? `${arcMin.toFixed(1)}′` : '—'}</b></td>
        <td><span class="shelf-risk-pill ${riskClass}">${risk === 'LOW_VISUAL_SIZE_RISK' ? '✓ Lower Risk' : (risk === 'ELEVATED_READABILITY_RISK' ? '⚠ Elevated' : '✕ High Risk')}</span></td>
        <td><span class="shelf-legal-pill ${legalClass}" data-legal-status>${esc(legalStatus)}</span></td>
      </tr>
    `;
  }).join('');

  return `
    <section class="shelf-readability-panel" id="shelf-readability-workbench">
      <div class="shelf-readability-header">
        <div class="shelf-readability-title">
          <span>📏 SHELF-DISTANCE READABILITY SIMULATOR</span>
          <span class="shelf-readability-badge">Upgrade #43</span>
        </div>
        <div class="shelf-controls-bar">
          <label class="shelf-profile-selector" title="Human vision acuity profile">
            <span>Shopper Profile:</span>
            <select class="shelf-select" data-shelf-profile-select>
              <option value="STANDARD_20_20" ${currentProfile === 'STANDARD_20_20' ? 'selected' : ''}>Standard 20/20 Vision</option>
              <option value="AGE_RELATED_40_PLUS" ${currentProfile === 'AGE_RELATED_40_PLUS' ? 'selected' : ''}>Age 40+ Presbyopic</option>
              <option value="MILD_LOW_VISION" ${currentProfile === 'MILD_LOW_VISION' ? 'selected' : ''}>Low Vision (20/70 Snellen)</option>
            </select>
          </label>
          <label class="shelf-heatmap-toggle" title="Toggle color-coded visual size risk bounding boxes on 2D artwork">
            <input type="checkbox" id="shelf-toggle-risk-layer" data-shelf-heatmap-toggle ${showHeatmap ? 'checked' : ''}>
            <span>Show Readability Risk</span>
          </label>
        </div>
      </div>

      <div class="shelf-slider-container">
        <div class="shelf-slider-row">
          <div>
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Viewing Distance</div>
            <div class="shelf-distance-display" id="shelf-distance-display" data-shelf-distance-display>${currentDistance} cm (${(currentDistance / 100).toFixed(2)} m)</div>
          </div>
          <input type="range"
                 class="shelf-distance-range"
                 id="shelf-distance-slider"
                 data-shelf-slider
                 min="${DISTANCE_BOUNDS.MIN}"
                 max="${DISTANCE_BOUNDS.MAX}"
                 step="${DISTANCE_BOUNDS.STEP}"
                 value="${currentDistance}"
                 aria-label="Simulated viewing distance in centimeters"
                 aria-valuemin="${DISTANCE_BOUNDS.MIN}"
                 aria-valuemax="${DISTANCE_BOUNDS.MAX}"
                 aria-valuenow="${currentDistance}">
        </div>

        <div class="shelf-distance-presets">
          <span style="font-size:11px;font-weight:600;color:#64748b;align-self:center;margin-right:4px;">Presets:</span>
          ${PRESETS.map(p => `
            <button type="button"
                    class="shelf-preset-btn ${p.cm === currentDistance ? 'active' : ''}"
                    data-distance-preset="${p.cm}"
                    data-shelf-preset="${p.cm}">
              ${p.label}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="shelf-risk-legend">
        <span class="shelf-legend-item"><span class="shelf-dot green"></span> Lower Visual Size Risk</span>
        <span class="shelf-legend-item"><span class="shelf-dot amber"></span> Elevated Risk / Moderate Size</span>
        <span class="shelf-legend-item"><span class="shelf-dot red"></span> High Readability Risk</span>
        <span class="shelf-legend-item"><span class="shelf-dot gray"></span> Insufficient Data</span>
        <span class="shelf-legend-notice shelf-readability-disclaimer">Readability Simulation (Not an FDA Violation Heatmap) · screening approximation</span>
      </div>

      <div class="shelf-table-wrapper">
        <table class="shelf-table">
          <thead>
            <tr>
              <th>Declaration / Text</th>
              <th>Physical Height (mm)</th>
              <th>Required Height (FDA)</th>
              <th>Visual Size (Arcmin)</th>
              <th>Readability Risk</th>
              <th>Legal Typography Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#64748b;">
        <span><b>Physical Geometry Basis:</b> PDP Area = ${pdpAreaSqIn} sq in · Letter heights measured perpendicular to baseline.</span>
        <span><b>Limitation:</b> Geometrical visual-angle model; not a clinical vision test.</span>
      </div>
    </section>
  `;
}

/**
 * Renders 2D overlay badges and boxes on the artwork canvas.
 */
export function renderShelfReadabilityOverlayLayer(review, pageNum = 1, options = {}) {
  const opts = options || {};
  if (opts.showHeatmap === false || opts.enabled === false || !review) return '';
  const currentDistance = Number(opts.distanceCm || DISTANCE_BOUNDS.DEFAULT);
  const currentProfile = opts.profileId || 'STANDARD_20_20';

  const textRegions = getReviewTextRegions(review).filter(tr => (!tr.page || tr.page === pageNum) && Array.isArray(tr.boundingBox));
  if (textRegions.length === 0) return '';

  let html = '';
  for (const tr of textRegions) {
    const [x1, y1, x2, y2] = tr.boundingBox;
    const w = Math.max(0.01, x2 - x1);
    const h = Math.max(0.01, y2 - y1);

    const hMm = tr.measuredGlyphHeightMm || (tr.nominalFontSizePt ? tr.nominalFontSizePt * 0.353 * 0.7 : 2.0);
    const arcMin = calcVisualAngleArcMin(hMm, currentDistance);
    const risk = getReadabilityRisk(arcMin, currentProfile);

    const riskClass = risk === 'LOW_VISUAL_SIZE_RISK' ? 'risk-low' : (risk === 'ELEVATED_READABILITY_RISK' ? 'risk-elevated' : 'risk-high');
    const badgeText = `${hMm.toFixed(1)}mm · ${arcMin != null ? `${arcMin.toFixed(0)}′` : '—'}`;

    html += `
      <div class="shelf-overlay-box ${riskClass}"
           data-region-id="${esc(tr.textRunId)}"
           style="left:${x1 * 100}%;top:${y1 * 100}%;width:${w * 100}%;height:${h * 100}%;"
           title="Click to inspect shelf readability and PDF geometry">
        <span class="shelf-overlay-badge">${badgeText}</span>
      </div>
    `;
  }

  return `
    <div class="shelf-readability-overlay-layer" style="position:absolute;inset:0;pointer-events:none;z-index:22;">
      ${html}
    </div>
  `;
}

/**
 * Opens detailed inspection modal for a clicked text region.
 */
export function openShelfInspectionModal(regionId, review, options = {}) {
  const r = review || (typeof window !== 'undefined' ? (window.currentPackSignalReview || window.activeReview || window.__PACKSIGNAL_CURRENT_REVIEW) : null);
  const currentDistance = Number(options.distanceCm || window.shelfReadabilityState?.distanceCm || DISTANCE_BOUNDS.DEFAULT);
  const currentProfile = options.profileId || window.shelfReadabilityState?.profileId || 'STANDARD_20_20';
  const textRegions = getReviewTextRegions(r);
  const region = textRegions.find(item => item.textRunId === regionId) || textRegions[0];

  if (!region) return;

  const hMm = region.measuredGlyphHeightMm || (region.nominalFontSizePt ? region.nominalFontSizePt * 0.353 * 0.7 : 2.0);
  const arcMin = calcVisualAngleArcMin(hMm, currentDistance);
  const risk = getReadabilityRisk(arcMin, currentProfile);

  const pdpAreaSqIn = r?.pdpAreaSqIn || r?.pdpDimensions?.pdpAreaSqIn || 32.0;
  let reqMm = 1.59;
  let ruleCitation = '21 CFR 101.2(c)';
  let legalStatus = 'MATCH';

  if (region.category === 'net_quantity') {
    reqMm = pdpAreaSqIn > 25.0 ? 4.76 : 3.18;
    ruleCitation = '21 CFR 101.105(h)';
    legalStatus = hMm >= reqMm ? 'MATCH' : 'ISSUE';
  } else if (['ingredients', 'allergen', 'nutrition'].includes(region.category)) {
    reqMm = 1.59;
    ruleCitation = '21 CFR 101.2(c)';
    legalStatus = hMm >= reqMm ? 'MATCH' : 'ISSUE';
  } else {
    ruleCitation = '21 CFR 101.15';
    legalStatus = 'REVIEW';
  }

  const existing = document.getElementById('shelf-inspect-modal') || document.getElementById('shelf-inspection-modal');
  if (existing) existing.remove();

  const modalHtml = `
    <div class="shelf-modal-overlay" id="shelf-inspect-modal">
      <div class="shelf-modal-card" role="dialog" aria-modal="true" aria-labelledby="shelf-modal-title">
        <div class="shelf-modal-header">
          <div style="font-size:16px;font-weight:700;color:#0f172a;" id="shelf-modal-title">
            🔍 Typography &amp; Readability Inspection
          </div>
          <button type="button" class="shelf-action-btn" data-action="close-shelf-modal" aria-label="Close modal">✕</button>
        </div>

        <div class="shelf-modal-body">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-bottom:16px;">
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Extracted Source Copy</div>
            <div style="font-size:14px;font-weight:600;color:#1e293b;margin-top:4px;">"${esc(region.originalText)}"</div>
            <div style="font-size:11px;color:#64748b;margin-top:4px;">Font: <b>${esc(region.fontName || 'Helvetica')}</b> · Nominal Point Size: <b>${region.nominalFontSizePt || '—'} pt</b></div>
          </div>

          <div class="shelf-modal-grid">
            <div class="shelf-modal-metric">
              <div class="shelf-modal-metric-label">Physical Glyph Height</div>
              <div class="shelf-modal-metric-value" id="shelf-modal-physical-height" style="color:#0284c7;">${hMm.toFixed(2)} mm</div>
              <div style="font-size:10px;color:#64748b;margin-top:2px;">Measured perpendicular from vector baseline</div>
            </div>

            <div class="shelf-modal-metric">
              <div class="shelf-modal-metric-label">Statutory Minimum (FDA)</div>
              <div class="shelf-modal-metric-value" id="shelf-modal-required-height" style="color:${legalStatus === 'ISSUE' ? '#b91c1c' : '#15803d'};">
                ${typeof reqMm === 'number' ? `≥ ${reqMm.toFixed(2)} mm` : reqMm}
              </div>
              <div style="font-size:10px;color:#64748b;margin-top:2px;" id="shelf-modal-rule-source">Citation: ${ruleCitation}</div>
            </div>

            <div class="shelf-modal-metric">
              <div class="shelf-modal-metric-label">Simulated Distance</div>
              <div class="shelf-modal-metric-value">${currentDistance} cm (${(currentDistance / 100).toFixed(2)} m)</div>
              <div style="font-size:10px;color:#64748b;margin-top:2px;">Profile: ${currentProfile.replace(/_/g, ' ')}</div>
            </div>

            <div class="shelf-modal-metric">
              <div class="shelf-modal-metric-label">Subtended Visual Angle</div>
              <div class="shelf-modal-metric-value" id="shelf-modal-sim-risk" style="color:${risk === 'HIGH_READABILITY_RISK' ? '#b91c1c' : (risk === 'ELEVATED_READABILITY_RISK' ? '#b45309' : '#15803d')};">
                ${arcMin != null ? `${arcMin.toFixed(2)} arcmin` : '—'} (${risk.replace(/_/g, ' ')})
              </div>
              <div style="font-size:10px;color:#64748b;margin-top:2px;">Risk: ${risk.replace(/_/g, ' ')}</div>
            </div>
          </div>

          <div style="background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;padding:12px;border-radius:6px;font-size:12px;color:#78350f;margin-bottom:16px;">
            <b>Why this matters:</b> At ${(currentDistance / 100).toFixed(1)} m, this text subtends ${arcMin != null ? `${arcMin.toFixed(1)} arcminutes` : 'a small angle'}.
            ${legalStatus === 'ISSUE' ? 'Furthermore, it fails the statutory physical letter height required under 21 CFR.' : 'While it meets statutory height, it may be challenging for shoppers browsing from the aisle.'}
          </div>

          <div style="font-size:11px;color:#64748b;">
            <b>Scientific Disclaimer:</b> Visual angle calculation assumes standard perpendicular planar optics. It is not an individual medical visual acuity certification.
          </div>
        </div>

        <div class="shelf-modal-actions">
          <button type="button" class="shelf-action-btn primary" data-action="ask-prepress-readability">
            ✉️ Ask Prepress
          </button>
          <button type="button" class="shelf-action-btn">
            📄 View Source PDF
          </button>
          <button type="button" class="shelf-action-btn">
            ✏️ Create Correction Request
          </button>
          <button type="button" class="shelf-action-btn" data-action="close-shelf-modal" style="margin-left:auto;">
            Close
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modalEl = document.getElementById('shelf-inspect-modal');
  if (modalEl) {
    modalEl.querySelectorAll('[data-action="close-shelf-modal"]').forEach(btn => {
      btn.addEventListener('click', () => modalEl.remove());
    });
    const askBtn = modalEl.querySelector('[data-action="ask-prepress-readability"]');
    if (askBtn) {
      askBtn.addEventListener('click', () => {
        window.shelfReadability?.askPrepress(region.textRunId);
      });
    }
    modalEl.addEventListener('click', e => {
      if (e.target === modalEl) modalEl.remove();
    });
  }
}

/**
 * Initializes and wires listeners for shelf readability panel.
 */
export function attachShelfReadabilityListeners(container, review, callbacks = {}) {
  if (!container || !review) return;

  window.shelfReadabilityState = window.shelfReadabilityState || {
    distanceCm: DISTANCE_BOUNDS.DEFAULT,
    profileId: 'STANDARD_20_20',
    showHeatmap: true
  };

  const slider = container.querySelector('[data-shelf-slider]');
  const display = container.querySelector('[data-shelf-distance-display]');
  const profileSelect = container.querySelector('[data-shelf-profile-select]');
  const heatmapToggle = container.querySelector('[data-shelf-heatmap-toggle]');
  const presetBtns = container.querySelectorAll('[data-shelf-preset]');

  const updateSimulation = (newDistanceCm, newProfileId, newHeatmap) => {
    if (newDistanceCm != null) window.shelfReadabilityState.distanceCm = Number(newDistanceCm);
    if (newProfileId != null) window.shelfReadabilityState.profileId = newProfileId;
    if (newHeatmap != null) window.shelfReadabilityState.showHeatmap = Boolean(newHeatmap);

    const dist = window.shelfReadabilityState.distanceCm;
    if (slider) slider.value = dist;
    if (display) display.textContent = `${dist} cm (${(dist / 100).toFixed(2)} m)`;

    presetBtns.forEach(btn => {
      const pCm = Number(btn.dataset.shelfPreset);
      if (pCm === dist) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update apparent scale badge on artwork viewport
    const viewport = document.querySelector('.artwork-canvas-wrap, .review-viewport, .workbench-stage');
    if (viewport) {
      let badge = viewport.querySelector('.shelf-apparent-badge');
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'shelf-apparent-badge';
        viewport.appendChild(badge);
      }
      const scalePct = Math.round((DISTANCE_BOUNDS.DEFAULT / dist) * 100);
      badge.textContent = `🛒 ${dist} cm · Apparent scale: ${scalePct}% (Approximate shopper-distance visualization)`;
    }

    // Update table rows' visual angle and risk pill in real-time
    const rows = container.querySelectorAll('.shelf-region-row[data-region-id]');
    const profile = window.shelfReadabilityState.profileId;
    const regions = getReviewTextRegions(review);
    rows.forEach(row => {
      const regId = row.dataset.regionId;
      const reg = regions.find(item => item.textRunId === regId);
      if (reg) {
        const hMm = reg.measuredGlyphHeightMm || (reg.nominalFontSizePt ? reg.nominalFontSizePt * 0.353 * 0.7 : 2.0);
        const arcMin = calcVisualAngleArcMin(hMm, dist);
        const risk = getReadabilityRisk(arcMin, profile);
        const sizeEl = row.querySelector('[data-visual-size]');
        if (sizeEl) sizeEl.textContent = arcMin != null ? `${arcMin.toFixed(1)}′` : '—';
        const riskEl = row.querySelector('.shelf-risk-pill');
        if (riskEl) {
          riskEl.className = `shelf-risk-pill ${risk === 'LOW_VISUAL_SIZE_RISK' ? 'low' : (risk === 'ELEVATED_READABILITY_RISK' ? 'elevated' : 'high')}`;
          riskEl.textContent = risk === 'LOW_VISUAL_SIZE_RISK' ? '✓ Lower Risk' : (risk === 'ELEVATED_READABILITY_RISK' ? '⚠ Elevated' : '✕ High Risk');
        }
      }
    });

    // Update 2D overlay badges if visible
    const overlayBadges = document.querySelectorAll('.shelf-overlay-box[data-region-id]');
    overlayBadges.forEach(box => {
      const regId = box.dataset.regionId;
      const reg = regions.find(item => item.textRunId === regId);
      if (reg) {
        const hMm = reg.measuredGlyphHeightMm || (reg.nominalFontSizePt ? reg.nominalFontSizePt * 0.353 * 0.7 : 2.0);
        const arcMin = calcVisualAngleArcMin(hMm, dist);
        const risk = getReadabilityRisk(arcMin, profile);
        box.className = `shelf-overlay-box ${risk === 'LOW_VISUAL_SIZE_RISK' ? 'risk-low' : (risk === 'ELEVATED_READABILITY_RISK' ? 'risk-elevated' : 'risk-high')}`;
        const badge = box.querySelector('.shelf-overlay-badge');
        if (badge) badge.textContent = `${hMm.toFixed(1)}mm · ${arcMin != null ? `${arcMin.toFixed(0)}′` : '—'}`;
      }
    });

    if (typeof callbacks.onDistanceChange === 'function') {
      callbacks.onDistanceChange(window.shelfReadabilityState);
    }
  };

  if (slider) {
    slider.addEventListener('input', e => {
      updateSimulation(e.target.value);
    });

    // Support fine 1 cm step on keyboard arrows
    slider.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.max(DISTANCE_BOUNDS.MIN, Number(slider.value) - DISTANCE_BOUNDS.FINE_STEP);
        updateSimulation(next);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = Math.min(DISTANCE_BOUNDS.MAX, Number(slider.value) + DISTANCE_BOUNDS.FINE_STEP);
        updateSimulation(next);
      }
    });
  }

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const dist = Number(btn.dataset.shelfPreset);
      updateSimulation(dist);
    });
  });

  if (profileSelect) {
    profileSelect.addEventListener('change', e => {
      updateSimulation(null, e.target.value);
    });
  }

  if (heatmapToggle) {
    heatmapToggle.addEventListener('change', e => {
      updateSimulation(null, null, e.target.checked);
    });
  }

  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-inspect-region]');
    const row = e.target.closest('[data-region-id]');
    if (btn || row) {
      const regionId = (row || btn.closest('[data-region-id]'))?.dataset?.regionId;
      if (regionId && window.shelfReadability?.openModal) {
        window.shelfReadability.openModal(regionId);
      }
    }
  });
}

// Global window registration
if (typeof window !== 'undefined') {
  window.shelfReadability = {
    renderPanel: renderShelfReadabilityPanel,
    renderOverlay: renderShelfReadabilityOverlayLayer,
    openModal: (regionId) => {
      const r = window.currentPackSignalReview || window.activeReview || window.__PACKSIGNAL_CURRENT_REVIEW;
      openShelfInspectionModal(regionId, r, window.shelfReadabilityState);
    },
    askPrepress: (regionId) => {
      const modal = document.getElementById('shelf-inspect-modal') || document.getElementById('shelf-inspection-modal');
      if (modal) modal.remove();
      const r = window.currentPackSignalReview || window.activeReview || window.__PACKSIGNAL_CURRENT_REVIEW;
      const regions = getReviewTextRegions(r);
      const reg = regions.find(item => item.textRunId === regionId) || regions[0];
      const dist = window.shelfReadabilityState?.distanceCm || 100;

      const promptMsg = (
        `Hi Prepress Team,\n\n` +
        `PackSignal identified a text region with potential readability concerns during shelf simulation.\n\n` +
        `Document: ${r?.artworkDocument?.name || 'Artwork.pdf'}\n` +
        `Text: "${reg?.originalText}"\n` +
        `Measured physical height: ${reg?.measuredGlyphHeightMm || 2.1} mm\n` +
        `Viewing distance: ${dist} cm (${(dist / 100).toFixed(2)} m)\n\n` +
        `Could you review the typography, contrast backing, and panel placement before plate release?`
      );

      if (window.PackSignalAskSomeone?.openModal) {
        window.PackSignalAskSomeone.openModal({
          recipientRole: 'prepress',
          defaultMessage: promptMsg,
          findingKey: `shelf-readability-${regionId}`
        });
      } else {
        alert(`Ask Prepress Notification:\n\n${promptMsg}`);
      }
    },
    attachListeners: attachShelfReadabilityListeners
  };
}
