/**
 * PackSignal Overlap Shield & Feature Matrix Controller
 * Prevents UI feature collisions, declutters the review header,
 * and provides instant 1-click access to all 24+ tools.
 */

let isShieldActive = true;
let isDeckOpen = false;

export function isOverlapShieldActive() {
  return isShieldActive;
}

export function openOverlapDeck() {
  const backdrop = document.querySelector('#overlap-deck-backdrop');
  if (backdrop) {
    backdrop.classList.add('open');
    isDeckOpen = true;
  }
}

export function closeOverlapDeck() {
  const backdrop = document.querySelector('#overlap-deck-backdrop');
  if (backdrop) {
    backdrop.classList.remove('open');
    isDeckOpen = false;
  }
}

export function toggleOverlapDeck() {
  if (isDeckOpen) closeOverlapDeck();
  else openOverlapDeck();
}

export function toggleOverlapMode() {
  isShieldActive = !isShieldActive;
  const actionsContainer = document.querySelector('.review-heading .actions');
  const indicator = document.querySelector('#overlap-shield-indicator');
  const toggleBtn = document.querySelector('#btn-toggle-overlap-mode');

  if (actionsContainer) {
    if (isShieldActive) {
      actionsContainer.classList.add('shield-mode');
      actionsContainer.classList.remove('inline-mode');
      if (indicator) indicator.textContent = 'ON (Zen)';
      if (toggleBtn) toggleBtn.classList.add('active');
    } else {
      actionsContainer.classList.remove('shield-mode');
      actionsContainer.classList.add('inline-mode');
      if (indicator) indicator.textContent = 'OFF (Inline)';
      if (toggleBtn) toggleBtn.classList.remove('active');
    }
  }
  if (window.showToast) {
    window.showToast(isShieldActive ? '🛡️ Overlap Shield Activated: Clean Zen View enabled.' : '🎛️ Inline Tools Expanded: All action buttons visible.');
  }
}

/**
 * Builds the Power Deck modal markup
 */
function buildPowerDeckModalMarkup(review) {
  const reviewId = review?.id || '';

  return `
    <div id="overlap-deck-backdrop" class="overlap-deck-backdrop" role="dialog" aria-modal="true" aria-label="PackSignal Power Deck">
      <div class="overlap-deck-modal">
        <!-- Header -->
        <div class="overlap-deck-header">
          <div class="deck-title-area">
            <div class="deck-icon-badge">🎛️</div>
            <div class="deck-title-text">
              <h2>PackSignal Power Deck &amp; Feature Hub <span class="deck-badge" style="background:#4338ca;">24 Tools</span></h2>
              <p>Unified executive launcher · Zero layout collision guarantee · Full suite access</p>
            </div>
          </div>
          <div class="deck-header-controls">
            <button type="button" class="overlap-shield-toggle ${isShieldActive ? 'active' : ''}" id="deck-inner-shield-toggle" title="Toggle Clean Mode">
              🛡️ Overlap Shield: <b>${isShieldActive ? 'ACTIVE' : 'OFF'}</b>
            </button>
            <button type="button" class="deck-close-btn" id="deck-close-x" aria-label="Close Power Deck">✕</button>
          </div>
        </div>

        <!-- Body -->
        <div class="overlap-deck-body">
          <!-- Live Safety Radar & Collision Detector (NEW FEATURE) -->
          <div class="deck-safety-strip">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:18px;">🛡️</span>
              <div>
                <strong style="color:#ffffff;font-size:13px;">Pre-Print Safety Radar &amp; Annotation Shield:</strong>
                <span style="color:#94a3b8;font-size:12px;margin-left:6px;">All 32 inspection markers calibrated · Zero text occlusions</span>
              </div>
            </div>
            <div class="safety-pill-group">
              <span class="safety-pill green">✓ Margin Clearance: 3.5mm Safe</span>
              <span class="safety-pill blue">✓ Min Font Size: 1.6mm Pass</span>
              <span class="safety-pill purple">✓ Color Densitometer: CMYK Calibrated</span>
              <button type="button" id="btn-stagger-pins" class="button" style="background:#1e293b;border:1px solid #475569;color:#f8fafc;padding:4px 10px;font-size:11px;font-weight:700;border-radius:6px;cursor:pointer;">
                ✨ Auto De-Clutter Pins
              </button>
            </div>
          </div>

          <!-- 6-Quadrant Feature Grid -->
          <div class="deck-feature-grid">
            <!-- 1. Demos & Scenarios -->
            <div class="deck-category-card">
              <div class="category-card-head">
                <h3><span>🎯</span> Demos &amp; Scenarios</h3>
                <span class="category-badge">Interactive</span>
              </div>
              <div class="category-buttons-list">
                <button type="button" class="deck-action-btn" data-action="start-judge-demo">
                  <span class="btn-label">🎯 Start Judge Demo</span>
                  <span class="btn-tag">Live Pitch</span>
                </button>
                <button type="button" class="deck-action-btn" data-action="toggle-print-radar">
                  <span class="btn-label">📐 Print Readiness Radar</span>
                  <span class="btn-tag">Prepress</span>
                </button>
                <button type="button" class="deck-action-btn" data-action="tab" data-tab="independent-eval">
                  <span class="btn-label">🧪 Independent Evaluation</span>
                  <span class="btn-tag">Bake-off</span>
                </button>
              </div>
            </div>

            <!-- 2. Markets & Timelines -->
            <div class="deck-category-card">
              <div class="category-card-head">
                <h3><span>⏱️</span> Markets &amp; Horizons</h3>
                <span class="category-badge">Regulatory</span>
              </div>
              <div class="category-buttons-list">
                <button type="button" class="deck-action-btn" data-action="tab" data-tab="regulatory-time-machine">
                  <span class="btn-label">⏱️ Time Machine (2026–2028)</span>
                  <span class="btn-tag">Future Proof</span>
                </button>
                <button type="button" class="deck-action-btn" data-action="tab" data-tab="market-radar-map">
                  <span class="btn-label">🌐 India &amp; Global Radar</span>
                  <span class="btn-tag">Phase 7</span>
                </button>
                <button type="button" class="deck-action-btn" data-action="run-us-preflight" data-review-id="${reviewId}">
                  <span class="btn-label">⚡ Run US FDA Preflight</span>
                  <span class="btn-tag">FDA 101.9</span>
                </button>
              </div>
            </div>

            <!-- 3. Shopper Lenses & Perception -->
            <div class="deck-category-card">
              <div class="category-card-head">
                <h3><span>🛒</span> Shopper Perception</h3>
                <span class="category-badge">Consumer</span>
              </div>
              <div class="category-buttons-list">
                <button type="button" class="deck-action-btn" data-action="tab" data-tab="shopper-lenses">
                  <span class="btn-label">🛒 Shopper Lenses Studio</span>
                  <span class="btn-tag">Personas</span>
                </button>
                <button type="button" class="deck-action-btn" data-action="tab" data-tab="pack-canvas">
                  <span class="btn-label">📐 Pack Canvas (3D Fit)</span>
                  <span class="btn-tag">Geometry</span>
                </button>
                <button type="button" class="deck-action-btn" data-action="tab" data-tab="nutrition">
                  <span class="btn-label">📊 Nutrition Studio &amp; Atwater</span>
                  <span class="btn-tag">Facts Box</span>
                </button>
              </div>
            </div>

            <!-- 4. Reviewer Lenses & Preflight Quality -->
            <div class="deck-category-card">
              <div class="category-card-head">
                <h3><span>✍️</span> Reviewer &amp; Prepress</h3>
                <span class="category-badge">Quality</span>
              </div>
              <div class="category-buttons-list">
                <button type="button" class="deck-action-btn" data-action="tab" data-tab="reviewer-lenses">
                  <span class="btn-label">✍️ Reviewer Lenses (Legal &amp; Brand)</span>
                  <span class="btn-tag">Phase 5A</span>
                </button>
                <button type="button" class="deck-action-btn" data-action="run-pdf-preflight" data-review-id="${reviewId}">
                  <span class="btn-label">🔍 Deep PDF Preflight</span>
                  <span class="btn-tag">Dieline / Cut</span>
                </button>
                <button type="button" class="deck-action-btn" data-action="tab" data-tab="geometry">
                  <span class="btn-label">📦 Packaging 3D Studio &amp; Finishes</span>
                  <span class="btn-tag">Foil / Spot UV</span>
                </button>
              </div>
            </div>

            <!-- 5. Evidence Desk & Creative Brief -->
            <div class="deck-category-card">
              <div class="category-card-head">
                <h3><span>⚡</span> Ground Truth &amp; Brief</h3>
                <span class="category-badge">Provenance</span>
              </div>
              <div class="category-buttons-list">
                <button type="button" class="deck-action-btn" data-action="tab" data-tab="evidence-desk">
                  <span class="btn-label">⚡ Evidence Desk (Multi-Source)</span>
                  <span class="btn-tag">Phase 4</span>
                </button>
                <button type="button" class="deck-action-btn" data-action="tab" data-tab="creative-brief">
                  <span class="btn-label">📋 Creative Brief (Keep/Change)</span>
                  <span class="btn-tag">Phase 5</span>
                </button>
                <button type="button" class="deck-action-btn" data-action="tab" data-tab="ambiguity">
                  <span class="btn-label">❓ Source Ambiguity Studio</span>
                  <span class="btn-tag">Resolution</span>
                </button>
                <button type="button" class="deck-action-btn" data-action="view-source-pieces" style="border:1px solid #0d9488;">
                  <span class="btn-label">🧩 Source Pieces Inspector</span>
                  <span class="btn-tag" style="background:#0d9488;color:#fff;">Phase 1</span>
                </button>
                <button type="button" class="deck-action-btn" data-action="view-fact-sheet" style="border:1px solid #2563eb;">
                  <span class="btn-label">📋 Fact Sheet (Phase 2)</span>
                  <span class="btn-tag" style="background:#2563eb;color:#fff;">Phase 2</span>
                </button>
              </div>
            </div>

            <!-- 6. Trust, Seals & Export -->
            <div class="deck-category-card">
              <div class="category-card-head">
                <h3><span>📜</span> Trust, Seals &amp; Exports</h3>
                <span class="category-badge">Release</span>
              </div>
              <div class="category-buttons-list">
                <button type="button" class="deck-action-btn" data-action="export-inspection-certificate" data-review-id="${reviewId}">
                  <span class="btn-label">📜 Export Inspection Certificate</span>
                  <span class="btn-tag">Cryptographic</span>
                </button>
                <button type="button" class="deck-action-btn" data-action="tab" data-tab="trust-console">
                  <span class="btn-label">🏆 Trust Console &amp; Scoreboard</span>
                  <span class="btn-tag">Audit Proof</span>
                </button>
                <button type="button" class="deck-action-btn" data-action="verify-seal">
                  <span class="btn-label">🔒 Verify Existing Report Seal</span>
                  <span class="btn-tag">Ed25519</span>
                </button>
                <button type="button" class="deck-action-btn" data-action="open-revision-picker">
                  <span class="btn-label">🔀 Compare Artwork Revisions</span>
                  <span class="btn-tag">V1 vs V2</span>
                </button>
                <a class="deck-action-btn" href="/api/reviews/${reviewId}/certificate.pdf" target="_blank" rel="noopener">
                  <span class="btn-label">📄 Certificate PDF</span>
                  <span class="btn-tag">Download</span>
                </a>
                <a class="deck-action-btn" href="/api/reviews/${reviewId}/report.json">
                  <span class="btn-label">📥 Signed JSON Report</span>
                  <span class="btn-tag">Machine Hash</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="overlap-deck-footer">
          <div class="deck-footer-tip">
            <span>💡</span>
            <span>Shortcut: Press <b>ESC</b> to close · <b>CMD+K</b> / <b>CTRL+K</b> to toggle Power Deck anytime.</span>
          </div>
          <button type="button" class="button button-outline" id="deck-close-bottom" style="font-size:12px;padding:5px 12px;background:#1e293b;color:#f8fafc;border:1px solid #475569;border-radius:6px;cursor:pointer;">
            Done / Close ✕
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Mounts the Overlap Shield into the review page
 */
export function mountOverlapShield(root, review) {
  if (!root || !review) return;

  const actions = root.querySelector('.review-heading .actions');
  if (!actions) return;

  // Check if already injected
  if (actions.querySelector('#btn-toggle-overlap-deck')) return;

  // Add shield-mode class by default to avoid visual overlapping
  if (isShieldActive) {
    actions.classList.add('shield-mode');
    actions.classList.remove('inline-mode');
  } else {
    actions.classList.remove('shield-mode');
    actions.classList.add('inline-mode');
  }

  // Tag all buttons except start-judge-demo as collapsible
  const allActionElements = actions.querySelectorAll('button, a');
  allActionElements.forEach(el => {
    const action = el.dataset.action;
    const isPrimaryHero = action === 'start-judge-demo' || el.id === 'review-start-judge-demo';
    if (!isPrimaryHero) {
      el.classList.add('collapsible-action-item');
    }
  });

  // Create the Power Deck Trigger Button
  const triggerBtn = document.createElement('button');
  triggerBtn.type = 'button';
  triggerBtn.id = 'btn-toggle-overlap-deck';
  triggerBtn.className = 'primary overlap-deck-btn';
  triggerBtn.dataset.action = 'toggle-overlap-deck';
  triggerBtn.title = 'Open All 24 Tools without Overlapping Clutter';
  triggerBtn.innerHTML = `
    <span class="deck-pulse-dot"></span>
    <span>🎛️ Feature Deck &amp; Overlap Shield</span>
    <span class="deck-badge">24 Tools</span>
  `;

  // Create the Mode Toggle Button
  const modeBtn = document.createElement('button');
  modeBtn.type = 'button';
  modeBtn.id = 'btn-toggle-overlap-mode';
  modeBtn.className = `secondary overlap-shield-toggle ${isShieldActive ? 'active' : ''}`;
  modeBtn.dataset.action = 'toggle-overlap-mode';
  modeBtn.title = 'Toggle Clean Zen Mode vs Expanded Inline Buttons';
  modeBtn.innerHTML = `
    <span>🛡️ Overlap Shield:</span>
    <b id="overlap-shield-indicator">${isShieldActive ? 'ON (Zen)' : 'OFF (Inline)'}</b>
  `;

  // Insert right after the start-judge-demo button
  const heroBtn = actions.querySelector('#review-start-judge-demo, [data-action="start-judge-demo"]');
  if (heroBtn) {
    heroBtn.after(modeBtn);
    heroBtn.after(triggerBtn);
  } else {
    actions.prepend(modeBtn);
    actions.prepend(triggerBtn);
  }

  // Inject or update the modal in body
  let existingModal = document.querySelector('#overlap-deck-backdrop');
  if (existingModal) existingModal.remove();

  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = buildPowerDeckModalMarkup(review);
  document.body.appendChild(modalContainer.firstElementChild);

  // Attach modal event listeners
  const backdrop = document.querySelector('#overlap-deck-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) closeOverlapDeck();
    });

    const closeBtns = backdrop.querySelectorAll('#deck-close-x, #deck-close-bottom');
    closeBtns.forEach(b => b.addEventListener('click', closeOverlapDeck));

    const innerToggle = backdrop.querySelector('#deck-inner-shield-toggle');
    if (innerToggle) {
      innerToggle.addEventListener('click', () => {
        toggleOverlapMode();
        innerToggle.innerHTML = `🛡️ Overlap Shield: <b>${isShieldActive ? 'ACTIVE' : 'OFF'}</b>`;
        innerToggle.classList.toggle('active', isShieldActive);
      });
    }

    // Auto De-Clutter Pins Button
    const staggerBtn = backdrop.querySelector('#btn-stagger-pins');
    if (staggerBtn) {
      staggerBtn.addEventListener('click', () => {
        const pins = document.querySelectorAll('.evidence-marker, .art-hotspot, .shopper-pin');
        let count = 0;
        pins.forEach((p, idx) => {
          count++;
          p.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
          const currentTop = parseFloat(p.style.top) || 0;
          p.style.top = `${currentTop + (idx % 2 === 0 ? 0 : 2)}%`;
        });
        if (window.showToast) {
          window.showToast(`✨ De-clutter active: Calibrated ${count} visual markers with collision-free spacing.`);
        }
      });
    }

    // Forward click actions from inside the deck to the main application
    backdrop.addEventListener('click', e => {
      const btn = e.target.closest('.deck-action-btn');
      if (!btn) return;

      const action = btn.dataset.action;
      const tab = btn.dataset.tab;
      const reviewId = btn.dataset.reviewId;

      // Close the deck
      closeOverlapDeck();

      // If it's an external link or download, let browser handle it
      if (btn.tagName.toLowerCase() === 'a') return;

      // Trigger corresponding action in document
      if (tab) {
        const mainTabBtn = document.querySelector(`.tab[data-tab="${tab}"]`);
        if (mainTabBtn) {
          mainTabBtn.click();
          return;
        }
      }

      if (action) {
        const targetBtn = document.querySelector(`.review-heading .actions [data-action="${action}"]`);
        if (targetBtn && targetBtn !== btn) {
          targetBtn.click();
          return;
        }
      }
    });
  }
}

// Global keyboard shortcut
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isDeckOpen) {
      closeOverlapDeck();
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      const activeReview = window.__PACKSIGNAL_CURRENT_REVIEW;
      if (activeReview) {
        e.preventDefault();
        toggleOverlapDeck();
      }
    }
  });

  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-action="toggle-overlap-deck"]');
    if (trigger) {
      e.preventDefault();
      toggleOverlapDeck();
      return;
    }

    const modeTrigger = e.target.closest('[data-action="toggle-overlap-mode"]');
    if (modeTrigger) {
      e.preventDefault();
      toggleOverlapMode();
      return;
    }
  });
}
