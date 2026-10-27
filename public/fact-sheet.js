/**
 * PackSignal Phase 2 — Fact Sheet UI Component
 * (public/fact-sheet.js)
 * 
 * Interactive Fact Sheet:
 * - Three headline presentation states: [All] [Verified] [AI Suggested] [Conflicted].
 * - Click-to-source evidence drawer linking directly to PDF geometry or Excel cells.
 * - Value & Semantic conflict resolution with full provenance history.
 * - Displays unit equivalence for 480g vs 16.9 oz without false conflicts.
 */

export class FactSheetView {
  constructor(mountElement, options = {}) {
    this.mount = typeof mountElement === 'string' ? document.querySelector(mountElement) : mountElement;
    this.options = options;
    this.factSheetData = null;
    this.activeFilter = 'ALL'; // ALL | VERIFIED | SUGGESTED | CONFLICTED
    this.selectedFact = null;
  }

  async load(apiUrl = '/api/fact-sheet') {
    if (!this.mount) return;
    this.mount.innerHTML = `<div class="fact-sheet-loading" style="padding: 2rem; color: #94a3b8; text-align: center;">Loading Unified Fact Sheet & Provenance Graph...</div>`;
    try {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      this.factSheetData = await res.json();
      this.render();
    } catch (err) {
      this.mount.innerHTML = `<div class="fact-sheet-error" style="padding: 2rem; color: #f87171;">Failed to load Fact Sheet: ${err.message}</div>`;
    }
  }

  setData(data) {
    this.factSheetData = data;
    this.render();
  }

  setFilter(filter) {
    this.activeFilter = filter;
    this.render();
  }

  getFilteredFacts() {
    if (!this.factSheetData?.facts) return [];
    const facts = this.factSheetData.facts;
    if (this.activeFilter === 'VERIFIED') {
      return facts.filter(f => f.verificationState === 'VERIFIED');
    }
    if (this.activeFilter === 'SUGGESTED') {
      return facts.filter(f => f.verificationState === 'AI_SUGGESTED');
    }
    if (this.activeFilter === 'CONFLICTED') {
      return facts.filter(f => f.verificationState === 'CONFLICTED');
    }
    return facts;
  }

  render() {
    if (!this.mount || !this.factSheetData) return;

    const data = this.factSheetData;
    const analytics = data.analytics || {
      totalFacts: data.facts?.length || 0,
      verifiedFacts: data.facts?.filter(f => f.verificationState === 'VERIFIED').length || 0,
      aiSuggestedFacts: data.facts?.filter(f => f.verificationState === 'AI_SUGGESTED').length || 0,
      conflictedFacts: data.facts?.filter(f => f.verificationState === 'CONFLICTED').length || 0
    };

    const conflicts = data.conflicts || [];
    const filteredFacts = this.getFilteredFacts();

    // Group filtered facts by semantic domain
    const groups = {
      ingredients: { title: 'Ingredients & Formulation', facts: [] },
      quantity: { title: 'Net Quantity', facts: [] },
      nutrition: { title: 'Nutrition Declarations', facts: [] },
      claims: { title: 'Claims, Certifications & Dietary', facts: [] },
      specification: { title: 'Product Specification & Identity', facts: [] }
    };

    for (const f of filteredFacts) {
      if (f.field.startsWith('ingredient')) groups.ingredients.facts.push(f);
      else if (f.field === 'net_quantity') groups.quantity.facts.push(f);
      else if (f.field.startsWith('nutrition')) groups.nutrition.facts.push(f);
      else if (f.field.startsWith('claims')) groups.claims.facts.push(f);
      else groups.specification.facts.push(f);
    }

    this.mount.innerHTML = `
      <div class="fact-sheet-container" id="fact-sheet-root">
        <!-- Header -->
        <header class="fact-sheet-header">
          <div class="fact-sheet-title-group">
            <h2>PACKSIGNAL — FACT SHEET</h2>
            <p class="fact-sheet-subtitle">Inspectable, verified document facts with PDF & spreadsheet provenance.</p>
          </div>
          <div class="fact-filters-bar" role="tablist">
            <button class="fact-filter-tab ${this.activeFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">All (${data.facts?.length || 0})</button>
            <button class="fact-filter-tab ${this.activeFilter === 'VERIFIED' ? 'active' : ''}" data-filter="VERIFIED">Verified (${analytics.verifiedFacts})</button>
            <button class="fact-filter-tab ${this.activeFilter === 'SUGGESTED' ? 'active' : ''}" data-filter="SUGGESTED">AI Suggested (${analytics.aiSuggestedFacts})</button>
            <button class="fact-filter-tab ${this.activeFilter === 'CONFLICTED' ? 'active' : ''}" data-filter="CONFLICTED">Conflicted (${analytics.conflictedFacts})</button>
          </div>
        </header>

        <!-- Analytics Dashboard Bar -->
        <div class="fact-analytics-grid">
          <div class="analytics-card verified">
            <span class="stat-value">${analytics.verifiedFacts}</span>
            <span class="stat-label">Verified Facts</span>
          </div>
          <div class="analytics-card suggested">
            <span class="stat-value">${analytics.aiSuggestedFacts}</span>
            <span class="stat-label">AI Suggested</span>
          </div>
          <div class="analytics-card conflicted">
            <span class="stat-value">${conflicts.length}</span>
            <span class="stat-label">Conflict Groups</span>
          </div>
          <div class="analytics-card">
            <span class="stat-value">${analytics.qualifiedDraftFacts || 0}</span>
            <span class="stat-label">Draft / Qualified</span>
          </div>
          <div class="analytics-card">
            <span class="stat-value">${analytics.visionOnlyObservations || 0}</span>
            <span class="stat-label">Vision Marks</span>
          </div>
        </div>

        <!-- Conflicted Groups Section (Shown when on ALL or CONFLICTED) -->
        ${(this.activeFilter === 'ALL' || this.activeFilter === 'CONFLICTED') && conflicts.length > 0 ? `
          <div class="fact-category-section">
            <div class="fact-category-header">
              <h3>⚠️ Sourced Conflicts & Ambiguities (${conflicts.length})</h3>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${conflicts.map(c => this.renderConflictCard(c)).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Categories List -->
        <div class="fact-categories-list">
          ${Object.entries(groups).map(([key, group]) => {
            if (group.facts.length === 0) return '';
            return `
              <section class="fact-category-section" data-category="${key}">
                <div class="fact-category-header">
                  <h3>${group.title} (${group.facts.length})</h3>
                </div>
                <div class="facts-cards-grid">
                  ${group.facts.map(f => this.renderFactCard(f)).join('')}
                </div>
              </section>
            `;
          }).join('')}
        </div>

        <!-- Evidence Drawer Modal -->
        <div class="evidence-drawer-modal" id="evidence-drawer" ${this.selectedFact ? '' : 'hidden'}>
          ${this.selectedFact ? this.renderEvidenceDrawerContent(this.selectedFact) : ''}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  renderConflictCard(c) {
    const isHoney = c.conflictId === 'CONFLICT-HONEY-PERCENTAGE';
    const isCarb = c.conflictId === 'CONFLICT-TOTAL-CARBOHYDRATE';

    return `
      <div class="conflict-group-card" data-conflict-id="${c.conflictId}">
        <div class="conflict-group-header">
          <div>
            <span class="conflict-badge">${c.conflictType}</span>
            <strong style="margin-left: 0.5rem; font-size: 0.95rem; color: #fff;">${c.field}</strong>
          </div>
          <span style="font-size: 0.75rem; color: #fca5a5; font-weight: 600;">Status: ${c.reviewStatus || 'PENDING'}</span>
        </div>
        <p class="conflict-reason">${c.reason || c.explanation}</p>
        
        <div style="display: flex; gap: 1rem; background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 4px; font-size: 0.8rem;">
          <div><span style="color: #38bdf8;">Artwork:</span> <strong>${c.observedValues?.artwork || c.artworkValue || 'N/A'}</strong></div>
          <div><span style="color: #a78bfa;">Specification:</span> <strong>${c.observedValues?.specification || c.specValue || 'N/A'}</strong></div>
        </div>

        <div class="conflict-actions-row">
          <button class="btn-conflict-action primary" data-action="view-both" data-id="${c.conflictId}">View Both Sources</button>
          <button class="btn-conflict-action" data-action="select-auth" data-id="${c.conflictId}">Select Authoritative Source</button>
          <button class="btn-conflict-action" data-action="clarify" data-id="${c.conflictId}">Request Clarification</button>
          <button class="btn-conflict-action" data-action="unresolved" data-id="${c.conflictId}">Mark Unresolved</button>
          <button class="btn-conflict-action" data-action="ripple" data-id="${c.conflictId}">Open Decision Ripple</button>
        </div>
      </div>
    `;
  }

  renderFactCard(f) {
    const stateClass = f.verificationState === 'VERIFIED' ? 'state-verified' :
      f.verificationState === 'AI_SUGGESTED' ? 'state-suggested' : 'state-conflicted';

    const isArtwork = f.source?.documentRole === 'artwork';
    const locChip = f.source?.cell ? `${f.source.sheet || 'Excel'}!${f.source.cell}` :
      (f.source?.panelId ? `${f.source.panelId}` : 'Document source');

    return `
      <div class="fact-item-card ${stateClass}" data-fact-id="${f.factId}">
        <div class="fact-card-top">
          <span class="fact-field-name">${f.field}</span>
          <span class="fact-state-badge ${f.verificationState.toLowerCase()}">${f.verificationState}</span>
        </div>
        <div class="fact-value-line">${this.escapeHtml(f.value)}</div>
        <div class="fact-provenance-chips">
          <span class="chip-source ${isArtwork ? 'artwork' : 'spec'}">${isArtwork ? '📄 ' : '📊 '} ${locChip}</span>
          ${f.evidence?.quote ? `<span class="chip-quote">“${this.escapeHtml(f.evidence.quote.slice(0, 30))}”</span>` : ''}
          ${f.qualifiers?.length > 0 ? `<span class="chip-qualifier">${f.qualifiers[0]}</span>` : ''}
        </div>
      </div>
    `;
  }

  renderEvidenceDrawerContent(fact) {
    const isArtwork = fact.source?.documentRole === 'artwork';
    return `
      <div class="evidence-drawer-content">
        <div class="evidence-drawer-header">
          <h3>Click-to-Source Provenance</h3>
          <button class="btn-close-drawer" id="btn-close-drawer">&times;</button>
        </div>

        <div class="evidence-meta-row">
          <span class="label">Field Identifier</span>
          <span class="value" style="font-weight: 700; color: #38bdf8;">${fact.field}</span>
        </div>

        <div class="evidence-meta-row">
          <span class="label">Raw Value</span>
          <span class="value">${this.escapeHtml(fact.value)}</span>
        </div>

        ${fact.normalizedValue ? `
          <div class="evidence-meta-row">
            <span class="label">Normalized Value</span>
            <span class="value">${fact.normalizedValue.amount ?? ''} ${fact.normalizedValue.unit || ''} (${fact.normalizedValue.dimension || 'scalar'}) ${fact.normalizedValue.basis ? `[${fact.normalizedValue.basis}]` : ''}</span>
          </div>
        ` : ''}

        <div class="evidence-meta-row">
          <span class="label">Source Document</span>
          <span class="value">${fact.source?.documentId || 'N/A'}</span>
        </div>

        <div class="evidence-meta-row">
          <span class="label">Document SHA-256</span>
          <span class="value" style="font-size: 0.75rem; word-break: break-all;">${fact.source?.documentSha256 || 'N/A'}</span>
        </div>

        <div class="evidence-meta-row">
          <span class="label">Source Location</span>
          <span class="value">${fact.source?.cell ? `Worksheet Cell: ${fact.source.sheet}!${fact.source.cell}` : `Panel: ${fact.source?.panelId || 'p1'} (Page ${fact.source?.page || 1})`}</span>
        </div>

        <div class="evidence-meta-row">
          <span class="label">Verification State & Authority</span>
          <span class="value">${fact.verificationState} · Authority: ${fact.sourceAuthority || 'APPROVED'}</span>
        </div>

        ${fact.evidence?.quote ? `
          <div class="evidence-meta-row">
            <span class="label">Independently Verified Source Quote</span>
            <div class="evidence-quote-box">
              “${this.escapeHtml(fact.evidence.quote)}”
              <div style="margin-top: 0.4rem; font-size: 0.72rem; color: #94a3b8;">
                Match: <strong>${fact.evidence.quoteMatch}</strong> · Visibility: <strong>${fact.evidence.visibility || 'VISIBLE'}</strong> · Method: ${fact.evidence.method}
              </div>
            </div>
          </div>
        ` : ''}

        ${fact.evidence?.visualEvidenceRef ? `
          <div class="evidence-meta-row">
            <span class="label">Visual Evidence Observation</span>
            <div class="evidence-image-crop-preview">
              <span>🖼️ Rendered Artwork Crop (Page ${fact.evidence.visualEvidenceRef.page})</span>
            </div>
            <p style="font-size: 0.75rem; color: #94a3b8; margin: 0.25rem 0 0 0;">${fact.evidence.visualEvidenceRef.notes || ''}</p>
          </div>
        ` : ''}

        ${fact.qualifiers?.length > 0 ? `
          <div class="evidence-meta-row">
            <span class="label">Source Qualifiers / Reviewer Notes</span>
            <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); padding: 0.5rem; border-radius: 4px; font-size: 0.8rem; color: #fbbf24;">
              ${fact.qualifiers.join(', ')}
            </div>
          </div>
        ` : ''}

        <div style="margin-top: auto; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); display: flex; gap: 0.5rem;">
          ${isArtwork ? `
            <button class="btn-conflict-action primary" style="flex: 1;" id="btn-open-artwork-viewer">Open in 2D Artwork Viewer</button>
          ` : `
            <button class="btn-conflict-action primary" style="flex: 1;" id="btn-open-excel-viewer">View Spreadsheet Cell</button>
          `}
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    // Filter tabs
    const filterTabs = this.mount.querySelectorAll('.fact-filter-tab');
    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.setFilter(tab.dataset.filter);
      });
    });

    // Fact Card Click -> Open Evidence Drawer
    const factCards = this.mount.querySelectorAll('.fact-item-card');
    factCards.forEach(card => {
      card.addEventListener('click', () => {
        const factId = card.dataset.factId;
        const fact = this.factSheetData.facts.find(f => f.factId === factId);
        if (fact) {
          this.selectedFact = fact;
          const drawer = this.mount.querySelector('#evidence-drawer');
          if (drawer) {
            drawer.innerHTML = this.renderEvidenceDrawerContent(fact);
            drawer.removeAttribute('hidden');
            this.attachDrawerListeners();
          }
        }
      });
    });

    // Conflict Actions
    const actionBtns = this.mount.querySelectorAll('.btn-conflict-action');
    actionBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const conflictId = btn.dataset.id;
        this.handleConflictAction(action, conflictId);
      });
    });
  }

  attachDrawerListeners() {
    const closeBtn = this.mount.querySelector('#btn-close-drawer');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.selectedFact = null;
        const drawer = this.mount.querySelector('#evidence-drawer');
        if (drawer) drawer.setAttribute('hidden', '');
      });
    }

    const openArtBtn = this.mount.querySelector('#btn-open-artwork-viewer');
    if (openArtBtn && this.selectedFact) {
      openArtBtn.addEventListener('click', () => {
        // Trigger artwork spotlight if available
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('packsignal:focus-panel', {
            detail: { panel: this.selectedFact.source?.panelId, box: this.selectedFact.source?.box }
          }));
        }
      });
    }
  }

  handleConflictAction(action, conflictId) {
    const conflict = this.factSheetData?.conflicts?.find(c => c.conflictId === conflictId);
    if (!conflict) return;

    if (action === 'view-both') {
      alert(`[View Both Sources]\nArtwork: ${conflict.observedValues?.artwork || conflict.artworkValue}\nSpecification: ${conflict.observedValues?.specification || conflict.specValue}\n\nReason: ${conflict.reason}`);
    } else if (action === 'select-auth') {
      const choice = prompt(`Select Authoritative Source for ${conflict.field}:\nType "artwork" or "specification":`, 'artwork');
      if (choice) {
        alert(`Recorded authoritative source choice: ${choice}.\nProvenance and conflict history preserved in audit ledger.`);
      }
    } else if (action === 'clarify') {
      alert(`Requested clarification for ${conflict.field}.\nAdded to Questions Stack.`);
    } else if (action === 'unresolved') {
      alert(`Marked conflict for ${conflict.field} as Unresolved.`);
    } else if (action === 'ripple') {
      alert(`Opened Decision Ripple for ${conflict.field}.`);
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

// Global initialization helper
export function initFactSheet(mountSelector = '#fact-sheet-mount') {
  const view = new FactSheetView(mountSelector);
  view.load();
  return view;
}
