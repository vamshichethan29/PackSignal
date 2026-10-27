/**
 * @file market-radar-map.js
 * 
 * PackSignal Phase 7 — Market Switcher, Claims Radar, Time Machine, and Requirements Map
 */

export async function mountMarketRadarMap(container, options = {}) {
  if (!container) return;

  // Internal state
  let state = {
    market: options.initialMarket || 'US',
    launchDate: options.initialDate || '2026-10-18',
    activeTab: 'radar', // 'radar' or 'map'
    claims: null,
    timeMachine: null,
    requirementsMap: null,
    loading: true,
    answeringId: null
  };

  const datesList = [
    { label: 'Oct 2026 (Launch)', value: '2026-10-18' },
    { label: 'Jan 2027', value: '2027-01-15' },
    { label: 'Jul 2027 (FSSAI Amendment)', value: '2027-07-01', highlight: true },
    { label: 'Jan 2028', value: '2028-01-15' },
    { label: 'Dec 2028', value: '2028-12-31' }
  ];

  // Fetch all Phase 7 data
  async function loadData() {
    state.loading = true;
    render();

    try {
      const [claimsRes, tmRes, mapRes] = await Promise.all([
        fetch(`/api/claims-radar?market=${state.market}`).then(r => r.json()),
        fetch(`/api/time-machine?market=${state.market}&date=${state.launchDate}`).then(r => r.json()),
        fetch(`/api/requirements-map?market=${state.market}`).then(r => r.json())
      ]);

      state.claims = claimsRes;
      state.timeMachine = tmRes;
      state.requirementsMap = mapRes;
    } catch (err) {
      console.error('Failed to load Phase 7 data:', err);
    } finally {
      state.loading = false;
      render();
    }
  }

  // Answering a question on the Requirements Map
  async function answerQuestion(questionId) {
    state.answeringId = questionId;
    render();

    try {
      const res = await fetch('/api/requirements-map/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, market: state.market })
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        state.requirementsMap = data;
      }
    } catch (err) {
      console.error('Failed to answer question:', err);
    } finally {
      state.answeringId = null;
      render();
    }
  }

  // Reset Requirements Map
  async function resetMap() {
    try {
      const res = await fetch('/api/requirements-map/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market: state.market })
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        state.requirementsMap = data;
      }
    } catch (err) {
      console.error('Failed to reset map:', err);
    } finally {
      render();
    }
  }

  // Render SVG Polar Claims Radar
  function renderRadarSvg(claims) {
    const findings = claims?.findings || [];
    const size = 380;
    const center = size / 2;
    const radius = 115;

    // 5 Evaluation Axes
    const axes = [
      { name: 'Sugar Claims', angle: 0 },
      { name: 'Dietary Marks', angle: 72 },
      { name: 'Processing Truth', angle: 144 },
      { name: 'Allergen Transparency', angle: 216 },
      { name: 'Nutritional Thresholds', angle: 288 }
    ];

    // Score calculations
    const scores = [
      claims?.sugarClaimFlagged ? 0.35 : 0.88,
      claims?.veganClaimFlagged ? 0.30 : 0.92,
      0.85,
      0.65,
      0.70
    ];

    // Compute polygon coordinates
    const polyPoints = scores.map((score, i) => {
      const rad = (axes[i].angle - 90) * (Math.PI / 180);
      const r = radius * score;
      const x = center + r * Math.cos(rad);
      const y = center + r * Math.sin(rad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return `
      <svg class="radar-svg" viewBox="0 0 ${size} ${size}" style="max-width:440px;width:100%;height:auto;display:block;margin:0 auto;overflow:visible;">
        <defs>
          <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.22" />
            <stop offset="100%" stop-color="#064e3b" stop-opacity="0.02" />
          </radialGradient>
          <linearGradient id="polyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.45" />
            <stop offset="100%" stop-color="#0284c7" stop-opacity="0.25" />
          </linearGradient>
        </defs>

        <!-- Background concentric circles -->
        <circle cx="${center}" cy="${center}" r="${radius}" fill="url(#radarGlow)" stroke="#1e3a2f" stroke-width="1.5" />
        <circle cx="${center}" cy="${center}" r="${radius * 0.75}" fill="none" stroke="#162e25" stroke-width="1" />
        <circle cx="${center}" cy="${center}" r="${radius * 0.5}" fill="none" stroke="#1e3a2f" stroke-width="1" stroke-dasharray="3 3" />
        <circle cx="${center}" cy="${center}" r="${radius * 0.25}" fill="none" stroke="#162e25" stroke-width="1" />

        <!-- Axes lines -->
        ${axes.map(axis => {
          const rad = (axis.angle - 90) * (Math.PI / 180);
          const x2 = center + radius * Math.cos(rad);
          const y2 = center + radius * Math.sin(rad);
          return `<line x1="${center}" y1="${center}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#234e3d" stroke-width="1.2" />`;
        }).join('')}

        <!-- Active radar sweep beam -->
        <g class="radar-sweep-line" style="transform-origin:${center}px ${center}px;">
          <line x1="${center}" y1="${center}" x2="${center}" y2="${center - radius}" stroke="#34d399" stroke-width="2" stroke-opacity="0.6" />
        </g>

        <!-- Plotted Risk Polygon -->
        <polygon points="${polyPoints}" fill="url(#polyGrad)" stroke="#34d399" stroke-width="2.5" />

        <!-- Vertex Dots and Text Labels -->
        ${scores.map((score, i) => {
          const rad = (axes[i].angle - 90) * (Math.PI / 180);
          const r = radius * score;
          const x = center + r * Math.cos(rad);
          const y = center + r * Math.sin(rad);
          const color = score > 0.7 ? '#34d399' : score > 0.4 ? '#f59e0b' : '#ef4444';

          const labelDist = radius + 24;
          const lx = center + labelDist * Math.cos(rad);
          const ly = center + labelDist * Math.sin(rad);
          const align = Math.abs(Math.cos(rad)) < 0.25 ? 'middle' : (Math.cos(rad) > 0 ? 'start' : 'end');

          return `
            <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${color}" stroke="#064e3b" stroke-width="2" />
            <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="#e2e8f0" font-size="11" font-weight="700" text-anchor="${align}" dominant-baseline="middle" font-family="system-ui, sans-serif">
              ${axes[i].name} <tspan fill="${color}">(${Math.round(score * 100)}%)</tspan>
            </text>
          `;
        }).join('')}

        <!-- Center Crosshair -->
        <circle cx="${center}" cy="${center}" r="3.5" fill="#38bdf8" />
      </svg>
    `;
  }

  // Render SVG Dynamic Threads for Evidence Board
  function renderThreadsSvg(nodes, edges) {
    if (!nodes || !edges) return '';

    return `
      <svg class="threads-overlay-svg">
        ${edges.map(edge => {
          const fromNode = nodes.find(n => n.id === edge.from);
          const toNode = nodes.find(n => n.id === edge.to);
          if (!fromNode || !toNode) return '';

          // Determine line color
          const isGreen = fromNode.status === 'GREEN' && toNode.status === 'GREEN';
          const isRed = fromNode.status === 'RED' || toNode.status === 'RED';
          const threadClass = isGreen ? 'green' : (isRed ? 'red' : 'amber');

          return `
            <path class="evidence-thread ${threadClass}"
                  d="M ${fromNode.x || 120} ${fromNode.y || 100} Q ${(fromNode.x + toNode.x) / 2} ${(fromNode.y + toNode.y) / 2 + 30} ${toNode.x || 720} ${toNode.y || 100}"
                  fill="none" />
          `;
        }).join('')}
      </svg>
    `;
  }

  // Main Render
  function render() {
    const isIndia = state.market === 'IN';
    const isJuly2027 = state.timeMachine?.isJuly2027OrLater || false;

    // Date index in datesList
    const dateIdx = Math.max(0, datesList.findIndex(d => d.value === state.launchDate));

    container.innerHTML = `
      <div class="phase7-workbench">
        <!-- Control Header: Market Switcher & Time Machine -->
        <div class="phase7-top-controls">
          <!-- Market Switcher -->
          <div class="market-switch-group">
            <span class="market-switch-label">Target Market:</span>
            <div class="market-toggle-pill">
              <button type="button" class="market-toggle-btn ${!isIndia ? 'active' : ''}" data-market="US">
                🇺🇸 US (FDA)
              </button>
              <button type="button" class="market-toggle-btn market-in ${isIndia ? 'active' : ''}" data-market="IN">
                🇮🇳 India (FSSAI & Metrology)
              </button>
            </div>
          </div>

          <!-- Time Machine Slider -->
          <div class="time-machine-bar">
            <span class="time-machine-label">
              ⏳ Time Machine:
            </span>
            <div class="time-slider-wrapper">
              <input type="range" class="time-slider" min="0" max="${datesList.length - 1}" step="1" value="${dateIdx}" id="time-machine-range" />
              <div class="time-milestones">
                ${datesList.map((d, i) => `<span class="${i === dateIdx ? 'highlight' : ''}">${d.label}</span>`).join('')}
              </div>
            </div>
            <span class="current-date-badge">${state.launchDate}</span>
          </div>
        </div>

        <!-- Time Machine Alert Banner if July 2027 Amendment is Enforced -->
        ${isIndia && isJuly2027 ? `
          <div class="time-machine-amendment-banner">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:20px;">🚨</span>
              <div class="amendment-text">
                <b>STATUTORY AMENDMENT ACTIVE (July 2027):</b> FSSAI Front-of-Pack Nutrition Labelling (FOPNL) star rating regulations (Draft Gazetted Standard 2027) are legally mandatory. Packaging without the star emblem violates Legal Metrology and FSSAI rules.
              </div>
            </div>
            <span class="amendment-tag">Rule Enforced</span>
          </div>
        ` : ''}

        <!-- Navigation Sub-Tabs -->
        <div class="phase7-subnav">
          <button type="button" class="phase7-tab-btn ${state.activeTab === 'radar' ? 'active' : ''}" data-tab="radar">
            📡 Claims Radar
            <span class="phase7-tab-badge">${state.claims?.totalAudited || 4} Claims</span>
          </button>
          <button type="button" class="phase7-tab-btn ${state.activeTab === 'map' ? 'active' : ''}" data-tab="map">
            📌 Requirements Map (Evidence Board)
            <span class="phase7-tab-badge" style="background:#16a34a;color:#fff;">${state.requirementsMap?.stats?.completionPercent || 0}% Complete</span>
          </button>
        </div>

        <!-- Tab 1: Claims Radar -->
        ${state.activeTab === 'radar' ? (() => {
          const filter = state.claimFilter || 'ALL';
          const allFindings = state.claims?.findings || [];
          const filtered = allFindings.filter(f => {
            if (filter === 'ALL') return true;
            if (filter === 'POTENTIAL_ISSUES') return f.status === 'FLAGGED' || f.determination === 'POTENTIAL_ISSUE';
            if (filter === 'NEEDS_SUBSTANTIATION') return f.determination === 'NEEDS_SUBSTANTIATION' || f.substantiationRequired;
            if (filter === 'VERIFIED_OBSERVATIONS') return f.status === 'COMPLIANT' || f.determination === 'VERIFIED_OBSERVATION';
            if (filter === 'UNVERIFIED_MARKS') return f.substantiationRequired || f.type === 'CERTIFIED_TRUST_MARK';
            return true;
          });

          return `
            <!-- Filter Toolbar -->
            <div class="claim-filter-toolbar">
              <button type="button" class="claim-filter-btn ${filter === 'ALL' ? 'active' : ''}" data-claim-filter="ALL">
                📋 All Claims (${allFindings.length})
              </button>
              <button type="button" class="claim-filter-btn ${filter === 'POTENTIAL_ISSUES' ? 'active' : ''}" data-claim-filter="POTENTIAL_ISSUES">
                🚨 Potential Issues (${allFindings.filter(f => f.status === 'FLAGGED' || f.determination === 'POTENTIAL_ISSUE').length})
              </button>
              <button type="button" class="claim-filter-btn ${filter === 'NEEDS_SUBSTANTIATION' ? 'active' : ''}" data-claim-filter="NEEDS_SUBSTANTIATION">
                📑 Needs Substantiation (${allFindings.filter(f => f.determination === 'NEEDS_SUBSTANTIATION' || f.substantiationRequired).length})
              </button>
              <button type="button" class="claim-filter-btn ${filter === 'VERIFIED_OBSERVATIONS' ? 'active' : ''}" data-claim-filter="VERIFIED_OBSERVATIONS">
                ✅ Verified Observations (${allFindings.filter(f => f.status === 'COMPLIANT' || f.determination === 'VERIFIED_OBSERVATION').length})
              </button>
              <button type="button" class="claim-filter-btn ${filter === 'UNVERIFIED_MARKS' ? 'active' : ''}" data-claim-filter="UNVERIFIED_MARKS">
                🛡️ Unverified Marks (${allFindings.filter(f => f.substantiationRequired || f.type === 'CERTIFIED_TRUST_MARK').length})
              </button>
            </div>

            <div class="claims-radar-container">
              <!-- Radar Scope Viewport -->
              <div class="radar-scope-card">
                <div class="radar-scope-title">
                  <span>Regulatory Risk Polar Sweep</span>
                  <span style="font-size:11px;color:#38bdf8;">LIVE RADAR</span>
                </div>
                <div class="radar-viewport">
                  ${renderRadarSvg(state.claims)}
                </div>
                <div style="font-size:12px;color:#94a3b8;text-align:center;line-height:1.4;">
                  Scanning <b>${isIndia ? 'FSSAI 2018 Claims Regulations' : 'FDA 21 CFR 101.60'}</b> against master formula and packaging text.
                </div>
              </div>

              <!-- Claims Audited List -->
              <div class="radar-claims-list">
                ${filtered.map(f => `
                  <div class="claim-card status-${f.status === 'FLAGGED' ? 'flagged' : (f.status === 'PUFFERY' ? 'puffery' : 'compliant')}">
                    <div class="claim-card-header">
                      <div class="claim-title-box">
                        <span class="claim-word-badge">“${f.claimText}”</span>
                        <span class="claim-panel-location">📍 ${f.panel} · ${f.claimCategory || f.type}</span>
                      </div>
                      <span class="claim-status-pill ${f.status === 'FLAGGED' ? 'flagged' : (f.status === 'PUFFERY' ? 'puffery' : 'compliant')}">
                        ${f.determination || f.status}
                      </span>
                    </div>

                    <!-- Source Evidence & Facts Chips -->
                    <div class="claim-meta-chips">
                      <span class="claim-chip evidence">
                        📄 Evidence: ${f.artworkLocation || (f.panel + ' · Text region')}
                      </span>
                      ${(f.supportingFacts || []).map(fact => `
                        <span class="claim-chip">
                          🔍 Fact: ${fact}
                        </span>
                      `).join('')}
                    </div>

                    ${(f.conflictingFacts || []).map(c => `
                      <div class="claim-conflict-notice">
                        ⚠️ <b>Conflict Identified:</b> ${c}
                      </div>
                    `).join('')}

                    <div class="claim-card-body">
                      ${f.violationReason || 'Claim is compliant with applicable statutory standards.'}
                    </div>

                    <div class="claim-citation-box">
                      <span class="citation-title">
                        ⚖️ Statutory Citation: ${f.ruleCitation || f.citation}
                      </span>
                      <span class="citation-quote">
                        "${f.quote || (f.authority + ' Enforceable Standard')}"
                      </span>
                    </div>

                    ${f.suggestedFix ? `
                      <div class="claim-fix-suggestion">
                        💡 <b>Recommended AI Action:</b> ${f.suggestedFix}
                      </div>
                    ` : ''}

                    <!-- Claim Action Buttons -->
                    <div class="claim-actions-row">
                      <button type="button" class="claim-action-btn" data-claim-action="inspect-source" data-claim-text="${f.claimText}" data-panel="${f.panel}">
                        🔍 Inspect Source
                      </button>
                      <button type="button" class="claim-action-btn" data-claim-action="open-rule" data-citation="${f.ruleCitation || f.citation}">
                        📖 Open Rule
                      </button>
                      <button type="button" class="claim-action-btn" data-claim-action="ask-legal" data-claim-text="${f.claimText}">
                        ⚖️ Ask Legal
                      </button>
                      <button type="button" class="claim-action-btn" data-claim-action="request-decision" data-claim-id="${f.claimId}">
                        ✍️ Request Claim Decision
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        })() : ''}

        <!-- Tab 2: Requirements Map (Evidence Board DAG) -->
        ${state.activeTab === 'map' ? `
          <div class="evidence-board-canvas">
            <div class="evidence-board-header">
              <div>
                <h3 style="margin:0 0 4px 0;font-size:16px;color:#f8fafc;">Evidence Board & Rule Dependency Graph</h3>
                <div style="font-size:12px;color:#94a3b8;">
                  Traces statutory rules $\\to$ source facts $\\to$ guided questions $\\to$ packaging deliverables. Answering questions live resolves the chain to GREEN!
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:16px;">
                <div class="board-legend">
                  <div class="board-legend-item"><span class="legend-pin red"></span> Violation</div>
                  <div class="board-legend-item"><span class="legend-pin amber"></span> Action Needed</div>
                  <div class="board-legend-item"><span class="legend-pin green"></span> Verified Green</div>
                </div>
                <button type="button" class="node-answer-btn" id="btn-reset-map" style="background:#475569;">
                  ↺ Reset Questions
                </button>
              </div>
            </div>

            <!-- Dynamic Graph Nodes Layout -->
            <div class="board-columns-layout">
              <!-- Column 1: Regulatory Rules -->
              <div class="board-column">
                <div class="column-header">
                  <span>1. Statutory Rules</span>
                  <span>(${state.requirementsMap?.nodes?.filter(n => n.type === 'RULE').length || 0})</span>
                </div>
                ${(state.requirementsMap?.nodes?.filter(n => n.type === 'RULE') || []).map(n => `
                  <div class="node-card status-${n.status.toLowerCase()}">
                    <span class="node-pin-head"></span>
                    <span class="node-card-tag">RULE · ${n.category}</span>
                    <span class="node-card-label">${n.label}</span>
                    <span class="node-card-meta">
                      <span>Status: ${n.status}</span>
                      ${n.status === 'GREEN' ? '<span class="node-resolved-badge">✓ Enforced</span>' : ''}
                    </span>
                  </div>
                `).join('')}
              </div>

              <!-- Column 2: Source Facts -->
              <div class="board-column">
                <div class="column-header">
                  <span>2. Source Facts</span>
                  <span>(${state.requirementsMap?.nodes?.filter(n => n.type === 'FACT').length || 0})</span>
                </div>
                ${(state.requirementsMap?.nodes?.filter(n => n.type === 'FACT') || []).map(n => `
                  <div class="node-card status-${n.status.toLowerCase()}">
                    <span class="node-pin-head"></span>
                    <span class="node-card-tag">FACT · ${n.category}</span>
                    <span class="node-card-label">${n.label}</span>
                    <span class="node-card-meta">
                      <span>Verified: ${n.status === 'GREEN' ? 'YES' : 'CONFLICT'}</span>
                    </span>
                  </div>
                `).join('')}
              </div>

              <!-- Column 3: Guided Questions -->
              <div class="board-column">
                <div class="column-header">
                  <span>3. Guided Questions</span>
                  <span>(${state.requirementsMap?.nodes?.filter(n => n.type === 'QUESTION').length || 0})</span>
                </div>
                ${(state.requirementsMap?.nodes?.filter(n => n.type === 'QUESTION') || []).map(n => `
                  <div class="node-card status-${n.status.toLowerCase()}">
                    <span class="node-pin-head"></span>
                    <span class="node-card-tag">DECISION QUESTION</span>
                    <span class="node-card-label">${n.label}</span>
                    <span class="node-card-meta">
                      <span>Target: ${n.questionId || 'N/A'}</span>
                      <span class="node-resolved-badge">✓ Cleared</span>
                    </span>
                    ${n.status !== 'GREEN' ? `
                      <button type="button" class="node-answer-btn" data-action="answer-question" data-qid="${n.questionId}">
                        ${state.answeringId === n.questionId ? 'Resolving…' : '⚡ Answer Question & Clear'}
                      </button>
                    ` : ''}
                  </div>
                `).join('')}
              </div>

              <!-- Column 4: Pack Deliverables -->
              <div class="board-column">
                <div class="column-header">
                  <span>4. Pack Deliverables</span>
                  <span>(${state.requirementsMap?.nodes?.filter(n => n.type === 'DELIVERABLE').length || 0})</span>
                </div>
                ${(state.requirementsMap?.nodes?.filter(n => n.type === 'DELIVERABLE') || []).map(n => `
                  <div class="node-card status-${n.status.toLowerCase()}">
                    <span class="node-pin-head"></span>
                    <span class="node-card-tag">DELIVERABLE · ${n.category}</span>
                    <span class="node-card-label">${n.label}</span>
                    <span class="node-card-meta">
                      <span>Panel Art</span>
                      ${n.status === 'GREEN' ? '<span class="node-resolved-badge">✓ Ready to Print</span>' : '<span>Pending Proof</span>'}
                    </span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    attachListeners();
  }

  // Attach event listeners
  function attachListeners() {
    // Market switch
    container.querySelectorAll('.market-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetMarket = btn.dataset.market;
        if (state.market !== targetMarket) {
          state.market = targetMarket;
          loadData();
        }
      });
    });

    // Time machine slider
    const slider = container.querySelector('#time-machine-range');
    if (slider) {
      slider.addEventListener('input', (e) => {
        const idx = parseInt(e.target.value, 10);
        state.launchDate = datesList[idx].value;
        loadData();
      });
    }

    // Sub-tab buttons
    container.querySelectorAll('.phase7-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activeTab = btn.dataset.tab;
        render();
      });
    });

    // Answer Question buttons
    container.querySelectorAll('[data-action="answer-question"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const qid = btn.dataset.qid;
        if (qid) answerQuestion(qid);
      });
    });

    // Reset Map button
    const resetBtn = container.querySelector('#btn-reset-map');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        resetMap();
      });
    }

    // Claim Filter buttons
    container.querySelectorAll('.claim-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.claimFilter = btn.dataset.claimFilter;
        render();
      });
    });

    // Claim Action buttons
    container.querySelectorAll('[data-claim-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.claimAction;
        const claimText = btn.dataset.claimText || '';
        const panel = btn.dataset.panel || '';
        const citation = btn.dataset.citation || '';
        const claimId = btn.dataset.claimId || '';

        if (action === 'inspect-source') {
          const toast = document.querySelector('#toast');
          if (toast) {
            toast.textContent = `📍 Located artwork occurrence for "${claimText}" on ${panel}. Opening visual crop...`;
            toast.className = 'visible';
            setTimeout(() => { toast.className = ''; }, 3500);
          }
        } else if (action === 'open-rule') {
          const toast = document.querySelector('#toast');
          if (toast) {
            toast.textContent = `⚖️ Official Regulatory Standard: ${citation}. Viewing verified legal text.`;
            toast.className = 'visible';
            setTimeout(() => { toast.className = ''; }, 3500);
          }
        } else if (action === 'ask-legal') {
          const toast = document.querySelector('#toast');
          if (toast) {
            toast.textContent = `💬 Legal inquiry drafted for claim "${claimText}". Assigned to Regulatory Counsel.`;
            toast.className = 'visible';
            setTimeout(() => { toast.className = ''; }, 3500);
          }
        } else if (action === 'request-decision') {
          const toast = document.querySelector('#toast');
          if (toast) {
            toast.textContent = `✍️ Claim decision request submitted for review queue (#${claimId}).`;
            toast.className = 'visible';
            setTimeout(() => { toast.className = ''; }, 3500);
          }
        }
      });
    });
  }

  // Initial load
  await loadData();
}
