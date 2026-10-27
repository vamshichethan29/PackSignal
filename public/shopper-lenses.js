/**
 * @file shopper-lenses.js
 * 
 * PackSignal Phase 6A — Shopper Lenses Interactive Controller
 */

let shopperData = null;
let activeTab = 'personas'; // 'personas' | 'shelf' | 'glance' | 'accessibility' | 'wipe'
let currentDistanceM = 0.6; // default arm's length (0.6m)
let currentCvdMode = 'normal';
let isDraggingWipe = false;
let wipePercentage = 50;

/**
 * Mounts the Shopper Lenses workbench into the DOM container.
 */
export async function mountShopperLenses(container) {
  if (!container) return;

  container.innerHTML = `
    <div class="shopper-workbench" id="shopper-workbench-root">
      <div style="text-align: center; padding: 3rem; color: #64748b;">
        <p>⚡ Loading shopper personas, shelf readability simulator, and 3s glance heatmap…</p>
      </div>
    </div>
  `;

  await loadShopperData();
  renderShopperWorkbench(container);
}

/**
 * Loads Shopper Lenses data from the API.
 */
async function loadShopperData() {
  try {
    const res = await fetch(`/api/shopper-lenses?distance=${currentDistanceM}`);
    const data = await res.json();
    if (data.status === 'SUCCESS') {
      shopperData = data;
    }
  } catch (err) {
    console.error('Failed to load Shopper Lenses data:', err);
  }
}

/**
 * Renders the top-level Shopper Lenses interface.
 */
function renderShopperWorkbench(container) {
  if (!shopperData) return;

  container.innerHTML = `
    <!-- SVG Color Vision Deficiency Filters -->
    <svg style="position: absolute; width: 0; height: 0;" aria-hidden="true">
      <defs>
        <filter id="filter-protanopia">
          <feColorMatrix type="matrix" values="0.567, 0.433, 0, 0, 0  0.558, 0.442, 0, 0, 0  0, 0.242, 0.758, 0, 0  0, 0, 0, 1, 0" />
        </filter>
        <filter id="filter-deuteranopia">
          <feColorMatrix type="matrix" values="0.625, 0.375, 0, 0, 0  0.7, 0.3, 0, 0, 0  0, 0.3, 0.7, 0, 0  0, 0, 0, 1, 0" />
        </filter>
        <filter id="filter-tritanopia">
          <feColorMatrix type="matrix" values="0.95, 0.05, 0, 0, 0  0, 0.433, 0.567, 0, 0  0, 0.475, 0.525, 0, 0  0, 0, 0, 1, 0" />
        </filter>
      </defs>
    </svg>

    <div class="shopper-workbench" id="shopper-workbench-root">
      <!-- 1. Header & Navigation Tabs -->
      <header class="shopper-header">
        <div class="shopper-title-row">
          <div>
            <h2>🛒 Shopper Lenses — Turning Rules into Human Experience</h2>
            <p>Personas · Shelf-distance readability · 3-second glance heatmap · Color-blindness & contrast</p>
          </div>
          <span class="estimate-pill">AUDITED PROVENANCE DATA</span>
        </div>

        <nav class="shopper-tabs" role="tablist">
          <button class="shopper-tab-btn ${activeTab === 'personas' ? 'active' : ''}" data-tab="personas">
            👥 Shopper Personas
          </button>
          <button class="shopper-tab-btn ${activeTab === 'shelf' ? 'active' : ''}" data-tab="shelf">
            📏 Shelf-Distance Test
          </button>
          <button class="shopper-tab-btn ${activeTab === 'glance' ? 'active' : ''}" data-tab="glance">
            👁️ 3s Glance Heatmap
          </button>
          <button class="shopper-tab-btn ${activeTab === 'accessibility' ? 'active' : ''}" data-tab="accessibility">
            🎨 Color Vision & Contrast
          </button>
          <button class="shopper-tab-btn ${activeTab === 'wipe' ? 'active' : ''}" data-tab="wipe">
            🔀 Before / After Wipe
          </button>
        </nav>
      </header>

      <!-- 2. Active Tab View -->
      <main class="shopper-tab-content">
        ${renderActiveTabContent()}
      </main>

      <!-- Inspector Modal Container -->
      <div id="shopper-modal-container"></div>
    </div>
  `;

  attachShopperListeners(container);
}

/**
 * Returns markup for the active view tab.
 */
function renderActiveTabContent() {
  switch (activeTab) {
    case 'personas':
      return renderPersonasSection();
    case 'shelf':
      return renderShelfSimulatorSection();
    case 'glance':
      return renderGlanceHeatmapSection();
    case 'accessibility':
      return renderAccessibilitySection();
    case 'wipe':
      return renderBeforeAfterWipeSection();
    default:
      return renderPersonasSection();
  }
}

/**
 * Renders the Shopper Personas grid.
 */
function renderPersonasSection() {
  const { personas } = shopperData;

  return `
    <section class="personas-grid" aria-label="Shopper Personas Matrix">
      ${personas.map(p => `
        <article class="persona-card status-${p.status.toLowerCase()}" data-persona="${p.id}">
          <div class="persona-header">
            <div class="persona-avatar-group">
              <div class="persona-icon-circle">${p.icon}</div>
              <div>
                <div class="persona-name">${p.name}</div>
                <div class="persona-sub">${p.personaTitle}</div>
              </div>
            </div>
            <span class="persona-badge ${p.status.toLowerCase()}">${p.badge}</span>
          </div>

          <div class="persona-verdict-box">
            "${p.oneLineVerdict}"
          </div>

          <p class="persona-journey">${p.shopperJourney}</p>

          <div class="persona-meta-footer">
            <span style="color: #64748b;">${p.panel}</span>
            <button class="persona-sources-link" data-action="inspect-persona-source" data-id="${p.id}">
              Inspect Sources (${p.sources.length}) →
            </button>
          </div>
        </article>
      `).join('')}
    </section>
  `;
}

/**
 * Renders the Shelf-Distance Test simulator with first dropout identification.
 */
function renderShelfSimulatorSection() {
  const { shelfReadability } = shopperData;
  const { items, firstDropout, activeDistanceMeters, estimateDisclaimer } = shelfReadability;

  return `
    <section class="shelf-simulator-box" aria-label="Shelf Distance Legibility Simulator">
      <div class="shelf-controls-bar">
        <div class="distance-slider-group">
          <label for="shelf-distance-slider">Viewing Distance:</label>
          <input type="range" id="shelf-distance-slider" class="distance-slider" min="0.3" max="3.0" step="0.1" value="${activeDistanceMeters}">
          <span class="distance-value-pill">${activeDistanceMeters.toFixed(1)} m (${Math.round(activeDistanceMeters * 3.28)} ft)</span>
        </div>
        <div style="font-size: 0.8rem; color: #64748b; font-weight: 600;">
          Snellen 20/20 Standard (1 arcmin resolution)
        </div>
      </div>

      <!-- First Dropout Highlight Card -->
      <div class="shelf-first-dropout-card">
        <div class="dropout-icon">🚨</div>
        <div class="dropout-body">
          <h4>First Required Element to Drop Out: ${firstDropout.firstDropoutElement}</h4>
          <p>${firstDropout.explanation}</p>
          <div>
            <span class="estimate-pill">${estimateDisclaimer}</span>
          </div>
        </div>
      </div>

      <!-- Items Readability Table -->
      <table class="shelf-items-table">
        <thead>
          <tr>
            <th>Required Pack Element</th>
            <th>Target Panel</th>
            <th>Cap Height / Font Size</th>
            <th>Max Readable Distance</th>
            <th>Legibility at ${activeDistanceMeters.toFixed(1)} m</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => {
            const isReadable = activeDistanceMeters <= item.maxReadableDistanceMeters;
            return `
              <tr>
                <td><strong>${item.name}</strong></td>
                <td>${item.panel}</td>
                <td>${item.capHeightMm} mm (${item.fontPt} pt)</td>
                <td>
                  <strong>${item.maxReadableDistanceMeters.toFixed(2)} m</strong>
                  <span style="font-size: 0.72rem; color: #94a3b8; display: block;">[ESTIMATE]</span>
                </td>
                <td>
                  <span class="readability-status-tag ${isReadable ? 'readable' : 'unreadable'}">
                    ${isReadable ? '✓ Readable' : '✕ Unreadable / Blurred'}
                  </span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </section>
  `;
}

/**
 * Renders the 3-Second Glance Heatmap.
 */
function renderGlanceHeatmapSection() {
  const { glanceHeatmap } = shopperData;
  const { gazeSequence, backPanelAttentionDuringGlance, estimateDisclaimer } = glanceHeatmap;

  return `
    <section class="glance-container" aria-label="3-Second Glance Heatmap">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <div>
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #0f172a;">
            3-Second Retail Shelf Attention Map
          </h3>
          <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: #64748b;">
            Eye-tracking simulation during the initial 3 seconds a shopper stands before the shelf.
          </p>
        </div>
        <span class="estimate-pill">${estimateDisclaimer}</span>
      </div>

      <!-- Visual Carton PDP Mockup with Radial Heatmap Overlay -->
      <div class="glance-viewer-wrapper" id="glance-viewer">
        <div class="carton-pdp-mockup">
          <div class="pdp-logo-mock">DANCING FISH</div>
          <div class="pdp-claim-mock glow-hazard">★ NO ADDED SUGAR ★</div>
          <div class="pdp-hero-mock">🥣</div>
          <div class="pdp-weight-mock">NET WT 16.9 OZ (480 g)</div>
        </div>

        <!-- Heatmap Radial Glows -->
        ${gazeSequence.map(spot => `
          <div class="heatmap-spot"
               style="left: ${spot.gazeXPercent}%; top: ${spot.gazeYPercent}%; width: ${spot.radiusPx * 2}px; height: ${spot.radiusPx * 2}px;
                      background: radial-gradient(circle, rgba(239, 68, 68, ${spot.intensity}) 0%, rgba(245, 158, 11, 0.45) 45%, rgba(245, 158, 11, 0) 70%);">
          </div>
        `).join('')}
      </div>

      <!-- Timeline Bar -->
      <div class="glance-timeline-bar">
        ${gazeSequence.map(seq => `
          <div class="timeline-step">
            <strong>${seq.timeWindow} (${seq.attentionSharePercent}% Share)</strong>
            <span>${seq.focusTarget}</span>
            <p style="margin: 4px 0 0; font-size: 0.75rem; color: #64748b;">${seq.cognitiveImpression}</p>
          </div>
        `).join('')}
      </div>

      <!-- Back Panel Blindness Notice -->
      <div style="background: #f1f5f9; border-left: 4px solid #64748b; padding: 1rem; border-radius: 6px; margin-top: 1.5rem; font-size: 0.85rem; color: #334155;">
        <strong>⚠️ 0% Attention on Back Panel:</strong> ${backPanelAttentionDuringGlance.observation}
      </div>
    </section>
  `;
}

/**
 * Renders the Accessibility and Color Vision Deficiency module.
 */
function renderAccessibilitySection() {
  const { accessibility } = shopperData;
  const { contrastChecks, colorBlindnessModes } = accessibility;

  return `
    <section class="accessibility-box" aria-label="Accessibility and Contrast Scorecard">
      <div style="margin-bottom: 1.5rem;">
        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #0f172a;">
          Color Vision Deficiency (CVD) & WCAG Contrast Evaluation
        </h3>
        <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: #64748b;">
          Simulate how color-blind shoppers perceive the carton palette and verify contrast compliance.
        </p>
      </div>

      <!-- CVD Mode Buttons -->
      <div class="cvd-selector-row">
        ${colorBlindnessModes.map(mode => `
          <button class="cvd-btn ${currentCvdMode === mode.id ? 'active' : ''}" data-action="set-cvd" data-mode="${mode.id}">
            ${mode.name}
          </button>
        `).join('')}
      </div>

      <!-- Interactive Sample Card with Applied Filter -->
      <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 2rem;">
        <div class="filter-${currentCvdMode}" style="flex: 1; min-width: 280px; background: #fbf7ee; border: 2px solid #cbd5e1; border-radius: 8px; padding: 1.5rem; transition: filter 0.3s ease;">
          <h4 style="margin: 0 0 0.5rem; color: #1a1412;">Dancing Fish · Berry Crunch</h4>
          <div style="background: #dc2626; color: #ffffff; padding: 6px 12px; border-radius: 4px; font-weight: 800; display: inline-block; margin-bottom: 1rem;">
            NO ADDED SUGAR (Simulated in ${currentCvdMode})
          </div>
          <p style="margin: 0; color: #3c2415; font-size: 0.88rem; line-height: 1.45;">
            Pacific Northwest Honey Granola with dried cranberries, blueberries, and California almonds.
          </p>
        </div>

        <div style="flex: 1; min-width: 280px;">
          <h4 style="margin: 0 0 0.75rem; font-size: 0.95rem; color: #0f172a;">WCAG 2.1 Contrast Scorecard</h4>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${contrastChecks.map(check => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.82rem;">
                <span>${check.element}</span>
                <span class="readability-status-tag ${check.status === 'PASS' ? 'readable' : 'unreadable'}">
                  ${check.contrastRatio}:1 (${check.status})
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </section>
  `;
}

/**
 * Renders the Before / After Wipe comparison slider.
 */
function renderBeforeAfterWipeSection() {
  const { beforeAfterWipe } = shopperData;
  const { beforeState, afterState } = beforeAfterWipe;

  return `
    <section class="wipe-container" aria-label="Before and After Carton Wipe Slider">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <div>
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #0f172a;">
            Senior Reviewer Before / After Split Wipe
          </h3>
          <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: #64748b;">
            Drag the divider handle horizontally to compare the uncorrected print run with remediated artwork.
          </p>
        </div>
        <div style="font-size: 0.8rem; font-weight: 700; color: #0284c7;">
          Left: Original Run | Right: Audited Remediation
        </div>
      </div>

      <!-- Wipe Viewport -->
      <div class="wipe-viewport" id="wipe-viewport">
        <!-- Before Layer (Left) -->
        <div class="wipe-layer before">
          <span class="persona-badge unsafe">${beforeState.badge}</span>
          <h4 style="margin: 0.75rem 0 0.5rem; font-size: 1.1rem; color: #991b1b;">${beforeState.title}</h4>
          <ul class="wipe-list">
            ${beforeState.hazards.map(h => `<li><span>❌</span> <span>${h}</span></li>`).join('')}
          </ul>
        </div>

        <!-- After Layer (Right) -->
        <div class="wipe-layer after" id="wipe-after-layer" style="clip-path: polygon(${wipePercentage}% 0, 100% 0, 100% 100%, ${wipePercentage}% 100%);">
          <span class="persona-badge" style="background:#dcfce7;color:#15803d;">${afterState.badge}</span>
          <h4 style="margin: 0.75rem 0 0.5rem; font-size: 1.1rem; color: #166534;">${afterState.title}</h4>
          <ul class="wipe-list">
            ${afterState.remediations.map(r => `<li><span>✓</span> <span>${r}</span></li>`).join('')}
          </ul>
        </div>

        <!-- Divider Handle -->
        <div class="wipe-divider-handle" id="wipe-handle" style="left: ${wipePercentage}%;">
          <div class="wipe-handle-knob">↔</div>
        </div>
      </div>
    </section>
  `;
}

/**
 * Attaches event listeners.
 */
function attachShopperListeners(container) {
  // Navigation tabs
  container.querySelectorAll('.shopper-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      renderShopperWorkbench(container);
    });
  });

  // Shelf distance slider
  const slider = container.querySelector('#shelf-distance-slider');
  if (slider) {
    slider.addEventListener('input', async (e) => {
      currentDistanceM = parseFloat(e.target.value);
      await loadShopperData();
      renderShopperWorkbench(container);
    });
  }

  // CVD mode buttons
  container.querySelectorAll('[data-action="set-cvd"]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentCvdMode = btn.dataset.mode;
      renderShopperWorkbench(container);
    });
  });

  // Persona source inspector click
  container.querySelectorAll('[data-action="inspect-persona-source"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const personaId = btn.dataset.id;
      const persona = shopperData.personas.find(p => p.id === personaId);
      if (persona) openPersonaProofModal(persona);
    });
  });

  // Wipe slider dragging
  const viewport = container.querySelector('#wipe-viewport');
  const handle = container.querySelector('#wipe-handle');
  const afterLayer = container.querySelector('#wipe-after-layer');

  if (viewport && handle && afterLayer) {
    const onMove = (clientX) => {
      const rect = viewport.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      wipePercentage = Math.round((x / rect.width) * 100);
      handle.style.left = `${wipePercentage}%`;
      afterLayer.style.clipPath = `polygon(${wipePercentage}% 0, 100% 0, 100% 100%, ${wipePercentage}% 100%)`;
    };

    handle.addEventListener('mousedown', () => { isDraggingWipe = true; });
    window.addEventListener('mouseup', () => { isDraggingWipe = false; });
    window.addEventListener('mousemove', (e) => {
      if (isDraggingWipe) onMove(e.clientX);
    });

    viewport.addEventListener('touchstart', (e) => {
      onMove(e.touches[0].clientX);
    });
    viewport.addEventListener('touchmove', (e) => {
      onMove(e.touches[0].clientX);
    });
  }
}

/**
 * Opens proof inspector modal for a persona showing verbatim source proof.
 */
function openPersonaProofModal(persona) {
  const modalContainer = document.querySelector('#shopper-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="block-inspector-overlay">
      <div class="block-inspector-modal" role="dialog" aria-modal="true">
        <div class="block-inspector-header">
          <h4>${persona.icon} Persona Proof Chain: ${persona.name}</h4>
          <button class="block-inspector-close" id="shopper-modal-close-btn">&times;</button>
        </div>
        <div class="block-inspector-body">
          <div class="inspector-meta-row">
            <strong>Audited Verdict:</strong>
            <span style="font-weight: 700; color: #b91c1c;">${persona.oneLineVerdict}</span>
          </div>
          <div class="inspector-meta-row">
            <strong>Regulatory Citation:</strong>
            <span>${persona.ruleCitation}</span>
          </div>
          <div class="inspector-meta-row">
            <strong>Affected Panel & Location:</strong>
            <span>${persona.panel} (x: ${persona.positionMm.x} mm, y: ${persona.positionMm.y} mm)</span>
          </div>
          <div style="margin-top: 0.5rem;">
            <strong>Verbatim Carton Finding:</strong>
            <div class="inspector-quote-box" style="border-left-color: #dc2626; color: #991b1b; margin-top: 4px;">
              "${persona.verbatimCartonText}"
            </div>
          </div>
          <div style="margin-top: 0.5rem;">
            <strong>Approved Specification Requirement:</strong>
            <div class="inspector-quote-box" style="border-left-color: #16a34a; color: #166534; margin-top: 4px;">
              "${persona.approvedSpecText}"
            </div>
          </div>
          <div style="margin-top: 0.5rem;">
            <strong>Underlying Evidence Sources (${persona.sources.length}):</strong>
            <ul style="padding-left: 1.25rem; margin: 4px 0; font-size: 0.8rem; color: #475569;">
              ${persona.sources.map(s => `
                <li><strong>${s.file}</strong> · ${s.location}: <em>"${s.quote}"</em></li>
              `).join('')}
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;

  document.querySelector('#shopper-modal-close-btn').addEventListener('click', () => {
    modalContainer.innerHTML = '';
  });
  modalContainer.querySelector('.block-inspector-overlay').addEventListener('click', (e) => {
    if (e.target.classList.contains('block-inspector-overlay')) {
      modalContainer.innerHTML = '';
    }
  });
}
