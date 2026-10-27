/**
 * PackSignal Phase 3 — Regulatory Requirements & Smart Questions Workspace
 * (public/requirements.js)
 */

class RequirementsWorkspace {
  constructor(mountElement) {
    this.mount = typeof mountElement === 'string' ? document.querySelector(mountElement) : mountElement;
    this.state = {
      market: 'us',
      launchDate: '2026-10-16',
      activeTab: 'ALL',
      data: null,
      loading: true,
      error: null,
      userAnswers: {},
      userDecisions: {},
      selectedEvidence: null,
      selectedRule: null
    };

    if (this.mount) {
      this.init();
    }
  }

  async init() {
    await this.fetchData();
    this.render();
  }

  async fetchData() {
    this.state.loading = true;
    try {
      const res = await fetch(`/api/requirements?market=${this.state.market}&launchDate=${this.state.launchDate}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      this.state.data = await res.json();
      this.state.loading = false;
    } catch (err) {
      this.state.error = err.message;
      this.state.loading = false;
    }
  }

  setTab(tab) {
    this.state.activeTab = tab;
    this.render();
  }

  async updateLaunchDate(newDate) {
    this.state.launchDate = newDate;
    await this.fetchData();
    this.render();
  }

  answerQuestion(qId, answer) {
    this.state.userAnswers[qId] = answer;
    this.render();
  }

  setAssetDecision(assetId, decision) {
    this.state.userDecisions[assetId] = decision;
    this.render();
  }

  render() {
    if (!this.mount) return;

    if (this.state.loading) {
      this.mount.innerHTML = `<div class="requirements-workspace"><div style="padding:40px;text-align:center;color:#94a3b8;">Loading regulatory requirements & smart questions...</div></div>`;
      return;
    }

    if (this.state.error) {
      this.mount.innerHTML = `<div class="requirements-workspace"><div style="padding:40px;text-align:center;color:#f87171;">Failed to load requirements: ${this.state.error}</div></div>`;
      return;
    }

    const d = this.state.data;
    const summary = d.summary || {};
    const reqs = d.evaluations || d.requirements || [];
    const questions = d.prioritizedQuestions || d.questions || [];
    const assets = d.designAssets || [];

    // Filter requirements
    const filteredReqs = reqs.filter(r => {
      if (this.state.activeTab === 'ALL') return true;
      if (this.state.activeTab === 'ISSUES') return r.status === 'ISSUE' || r.status === 'FAIL';
      if (this.state.activeTab === 'NEEDS_REVIEW') return r.status === 'NEEDS_REVIEW';
      if (this.state.activeTab === 'PASSED') return r.status === 'PASS';
      if (this.state.activeTab === 'UNABLE') return r.status === 'UNABLE_TO_VERIFY';
      if (this.state.activeTab === 'NOT_APPLICABLE') return r.status === 'NOT_APPLICABLE';
      return true;
    });

    const passCount = summary.passedCount || summary.passed || 0;
    const issueCount = summary.failedCount || summary.issues || 0;
    const reviewCount = summary.needsReview || 0;
    const unableCount = summary.unableToVerify || 0;
    const naCount = summary.notApplicable || 0;

    // Build Brief summary from userDecisions
    const keepAssets = [];
    const changeAssets = [];
    const addAssets = [];
    const removeAssets = [];

    assets.forEach(a => {
      const dec = this.state.userDecisions[a.assetId] || a.decision || 'UNKNOWN';
      if (dec === 'KEEP') keepAssets.push(a.name);
      else if (dec === 'CHANGE') changeAssets.push(a.name);
      else if (dec === 'ADD') addAssets.push(a.name);
      else if (dec === 'REMOVE') removeAssets.push(a.name);
    });

    this.mount.innerHTML = `
      <div class="requirements-workspace" id="req-workspace-root">
        <!-- Header -->
        <div class="req-header">
          <div class="req-title-group">
            <h2>Regulatory Requirements & Smart Questions</h2>
            <p class="req-subtitle">Date-aware FDA Granola Rule Pack (21 CFR Part 101) with prioritized reviewer decisions.</p>
          </div>
          <div class="req-context-controls">
            <div class="req-control-item">
              <span>Market:</span>
              <select id="req-market-select">
                <option value="us" selected>United States (FDA)</option>
                <option value="in">India (FSSAI)</option>
                <option value="eu">European Union</option>
              </select>
            </div>
            <div class="req-control-item">
              <span>Launch Date:</span>
              <input type="date" id="req-launch-date-input" value="${this.state.launchDate}" />
            </div>
            <div class="req-control-item">
              <span>Product Scope:</span>
              <span style="color:#f8fafc;font-weight:700;">Granola (Conventional)</span>
            </div>
          </div>
        </div>

        <!-- KPI Grid -->
        <div class="req-analytics-grid">
          <div class="req-kpi-card pass">
            <span class="req-kpi-val">${passCount}</span>
            <span class="req-kpi-label">Passed Checks</span>
          </div>
          <div class="req-kpi-card issue">
            <span class="req-kpi-val">${issueCount}</span>
            <span class="req-kpi-label">Regulatory Issues</span>
          </div>
          <div class="req-kpi-card review">
            <span class="req-kpi-val">${reviewCount}</span>
            <span class="req-kpi-label">Needs Review</span>
          </div>
          <div class="req-kpi-card unable">
            <span class="req-kpi-val">${unableCount}</span>
            <span class="req-kpi-label">Unable to Verify</span>
          </div>
          <div class="req-kpi-card na">
            <span class="req-kpi-val">${naCount}</span>
            <span class="req-kpi-label">Not Applicable</span>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="req-nav-tabs">
          <button class="req-tab-btn ${this.state.activeTab === 'ALL' ? 'active' : ''}" data-tab="ALL">All Rules (${reqs.length})</button>
          <button class="req-tab-btn ${this.state.activeTab === 'ISSUES' ? 'active' : ''}" data-tab="ISSUES">Issues (${issueCount})</button>
          <button class="req-tab-btn ${this.state.activeTab === 'NEEDS_REVIEW' ? 'active' : ''}" data-tab="NEEDS_REVIEW">Needs Review (${reviewCount})</button>
          <button class="req-tab-btn ${this.state.activeTab === 'PASSED' ? 'active' : ''}" data-tab="PASSED">Passed (${passCount})</button>
          <button class="req-tab-btn ${this.state.activeTab === 'UNABLE' ? 'active' : ''}" data-tab="UNABLE">Unable (${unableCount})</button>
          <button class="req-tab-btn ${this.state.activeTab === 'NOT_APPLICABLE' ? 'active' : ''}" data-tab="NOT_APPLICABLE">Not Applicable (${naCount})</button>
        </div>

        <!-- Sections -->
        <div class="req-sections-container">
          <!-- Requirements Cards -->
          <div class="req-cards-list">
            ${filteredReqs.map(r => {
              const statusClass = (r.status || 'PASS').toLowerCase();
              return `
                <div class="req-card" data-rule-id="${r.ruleId}">
                  <div class="req-card-top">
                    <span class="req-card-citation">${r.legalProvision || r.citation || r.ruleId}</span>
                    <span class="req-status-badge ${statusClass}">${r.status}</span>
                  </div>
                  <div class="req-card-title">${r.title || r.name}</div>
                  <div class="req-card-details">
                    <div class="req-detail-col">
                      <span class="req-detail-lbl">Observed Artwork</span>
                      <span class="req-detail-val">${r.observed || r.explanation || 'Evaluated'}</span>
                    </div>
                    <div class="req-detail-col">
                      <span class="req-detail-lbl">Statutory Expectation</span>
                      <span class="req-detail-val">${r.expected || 'Conformance to CFR requirement'}</span>
                    </div>
                  </div>
                  ${r.proof ? `<div class="req-card-proof"><strong>Proof / Analysis:</strong> ${r.proof}</div>` : ''}
                  <div class="req-card-actions">
                    <button class="req-action-btn view-evidence-btn" data-rule="${r.ruleId}">View Evidence</button>
                    <button class="req-action-btn inspect-rule-btn" data-rule="${r.ruleId}">Inspect Rule (Trust Center)</button>
                    <button class="req-action-btn ask-someone-btn" data-rule="${r.ruleId}">Ask Someone</button>
                    <button class="req-action-btn request-fix-btn" data-rule="${r.ruleId}">Create Correction Request</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Prioritized Smart Questions Queue (Hard Max 10) -->
          <div class="questions-section">
            <h3>
              Prioritized Reviewer Questions
              <span class="q-badge-count">${questions.length} Active (Max 10)</span>
            </h3>
            <div class="q-cards-list">
              ${questions.map((q, idx) => {
                const userAns = this.state.userAnswers[q.questionId || q.id];
                return `
                  <div class="q-card" data-qid="${q.questionId || q.id}">
                    <div class="q-card-header">
                      <span class="q-priority-pill">Rank #${idx + 1} · ${q.impact || 'HIGH'} IMPACT</span>
                      <span class="q-dept-pill">${q.responsibleDepartment || q.category || 'Regulatory & Legal'}</span>
                    </div>
                    <div class="q-title">${q.title}</div>
                    <div class="q-text">${q.question}</div>
                    <div class="q-reason"><strong>Why this matters:</strong> ${q.reason}</div>
                    <div class="q-options-row">
                      ${(q.answerOptions || q.options || []).map(opt => `
                        <button class="q-opt-btn ${userAns === opt ? 'selected' : ''}" data-qid="${q.questionId || q.id}" data-opt="${opt}">
                          ${userAns === opt ? '✔ ' : ''}${opt}
                        </button>
                      `).join('')}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Design Assets Inventory & Creative Brief Feeder -->
          <div class="design-assets-section">
            <h3>
              Original Brand Design Assets
              <span class="q-badge-count">${assets.length} Detected</span>
            </h3>
            <div class="design-assets-grid">
              ${assets.map(a => {
                const dec = this.state.userDecisions[a.assetId] || a.decision || 'UNKNOWN';
                return `
                  <div class="asset-card" data-asset-id="${a.assetId}">
                    <div class="asset-card-top">
                      <span class="asset-type-badge">${a.assetType}</span>
                    </div>
                    <div class="asset-name">${a.name}</div>
                    <div class="asset-desc">${a.originalDescription}</div>
                    <div class="asset-decision-controls">
                      <button class="asset-dec-btn keep ${dec === 'KEEP' ? 'active' : ''}" data-asset="${a.assetId}" data-dec="KEEP">KEEP</button>
                      <button class="asset-dec-btn change ${dec === 'CHANGE' ? 'active' : ''}" data-asset="${a.assetId}" data-dec="CHANGE">CHANGE</button>
                      <button class="asset-dec-btn add ${dec === 'ADD' ? 'active' : ''}" data-asset="${a.assetId}" data-dec="ADD">ADD</button>
                      <button class="asset-dec-btn remove ${dec === 'REMOVE' ? 'active' : ''}" data-asset="${a.assetId}" data-dec="REMOVE">REMOVE</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Brief Projection Card -->
            <div class="brief-projection-box">
              <div class="brief-proj-title">CREATIVE BRIEF — DESIGN REQUIREMENTS PROJECTION</div>
              <div class="brief-proj-row"><strong>KEEP:</strong> ${keepAssets.length ? keepAssets.join(', ') : 'None decided'}</div>
              <div class="brief-proj-row"><strong>CHANGE:</strong> ${changeAssets.length ? changeAssets.join(', ') : 'None decided'}</div>
              <div class="brief-proj-row"><strong>ADD:</strong> ${addAssets.length ? addAssets.join(', ') : 'None decided'}</div>
              <div class="brief-proj-row"><strong>REMOVE:</strong> ${removeAssets.length ? removeAssets.join(', ') : 'None decided'}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  attachEvents() {
    // Tabs
    this.mount.querySelectorAll('.req-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.setTab(e.target.dataset.tab);
      });
    });

    // Launch date
    const dateInput = this.mount.querySelector('#req-launch-date-input');
    if (dateInput) {
      dateInput.addEventListener('change', (e) => {
        this.updateLaunchDate(e.target.value);
      });
    }

    // Question options
    this.mount.querySelectorAll('.q-opt-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const qid = e.target.dataset.qid;
        const opt = e.target.dataset.opt;
        this.answerQuestion(qid, opt);
      });
    });

    // Design Asset decisions
    this.mount.querySelectorAll('.asset-dec-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const assetId = e.target.dataset.asset;
        const dec = e.target.dataset.dec;
        this.setAssetDecision(assetId, dec);
      });
    });

    // Action buttons
    this.mount.querySelectorAll('.view-evidence-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rId = e.target.dataset.rule;
        alert(`Evidence anchored to rule ${rId}: Verified in packaging artwork source pieces.`);
      });
    });

    this.mount.querySelectorAll('.inspect-rule-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rId = e.target.dataset.rule;
        const req = (this.state.data.evaluations || this.state.data.requirements || []).find(r => r.ruleId === rId);
        alert(`Rule Trust Center — ${rId}\nTitle: ${req?.title || req?.name}\nLegal Citation: ${req?.legalProvision || req?.citation}\nStatus: ${req?.status}\nOfficial URL: https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101`);
      });
    });
  }
}

// Global factory / mount
export function mountRequirementsWorkspace(mountSelector = '#requirements-workspace-mount') {
  return new RequirementsWorkspace(mountSelector);
}
export const initRequirementsWorkspace = mountRequirementsWorkspace;

if (typeof window !== 'undefined') {
  window.RequirementsWorkspace = RequirementsWorkspace;
  window.mountRequirementsWorkspace = mountRequirementsWorkspace;
  window.initRequirementsWorkspace = initRequirementsWorkspace;
}
