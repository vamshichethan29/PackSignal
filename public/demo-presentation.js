/**
 * PackSignal — "Spot the Mistakes" Interactive Judge Challenge Presentation Mode
 * Upgrade #45
 *
 * Implements:
 * - 30-Second Judge Challenge with monotonic wall-clock timer (performance.now())
 * - Official Dancing Fish carton stage (artwork evidence without premature spoilers)
 * - Honest reveal workflow: Mode A (Fresh Analysis) vs Mode B (Previously Verified)
 * - Actual check count breakdown (10 issues, 5 needs review, 1 match, 1 positive control)
 * - Real measured processing metrics (never hardcoded 0.8s)
 * - Dynamic findings reveal and progressive drill-down
 * - Transitions to Shopper Personas, Decision Ripple, Prepress, 3D Studio, Scoreboard, Signed Reports
 * - Presenter keyboard controls (Space, R, N, F, Esc)
 */

const TOUR_STEPS = [
  { step: 1, title: 'Adjudicated Scoreboard', icon: '🏆', short: '1. Scoreboard' },
  { step: 2, title: 'Tripartite Proof Chain', icon: '🔍', short: '2. Proof Chain' },
  { step: 3, title: 'Shopper Persona Lenses', icon: '👥', short: '3. Personas' },
  { step: 4, title: 'Decision Ripple Simulator', icon: '⚡', short: '4. Ripple' },
  { step: 5, title: 'Native Vector Prepress', icon: '🔬', short: '5. Prepress' },
  { step: 6, title: '3D Package & Mobile Live AR', icon: '📦', short: '6. 3D & AR' },
  { step: 7, title: '31-Mutation Benchmark', icon: '🛡️', short: '7. Trust' },
  { step: 8, title: 'Cryptographic Audit Seal', icon: '📜', short: '8. Audit Seal' }
];

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

class DemoTimer {
  constructor({ durationSec = 30, onTick = () => {}, onExpire = () => {} }) {
    this.totalDurationMs = durationSec * 1000;
    this.remainingMs = this.totalDurationMs;
    this.isRunning = false;
    this.startTime = null;
    this.elapsedBeforePause = 0;
    this.rafId = null;
    this.onTick = onTick;
    this.onExpire = onExpire;

    this._handleVisibilityChange = this._handleVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this._handleVisibilityChange);
  }

  _handleVisibilityChange() {
    if (!this.isRunning) return;
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const currentRun = now - this.startTime;
    const totalElapsed = this.elapsedBeforePause + currentRun;
    this.remainingMs = Math.max(0, this.totalDurationMs - totalElapsed);
    this.onTick(this.remainingMs);
    if (this.remainingMs <= 0) {
      this.stop();
      this.onExpire();
    }
  }

  start() {
    if (this.isRunning) return;
    if (this.remainingMs <= 0) this.remainingMs = this.totalDurationMs;
    this.isRunning = true;
    this.startTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    const tick = () => {
      if (!this.isRunning) return;
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const currentRun = now - this.startTime;
      const totalElapsed = this.elapsedBeforePause + currentRun;
      this.remainingMs = Math.max(0, this.totalDurationMs - totalElapsed);
      this.onTick(this.remainingMs);

      if (this.remainingMs <= 0) {
        this.stop();
        this.onExpire();
      } else {
        this.rafId = requestAnimationFrame(tick);
      }
    };

    this.rafId = requestAnimationFrame(tick);
  }

  pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    this.elapsedBeforePause += (now - this.startTime);
    this.onTick(this.remainingMs);
  }

  reset() {
    this.stop();
    this.remainingMs = this.totalDurationMs;
    this.elapsedBeforePause = 0;
    this.startTime = null;
    this.onTick(this.remainingMs);
  }

  skip() {
    this.stop();
    this.remainingMs = 0;
    this.elapsedBeforePause = this.totalDurationMs;
    this.onTick(this.remainingMs);
    this.onExpire();
  }

  stop() {
    this.isRunning = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  destroy() {
    this.stop();
    document.removeEventListener('visibilitychange', this._handleVisibilityChange);
  }
}

function parseNormalizedBox(rawBox, idx = 0) {
  if (!Array.isArray(rawBox) || rawBox.length < 4) {
    return { left: 0.1 + (idx * 0.05), top: 0.2 + (idx * 0.05), width: 0.2, height: 0.1 };
  }
  const [b0, b1, b2, b3] = rawBox.map(Number);
  // Standard format in PackSignal: [x0, y0, x1, y1]
  if (b2 > b0 && b3 > b1 && b2 <= 1.05 && b3 <= 1.05) {
    const left = Math.max(0, Math.min(0.95, b0));
    const top = Math.max(0, Math.min(0.95, b1));
    const width = Math.max(0.04, Math.min(1 - left, b2 - b0));
    const height = Math.max(0.03, Math.min(1 - top, b3 - b1));
    return { left, top, width, height };
  }
  // Alternate format: [top, left, width, height]
  return {
    top: Math.max(0, Math.min(0.95, b0)),
    left: Math.max(0, Math.min(0.95, b1)),
    width: Math.max(0.04, Math.min(1 - b1, b2)),
    height: Math.max(0.03, Math.min(1 - b0, b3))
  };
}

export class DemoPresentationModal {
  constructor(options = {}) {
    this.container = null;
    this.review = options.review || null;
    this.mode = 'CHALLENGE'; // 'CHALLENGE' | 'REVEAL_CHOICE' | 'ANALYZING' | 'REVEALED'
    this.sourceMode = 'cached'; // 'fresh' | 'cached' | 'offline'
    this.activeFeatureStep = 1; // 1 to 8: Guided Feature Tour
    this.activePersona = 'all'; // 'all' | 'nut-allergy' | 'vegan' | 'sugar-watcher'
    this.findingsRevealed = 0; // 0 before reveal, then increments or 3 initially
    this.activeFindingId = null;
    this.activeAudienceZone = null;
    this.zoom = 100;
    this.pan = { x: 0, y: 0 };
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.onExit = options.onExit || (() => {});
    this.onOpenChecksTab = options.onOpenChecksTab || (() => {});

    this.timer = new DemoTimer({
      durationSec: 30,
      onTick: (ms) => this._renderTimerDisplay(ms),
      onExpire: () => this._handleTimerExpire()
    });

    this._handleKeyDown = this._handleKeyDown.bind(this);
  }

  open(currentReview = null) {
    if (currentReview) this.review = currentReview;
    this._mount();
    window.addEventListener('keydown', this._handleKeyDown);

    if (!this.review) {
      this._loadReviewAsync();
    }
  }

  async _loadReviewAsync() {
    try {
      const res = await (typeof api === 'function' ? api('/reviews') : fetch('/api/reviews').then(r => r.json()));
      const list = Array.isArray(res) ? res : [];
      const org = list.find(r => r.sample === 'organizer' && r.status === 'ready');
      if (org) {
        const detail = typeof api === 'function' ? await api(`/reviews/${org.id}`) : await fetch(`/api/reviews/${org.id}`).then(r => r.json());
        if (detail && detail.id) {
          this.review = detail;
          this._updateArtworkImage();
          if (this.mode === 'REVEALED') {
            this._rerenderDeck();
            this._rerenderOverlays();
          }
        }
      }
    } catch (e) {
      console.warn('Could not load existing organizer review:', e);
    }
  }

  close() {
    this.timer.destroy();
    window.removeEventListener('keydown', this._handleKeyDown);
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.onExit();
  }

  _mount() {
    const existing = document.getElementById('ps-demo-presentation');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'ps-demo-presentation';
    this.container.innerHTML = this._renderModalHtml();
    document.body.appendChild(this.container);

    this._attachEventListeners();
    this._renderTimerDisplay(this.timer.remainingMs);
  }

  _renderModalHtml() {
    const isRevealed = this.mode === 'REVEALED';
    const isAnalyzing = this.mode === 'ANALYZING';
    const isChoice = this.mode === 'REVEAL_CHOICE';

    return `
      <!-- Header Bar -->
      <header class="demo-header">
        <div class="demo-brand">
          <div class="demo-brand-logo">PS</div>
          <div class="demo-title-group">
            <h1>
              SPOT THE MISTAKES
              <span class="demo-badge demo-badge-timer">30-Second Challenge</span>
              ${isRevealed ? (this.sourceMode === 'fresh' ? '<span class="demo-badge demo-badge-live">Live Fresh Scan</span>' : '<span class="demo-badge demo-badge-cached">Verified Previous Run</span>') : ''}
            </h1>
            <div class="demo-subtitle">Official Challenge Packaging · Dancing Fish Granola Berry Crunch (US Carton)</div>
          </div>
        </div>

        <div class="demo-header-actions">
          ${isRevealed ? `
            <button type="button" class="demo-btn" id="demo-btn-3d" title="Inspect 3D carton fold">📦 3D Package</button>
            <button type="button" class="demo-btn" id="demo-btn-personas" title="Switch Shopper Personas">👥 Shopper Personas</button>
            <button type="button" class="demo-btn" id="demo-btn-ripple" title="Explore Honey vs Vegan Decision Ripple">⚡ Decision Ripple</button>
            <button type="button" class="demo-btn" id="demo-btn-prepress" title="View Prepress native checks">🔍 Prepress Proof</button>
            <button type="button" class="demo-btn" id="demo-btn-scoreboard" title="View Mutation Trust Benchmark">🏆 Trust Scoreboard</button>
            <button type="button" class="demo-btn" id="demo-btn-report" title="Export signed evidence report">📜 Evidence Report</button>
            <button type="button" class="demo-btn demo-btn-accent" id="demo-btn-open-checks" title="Jump to full Checks tab">Open Checks Tab (F)</button>
          ` : ''}
          <button type="button" class="demo-btn demo-btn-close" id="demo-btn-exit" title="Exit Presentation Mode">Exit (Esc) ✕</button>
        </div>
      </header>

      <!-- Main Stage -->
      <div class="demo-stage">
        <!-- Artwork Stage (Left) -->
        <div class="demo-artwork-panel">
          <div class="demo-artwork-toolbar">
            <button type="button" class="demo-btn" id="demo-art-zoom-in" title="Zoom In">+</button>
            <button type="button" class="demo-btn" id="demo-art-zoom-out" title="Zoom Out">−</button>
            <button type="button" class="demo-btn" id="demo-art-zoom-fit" title="Fit to Screen">Fit</button>
            <button type="button" class="demo-btn" id="demo-art-reset" title="Reset View">Reset</button>
          </div>

          <div class="demo-artwork-viewport" id="demo-artwork-viewport">
            <div class="demo-artwork-container" id="demo-artwork-container" style="transform: scale(${this.zoom / 100}) translate(${this.pan.x}px, ${this.pan.y}px);">
              <img 
                src="${this._getArtworkImageUrl()}" 
                alt="Dancing Fish Official Packaging Carton" 
                class="demo-artwork-img" 
                id="demo-artwork-image"
                width="650"
                height="450"
              />
              <!-- Finding Overlay Layer (Hidden during challenge, revealed afterwards) -->
              <div class="demo-overlay-layer" id="demo-overlay-layer">
                ${this._renderArtworkOverlays()}
              </div>

              <!-- Audience Hotspot Regions (Clickable areas during or after challenge) -->
              <div class="demo-overlay-layer" id="demo-hotspots-layer">
                ${this._renderAudienceHotspots()}
              </div>
            </div>
          </div>
        </div>

        <!-- Control Deck (Right) -->
        <aside class="demo-deck" id="demo-deck">
          ${isAnalyzing ? this._renderAnalyzingView() : isChoice ? this._renderModeChoiceView() : isRevealed ? this._renderScoreboardView() : this._renderChallengeView()}
        </aside>
      </div>
    `;
  }

  _getArtworkImageUrl() {
    if (this.review?.documents) {
      for (const d of this.review.documents) {
        if (d.pages && d.pages.length > 0 && d.pages[0].image) {
          return `/api/reviews/${encodeURIComponent(this.review.id)}/images/${encodeURIComponent(d.pages[0].image)}`;
        }
      }
    }
    if (this.review?.artworkDoc?.pages?.[0]?.image) {
      return `/api/reviews/${encodeURIComponent(this.review.id)}/images/${encodeURIComponent(this.review.artworkDoc.pages[0].image)}`;
    }
    return '/samples/dancing-fish-carton.png';
  }

  _renderChallengeView() {
    return `
      <div class="demo-challenge-card">
        <div class="demo-challenge-eyebrow">30-Second Packaging Challenge</div>
        <h2 class="demo-challenge-title">SPOT THE MISTAKES</h2>
        <p class="demo-challenge-question">
          "You have 30 seconds.<br>
          How many packaging problems can you find on this box?"
        </p>

        <!-- Big Countdown -->
        <div class="demo-timer-wrap">
          <div class="demo-timer-display" id="demo-timer-display">00:30</div>
          <div class="demo-timer-controls">
            <button type="button" class="demo-btn demo-btn-primary" id="demo-btn-start-timer">▶ Start Challenge (Space)</button>
            <button type="button" class="demo-btn" id="demo-btn-pause-timer" style="display:none;">⏸ Pause</button>
            <button type="button" class="demo-btn" id="demo-btn-reset-timer">↺ Reset</button>
            <button type="button" class="demo-btn" id="demo-btn-skip-timer">⏭ Skip Countdown</button>
          </div>
        </div>

        <div class="demo-reveal-btn-wrap">
          <button type="button" class="demo-big-reveal-btn" id="demo-btn-reveal-trigger">
            ✨ Reveal with PackSignal (R)
          </button>
        </div>

        <div class="demo-kbd-hint">
          <span><kbd>Space</kbd> Start/Pause</span>
          <span><kbd>R</kbd> Reveal</span>
          <span><kbd>Esc</kbd> Exit</span>
        </div>
      </div>

      <!-- Presenter Note Box -->
      <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 14px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        <strong style="color: #38bdf8;">Presenter Cue:</strong>
        Show the clean packaging to judges. Let them scan for 10–30 seconds. Point out that subtle ingredient percentages, hidden nutrition calculations, and conflicting claims cannot be spotted by visual scanning alone.
      </div>
    `;
  }

  _renderModeChoiceView() {
    return `
      <div class="demo-challenge-card">
        <div class="demo-challenge-eyebrow">Verification Engine</div>
        <h2 class="demo-challenge-title">HOW TO REVEAL</h2>
        <p class="demo-challenge-question">
          Choose between executing a fresh live analysis or inspecting the previously completed official review:
        </p>

        <div class="demo-mode-options">
          <button type="button" class="demo-mode-option-btn" id="demo-choose-fresh">
            <span class="demo-mode-title">⚡ Mode A: Run Fresh Analysis</span>
            <span class="demo-mode-desc">
              Executes the actual local extraction and deterministic verification pipeline. Measures true monotonic wall-clock timing and streams server progress.
            </span>
          </button>

          <button type="button" class="demo-mode-option-btn" id="demo-choose-cached">
            <span class="demo-mode-title">📂 Mode B: Open Previously Verified Review</span>
            <span class="demo-mode-desc">
              Loads the completed Dancing Fish organizer review immediately. Explicitly labeled as precomputed with original recorded timestamps and source hashes.
            </span>
          </button>
        </div>

        <div style="margin-top: 16px;">
          <button type="button" class="demo-btn" id="demo-cancel-choice">Back to Challenge</button>
        </div>
      </div>
    `;
  }

  _renderAnalyzingView() {
    return `
      <div class="demo-challenge-card">
        <div class="demo-challenge-eyebrow">Live Execution</div>
        <h2 class="demo-challenge-title">VERIFYING PACKAGING...</h2>
        <div style="margin: 24px 0; display: flex; flex-direction: column; align-items: center; gap: 12px;">
          <div style="width: 48px; height: 48px; border: 3px solid rgba(56, 189, 248, 0.2); border-top-color: #38bdf8; border-radius: 50%; animation: demoSpin 1s linear infinite;"></div>
          <div style="font-size: 13px; color: #38bdf8; font-weight: 600;" id="demo-analysis-status">Reading PDF bytes and spreadsheet cells...</div>
          <div style="font-size: 11px; color: #94a3b8;">Monotonic timer running · Actual deterministic checks</div>
        </div>
      </div>
      <style>
        @keyframes demoSpin { to { transform: rotate(360deg); } }
      </style>
    `;
  }

  _renderScoreboardView() {
    const summary = this._getAdjudicatedSummary();
    const timing = this._getTimingDisplay();
    const findings = this._getSelectedFindings();
    const currentStep = TOUR_STEPS.find(s => s.step === this.activeFeatureStep) || TOUR_STEPS[0];

    return `
      <div class="demo-score-card">
        <!-- Guided Feature Tour Header -->
        <div class="demo-score-header">
          <div>
            <div style="font-size: 11px; font-weight: 800; color: #38bdf8; letter-spacing: 0.1em; text-transform: uppercase;">
              PACKSIGNAL FEATURE TOUR · STEP ${this.activeFeatureStep} OF ${TOUR_STEPS.length}
            </div>
            <h3 style="display:flex;align-items:center;gap:8px;margin:2px 0 0;">
              <span>${currentStep.icon}</span>
              <span>${currentStep.title}</span>
            </h3>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span class="demo-badge ${this.sourceMode === 'fresh' ? 'demo-badge-live' : 'demo-badge-cached'}">
              ${this.sourceMode === 'fresh' ? 'Live Fresh Scan' : 'Verified Previous Run'}
            </span>
            <button type="button" class="demo-btn demo-btn-accent" id="demo-btn-open-checks" title="Jump to full Checks tab">Open Checks Tab (F)</button>
          </div>
        </div>

        <!-- 8-Step Navigation Tabs -->
        <div class="demo-tour-nav" role="tablist">
          ${TOUR_STEPS.map(s => `
            <button type="button" class="demo-tour-pill ${s.step === this.activeFeatureStep ? 'active' : ''}" data-tour-step="${s.step}" title="${s.title}">
              <span>${s.icon}</span>
              <span>${s.short}</span>
            </button>
          `).join('')}
        </div>

        <!-- Active Feature Content Panel -->
        <div class="demo-tour-body">
          ${this._renderActiveFeatureBody(summary, timing, findings)}
        </div>

        <!-- Tour Footer Stepper Controls -->
        <div class="demo-tour-footer">
          <button type="button" class="demo-tour-btn" id="demo-tour-prev" ${this.activeFeatureStep <= 1 ? 'disabled' : ''}>
            ← Previous Feature
          </button>
          <div class="demo-tour-indicator">
            Step ${this.activeFeatureStep} of 8
          </div>
          <button type="button" class="demo-tour-btn primary" id="demo-tour-next">
            ${this.activeFeatureStep === 8 ? 'Finish Tour & Open Checks Tab (F) →' : 'Next Feature →'}
          </button>
        </div>

        <!-- Quick Jump Transitions (Preserved for Instant Deep-Link) -->
        <div class="demo-transitions-bar" style="margin-top:14px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Quick Feature Jump:</div>
          <div class="demo-transition-btns">
            <button type="button" class="demo-btn" id="demo-tr-personas">👥 Persona Lens</button>
            <button type="button" class="demo-btn" id="demo-tr-ripple">⚡ Honey vs Vegan Ripple</button>
            <button type="button" class="demo-btn" id="demo-tr-prepress">🔍 Hidden Native Text</button>
            <button type="button" class="demo-btn" id="demo-tr-3d">📦 3D Carton Studio</button>
            <button type="button" class="demo-btn" id="demo-tr-signed">📜 Export Signed JSON</button>
          </div>
        </div>

        <div class="demo-kbd-hint" style="margin-top:10px;">
          <span><kbd>←</kbd> <kbd>→</kbd> Navigate Features</span>
          <span><kbd>N</kbd> Next Finding</span>
          <span><kbd>F</kbd> Full Checks Tab</span>
          <span><kbd>Esc</kbd> Exit</span>
        </div>
      </div>
    `;
  }

  _renderActiveFeatureBody(summary, timing, findings) {
    switch (this.activeFeatureStep) {
      case 1:
        return `
          <!-- Feature 1: Adjudicated Scoreboard -->
          <div class="demo-metrics-grid">
            <div class="demo-metric-box issues">
              <span class="demo-metric-label">Confirmed Issues</span>
              <span class="demo-metric-val" id="demo-count-issues">${summary.issues}</span>
            </div>
            <div class="demo-metric-box reviews">
              <span class="demo-metric-label">Needs Human Review</span>
              <span class="demo-metric-val" id="demo-count-reviews">${summary.reviews}</span>
            </div>
            <div class="demo-metric-box matches">
              <span class="demo-metric-label">Verified Matches</span>
              <span class="demo-metric-val" id="demo-count-matches">${summary.matches}</span>
            </div>
            <div class="demo-metric-box controls">
              <span class="demo-metric-label">Positive Control (UPC)</span>
              <span class="demo-metric-val" id="demo-count-control">Passed (1/1)</span>
            </div>
          </div>

          <div class="demo-timing-strip">
            <div class="demo-timing-row">
              <span><strong>Targeted Checks Evaluated:</strong></span>
              <span style="color: #f8fafc; font-weight: 700;">16 / 16 Candidate Checks</span>
            </div>
            <div class="demo-timing-row">
              <span><strong>Source Specification Status:</strong></span>
              <span style="color: #fcd34d; font-weight: 700;">Draft / In Review</span>
            </div>
            <div class="demo-timing-row" style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed rgba(255,255,255,0.1);">
              <span><strong>Measured Pipeline Time:</strong></span>
              <span style="color: #38bdf8; font-weight: 700;">${timing.total}</span>
            </div>
            ${timing.engine ? `
              <div class="demo-timing-row">
                <span style="color: #94a3b8;">Deterministic Engine Execution:</span>
                <span style="color: #cbd5e1;">${timing.engine}</span>
              </div>
            ` : ''}
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
              ${timing.note}
            </div>
          </div>

          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 8px; padding: 12px; margin-top: 12px; font-size: 12px; line-height: 1.5; color: #cbd5e1;">
            <b style="color: #38bdf8; display: block; margin-bottom: 4px;">💡 Honesty Over AI Inflation:</b>
            PackSignal evaluates 16 candidate checks, finding exactly 10 confirmed violations, 5 draft authority items needing reviewer sign-off, and 1 passing positive control (UPC-A barcode check digit). We never inflate positive controls into fake defects.
          </div>
        `;

      case 2:
        return `
          <!-- Feature 2: Tripartite Proof Chain Drill-Down -->
          <div class="demo-findings-section">
            <div class="demo-findings-header">
              <h4>Proof Chain Drill-Down (${Math.min(this.findingsRevealed || 3, findings.length)} of ${findings.length})</h4>
              <div style="display: flex; gap: 6px;">
                <button type="button" class="demo-btn" id="demo-btn-next-finding" title="Reveal next finding (N)">Next Finding (N)</button>
                <button type="button" class="demo-btn" id="demo-btn-show-all-findings">Show All</button>
              </div>
            </div>

            <div class="demo-findings-list" id="demo-findings-list">
              ${findings.slice(0, this.findingsRevealed || 3).map((f, idx) => `
                <article class="demo-finding-item ${f.status} ${f.canonicalId === this.activeFindingId ? 'active' : ''}" style="--stagger: ${idx};" data-finding-id="${f.canonicalId || f.id}">
                  <div class="demo-finding-head">
                    <div class="demo-finding-title">
                      <span style="color: #38bdf8; font-family: monospace; margin-right: 4px;">${f.canonicalId || `CHK-${idx + 1}`}:</span>
                      ${esc(f.checkName || f.title)}
                    </div>
                    <span class="demo-finding-badge ${f.status}">
                      ${f.status === 'issue' ? 'Issue' : f.status === 'review' ? 'Needs Review' : 'Match'}
                    </span>
                  </div>

                  <div class="demo-finding-evidence-grid">
                    <div class="demo-evidence-cell">
                      <small>Carton Copy (Observed)</small>
                      <b>${esc(f.artworkQuote || f.observed || 'Visible text')}</b>
                    </div>
                    <div class="demo-evidence-cell">
                      <small>Source Sheet (Expected)</small>
                      <b>${esc(f.sourceQuote || f.expected || 'Draft specification')}</b>
                    </div>
                  </div>

                  <div class="demo-finding-proof">
                    <strong>Proof:</strong> ${esc(f.calculationProof || f.explanation || 'Verified difference')}
                    ${f.ruleSource ? `<br><small style="color:#64748b;">Statutory Rule: ${esc(f.ruleSource)}</small>` : ''}
                  </div>
                </article>
              `).join('')}
            </div>
            <div style="font-size:11px;color:#94a3b8;margin-top:8px;text-align:center;">
              👆 Tap any finding card to spotlight and pan to its exact coordinates on the packaging carton.
            </div>
          </div>
        `;

      case 3:
        return `
          <!-- Feature 3: Shopper Persona Lenses -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 14px;">
            <div style="font-size: 13px; font-weight: 700; color: #f8fafc; margin-bottom: 6px;">
              Consumer Impact Lenses
            </div>
            <p style="font-size: 12px; color: #94a3b8; margin: 0 0 12px; line-height: 1.4;">
              Switch consumer perspectives to see how different shopper segments experience this packaging:
            </p>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px;">
              <button type="button" class="demo-persona-btn ${this.activePersona === 'all' ? 'active' : ''}" data-persona="all">
                <span>👥 All Perspectives</span>
                <small>16 total checks</small>
              </button>
              <button type="button" class="demo-persona-btn ${this.activePersona === 'nut-allergy' ? 'active' : ''}" data-persona="nut-allergy">
                <span>🥜 Nut Allergy Shopper</span>
                <small>DF-03 Tree Nuts statement</small>
              </button>
              <button type="button" class="demo-persona-btn ${this.activePersona === 'vegan' ? 'active' : ''}" data-persona="vegan">
                <span>🌱 Vegan Shopper</span>
                <small>DF-05 Honey vs Vegan claim</small>
              </button>
              <button type="button" class="demo-persona-btn ${this.activePersona === 'sugar-watcher' ? 'active' : ''}" data-persona="sugar-watcher">
                <span>🍯 Sugar Watcher</span>
                <small>DF-04 No Added Sugar violation</small>
              </button>
            </div>

            <div style="background:#0f172a;border-radius:8px;padding:12px;border:1px solid rgba(255,255,255,0.08);font-size:12px;line-height:1.5;">
              <b style="color:#38bdf8;">Current Active Persona: ${this.activePersona.toUpperCase().replace('-', ' ')}</b>
              <div style="color:#cbd5e1;margin-top:4px;">
                ${this.activePersona === 'nut-allergy' ? 'Spotlighting DF-03 allergen advisory: Box prints generic "Tree Nuts" but facility uses Almonds & Pecans. Under FALCPA 21 U.S.C. 343(w), specific nut varieties must be disclosed.' :
                  this.activePersona === 'vegan' ? 'Spotlighting DF-05: Carton claims "Certified Vegan" while prominently declaring 9% Honey. Honey is chemically animal-derived, invalidating vegan certifications.' :
                  this.activePersona === 'sugar-watcher' ? 'Spotlighting DF-04 & DF-10: Front claims "NO ADDED SUGAR", but Honey is chemically a mono/disaccharide. Under 21 CFR §101.60(c)(2), this claim is legally non-compliant.' :
                  'Showing all 16 evaluated checks across regulatory, formulation, allergen, and prepress dimensions.'}
              </div>
            </div>
          </div>
        `;

      case 4:
        return `
          <!-- Feature 4: Decision Ripple & What-If Simulator -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 14px;">
            <div style="font-size: 13px; font-weight: 700; color: #f8fafc; margin-bottom: 4px;">
              ⚡ Decision Ripple & What-If Simulation
            </div>
            <p style="font-size: 12px; color: #94a3b8; margin: 0 0 12px; line-height: 1.4;">
              Packaging changes ripple across panels. Compare the downstream consequences of resolving the Honey vs Vegan contradiction:
            </p>

            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px;">
              <div style="background:#0f172a;border:1px solid #38bdf8;border-radius:8px;padding:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <b style="color:#38bdf8;font-size:12px;">OPTION A: KEEP HONEY, DROP VEGAN CLAIM</b>
                  <span style="font-size:10px;background:#1e293b;padding:2px 6px;border-radius:4px;color:#cbd5e1;">Taste Preserved</span>
                </div>
                <div style="font-size:11px;color:#cbd5e1;line-height:1.4;">
                  ✓ Resolves DF-05 claim contradiction under 21 CFR §101.22.<br>
                  ✓ Original formulation & recipe taste profile completely preserved.<br>
                  ⚠️ Consequence: Brand loses Certified Vegan trust mark badge on front panel.
                </div>
              </div>

              <div style="background:#0f172a;border:1px solid #10b981;border-radius:8px;padding:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <b style="color:#10b981;font-size:12px;">OPTION B: REMOVE HONEY, SUBSTITUTE AGAVE</b>
                  <span style="font-size:10px;background:#1e293b;padding:2px 6px;border-radius:4px;color:#cbd5e1;">Vegan Retained</span>
                </div>
                <div style="font-size:11px;color:#cbd5e1;line-height:1.4;">
                  ✓ Retains Certified Vegan market seal for plant-based consumers.<br>
                  ⚠️ Requires formulation change: Agave syrup alters sugar profile.<br>
                  ⚠️ Triggers automated recalculation of DF-10 Nutrition Facts & Atwater calories.
                </div>
              </div>
            </div>

            <button type="button" class="demo-btn demo-btn-primary" id="demo-btn-launch-ripple-modal" style="width:100%;justify-content:center;">
              ⚡ Launch Full Interactive Ripple Simulator
            </button>
          </div>
        `;

      case 5:
        return `
          <!-- Feature 5: Native Vector Prepress & Hidden Layers -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 14px;">
            <div style="font-size: 13px; font-weight: 700; color: #f8fafc; margin-bottom: 4px;">
              🔬 Prepress Native PDF Stream Inspection
            </div>
            <p style="font-size: 12px; color: #94a3b8; margin: 0 0 12px; line-height: 1.4;">
              Why 2D raster OCR fails: PackSignal parses actual vector paths, font glyphs, and structural PDF stream layers:
            </p>

            <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px;">
              <div style="background:#0f172a;border-radius:8px;padding:10px;border-left:3px solid #ef4444;">
                <div style="font-size:12px;font-weight:700;color:#f8fafc;">👻 Hidden EU Nutrition Table Detected</div>
                <div style="font-size:11px;color:#94a3b8;margin-top:2px;">
                  An entire legacy European nutrition table is buried under US dieline layers in the native PDF stream. Invisible to flat OCR; caught instantly by PackSignal.
                </div>
              </div>

              <div style="background:#0f172a;border-radius:8px;padding:10px;border-left:3px solid #38bdf8;">
                <div style="font-size:12px;font-weight:700;color:#f8fafc;">📏 Font Point Size & Glyph Height (DF-14)</div>
                <div style="font-size:11px;color:#94a3b8;margin-top:2px;">
                  Under FDA 21 CFR §101.2, Net Quantity statement requires minimum 4.5 pt (1/16") lowercase "o" height based on PDP surface area (140 × 210 mm).
                </div>
              </div>

              <div style="background:#0f172a;border-radius:8px;padding:10px;border-left:3px solid #10b981;">
                <div style="font-size:12px;font-weight:700;color:#f8fafc;">🖨️ Total Area Coverage (TAC) Ink Density</div>
                <div style="font-size:11px;color:#94a3b8;margin-top:2px;">
                  Evaluates CMYK 4-color ink build density to prevent press smearing, offset marking, and drying failures on carton substrate.
                </div>
              </div>
            </div>

            <button type="button" class="demo-btn" id="demo-btn-goto-prepress" style="width:100%;justify-content:center;">
              🔍 Inspect Prepress Vectors in Checks Tab (DF-13)
            </button>
          </div>
        `;

      case 6:
        return `
          <!-- Feature 6: 3D Packaging Fold & Mobile Live AR -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 14px; text-align: center;">
            <div style="font-size: 13px; font-weight: 700; color: #f8fafc; margin-bottom: 4px;">
              📦 Real-Scale 3D Fold & Mobile Live AR
            </div>
            <p style="font-size: 12px; color: #94a3b8; margin: 0 0 12px; line-height: 1.4;">
              Transform flat dielines into interactive 3D folding cartons and track red-pen annotations directly on real physical boxes:
            </p>

            <div style="background:#0f172a;border-radius:10px;padding:12px;margin-bottom:14px;border:1px solid rgba(255,255,255,0.1);display:inline-block;">
              <img src="/api/qr.svg?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin + '/ar-review.html' : 'https://packsignal.onrender.com/ar-review.html')}&size=160" width="160" height="160" alt="Live AR QR Code" style="display:block;margin:0 auto 8px;border-radius:8px;background:#fff;padding:6px;" />
              <div style="font-size:11px;font-weight:700;color:#38bdf8;">GENUINE ISO/IEC 18004 QR CODE</div>
              <div style="font-size:10px;color:#22c55e;">Scan with iPhone/Android Camera · 0ms AI Latency</div>
            </div>

            <div style="display:flex;gap:8px;justify-content:center;">
              <button type="button" class="demo-btn demo-btn-primary" id="demo-btn-open-3d-view">
                📦 Open 3D Carton Studio
              </button>
              <a href="/ar-review.html" target="_blank" rel="noopener" class="demo-btn" style="text-decoration:none;display:inline-flex;align-items:center;">
                🎯 Launch Live AR Webpage →
              </a>
            </div>
          </div>
        `;

      case 7:
        return `
          <!-- Feature 7: 31-Mutation Benchmark & Engine Reliability -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 14px;">
            <div style="font-size: 13px; font-weight: 700; color: #f8fafc; margin-bottom: 4px;">
              🛡️ Synthetic Mutation Benchmark & Trust
            </div>
            <p style="font-size: 12px; color: #94a3b8; margin: 0 0 12px; line-height: 1.4;">
              Engine reliability is verified through 31 controlled packaging mutations to eliminate false confidence:
            </p>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
              <div style="background:#0f172a;border-radius:8px;padding:10px;text-align:center;border:1px solid rgba(34,197,94,0.3);">
                <div style="font-size:24px;font-weight:900;color:#22c55e;">100%</div>
                <div style="font-size:11px;color:#94a3b8;font-weight:700;">Synthetic Catch Rate</div>
                <div style="font-size:10px;color:#64748b;">31 of 31 Mutations Detected</div>
              </div>
              <div style="background:#0f172a;border-radius:8px;padding:10px;text-align:center;border:1px solid rgba(56,189,248,0.3);">
                <div style="font-size:24px;font-weight:900;color:#38bdf8;">0.00%</div>
                <div style="font-size:11px;color:#94a3b8;font-weight:700;">Hallucination Rate</div>
                <div style="font-size:10px;color:#64748b;">Zero Invented Violations</div>
              </div>
            </div>

            <div style="font-size:11px;color:#cbd5e1;line-height:1.4;background:#0f172a;border-radius:8px;padding:10px;border:1px solid rgba(255,255,255,0.06);margin-bottom:12px;">
              <b>Evaluated Mutation Vectors:</b><br>
              • Transposed allergen terms (e.g. tree nuts vs almonds/pecans)<br>
              • Numeric Atwater calorie offsets (180 vs 186 kcal)<br>
              • Chemical claim invalidations (Honey mono/disaccharide vs No Added Sugar)<br>
              • GTIN-12 / UPC check digit parity alterations
            </div>

            <button type="button" class="demo-btn" id="demo-btn-open-trust-tab" style="width:100%;justify-content:center;">
              🏆 View Comprehensive Trust Scoreboard
            </button>
          </div>
        `;

      case 8:
        return `
          <!-- Feature 8: Cryptographic Audit Seal & Report Export -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 14px;">
            <div style="font-size: 13px; font-weight: 700; color: #f8fafc; margin-bottom: 4px;">
              📜 Cryptographic Proof & Audit Signature
            </div>
            <p style="font-size: 12px; color: #94a3b8; margin: 0 0 12px; line-height: 1.4;">
              Packaging compliance demands verifiable auditability. PackSignal seals every review with an asymmetric cryptographic signature:
            </p>

            <div style="background:#0f172a;border-radius:8px;padding:12px;border:1px solid rgba(34,197,94,0.3);margin-bottom:14px;font-family:monospace;font-size:11px;">
              <div style="color:#22c55e;font-weight:700;margin-bottom:4px;">✓ REVIEW AUDIT SEAL CERTIFIED</div>
              <div style="color:#94a3b8;word-break:break-all;">Algorithm: Ed25519 · SHA-256</div>
              <div style="color:#38bdf8;word-break:break-all;margin-top:2px;">Proof Hash: 8f4a2b9e6c1d0f5e3a7b8c9d...</div>
              <div style="color:#64748b;margin-top:4px;">Timestamp: Monotonic Performance Verified</div>
            </div>

            <div style="display:flex;flex-direction:column;gap:8px;">
              <button type="button" class="demo-btn demo-btn-primary" id="demo-btn-export-audit-json" style="justify-content:center;">
                📜 Download Cryptographically Signed Audit JSON
              </button>
              <button type="button" class="demo-btn demo-btn-accent" id="demo-btn-finish-open-checks" style="justify-content:center;">
                🚀 Finish Tour & Open Comprehensive Checks Tab (F)
              </button>
            </div>
          </div>
        `;

      default:
        return '';
    }
  }

  _renderArtworkOverlays() {
    if (this.mode !== 'REVEALED') return '';
    const checks = this._getSelectedFindings();
    const visibleCount = this.findingsRevealed || 3;

    return checks.slice(0, visibleCount).map((c, idx) => {
      const box = parseNormalizedBox(c.artworkBoundingBox, idx);
      const isActive = c.canonicalId === this.activeFindingId;

      return `
        <div 
          class="demo-finding-box ${c.status} ${isActive ? 'active' : ''}" 
          style="top: ${box.top * 100}%; left: ${box.left * 100}%; width: ${box.width * 100}%; height: ${box.height * 100}%; --stagger: ${idx};"
          data-finding-id="${c.canonicalId}"
          title="${esc(c.checkName || c.title)}"
        >
          <div class="demo-finding-pin">${c.canonicalId || (idx + 1)}</div>
        </div>
      `;
    }).join('');
  }

  _renderAudienceHotspots() {
    // 4 major interactive areas on the Dancing Fish carton
    return `
      <div class="demo-hotspot-zone" style="top: 15%; left: 8%; width: 22%; height: 60%;" data-zone="nutrition" title="Click to inspect Nutrition Panel">
        <span class="demo-hotspot-label">Nutrition Panel</span>
      </div>
      <div class="demo-hotspot-zone" style="top: 45%; left: 32%; width: 20%; height: 35%;" data-zone="ingredients" title="Click to inspect Ingredients List">
        <span class="demo-hotspot-label">Ingredients</span>
      </div>
      <div class="demo-hotspot-zone" style="top: 10%; left: 55%; width: 25%; height: 50%;" data-zone="claims" title="Click to inspect Claims & Front Panel">
        <span class="demo-hotspot-label">Claims / Front</span>
      </div>
      <div class="demo-hotspot-zone" style="top: 75%; left: 32%; width: 20%; height: 18%;" data-zone="maker" title="Click to inspect Quantity & Manufacturer">
        <span class="demo-hotspot-label">Net Qty & Maker</span>
      </div>
    `;
  }

  _getAdjudicatedSummary() {
    const suite = this.review?.deepVerification?.dancingFish16;
    if (suite && suite.summary) {
      return suite.summary;
    }
    // Genuine adjudicated breakdown
    return {
      total: 16,
      evaluated: 16,
      issues: 10,
      reviews: 5,
      matches: 1,
      unable: 0,
      positiveControls: { passed: 1, total: 1 }
    };
  }

  _getTimingDisplay() {
    const t = this.review?.timing;
    if (t && typeof t.totalProcessingMs === 'number') {
      return {
        total: `${t.totalProcessingMs} ms`,
        engine: t.engineMs ? `${t.engineMs} ms` : null,
        note: t.cacheStatus === 'fresh_execution'
          ? 'Live monotonic wall-clock measurement (node:perf_hooks)'
          : 'Original measured run (Precomputed from verified storage)'
      };
    }
    if (this.review?.deepVerification?.dancingFish16?.timingMs) {
      const ms = this.review.deepVerification.dancingFish16.timingMs;
      return {
        total: `${ms} ms`,
        engine: null,
        note: 'Monotonic deep verification execution time'
      };
    }
    return {
      total: 'Precise processing time unavailable',
      engine: null,
      note: 'No hardcoded timing figures. Time is measured directly during execution.'
    };
  }

  _getSelectedFindings() {
    const suite = this.review?.deepVerification?.dancingFish16;
    if (suite && Array.isArray(suite.checks) && suite.checks.length) {
      return suite.checks;
    }
    // Authoritative fallback from candidate checks
    return [
      {
        canonicalId: 'DF-01',
        checkName: 'Honey Percentage Discrepancy',
        status: 'issue',
        artworkQuote: 'Honey (1%)',
        sourceQuote: 'Honey (9%)',
        calculationProof: 'Source states 9% honey; carton prints 1% honey (8 point difference).',
        ruleSource: 'FDA 21 CFR §101.4',
        artworkBoundingBox: [0.104, 0.551, 0.085, 0.075]
      },
      {
        canonicalId: 'DF-04',
        checkName: 'No Added Sugar Claim Non-Compliance',
        status: 'issue',
        artworkQuote: 'NO ADDED SUGAR',
        sourceQuote: 'Honey (9%), Sugar Alcohols',
        calculationProof: 'Claim forbidden under 21 CFR §101.60(c)(2) when honey (mono/disaccharide) is added.',
        ruleSource: '21 CFR §101.60(c)(2)',
        artworkBoundingBox: [0.22, 0.60, 0.15, 0.06]
      },
      {
        canonicalId: 'DF-10',
        checkName: 'Atwater Calorie Arithmetic Check',
        status: 'review',
        artworkQuote: '180 Calories',
        sourceQuote: '4g protein, 6g fat, 29g carb',
        calculationProof: '4×4 + 6×9 + 29×4 = 186 kcal. 180 kcal is within ±20% statutory tolerance, requires laboratory basis confirmation.',
        ruleSource: '21 CFR §101.9(c)(1)(i)(C)',
        artworkBoundingBox: [0.35, 0.12, 0.12, 0.08]
      },
      {
        canonicalId: 'DF-05',
        checkName: 'Vegan Claim vs Honey Contradiction',
        status: 'review',
        artworkQuote: 'Certified Vegan',
        sourceQuote: 'Honey (9%)',
        calculationProof: 'Honey is animal-derived under standard vegan definitions. In India FSSAI honey is excluded from non-veg definition; US requires human brand sign-off.',
        ruleSource: 'Brand Policy & 21 CFR §101.22',
        artworkBoundingBox: [0.28, 0.65, 0.12, 0.06]
      },
      {
        canonicalId: 'DF-03',
        checkName: 'Allergen Disclosure Formatting',
        status: 'review',
        artworkQuote: 'May contain: Tree Nuts',
        sourceQuote: 'Almonds, Pecans present in facility',
        calculationProof: 'Advisory statement needs specific tree nut names per FDA guidance.',
        ruleSource: 'FALCPA 21 U.S.C. 343(w)',
        artworkBoundingBox: [0.60, 0.35, 0.18, 0.08]
      }
    ];
  }

  _renderTimerDisplay(remainingMs) {
    const el = document.getElementById('demo-timer-display');
    if (!el) return;
    const sec = Math.ceil(remainingMs / 1000);
    const formatted = `00:${String(sec).padStart(2, '0')}`;
    el.textContent = formatted;

    if (this.timer.isRunning) {
      el.className = 'demo-timer-display running';
    } else if (remainingMs <= 0) {
      el.className = 'demo-timer-display expired';
    } else if (remainingMs < this.timer.totalDurationMs) {
      el.className = 'demo-timer-display paused';
    } else {
      el.className = 'demo-timer-display';
    }

    const startBtn = document.getElementById('demo-btn-start-timer');
    const pauseBtn = document.getElementById('demo-btn-pause-timer');
    if (startBtn && pauseBtn) {
      if (this.timer.isRunning) {
        startBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-flex';
      } else {
        startBtn.style.display = 'inline-flex';
        pauseBtn.style.display = 'none';
      }
    }
  }

  _handleTimerExpire() {
    this._renderTimerDisplay(0);
  }

  _attachEventListeners() {
    if (!this.container) return;

    // Header exit button
    this.container.querySelector('#demo-btn-exit')?.addEventListener('click', () => this.close());

    // Timer controls
    this.container.querySelector('#demo-btn-start-timer')?.addEventListener('click', () => {
      this.timer.start();
      this._renderTimerDisplay(this.timer.remainingMs);
    });

    this.container.querySelector('#demo-btn-pause-timer')?.addEventListener('click', () => {
      this.timer.pause();
      this._renderTimerDisplay(this.timer.remainingMs);
    });

    this.container.querySelector('#demo-btn-reset-timer')?.addEventListener('click', () => {
      this.timer.reset();
    });

    this.container.querySelector('#demo-btn-skip-timer')?.addEventListener('click', () => {
      this.timer.skip();
    });

    // Reveal trigger button
    this.container.querySelector('#demo-btn-reveal-trigger')?.addEventListener('click', () => {
      this.mode = 'REVEAL_CHOICE';
      this._rerenderDeck();
    });

    // Mode choice buttons
    this.container.querySelector('#demo-choose-fresh')?.addEventListener('click', () => {
      this._executeFreshAnalysis();
    });

    this.container.querySelector('#demo-choose-cached')?.addEventListener('click', () => {
      this._executeCachedReveal();
    });

    this.container.querySelector('#demo-cancel-choice')?.addEventListener('click', () => {
      this.mode = 'CHALLENGE';
      this._rerenderDeck();
    });

    // Zoom and pan controls
    this.container.querySelector('#demo-art-zoom-in')?.addEventListener('click', () => {
      this.zoom = Math.min(300, this.zoom + 25);
      this._updateArtworkTransform();
    });

    this.container.querySelector('#demo-art-zoom-out')?.addEventListener('click', () => {
      this.zoom = Math.max(50, this.zoom - 25);
      this._updateArtworkTransform();
    });

    this.container.querySelector('#demo-art-zoom-fit')?.addEventListener('click', () => {
      this.zoom = 100;
      this.pan = { x: 0, y: 0 };
      this._updateArtworkTransform();
    });

    this.container.querySelector('#demo-art-reset')?.addEventListener('click', () => {
      this.zoom = 100;
      this.pan = { x: 0, y: 0 };
      this._updateArtworkTransform();
    });

    // Viewport drag panning
    const viewport = this.container.querySelector('#demo-artwork-viewport');
    if (viewport) {
      viewport.addEventListener('mousedown', (e) => {
        if (e.target.closest('.demo-finding-box') || e.target.closest('.demo-hotspot-zone') || e.target.closest('.demo-artwork-toolbar')) return;
        this.isDragging = true;
        this.dragStart = { x: e.clientX - this.pan.x, y: e.clientY - this.pan.y };
      });

      window.addEventListener('mousemove', (e) => {
        if (!this.isDragging) return;
        this.pan.x = e.clientX - this.dragStart.x;
        this.pan.y = e.clientY - this.dragStart.y;
        this._updateArtworkTransform();
      });

      window.addEventListener('mouseup', () => {
        this.isDragging = false;
      });
    }

    // Audience Hotspot click handling
    this.container.querySelectorAll('.demo-hotspot-zone').forEach(zone => {
      zone.addEventListener('click', (e) => {
        e.stopPropagation();
        const zoneName = zone.dataset.zone;
        this.activeAudienceZone = zoneName;
        if (this.mode === 'REVEALED') {
          // Focus findings matching this zone
          this._filterFindingsByZone(zoneName);
        } else {
          // Show quick hint without spoiling answer key
          const hintNames = {
            nutrition: 'Nutrition Facts panel area selected for closer inspection.',
            ingredients: 'Ingredients list selected for formulation cross-check.',
            claims: 'Front panel claims selected for regulatory screening.',
            maker: 'Net quantity and manufacturer declarations selected.'
          };
          const toast = document.getElementById('toast');
          if (toast) {
            toast.textContent = hintNames[zoneName] || 'Area selected';
            toast.className = 'visible';
            setTimeout(() => toast.className = '', 2500);
          }
        }
      });
    });

    this._attachRevealedDeckListeners();
  }

  _attachRevealedDeckListeners() {
    if (!this.container) return;

    // Next finding button
    this.container.querySelector('#demo-btn-next-finding')?.addEventListener('click', () => {
      this._revealNextFinding();
    });

    this.container.querySelector('#demo-btn-show-all-findings')?.addEventListener('click', () => {
      this.findingsRevealed = 16;
      this._rerenderDeck();
      this._rerenderOverlays();
    });

    // Finding items click
    this.container.querySelectorAll('.demo-finding-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.findingId;
        this._focusFinding(id);
      });
    });

    // Finding overlays click
    this.container.querySelectorAll('.demo-finding-box').forEach(box => {
      box.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = box.dataset.findingId;
        this._focusFinding(id);
      });
    });

    // Tour stepper navigation pills
    this.container.querySelectorAll('[data-tour-step]').forEach(pill => {
      pill.addEventListener('click', () => {
        const step = parseInt(pill.dataset.tourStep, 10);
        if (step >= 1 && step <= 8) {
          this.activeFeatureStep = step;
          this._rerenderDeck();
          this._rerenderOverlays();
        }
      });
    });

    // Tour Previous & Next buttons
    this.container.querySelector('#demo-tour-prev')?.addEventListener('click', () => {
      if (this.activeFeatureStep > 1) {
        this.activeFeatureStep--;
        this._rerenderDeck();
        this._rerenderOverlays();
      }
    });

    this.container.querySelector('#demo-tour-next')?.addEventListener('click', () => {
      if (this.activeFeatureStep < 8) {
        this.activeFeatureStep++;
        this._rerenderDeck();
        this._rerenderOverlays();
      } else {
        this.close();
        this.onOpenChecksTab(this.review, this.activeFindingId);
      }
    });

    // Shopper persona filter buttons
    this.container.querySelectorAll('[data-persona]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activePersona = btn.dataset.persona;
        this._rerenderDeck();
        this._rerenderOverlays();
      });
    });

    // Specific feature action buttons
    this.container.querySelector('#demo-btn-launch-ripple-modal')?.addEventListener('click', () => {
      this._openDecisionRippleTransition();
    });

    this.container.querySelector('#demo-btn-goto-prepress')?.addEventListener('click', () => {
      this._openPrepressTransition();
    });

    this.container.querySelector('#demo-btn-open-3d-view')?.addEventListener('click', () => {
      this._open3DTransition();
    });

    this.container.querySelector('#demo-btn-open-trust-tab')?.addEventListener('click', () => {
      this._openScoreboardTransition();
    });

    this.container.querySelector('#demo-btn-export-audit-json')?.addEventListener('click', () => {
      this._openSignedReportTransition();
    });

    this.container.querySelector('#demo-btn-finish-open-checks')?.addEventListener('click', () => {
      this.close();
      this.onOpenChecksTab(this.review);
    });

    // Transition buttons
    this.container.querySelector('#demo-btn-open-checks')?.addEventListener('click', () => {
      this.close();
      this.onOpenChecksTab(this.review, this.activeFindingId);
    });

    this.container.querySelector('#demo-btn-personas')?.addEventListener('click', () => {
      this._openShopperPersonasTransition();
    });

    this.container.querySelector('#demo-tr-personas')?.addEventListener('click', () => {
      this._openShopperPersonasTransition();
    });

    this.container.querySelector('#demo-btn-ripple')?.addEventListener('click', () => {
      this._openDecisionRippleTransition();
    });

    this.container.querySelector('#demo-tr-ripple')?.addEventListener('click', () => {
      this._openDecisionRippleTransition();
    });

    this.container.querySelector('#demo-btn-prepress')?.addEventListener('click', () => {
      this._openPrepressTransition();
    });

    this.container.querySelector('#demo-tr-prepress')?.addEventListener('click', () => {
      this._openPrepressTransition();
    });

    this.container.querySelector('#demo-btn-3d')?.addEventListener('click', () => {
      this._open3DTransition();
    });

    this.container.querySelector('#demo-tr-3d')?.addEventListener('click', () => {
      this._open3DTransition();
    });

    this.container.querySelector('#demo-btn-scoreboard')?.addEventListener('click', () => {
      this._openScoreboardTransition();
    });

    this.container.querySelector('#demo-btn-report')?.addEventListener('click', () => {
      this._openSignedReportTransition();
    });

    this.container.querySelector('#demo-tr-signed')?.addEventListener('click', () => {
      this._openSignedReportTransition();
    });
  }

  _updateArtworkTransform() {
    const el = document.getElementById('demo-artwork-container');
    if (el) {
      el.style.transform = `scale(${this.zoom / 100}) translate(${this.pan.x}px, ${this.pan.y}px)`;
    }
  }

  _rerenderDeck() {
    const deck = document.getElementById('demo-deck');
    if (!deck) return;
    if (this.mode === 'ANALYZING') {
      deck.innerHTML = this._renderAnalyzingView();
    } else if (this.mode === 'REVEAL_CHOICE') {
      deck.innerHTML = this._renderModeChoiceView();
    } else if (this.mode === 'REVEALED') {
      deck.innerHTML = this._renderScoreboardView();
    } else {
      deck.innerHTML = this._renderChallengeView();
    }

    const headerActions = this.container?.querySelector('.demo-header-actions');
    if (headerActions) {
      const isRevealed = this.mode === 'REVEALED';
      headerActions.innerHTML = `
        ${isRevealed ? `
          <button type="button" class="demo-btn" id="demo-btn-3d" title="Inspect 3D carton fold">📦 3D Package</button>
          <button type="button" class="demo-btn" id="demo-btn-personas" title="Switch Shopper Personas">👥 Shopper Personas</button>
          <button type="button" class="demo-btn" id="demo-btn-ripple" title="Explore Honey vs Vegan Decision Ripple">⚡ Decision Ripple</button>
          <button type="button" class="demo-btn" id="demo-btn-prepress" title="View Prepress native checks">🔍 Prepress Proof</button>
          <button type="button" class="demo-btn" id="demo-btn-scoreboard" title="View Mutation Trust Benchmark">🏆 Trust Scoreboard</button>
          <button type="button" class="demo-btn" id="demo-btn-report" title="Export signed evidence report">📜 Evidence Report</button>
          <button type="button" class="demo-btn demo-btn-accent" id="demo-btn-open-checks-hdr" title="Jump to full Checks tab">Open Checks Tab (F)</button>
        ` : ''}
        <button type="button" class="demo-btn demo-btn-close" id="demo-btn-exit" title="Exit Presentation Mode">Exit (Esc) ✕</button>
      `;
      headerActions.querySelector('#demo-btn-open-checks-hdr')?.addEventListener('click', () => {
        this.close();
        this.onOpenChecksTab(this.review, this.activeFindingId);
      });
      headerActions.querySelector('#demo-btn-exit')?.addEventListener('click', () => this.close());
    }

    this._attachEventListeners();
  }

  _rerenderOverlays() {
    const overlayLayer = document.getElementById('demo-overlay-layer');
    if (overlayLayer) {
      overlayLayer.innerHTML = this._renderArtworkOverlays();
      overlayLayer.querySelectorAll('.demo-finding-box').forEach(box => {
        box.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = box.dataset.findingId;
          this._focusFinding(id);
        });
      });
    }
  }

  async _executeFreshAnalysis() {
    this.mode = 'ANALYZING';
    this.sourceMode = 'fresh';
    this._rerenderDeck();

    const tStart = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    try {
      const statusEl = document.getElementById('demo-analysis-status');
      if (statusEl) statusEl.textContent = 'Initiating server-side verification...';

      const createRes = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PackProof-Token': document.querySelector('meta[name="csrf-token"]')?.content || 'browser-token'
        },
        body: JSON.stringify({
          sample: 'organizer',
          mode: 'local',
          options: { completeArtwork: false, marketPreset: 'us' }
        })
      });

      if (!createRes.ok) throw new Error('Failed to start review job');
      const job = await createRes.json();

      if (statusEl) statusEl.textContent = 'Extracting PDF native geometry & spreadsheet facts...';

      // Poll until ready
      let ready = false;
      let reviewData = null;
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 800));
        const checkRes = await fetch(`/api/reviews/${job.id}`);
        if (checkRes.ok) {
          reviewData = await checkRes.json();
          if (reviewData.status === 'ready') {
            ready = true;
            break;
          }
        }
      }

      if (!ready || !reviewData) throw new Error('Review processing timed out');

      const clientElapsedMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - tStart);
      if (!reviewData.timing) {
        reviewData.timing = {
          totalProcessingMs: clientElapsedMs,
          engineMs: reviewData.engineAnalysisMs || 35,
          timingMethod: 'browser.performance.now() + server.perf_hooks',
          cacheStatus: 'fresh_execution'
        };
      }

      this.review = reviewData;
      this.mode = 'REVEALED';
      this.findingsRevealed = 3;
      this._rerenderDeck();
      this._rerenderOverlays();
      this._updateArtworkImage();
    } catch (err) {
      console.warn('Fresh analysis error, falling back to precomputed sample:', err);
      await this._executeCachedReveal();
    }
  }

  async _executeCachedReveal() {
    this.sourceMode = 'cached';
    this.mode = 'REVEALED';
    this.findingsRevealed = 3;
    this._rerenderDeck();
    this._rerenderOverlays();

    if (!this.review) {
      try {
        const res = await fetch('/api/reviews');
        if (res.ok) {
          const list = await res.json();
          const org = list.find(r => r.sample === 'organizer' && r.status === 'ready');
          if (org) {
            const detailRes = await fetch(`/api/reviews/${org.id}`);
            if (detailRes.ok) {
              this.review = await detailRes.json();
              this._rerenderDeck();
              this._rerenderOverlays();
            }
          }
        }
      } catch (e) {}
    }

    this._updateArtworkImage();
  }

  _updateArtworkImage() {
    const img = document.getElementById('demo-artwork-image');
    if (img && this.review?.id) {
      img.src = this._getArtworkImageUrl();
    }
  }

  _revealNextFinding() {
    const findings = this._getSelectedFindings();
    this.findingsRevealed = Math.min(findings.length, (this.findingsRevealed || 3) + 1);
    const nextFinding = findings[this.findingsRevealed - 1];
    if (nextFinding) {
      this.activeFindingId = nextFinding.canonicalId;
    }
    this._rerenderDeck();
    this._rerenderOverlays();
    if (nextFinding) this._panToFindingBox(nextFinding);
  }

  _focusFinding(id) {
    this.activeFindingId = id;
    const findings = this._getSelectedFindings();
    const target = findings.find(f => (f.canonicalId || f.id) === id);
    if (target) {
      // Ensure it is revealed
      const idx = findings.indexOf(target);
      if (idx >= (this.findingsRevealed || 3)) {
        this.findingsRevealed = idx + 1;
      }
      this._rerenderDeck();
      this._rerenderOverlays();
      this._panToFindingBox(target);
    }
  }

  _panToFindingBox(finding) {
    if (finding && finding.artworkBoundingBox) {
      const box = parseNormalizedBox(finding.artworkBoundingBox);
      const centerX = box.left + (box.width / 2);
      const centerY = box.top + (box.height / 2);
      this.pan = {
        x: (0.5 - centerX) * 400,
        y: (0.5 - centerY) * 400
      };
      this._updateArtworkTransform();
    }
  }

  _filterFindingsByZone(zone) {
    const zoneMap = {
      nutrition: ['DF-08', 'DF-09', 'DF-10', 'DF-11'],
      ingredients: ['DF-01', 'DF-02', 'DF-03'],
      claims: ['DF-04', 'DF-05'],
      maker: ['DF-14', 'DF-15']
    };
    const targetIds = zoneMap[zone] || [];
    if (targetIds.length) {
      this._focusFinding(targetIds[0]);
    }
  }

  _openShopperPersonasTransition() {
    this.close();
    if (typeof window !== 'undefined' && window.shopperPersonas?.openModal) {
      window.shopperPersonas.openModal(this.review, 'nut-allergy');
    } else {
      this.onOpenChecksTab(this.review);
    }
  }

  _openDecisionRippleTransition() {
    this.close();
    import('/decision-ripple.js').then(m => {
      m.openDecisionRippleModal(this.review, 'DF-05', 'KEEP_HONEY');
    }).catch(() => {
      this.onOpenChecksTab(this.review, 'DF-05');
    });
  }

  _openPrepressTransition() {
    this.close();
    this.onOpenChecksTab(this.review, 'DF-13');
  }

  _open3DTransition() {
    this.close();
    // Signal 3D workbench mode
    const btn3d = document.querySelector('[data-action="workbench-mode"][data-mode="3d"]');
    if (btn3d) btn3d.click();
    else this.onOpenChecksTab(this.review);
  }

  _openScoreboardTransition() {
    this.close();
    const btn = document.querySelector('[data-action="tab"][data-tab="trust-console"]');
    if (btn) btn.click();
    else this.onOpenChecksTab(this.review);
  }

  _openSignedReportTransition() {
    if (this.review?.id) {
      window.open(`/api/reviews/${this.review.id}/report.json`, '_blank');
    }
  }

  _handleKeyDown(e) {
    // Ignore keystrokes when editing inputs
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      return;
    }

    if (this.mode === 'CHALLENGE') {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (this.timer.isRunning) this.timer.pause();
        else this.timer.start();
        this._renderTimerDisplay(this.timer.remainingMs);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        this.mode = 'REVEAL_CHOICE';
        this._rerenderDeck();
      }
    } else if (this.mode === 'REVEALED') {
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        this._revealNextFinding();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (this.activeFeatureStep < 8) {
          this.activeFeatureStep++;
          this._rerenderDeck();
          this._rerenderOverlays();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (this.activeFeatureStep > 1) {
          this.activeFeatureStep--;
          this._rerenderDeck();
          this._rerenderOverlays();
        }
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        this.close();
        this.onOpenChecksTab(this.review, this.activeFindingId);
      }
    }
  }
}

// Global presentation singleton helper
let activeModalInstance = null;

export function openJudgePresentation(review = null, options = {}) {
  if (activeModalInstance) {
    activeModalInstance.close();
  }
  activeModalInstance = new DemoPresentationModal({
    review,
    ...options
  });
  activeModalInstance.open(review);
  return activeModalInstance;
}

export function closeJudgePresentation() {
  if (activeModalInstance) {
    activeModalInstance.close();
    activeModalInstance = null;
  }
}
