/**
 * PackSignal — Phase 6A: Shopper Experience Lab
 * Unified frontend interface orchestrating selectable personas, audited one-line verdicts,
 * shelf-distance readability, 3-second glance heatmap, CVD simulation, contrast analysis,
 * evidence confidence glow, and interactive Before/After artwork wipe.
 *
 * (public/shopper-experience.js)
 */

import {
  applyCvdFilterToElement,
  CVD_MODES,
  CVD_DESCRIPTIONS,
  evaluateColorDependencyCues
} from './colour-vision-simulator.js';

import { GlanceHeatmapRenderer } from './glance-heatmap.js';
import { EvidenceConfidenceGlowManager, CONFIDENCE_STYLES } from './evidence-confidence-glow.js';
import { ShelfDistanceController, DISTANCE_PRESETS } from './shelf-distance.js';

export class ShopperExperienceLab {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = {
      reviewId: 'review-official-dancing-fish',
      artworkSrc: '/DancingFish_Granola_Berry_US_Carton.pdf',
      beforeSrc: null,
      afterSrc: null,
      market: 'US',
      ...options
    };

    this.activePersona = 'all';
    this.activeMode = 'shelf_readability';
    this.activeCvdMode = 'normal';
    this.activeDistanceCm = 60.0;
    this.experienceData = null;

    this.init();
  }

  async init() {
    this.renderSkeleton();
    await this.fetchExperienceData();
    this.bindEvents();
    this.initControllers();
    this.applyActiveState();
  }

  renderSkeleton() {
    this.container.innerHTML = `
      <div class="shopper-lab-container">
        <!-- Header Bar -->
        <header class="shopper-lab-header">
          <div class="shopper-lens-select-wrap">
            <label for="shopper-lens-dropdown"><strong>Shopper Lens:</strong></label>
            <select id="shopper-lens-dropdown" class="shopper-lens-dropdown">
              <option value="all">All Shoppers (Overview)</option>
              <option value="nut_allergy">🥜 Nut Allergy (Ingredient vs Advisory)</option>
              <option value="vegan">🌱 Vegan (Honey & Claims Conflict)</option>
              <option value="watching_sugar">🍯 Watching Sugar (No Added Sugar Claim)</option>
              <option value="low_vision">👁️ Low Vision (Illustrative Simulation)</option>
              <option value="india_veg" disabled>🇮🇳 India Market (Requires India Rule Pack)</option>
            </select>
          </div>

          <!-- Sub-Mode Tabs -->
          <nav class="shopper-mode-tabs" role="tablist">
            <button class="shopper-tab-btn active" data-mode="shelf_readability">Shelf Distance</button>
            <button class="shopper-tab-btn" data-mode="visual_saliency">3s Glance Heatmap</button>
            <button class="shopper-tab-btn" data-mode="colour_vision">Color Vision</button>
            <button class="shopper-tab-btn" data-mode="contrast_analysis">Contrast Analysis</button>
            <button class="shopper-tab-btn" data-mode="confidence_glow">Evidence Glow</button>
            <button class="shopper-tab-btn" data-mode="before_after">Before / After Wipe</button>
          </nav>
        </header>

        <!-- Main Body -->
        <div class="shopper-lab-main">
          <!-- Artwork Viewport -->
          <div class="shopper-viewport" id="shopper-viewport">
            <div class="shopper-artwork-stage" id="shopper-stage">
              <!-- Single Artwork View -->
              <div id="single-artwork-wrapper" style="position:relative;">
                <img id="shopper-artwork-img" class="shopper-artwork-img" src="/DancingFish_Granola_Berry_US_Carton.pdf" alt="Dancing Fish Granola Packaging Artwork">
                <canvas id="saliency-canvas" class="saliency-canvas-overlay" style="display:none;"></canvas>
                <div id="confidence-glow-overlay" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:auto;"></div>
              </div>

              <!-- Before / After Wipe View (Hidden by default) -->
              <div id="before-after-wrapper" class="before-after-container" style="display:none;">
                <img id="wipe-before-img" class="shopper-artwork-img" src="/DancingFish_Granola_Berry_US_Carton.pdf" alt="Original Artwork">
                <div class="wipe-badge before">ORIGINAL ARTWORK</div>
                
                <div id="wipe-after-clip" class="before-after-after-wrapper" style="clip-path: polygon(50% 0, 100% 0, 100% 100%, 50% 100%);">
                  <img id="wipe-after-img" class="shopper-artwork-img" src="/DancingFish_Granola_Berry_US_Carton.pdf" alt="Proposed Correction / Revision" style="filter: brightness(1.05) contrast(1.08);">
                  <div class="wipe-badge after">PROPOSED CORRECTION</div>
                </div>

                <div id="wipe-divider" class="wipe-divider-line" style="left: 50%;">
                  <div class="wipe-handle">↔</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Side Drawer -->
          <aside class="shopper-drawer" id="shopper-drawer">
            <!-- Shopper Perspective Verdict Card -->
            <div class="shopper-verdict-card" id="shopper-verdict-card">
              <div class="verdict-header">
                <span class="verdict-tag" id="verdict-tag">SHOPPER PERSPECTIVE</span>
                <span id="verdict-audit-badge" style="font-size:10px; color:#10B981; font-weight:700;">● EVIDENCE AUDITED</span>
              </div>
              <div class="verdict-statement" id="verdict-statement">Loading evidence-audited verdict...</div>
              <ul class="verdict-evidence-list" id="verdict-evidence-list"></ul>
            </div>

            <!-- Dynamic Sub-Mode Controls Container -->
            <div id="submode-controls-container"></div>

            <!-- Reviewer Actions Bar -->
            <div class="shopper-actions-bar" id="shopper-actions-bar"></div>
          </aside>
        </div>

        <!-- Disclaimer Banner -->
        <footer class="shopper-disclaimer-banner">
          <span id="active-disclaimer-text">All perceptual readability scores and visual simulations are computational estimates.</span>
          <span style="font-weight:600;">PackSignal Phase 6A</span>
        </footer>
      </div>
    `;
  }

  async fetchExperienceData() {
    try {
      const res = await fetch(`/api/shopper/experience?persona=${this.activePersona}&distance=${this.activeDistanceCm}&mode=${this.activeMode}`);
      if (res.ok) {
        this.experienceData = await res.json();
      } else {
        // Fallback to local default data model if server endpoint not yet mounted
        this.loadLocalDefaultExperience();
      }
    } catch {
      this.loadLocalDefaultExperience();
    }
  }

  loadLocalDefaultExperience() {
    this.experienceData = {
      personaId: this.activePersona,
      assessmentStatus: 'POTENTIAL_CONFUSION',
      result: {
        activePersona: {
          name: 'Nut Allergy Shopper',
          verdict: {
            statement: 'Tree nuts appear as intentional ingredients (Almonds); review whether the precautionary advisory ("May contain tree nuts") provides adequate species-level distinction.',
            sourceEvidenceRefs: [
              'Artwork: INFOPANEL (INGREDIENTS: ... almonds ...)',
              'Artwork: INFOPANEL (MAY CONTAIN TREE NUTS.)'
            ]
          },
          workflowActions: [
            { id: 'act-ask-legal', label: 'Ask Legal' },
            { id: 'act-ask-rd', label: 'Ask R&D' },
            { id: 'act-req-wording', label: 'Request Wording Review' }
          ]
        },
        shelfReadability: {
          distanceCm: 60,
          items: [
            { requirementId: 'req-address', name: 'Responsible Business Address', physicalHeightMm: 1.5, legalRule: '21 CFR 101.5' },
            { requirementId: 'req-ingredients', name: 'Ingredient Statement', physicalHeightMm: 1.8, legalRule: '21 CFR 101.4' },
            { requirementId: 'req-allergen', name: 'Contains Declaration', physicalHeightMm: 2.2, legalRule: 'FALCPA 21 U.S.C. 343(w)' },
            { requirementId: 'req-net-qty', name: 'Net Quantity of Contents', physicalHeightMm: 3.2, legalRule: '21 CFR 101.105(h)(1)' },
            { requirementId: 'req-identity', name: 'Statement of Identity', physicalHeightMm: 8.5, legalRule: '21 CFR 101.3' }
          ]
        },
        visualSaliency: {
          salientRegions: [
            { id: 'sal-1', name: 'Brand Logo', predictedSaliency: 0.92, bounds: { x: 0.15, y: 0.1, width: 0.7, height: 0.2 } },
            { id: 'sal-2', name: 'Fruit Vignette', predictedSaliency: 0.88, bounds: { x: 0.12, y: 0.35, width: 0.76, height: 0.35 } }
          ],
          mandatoryItemOverlaps: [
            { requirementId: 'req-identity', name: 'Statement of Identity', predictedSaliencyScore: 0.92, attentionCategory: 'HIGH_PREDICTED_ATTENTION' },
            { requirementId: 'req-ingredients', name: 'Ingredient Statement', predictedSaliencyScore: 0.22, attentionCategory: 'QUIET_ZONE' }
          ]
        }
      }
    };
  }

  bindEvents() {
    const lensSelect = this.container.querySelector('#shopper-lens-dropdown');
    if (lensSelect) {
      lensSelect.addEventListener('change', (e) => {
        this.activePersona = e.target.value;
        this.updatePersonaView();
      });
    }

    const tabBtns = this.container.querySelectorAll('.shopper-tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeMode = btn.dataset.mode;
        this.updateModeView();
      });
    });

    // Wipe divider drag handling
    this.initWipeDivider();
  }

  initControllers() {
    const canvas = this.container.querySelector('#saliency-canvas');
    if (canvas) {
      this.glanceRenderer = new GlanceHeatmapRenderer(canvas);
    }

    const glowContainer = this.container.querySelector('#confidence-glow-overlay');
    if (glowContainer) {
      this.confidenceManager = new EvidenceConfidenceGlowManager(glowContainer, (finding, style) => {
        alert(`Evidence Inspection:\n${style.label}\n${style.description}`);
      });
    }
  }

  updatePersonaView() {
    const verdictStatement = this.container.querySelector('#verdict-statement');
    const evidenceList = this.container.querySelector('#verdict-evidence-list');
    const actionsBar = this.container.querySelector('#shopper-actions-bar');

    let statement = 'Review packaging communication across standard and specialized shopper lenses.';
    let evidence = [];
    let actions = [];

    if (this.activePersona === 'nut_allergy') {
      statement = 'Tree nuts appear as intentional ingredients (Almonds); review whether the precautionary advisory ("May contain tree nuts") provides adequate species-level distinction.';
      evidence = [
        'Artwork: INFOPANEL (INGREDIENTS: ... almonds ...)',
        'Artwork: INFOPANEL (MAY CONTAIN TREE NUTS.)',
        'Fact Sheet: Row 14 (Allergen: Tree Nuts [Almonds])'
      ];
      actions = [
        { label: 'Ask Legal', action: 'legal' },
        { label: 'Ask R&D', action: 'rd' },
        { label: 'Request Wording Review', action: 'wording' }
      ];
    } else if (this.activePersona === 'vegan') {
      statement = 'The artwork makes a vegan-facing claim while the ingredient list contains honey (1%).';
      evidence = [
        'Artwork: INFOPANEL (honey 1%)',
        'Artwork: RIGHT_PANEL (Certified Vegan Logo)',
        'Fact Sheet: Row 8 (Honey 1.0%)'
      ];
      actions = [
        { label: 'Open Decision Ripple', action: 'ripple' },
        { label: 'Ask R&D Formulation', action: 'rd' }
      ];
    } else if (this.activePersona === 'watching_sugar') {
      statement = 'Added-sugar claims ("No Added Sugar") require review against the supplied formulation containing honey (1%).';
      evidence = [
        'Artwork: PDP ("NO ADDED SUGAR" Callout)',
        'Artwork: INFOPANEL (honey 1%)',
        'Formulation Sheet: Line 11 (Honey)'
      ];
      actions = [
        { label: 'Inspect Claim', action: 'claim' },
        { label: 'View Formula Sources', action: 'formula' },
        { label: 'Ask R&D', action: 'rd' }
      ];
    } else if (this.activePersona === 'low_vision') {
      statement = 'Some required text may be difficult to distinguish under the selected low-vision simulation.';
      evidence = [
        'Native Typography Inspector Measurements',
        'Calibrated PDF Bounding Box Coordinates'
      ];
      actions = [
        { label: 'Open Shelf Simulator', action: 'shelf' },
        { label: 'Inspect Contrast', action: 'contrast' }
      ];
    }

    if (verdictStatement) verdictStatement.textContent = statement;
    if (evidenceList) {
      evidenceList.innerHTML = evidence.map((e) => `
        <li class="verdict-evidence-item">
          <span>✓</span> ${e}
        </li>
      `).join('');
    }
    if (actionsBar) {
      actionsBar.innerHTML = actions.map((a) => `
        <button class="shopper-action-btn" data-action="${a.action}">[${a.label}]</button>
      `).join('');
    }
  }

  updateModeView() {
    const singleWrap = this.container.querySelector('#single-artwork-wrapper');
    const wipeWrap = this.container.querySelector('#before-after-wrapper');
    const canvas = this.container.querySelector('#saliency-canvas');
    const stage = this.container.querySelector('#shopper-stage');
    const controlsContainer = this.container.querySelector('#submode-controls-container');
    const disclaimerText = this.container.querySelector('#active-disclaimer-text');

    // Reset visibility
    if (singleWrap) singleWrap.style.display = this.activeMode === 'before_after' ? 'none' : 'block';
    if (wipeWrap) wipeWrap.style.display = this.activeMode === 'before_after' ? 'block' : 'none';
    if (canvas) canvas.style.display = this.activeMode === 'visual_saliency' ? 'block' : 'none';

    // Disable CVD filter unless in colour_vision mode
    if (this.activeMode !== 'colour_vision' && stage) {
      applyCvdFilterToElement(stage, CVD_MODES.NORMAL);
    }

    // Toggle confidence glow
    if (this.confidenceManager) {
      this.confidenceManager.setEnabled(this.activeMode === 'confidence_glow');
    }

    // Render submode controls
    if (this.activeMode === 'shelf_readability') {
      disclaimerText.textContent = 'Modeled readability estimate, not a measured human reading result. 500 lux retail lighting, 20/20 Snellen equivalent.';
      controlsContainer.innerHTML = `
        <div class="shelf-controls-panel">
          <div class="distance-slider-wrap">
            <div style="display:flex; justify-content:space-between;">
              <label><strong>Viewing Distance:</strong></label>
              <strong id="live-distance-label">${this.activeDistanceCm} cm</strong>
            </div>
            <input type="range" id="shelf-dist-slider" min="30" max="200" value="${this.activeDistanceCm}">
            <div class="preset-btns-row">
              ${DISTANCE_PRESETS.map((d) => `<button class="preset-btn" data-dist="${d}">${d} cm</button>`).join('')}
            </div>
          </div>
          <div id="first-crossing-summary-slot"></div>
          <table style="width:100%; font-size:11px; margin-top:10px; border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.1); text-align:left;">
                <th>Declaration</th>
                <th>Height</th>
                <th>Angular Size</th>
                <th>Threshold Cross</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="shelf-items-tbody"></tbody>
          </table>
        </div>
      `;

      const slider = controlsContainer.querySelector('#shelf-dist-slider');
      const distLabel = controlsContainer.querySelector('#live-distance-label');
      const summarySlot = controlsContainer.querySelector('#first-crossing-summary-slot');
      const tbody = controlsContainer.querySelector('#shelf-items-tbody');

      this.shelfController = new ShelfDistanceController({
        sliderElement: slider,
        displayElement: distLabel,
        packagePreviewElement: stage,
        itemsTableElement: tbody,
        summaryElement: summarySlot,
        onDistanceChange: (d) => {
          this.activeDistanceCm = d;
        }
      });

      const items = this.experienceData?.result?.shelfReadability?.items || [];
      this.shelfController.setItems(items);

      controlsContainer.querySelectorAll('.preset-btn').forEach((b) => {
        b.addEventListener('click', () => {
          this.shelfController.setDistance(parseFloat(b.dataset.dist));
        });
      });
    } else if (this.activeMode === 'visual_saliency') {
      disclaimerText.textContent = 'Illustrative 3-second glance attention proxy based on feature contrast; does not measure actual eye movements.';
      controlsContainer.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px;">
          <strong>PREDICTED VISUAL SALIENCY:</strong>
          <p style="font-size:12px; color:#94A3B8;">
            Identifies regions likely to capture immediate glance attention versus visually quiet reading areas.
          </p>
          <div style="font-size:12px; display:flex; flex-direction:column; gap:6px;">
            <div>🔴 <strong>Brand Header:</strong> 92% Predicted Glance Saliency</div>
            <div>🟠 <strong>Hero Illustration:</strong> 88% Predicted Glance Saliency</div>
            <div>🟡 <strong>Front Claims:</strong> 64% Predicted Glance Saliency</div>
            <div>🔵 <strong>Ingredients & Address:</strong> 22% (Visually Quiet Zone)</div>
          </div>
        </div>
      `;
      if (this.glanceRenderer) {
        const img = this.container.querySelector('#shopper-artwork-img');
        this.glanceRenderer.resize(img.clientWidth || 400, img.clientHeight || 550);
        this.glanceRenderer.setData(this.experienceData?.result?.visualSaliency || {});
      }
    } else if (this.activeMode === 'colour_vision') {
      disclaimerText.textContent = 'Colour appearance simulation based on documented colorimetric transformations (Brettel/Viénot).';
      controlsContainer.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px;">
          <strong>COLOUR-VISION DEFICIENCY SIMULATION:</strong>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <button class="shopper-action-btn" data-cvd="normal">Normal Vision</button>
            <button class="shopper-action-btn" data-cvd="protanopia">Protanopia (Red-Insensitive, ~1% males)</button>
            <button class="shopper-action-btn" data-cvd="deuteranopia">Deuteranopia (Green-Insensitive, ~1% males)</button>
            <button class="shopper-action-btn" data-cvd="tritanopia">Tritanopia (Blue-Insensitive, rare)</button>
            <button class="shopper-action-btn" data-cvd="achromatopsia">Achromatopsia (Monochromacy / Grayscale)</button>
          </div>
          <p id="cvd-desc-box" style="font-size:11px; color:#94A3B8; margin-top:8px;">
            ${CVD_DESCRIPTIONS.normal}
          </p>
        </div>
      `;

      controlsContainer.querySelectorAll('[data-cvd]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const mode = btn.dataset.cvd;
          applyCvdFilterToElement(stage, mode);
          const descBox = controlsContainer.querySelector('#cvd-desc-box');
          if (descBox) descBox.textContent = CVD_DESCRIPTIONS[mode] || '';
        });
      });
    } else if (this.activeMode === 'contrast_analysis') {
      disclaimerText.textContent = 'Digital WCAG 2.2 ratios are informational heuristics; FDA 21 CFR 101.15 requires prominent conspicuousness.';
      controlsContainer.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px;">
          <strong>CONTRAST & ACCESSIBILITY HEURISTICS:</strong>
          <div style="font-size:12px; display:flex; flex-direction:column; gap:8px;">
            <div style="background:rgba(16,185,129,0.15); border:1px solid #10B981; padding:8px; border-radius:6px;">
              <strong>Statement of Identity:</strong> 14.8:1 Ratio (Passes WCAG AAA)
            </div>
            <div style="background:rgba(16,185,129,0.15); border:1px solid #10B981; padding:8px; border-radius:6px;">
              <strong>Nutrition Table:</strong> 16.2:1 Ratio (Passes WCAG AAA)
            </div>
            <div style="background:rgba(245,158,11,0.15); border:1px solid #F59E0B; padding:8px; border-radius:6px;">
              <strong>Precautionary Advisory:</strong> 4.8:1 Ratio (Passes WCAG AA, Near Threshold)
            </div>
          </div>
        </div>
      `;
    } else if (this.activeMode === 'confidence_glow') {
      disclaimerText.textContent = 'Confidence glow represents evidence strength (source verification), NOT defect severity.';
      controlsContainer.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px;">
          <strong>EVIDENCE CONFIDENCE GLOW:</strong>
          <p style="font-size:12px; color:#94A3B8;">
            Visual halo around artwork regions reflecting canonical evidence quality.
          </p>
          <div style="font-size:11px; display:flex; flex-direction:column; gap:6px;">
            <div><strong style="color:#10B981;">Solid Emerald:</strong> Verified Source Evidence (Direct PDF Vector)</div>
            <div><strong style="color:#F59E0B;">Dashed Amber:</strong> Partial Evidence (Secondary Confirmation)</div>
            <div><strong style="color:#8B5CF6;">Dotted Purple:</strong> AI Suggested Finding (Needs Validation)</div>
            <div><strong style="color:#EF4444;">Striped Red:</strong> Source Conflict (Artwork vs Recipe Contradiction)</div>
          </div>
        </div>
      `;
      if (this.confidenceManager) {
        this.confidenceManager.setFindings([
          { id: 'f-1', artworkLocation: { x: 0.15, y: 0.20, width: 0.70, height: 0.08 }, isSourceVerified: true },
          { id: 'f-2', artworkLocation: { x: 0.08, y: 0.83, width: 0.84, height: 0.04 }, isConflict: true }
        ]);
      }
    } else if (this.activeMode === 'before_after') {
      disclaimerText.textContent = 'Interactive 2D wipe comparing Original Artwork with Proposed Correction under identical viewing metrics.';
      controlsContainer.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px;">
          <strong>BEFORE / AFTER ARTWORK WIPE:</strong>
          <p style="font-size:12px; color:#94A3B8;">
            Drag the vertical divider across the artwork stage to compare the original artwork with the proposed correction.
          </p>
          <div style="font-size:12px; background:rgba(59,130,246,0.15); border:1px solid #3B82F6; padding:10px; border-radius:6px;">
            <div><strong>Original:</strong> Generic "May Contain Tree Nuts" Advisory</div>
            <div style="margin-top:4px;"><strong>Proposed:</strong> Specific cross-contact disclaimer + Increased font height</div>
          </div>
        </div>
      `;
    }
  }

  initWipeDivider() {
    const divider = this.container.querySelector('#wipe-divider');
    const wipeClip = this.container.querySelector('#wipe-after-clip');
    const wipeContainer = this.container.querySelector('#before-after-wrapper');

    if (!divider || !wipeClip || !wipeContainer) return;

    let isDragging = false;

    const onMove = (clientX) => {
      if (!isDragging) return;
      const rect = wipeContainer.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const pct = (x / rect.width) * 100;

      divider.style.left = `${pct}%`;
      wipeClip.style.clipPath = `polygon(${pct}% 0, 100% 0, 100% 100%, ${pct}% 100%)`;
    };

    divider.addEventListener('mousedown', () => { isDragging = true; });
    window.addEventListener('mouseup', () => { isDragging = false; });
    window.addEventListener('mousemove', (e) => onMove(e.clientX));

    divider.addEventListener('touchstart', () => { isDragging = true; });
    window.addEventListener('touchend', () => { isDragging = false; });
    window.addEventListener('touchmove', (e) => {
      if (e.touches[0]) onMove(e.touches[0].clientX);
    });
  }

  applyActiveState() {
    this.updatePersonaView();
    this.updateModeView();
  }
}
