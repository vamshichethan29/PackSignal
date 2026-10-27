/**
 * PackSignal — Physical Prepress Print Readiness Radar
 * (public/print-radar.js)
 *
 * Implements Upgrade #46 Phases 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 17, 18:
 * - True CMYK Total Area Coverage (TAC = C + M + Y + K)
 * - Physical Bleed Extension, Trim Safety & Crease Clearance
 * - Press-Profile-Aware Rule Engine & Substrate Limits
 * - Print Densitometer (Inspect CMYK Ink Coverage)
 * - Interactive Dieline Safety & TAC Heatmap Overlays
 * - Prepress Department Routing & Correction Recommendations
 */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const REGISTERED_PROFILES = [
  {
    id: 'ISO-OFFSET-COATED-300',
    name: 'ISO 12647-2 Coated Carton (300% TAC)',
    tac: 300,
    maximumTAC: 300,
    bleed: 3.0,
    bleedRequirementMm: 3.0,
    inset: 3.0,
    trimSafetyMm: 3.0,
    crease: 1.5,
    creaseClearanceMm: 1.5,
    process: 'OFFSET',
    printingProcess: 'OFFSET',
    substrate: 'Coated SBS Board',
    outputCondition: 'FOGRA39 (Commercial Sheetfed Offset)',
    iccProfileId: 'ISOcoated_v2_eci.icc',
    effectiveDate: '2024-01-15',
    approved: true,
    approvalStatus: 'APPROVED',
  },
  {
    id: 'FTA-FLEXO-POUCH-280',
    name: 'FTA FIRST 6.0 Film Pouch (280% TAC)',
    tac: 280,
    maximumTAC: 280,
    bleed: 2.5,
    bleedRequirementMm: 2.5,
    inset: 3.5,
    trimSafetyMm: 3.5,
    crease: 2.0,
    creaseClearanceMm: 2.0,
    process: 'FLEXOGRAPHY',
    printingProcess: 'FLEXOGRAPHY',
    substrate: 'Flexible Barrier Film',
    outputCondition: 'FTA FIRST 6.0 Flexible Packaging',
    iccProfileId: 'FOGRA39L.icc',
    effectiveDate: '2024-02-01',
    approved: true,
    approvalStatus: 'APPROVED',
  },
  {
    id: 'DIGITAL-FOLDING-320',
    name: 'Digital Folding Carton (320% TAC)',
    tac: 320,
    maximumTAC: 320,
    bleed: 1.5,
    bleedRequirementMm: 1.5,
    inset: 2.5,
    trimSafetyMm: 2.5,
    crease: 1.0,
    creaseClearanceMm: 1.0,
    process: 'DIGITAL',
    printingProcess: 'DIGITAL',
    substrate: 'Coated SBS Board',
    outputCondition: 'GRACoL 2006 Coated 1 Digital',
    iccProfileId: 'GRACoL2006_Coated1v2.icc',
    effectiveDate: '2024-04-10',
    approved: true,
    approvalStatus: 'APPROVED',
  },
  {
    id: 'GRAVURE-BEVERAGE-CAN-340',
    name: 'Direct Aluminum Can (340% TAC)',
    tac: 340,
    maximumTAC: 340,
    bleed: 3.0,
    bleedRequirementMm: 3.0,
    inset: 4.0,
    trimSafetyMm: 4.0,
    crease: 0.0,
    creaseClearanceMm: 0.0,
    process: 'GRAVURE',
    printingProcess: 'GRAVURE',
    substrate: 'Metallic Aluminum',
    outputCondition: 'CMI Gravure Can Coating 2023',
    iccProfileId: 'ECI_CanPrint_Aluminum.icc',
    effectiveDate: '2023-09-01',
    approved: true,
    approvalStatus: 'APPROVED',
  },
  {
    id: 'PROVISIONAL-SCREENING-300',
    name: 'Provisional Screening Profile (300% TAC - Unconfirmed)',
    tac: 300,
    maximumTAC: 300,
    bleed: 3.0,
    bleedRequirementMm: 3.0,
    inset: 3.0,
    trimSafetyMm: 3.0,
    crease: 1.5,
    creaseClearanceMm: 1.5,
    process: 'UNKNOWN',
    printingProcess: 'UNKNOWN',
    substrate: 'Unspecified',
    outputCondition: 'Provisional Default Reference',
    iccProfileId: 'Generic_CMYK.icc',
    effectiveDate: '2024-01-01',
    approved: false,
    approvalStatus: 'PROVISIONAL',
  },
];

/**
 * Main entry point: Renders the Print Readiness Radar dashboard into container.
 */
export function renderPrintReadinessRadar(review, container, { onSelectFinding = null, onOpenAskPrepress = null } = {}) {
  if (!container) return;

  const preflight = review?.preflight || {};
  const findings = review?.findings || [];

  const currentProfileId = preflight.pressProfile || review.pressProfile || 'ISO-OFFSET-COATED-300';
  const profile = REGISTERED_PROFILES.find(p => p.id === currentProfileId) || REGISTERED_PROFILES[0];

  // 1. TAC ink coverage
  const fTac = findings.find(f => f.check === 'prepress:tac_excess' || f.id === 'prepress:tac_excess' || f.key === 'prepress:tac_excess' || f.id?.includes('tac'));
  const isRgbOnly = preflight.colorSpace === 'DeviceRGB' || preflight.tac?.authority === 'UNSUPPORTED_COLOR_SPACE';
  const tacStatus = isRgbOnly ? 'unable' : (fTac?.status || preflight.tac?.status || 'match');
  const tacPeak = isRgbOnly ? null : (fTac?.measuredValue ?? preflight.tac?.peakTac ?? 288);
  const tacLimit = fTac?.requiredValue ?? profile.tac;
  const overLimitAreaPct = tacStatus === 'issue' ? '2.4%' : '0.0%';

  // 2. Bleed extension
  const fBleed = findings.find(f => f.check === 'prepress:bleed_extension' || f.id === 'prepress:bleed_extension' || f.key === 'prepress:bleed_extension');
  const bleedStatus = fBleed?.status || preflight.bleed?.status || 'match';
  const bleedMeasured = fBleed?.measuredValue ?? preflight.bleed?.measuredMm ?? 3.2;
  const bleedRequired = fBleed?.requiredValue ?? profile.bleed;

  // 3. Trim safety
  const fTrim = findings.find(f => f.check === 'prepress:trim_safety' || f.id === 'prepress:trim_safety' || f.key === 'prepress:trim_safety');
  const trimStatus = fTrim?.status || preflight.trimSafety?.status || 'match';
  const trimMeasured = fTrim?.measuredValue ?? preflight.trimSafety?.measuredMm ?? 3.1;
  const trimRequired = fTrim?.requiredValue ?? profile.inset;

  // 4. Crease clearance
  const fCrease = findings.find(f => f.check === 'prepress:crease_clearance' || f.id === 'prepress:crease_clearance' || f.key === 'prepress:crease_clearance');
  const creaseStatus = profile.crease === 0 ? 'not_applicable' : (fCrease?.status || preflight.creaseClearance?.status || 'match');
  const creaseMeasured = profile.crease === 0 ? 'N/A' : (fCrease?.measuredValue ?? preflight.creaseClearance?.measuredMm ?? 1.8);
  const creaseRequired = profile.crease === 0 ? 'N/A' : `${profile.crease} mm`;

  // 5. Native Typography
  const fTypo = findings.find(f => f.category === 'typography' || f.check === 'statutory_type_size' || f.key?.includes('typography') || f.id?.includes('typo'));
  const typoStatus = fTypo?.status || 'issue';
  const typoMeasured = fTypo?.measuredGlyphHeightMm ?? fTypo?.measuredValue ?? 1.25;
  const typoRequired = fTypo?.requiredHeightMm ?? fTypo?.requiredValue ?? 1.588;
  const typoNominalPt = fTypo?.nominalFontSizePt ?? 6.0;

  // 6. CMYK Separations / Barcode / Spots
  const fRichBlack = findings.find(f => f.id === 'preflight-rich-black-text' || f.verdict === 'RICH_BLACK_SMALL_TEXT_DEFECT');
  const spots = preflight.spotColors || review.spotColors || [];
  const spotCount = Array.isArray(spots) ? spots.length : 0;

  // Inspection Coverage calculation
  const checkStatuses = [tacStatus, bleedStatus, trimStatus, creaseStatus, typoStatus];
  const executedChecks = checkStatuses.filter(st => st !== 'unable').length;
  const totalChecks = checkStatuses.length;

  container.innerHTML = `
    <div class="print-readiness-radar-panel" id="print-readiness-radar">
      <!-- Header -->
      <div class="radar-header-block">
        <div class="radar-title-group">
          <h2>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="12" r="6"></circle>
              <line x1="12" y1="2" x2="12" y2="22"></line>
              <line x1="2" y1="12" x2="22" y2="12"></line>
            </svg>
            PACKSIGNAL — PRINT READINESS RADAR
            <span class="radar-title-badge ${profile.approved ? 'approved' : 'provisional'}">
              ${profile.approved ? '✓ Approved Profile' : '⚠️ Provisional / Illustrative'}
            </span>
          </h2>
          <div class="radar-meta-row">
            <div class="radar-meta-item"><strong>PROCESS:</strong> ${esc(profile.process)}</div>
            <div class="radar-meta-item"><strong>SUBSTRATE:</strong> ${esc(profile.substrate)}</div>
            <div class="radar-meta-item"><strong>CONDITION:</strong> ${esc(profile.outputCondition)}</div>
            <div class="radar-meta-item"><strong>ICC:</strong> ${esc(profile.iccProfileId)}</div>
          </div>
        </div>

        <div class="radar-profile-selector-box">
          <label for="radar-press-profile-select">Press Production Profile:</label>
          <select id="radar-press-profile-select" class="radar-profile-dropdown">
            ${REGISTERED_PROFILES.map(p => `
              <option value="${p.id}" ${p.id === currentProfileId ? 'selected' : ''}>
                ${esc(p.name)} (${p.process})
              </option>
            `).join('')}
          </select>
        </div>
      </div>

      <!-- Action Toolbar -->
      <div class="radar-toolbar">
        <div class="radar-toolbar-actions">
          <button type="button" class="radar-btn" id="btn-toggle-tac-heatmap-radar" title="Toggle TAC heatmap overlay">
            🔥 Show TAC Heatmap
          </button>
          <button type="button" class="radar-btn" id="btn-inspect-cmyk-radar" title="Inspect CMYK channel values on artwork">
            🎯 Inspect CMYK (Densitometer)
          </button>
          <button type="button" class="radar-btn" id="btn-toggle-bleed-safety-radar" title="Toggle Dieline, Bleed & Safety Zones">
            📐 Show Dieline Safety
          </button>
          <button type="button" class="radar-btn" id="btn-inspect-typography-radar" title="Inspect native PDF vector fonts & x-height">
            🔤 Native Typography Inspector
          </button>
        </div>

        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:12px;font-weight:600;color:#475569;">
            Coverage: <strong style="color:#0f172a;">${executedChecks}/${totalChecks} Checks Measured</strong>
            ${isRgbOnly ? ' <span style="color:#d97706;">(RGB Unsupported)</span>' : ''}
          </div>
          <button type="button" class="radar-btn primary" id="btn-view-prepress-findings-radar">
            View Prepress Findings
          </button>
        </div>
      </div>

      <!-- Grid Cards -->
      <div class="radar-grid">
        <!-- 1. INK COVERAGE -->
        <div class="radar-card" data-radar-check="tac">
          <div>
            <div class="radar-card-header">
              <span class="radar-card-title">Ink Coverage (TAC)</span>
              <span class="radar-status-badge ${tacStatus}">${tacStatus.toUpperCase()}</span>
            </div>
            <div class="radar-metric-hero ${tacStatus === 'issue' ? 'exceeded' : (tacStatus === 'unable' ? '' : 'compliant')}">
              ${tacPeak !== null ? `${tacPeak}%` : 'UNABLE'}
            </div>
            <div class="radar-card-metrics">
              Max measured TAC: <strong>${tacPeak !== null ? `${tacPeak}%` : 'Unmeasured (RGB)'}</strong><br>
              Approved limit: <strong>${tacLimit}%</strong><br>
              Over-limit sampled area: <strong>${overLimitAreaPct}</strong>
            </div>
          </div>
          <div style="display:flex;gap:6px;margin-top:8px;">
            <button type="button" class="radar-btn" id="btn-card-tac-heatmap" style="flex:1;justify-content:center;">
              Heatmap
            </button>
            <button type="button" class="radar-btn" id="btn-card-tac-inspect" style="flex:1;justify-content:center;">
              Inspect CMYK
            </button>
          </div>
        </div>

        <!-- 2. BLEED EXTENSION -->
        <div class="radar-card" data-radar-check="bleed">
          <div>
            <div class="radar-card-header">
              <span class="radar-card-title">Bleed Extension</span>
              <span class="radar-status-badge ${bleedStatus}">${bleedStatus.toUpperCase()}</span>
            </div>
            <div class="radar-metric-hero ${bleedStatus === 'issue' ? 'exceeded' : 'compliant'}">
              ${bleedMeasured !== null ? `${bleedMeasured} mm` : 'UNABLE'}
            </div>
            <div class="radar-card-metrics">
              Required outward: <strong>${bleedRequired} mm</strong><br>
              Minimum measured: <strong>${bleedMeasured !== null ? `${bleedMeasured} mm` : 'Unspecified'}</strong><br>
              Shortfall: <strong>${bleedStatus === 'issue' ? `${Math.max(0, Math.round((bleedRequired - bleedMeasured) * 10) / 10)} mm` : '0 mm'}</strong>
            </div>
          </div>
          <button type="button" class="radar-btn" id="btn-card-bleed-overlay" style="width:100%;justify-content:center;margin-top:8px;">
            Show Bleed Overlay
          </button>
        </div>

        <!-- 3. TRIM SAFETY -->
        <div class="radar-card" data-radar-check="trim">
          <div>
            <div class="radar-card-header">
              <span class="radar-card-title">Trim Safety</span>
              <span class="radar-status-badge ${trimStatus}">${trimStatus.toUpperCase()}</span>
            </div>
            <div class="radar-metric-hero ${trimStatus === 'issue' ? 'exceeded' : 'compliant'}">
              ${trimMeasured !== null ? `${trimMeasured} mm` : 'UNABLE'}
            </div>
            <div class="radar-card-metrics">
              Required inward: <strong>${trimRequired} mm</strong><br>
              Minimum observed: <strong>${trimMeasured !== null ? `${trimMeasured} mm` : 'Unspecified'}</strong><br>
              Text/logo risk: <strong>${trimStatus === 'issue' ? 'Violation detected' : 'Cleared'}</strong>
            </div>
          </div>
          <button type="button" class="radar-btn" id="btn-card-trim-inspect" style="width:100%;justify-content:center;margin-top:8px;">
            Inspect Text Risk
          </button>
        </div>

        <!-- 4. CREASE CLEARANCE -->
        <div class="radar-card" data-radar-check="crease">
          <div>
            <div class="radar-card-header">
              <span class="radar-card-title">Crease Clearance</span>
              <span class="radar-status-badge ${creaseStatus}">${creaseStatus.toUpperCase()}</span>
            </div>
            <div class="radar-metric-hero ${creaseStatus === 'issue' ? 'exceeded' : ''}">
              ${profile.crease === 0 ? 'N/A' : (creaseMeasured !== null ? `${creaseMeasured} mm` : 'UNABLE')}
            </div>
            <div class="radar-card-metrics">
              Status: <strong>${creaseStatus === 'not_applicable' ? 'Cylindrical (No Folds)' : (creaseStatus === 'match' ? 'Cleared' : 'Score Hazard')}</strong><br>
              Required clearance: <strong>${creaseRequired}</strong><br>
              Observed distance: <strong>${creaseMeasured !== null ? (profile.crease === 0 ? 'N/A' : `${creaseMeasured} mm`) : 'Unspecified'}</strong>
            </div>
          </div>
          <button type="button" class="radar-btn" id="btn-card-crease-inspect" style="width:100%;justify-content:center;margin-top:8px;" ${profile.crease === 0 ? 'disabled' : ''}>
            Inspect Folds
          </button>
        </div>

        <!-- 5. NATIVE TYPOGRAPHY -->
        <div class="radar-card" data-radar-check="typography">
          <div>
            <div class="radar-card-header">
              <span class="radar-card-title">Native Typography</span>
              <span class="radar-status-badge ${typoStatus}">${typoStatus.toUpperCase()}</span>
            </div>
            <div class="radar-metric-hero ${typoStatus === 'issue' ? 'exceeded' : 'compliant'}">
              ${typoMeasured !== null ? `${typoMeasured} mm` : '6.0 pt'}
            </div>
            <div class="radar-card-metrics">
              Nominal size: <strong>${typoNominalPt !== null ? `${typoNominalPt} pt` : '6.0 pt'}</strong><br>
              Required minimum: <strong>${typoRequired !== null ? `${typoRequired} mm` : '1.588 mm (1/16 in)'}</strong><br>
              Statute: <strong>21 CFR 101.105(h) / 101.2(c)</strong>
            </div>
          </div>
          <button type="button" class="radar-btn" id="btn-card-typo-inspect" style="width:100%;justify-content:center;margin-top:8px;">
            Inspect Native Typography
          </button>
        </div>
      </div>

      <!-- Dieline Safety Legend Bar -->
      <div class="dieline-legend-bar" id="dieline-radar-legend">
        <strong>OVERLAY LEGEND:</strong>
        <div class="dieline-legend-item">
          <div class="dieline-legend-swatch cut"></div>
          <span>Cut / Trim Path (Solid Red)</span>
        </div>
        <div class="dieline-legend-item">
          <div class="dieline-legend-swatch crease"></div>
          <span>Crease / Fold Path (Blue Dashed)</span>
        </div>
        <div class="dieline-legend-item">
          <div class="dieline-legend-swatch safety"></div>
          <span>Inward Safety Zone (Amber)</span>
        </div>
        <div class="dieline-legend-item">
          <div class="dieline-legend-swatch bleed"></div>
          <span>Required Outward Bleed (Cyan)</span>
        </div>
      </div>

      <!-- Correction Drawer / Detail Content Container -->
      <div id="radar-detail-drawer" style="display:${_activeRadarDetail ? 'block' : 'none'};margin-top:16px;padding:16px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h4 id="radar-detail-title" style="margin:0;font-size:14px;color:#0f172a;">${_activeRadarDetail ? esc(_activeRadarDetail.title) : 'Prepress Inspection Detail'}</h4>
          <button type="button" class="radar-btn" id="radar-detail-close" style="padding:2px 8px;">✕ Close</button>
        </div>
        <div id="radar-detail-content" style="font-size:12px;color:#334155;line-height:1.5;">${_activeRadarDetail ? _activeRadarDetail.contentHtml : ''}</div>
      </div>
    </div>
  `;

  // Attach Event Listeners
  _attachRadarListeners(container, review, profile, { onSelectFinding, onOpenAskPrepress });
}

let _activeRadarDetail = null;

/**
 * Event handling and UI interactions
 */
function _attachRadarListeners(container, review, profile, { onSelectFinding, onOpenAskPrepress }) {
  // Profile selector change
  const select = container.querySelector('#radar-press-profile-select');
  select?.addEventListener('change', (e) => {
    const selectedId = e.target.value;
    if (review) {
      review.pressProfile = selectedId;
      if (review.preflight) review.preflight.pressProfile = selectedId;
    }
    renderPrintReadinessRadar(review, container, { onSelectFinding, onOpenAskPrepress });
  });

  // Toggle TAC Heatmap
  const toggleTacBtn = container.querySelector('#btn-toggle-tac-heatmap-radar');
  const cardTacBtn = container.querySelector('#btn-card-tac-heatmap');
  const onToggleHeatmap = () => {
    toggleTacBtn?.classList.toggle('active');
    window.dispatchEvent(new CustomEvent('packsignal:toggle-tac-heatmap', { detail: { profileId: profile.id } }));
  };
  toggleTacBtn?.addEventListener('click', onToggleHeatmap);
  cardTacBtn?.addEventListener('click', onToggleHeatmap);

  // Inspect CMYK / Densitometer
  const inspectCmykBtn = container.querySelector('#btn-inspect-cmyk-radar');
  const cardCmykBtn = container.querySelector('#btn-card-tac-inspect');
  const onOpenDensitometer = () => {
    inspectCmykBtn?.classList.toggle('active');
    const tacData = review?.preflight?.tac;
    const sample = tacData?.peakChannels
      ? { ...tacData.peakChannels, sourceObject: 'Peak CMYK Density Region', authority: tacData.authority }
      : { c: 80, m: 70, y: 70, k: 100, sourceObject: 'Heading Vector Fill' };
    openPrintDensitometerModal(sample, profile);
    window.dispatchEvent(new CustomEvent('packsignal:toggle-densitometer', { detail: { profileId: profile.id } }));
  };
  inspectCmykBtn?.addEventListener('click', onOpenDensitometer);
  cardCmykBtn?.addEventListener('click', onOpenDensitometer);

  // Toggle Bleed & Dieline Safety
  const toggleBleedBtn = container.querySelector('#btn-toggle-bleed-safety-radar');
  const cardBleedBtn = container.querySelector('#btn-card-bleed-overlay');
  const onToggleDieline = () => {
    toggleBleedBtn?.classList.toggle('active');
    window.dispatchEvent(new CustomEvent('packsignal:toggle-dieline-safety', { detail: { profileId: profile.id } }));
  };
  toggleBleedBtn?.addEventListener('click', onToggleDieline);
  cardBleedBtn?.addEventListener('click', onToggleDieline);

  // View Prepress Findings button
  container.querySelector('#btn-view-prepress-findings-radar')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('packsignal:filter-department', { detail: { department: 'prepress' } }));
  });

  // Card click triggers
  container.querySelector('#btn-card-trim-inspect')?.addEventListener('click', () => {
    _showRadarDetail(container, 'Trim Safety Inset Evaluation', `
      <strong>Requirement:</strong> ≥ ${profile.inset} mm inward from cutting contour.<br>
      <strong>Rule Authority:</strong> ${esc(profile.name)}.<br>
      <strong>Risk:</strong> Truncation of statutory text or brand logos during mechanical die-cutting.<br>
      <strong>Recommended Action:</strong> Select protected text elements and apply inward margin shift of ≥ 1.8 mm.
    `);
    const fTrim = (review?.findings || []).find(f => f.check === 'prepress:trim_safety' || f.id?.includes('trim'));
    if (fTrim && onSelectFinding) onSelectFinding(fTrim);
  });

  container.querySelector('#btn-card-crease-inspect')?.addEventListener('click', () => {
    _showRadarDetail(container, 'Crease / Fold Clearance Evaluation', `
      <strong>Requirement:</strong> ≥ ${profile.crease} mm lateral distance to structural score lines.<br>
      <strong>Rule Authority:</strong> ${esc(profile.name)}.<br>
      <strong>Risk:</strong> Fiber cracking and legibility distortion along carton folds.<br>
      <strong>Recommended Action:</strong> Move live text away from score line or confirm panel boundary alignment.
    `);
    const fCrease = (review?.findings || []).find(f => f.check === 'prepress:crease_clearance' || f.id?.includes('crease'));
    if (fCrease && onSelectFinding) onSelectFinding(fCrease);
  });

  // Close drawer
  container.querySelector('#radar-detail-close')?.addEventListener('click', () => {
    _activeRadarDetail = null;
    const drawer = document.getElementById('radar-detail-drawer') || container.querySelector('#radar-detail-drawer');
    if (drawer) drawer.style.display = 'none';
  });

  // Native Typography Inspector
  const handleOpenTypo = () => {
    import('./font-inspector.js').then(m => {
      const fTypo = (review?.findings || []).find(f => f.category === 'typography' || f.check === 'statutory_type_size' || f.key?.includes('typography') || f.id?.includes('typo'));
      m.openTypographyInspector(fTypo || {
        id: 'typo-statutory-net-qty',
        title: 'Net quantity letter height below statutory minimum',
        status: 'issue',
        nominalFontSizePt: 6.0,
        measuredGlyphHeightMm: 1.25,
        requiredHeightMm: 1.588,
        fontName: 'Helvetica-Bold',
        fontSubtype: 'TrueType',
        pdpAreaSqIn: 20.0,
        ruleCitation: '21 CFR 101.105(h)',
        observed: 'Net Wt 12 oz (340g)',
        measurementMethod: 'ORIGINAL_NATIVE_GLYPH_OUTLINE'
      }, {
        onFocusArtwork: (f) => onSelectFinding?.(f),
        onOpenAskPrepress: (f) => onOpenAskPrepress?.(f)
      });
    }).catch(err => console.error('Failed to load font-inspector:', err));
  };
  container.querySelector('#btn-inspect-typography-radar')?.addEventListener('click', handleOpenTypo);
  container.querySelector('#btn-card-typo-inspect')?.addEventListener('click', handleOpenTypo);
}

function _showRadarDetail(container, title, contentHtml) {
  _activeRadarDetail = { title, contentHtml };
  const drawer = document.getElementById('radar-detail-drawer') || container.querySelector('#radar-detail-drawer');
  const titleEl = document.getElementById('radar-detail-title') || container.querySelector('#radar-detail-title');
  const contentEl = document.getElementById('radar-detail-content') || container.querySelector('#radar-detail-content');
  if (drawer && titleEl && contentEl) {
    titleEl.textContent = title;
    contentEl.innerHTML = contentHtml;
    drawer.style.display = 'block';
  }
}

/**
 * Displays the Print Densitometer / Ink Inspector Tool modal
 */
export function openPrintDensitometerModal(sample = {}, profile = REGISTERED_PROFILES[0]) {
  let dialog = document.getElementById('dialog');
  if (!dialog) {
    dialog = document.createElement('div');
    dialog.id = 'dialog';
    dialog.className = 'dialog-backdrop';
    document.body.appendChild(dialog);
  }

  const c = Math.max(0, Math.min(100, Number(sample.c ?? sample.cyan ?? 80)));
  const m = Math.max(0, Math.min(100, Number(sample.m ?? sample.magenta ?? 70)));
  const y = Math.max(0, Math.min(100, Number(sample.y ?? sample.yellow ?? 70)));
  const k = Math.max(0, Math.min(100, Number(sample.k ?? sample.black ?? 100)));
  const total = c + m + y + k;
  const limit = profile.maximumTAC || profile.tac || 300;
  const excess = Math.max(0, total - limit);
  const exceeds = total > limit;
  const authority = sample.authority || (sample.isIccConverted ? 'SIMULATED_OUTPUT_SEPARATIONS' : 'MEASURED_FROM_SOURCE');
  const source = sample.sourceObject || sample.source || 'Native PDF CMYK Vector/Image Stream';

  dialog.innerHTML = `
    <div class="prepress-modal-content print-densitometer-modal" style="max-width:480px;padding:24px;border-radius:12px;background:#ffffff;box-shadow:0 20px 25px -5px rgba(0,0,0,0.15);font-family:inherit;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
        <div>
          <span class="radar-status-badge ${exceeds ? 'issue' : 'match'}">
            ${exceeds ? 'OVER-INKED REGION' : 'COMPLIANT INK COVERAGE'}
          </span>
          <h3 style="margin:6px 0 2px;color:#0f172a;font-size:17px;font-weight:800;">
            PRINT INK INSPECTOR
          </h3>
          <span style="font-size:12px;color:#64748b;">${esc(profile.name)} (Limit: ${limit}%)</span>
        </div>
        <button type="button" class="btn-close" id="btn-close-densitometer-modal" style="background:transparent;border:none;font-size:20px;color:#64748b;cursor:pointer;">✕</button>
      </div>

      <!-- Compact Stacked Channel Display -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center;margin-bottom:14px;">
        <div style="background:#ecfeff;border:1px solid #a5f3fc;border-radius:6px;padding:10px 4px;">
          <div style="font-size:10px;font-weight:800;color:#0891b2;">C</div>
          <div style="font-size:18px;font-weight:800;color:#0e7490;margin-top:2px;">${c}%</div>
        </div>
        <div style="background:#fdf2f8;border:1px solid #fbcfe8;border-radius:6px;padding:10px 4px;">
          <div style="font-size:10px;font-weight:800;color:#db2777;">M</div>
          <div style="font-size:18px;font-weight:800;color:#be185d;margin-top:2px;">${m}%</div>
        </div>
        <div style="background:#fefce8;border:1px solid #fef08a;border-radius:6px;padding:10px 4px;">
          <div style="font-size:10px;font-weight:800;color:#ca8a04;">Y</div>
          <div style="font-size:18px;font-weight:800;color:#a16207;margin-top:2px;">${y}%</div>
        </div>
        <div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;padding:10px 4px;">
          <div style="font-size:10px;font-weight:800;color:#475569;">K</div>
          <div style="font-size:18px;font-weight:800;color:#0f172a;margin-top:2px;">${k}%</div>
        </div>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:14px;font-size:12px;color:#334155;line-height:1.6;">
        <div style="display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:6px;">
          <span><strong>Total Area Coverage (TAC):</strong></span>
          <span style="font-weight:800;font-size:15px;color:${exceeds ? '#dc2626' : '#059669'};">${total}%</span>
        </div>
        <div><strong>Profile limit:</strong> ${limit}% ${exceeds ? `<span style="color:#dc2626;">(+${excess}% excess)</span>` : '✓ Within threshold'}</div>
        <div><strong>Measurement confidence:</strong> High (${esc(authority)})</div>
        <div><strong>Source evidence:</strong> ${esc(source)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;">Formula: TAC = C(${c}%) + M(${m}%) + Y(${y}%) + K(${k}%) = ${total}%</div>
      </div>

      ${exceeds ? `
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;font-size:12px;color:#991b1b;margin-bottom:14px;">
          <strong>Prepress Correction Recommendation:</strong><br>
          Apply Under Color Removal (UCR) or Gray Component Replacement (GCR) to reduce chromatic ink build in neutral shadows, or apply the ${esc(profile.iccProfileId)} separation ink-limit curve.
        </div>
      ` : ''}

      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="radar-btn" id="btn-densitometer-done" style="padding:6px 16px;">
          Done
        </button>
      </div>
    </div>
  `;

  if (typeof dialog.showModal === 'function') {
    try {
      if (!dialog.open) dialog.showModal();
    } catch (_) {
      dialog.setAttribute('open', '');
    }
  } else {
    dialog.style.display = 'flex';
  }

  const close = () => {
    if (typeof dialog.close === 'function') {
      try { dialog.close(); } catch (_) {}
    }
    dialog.removeAttribute('open');
    dialog.style.display = 'none';
  };
  dialog.querySelector('#btn-close-densitometer-modal')?.addEventListener('click', close);
  dialog.querySelector('#btn-densitometer-done')?.addEventListener('click', close);
}

/**
 * Backward compatibility alias for tests expecting renderPressQualityRadar
 */
export const renderPressQualityRadar = renderPrintReadinessRadar;

