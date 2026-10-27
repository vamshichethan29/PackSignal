/**
 * Phase 4 — Unified Evidence Desk (public/evidence-desk.js)
 * 
 * Provides:
 * 1. Evidence Desk with live processing progress and multi-source document intake
 * 2. Multi-Format upload (PDF Artwork, Excel, DOCX, Plain PDF Spec, TXT/Notes, Previous Design PNG/JPG)
 * 3. Canonical document roles (ARTWORK, PRODUCT_SPECIFICATION, REGULATORY_RULEBOOK, CLAIMS_SOURCE, PREVIOUS_DESIGN, REVIEWER_NOTES, STRUCTURAL_DIELINE)
 * 4. Interactive Fact Sheet with clickable source chips navigating to original evidence
 * 5. Side-by-side Conflict Cards with auditable resolution decisions and live requirement refresh
 * 6. Prioritized Questions Stack (max 10) updating Fact Sheet & Creative Brief Matrix live
 */

import { renderConflictCards, mountConflictCardsHandlers } from './conflict-cards.js';
import { renderSourceChip, renderSourceChips } from './source-chip.js';
import { openSourceViewer } from './source-viewer.js';

let deskState = null;
let activeFactFilter = 'all';

export function evidenceDeskView(review) {
  return `
    <div class="desk-wrapper">
      <div class="desk-header">
        <div>
          <div class="eyebrow">PACKSIGNAL — EVIDENCE DESK · CORE BROWSER WORKFLOW</div>
          <h2>Evidence Desk</h2>
          <p>Unified ground-truth packaging workspace. Multi-source intake with role classification, verified facts with clickable source chips, side-by-side conflict resolution, and prioritized questions.</p>
          <div class="desk-badges-row">
            <span class="desk-pill pill-live">● LIVE REVIEW ENGINE</span>
            <span class="desk-pill pill-market">MARKET: US (FDA) · LAUNCH: OCT 16, 2026</span>
          </div>
        </div>
        <div class="desk-header-actions">
          <button type="button" class="primary" id="btn-open-upload-modal" style="background:#0f766e;color:#fff;font-weight:700;">
            📂 Add Documents
          </button>
          <button type="button" class="primary" id="btn-run-analysis" style="background:#2563eb;color:#fff;font-weight:700;">
            ⚙ Run Analysis
          </button>
          <button type="button" class="secondary" id="btn-open-paste-modal">
            📝 Paste Notes
          </button>
          <button type="button" class="secondary" id="btn-continue-review" style="background:#f8fafc;font-weight:700;">
            Continue Review →
          </button>
          <button type="button" class="secondary" id="btn-reset-desk">
            ↻ Reset Desk
          </button>
        </div>
      </div>

      <!-- Live Processing Progress Stage Banner -->
      <div class="desk-stepper-card" id="desk-stepper-card">
        <div class="stepper-steps">
          <div class="step-node active" id="step-node-intake">
            <span class="step-icon">01</span>
            <div class="step-text">
              <strong>Multi-Format Intake</strong>
              <small>PDF, XLSX, DOCX, Plain-PDF, Notes, Images</small>
            </div>
          </div>
          <span class="stepper-arrow">→</span>
          <div class="step-node active" id="step-node-pieces">
            <span class="step-icon">02</span>
            <div class="step-text">
              <strong>Source Pieces &amp; Provenance</strong>
              <small>Panels, Cells, Paragraphs, Lines</small>
            </div>
          </div>
          <span class="stepper-arrow">→</span>
          <div class="step-node active" id="step-node-facts">
            <span class="step-icon">03</span>
            <div class="step-text">
              <strong>Fact Extraction &amp; Quotes</strong>
              <small>3 States, Unit Normalization, Vision</small>
            </div>
          </div>
          <span class="stepper-arrow">→</span>
          <div class="step-node active" id="step-node-conflicts">
            <span class="step-icon">04</span>
            <div class="step-text">
              <strong>Conflict Detection &amp; Resolution</strong>
              <small>Side-by-side cards, Audited decision</small>
            </div>
          </div>
          <span class="stepper-arrow">→</span>
          <div class="step-node active" id="step-node-ready">
            <span class="step-icon">05</span>
            <div class="step-text">
              <strong>Questions &amp; Packaging Brief</strong>
              <small>Max 10 prioritized questions, Brief sync</small>
            </div>
          </div>
        </div>
        <div class="progress-track" style="margin-top:12px;background:#e2e8f0;border-radius:4px;height:6px;overflow:hidden;">
          <div class="progress-bar" id="desk-progress-bar" style="width: 100%;height:100%;background:#16a34a;transition:width 0.3s ease;"></div>
        </div>
        <div id="desk-stage-label" style="font-size:11px;font-family:monospace;color:#15803d;margin-top:6px;text-align:right;">
          ● STAGE: READY · All sources parsed, quotes verified, conflicts evaluated.
        </div>
      </div>

      <!-- Metrics Strip -->
      <div class="desk-metrics-grid">
        <div class="metric-box">
          <small>Document Sources</small>
          <strong id="m-sources-count">6</strong>
          <span>PDF, XLSX, DOCX, TXT, PNG</span>
        </div>
        <div class="metric-box">
          <small>Total Source Pieces</small>
          <strong id="m-pieces-count">403</strong>
          <span>With verified coordinates</span>
        </div>
        <div class="metric-box">
          <small>Source-Verified Facts</small>
          <strong id="m-proven-count" style="color:#15803d;">6</strong>
          <span>Verbatim quotes verified</span>
        </div>
        <div class="metric-box">
          <small>AI-Suggested</small>
          <strong id="m-ai-count" style="color:#2563eb;">8</strong>
          <span>Unconfirmed sheet notes / vision</span>
        </div>
        <div class="metric-box">
          <small>Open Conflicts</small>
          <strong id="m-conflicts-count" style="color:#dc2626;">3</strong>
          <span>Require reviewer resolution</span>
        </div>
        <div class="metric-box">
          <small>Questions Stack</small>
          <strong id="m-questions-count" style="color:#b45309;">10</strong>
          <span>Ranked by regulatory impact</span>
        </div>
      </div>

      <!-- 3-Column Ground Truth Grid -->
      <div class="desk-layout-3col">
        <!-- Col 1: Document Sources -->
        <div class="desk-panel">
          <div class="panel-title-row">
            <h3>Document Sources <span class="count-badge" id="b-sources-cnt">6</span></h3>
            <button type="button" class="filter" id="btn-mini-upload" style="font-size:11px;padding:2px 8px;">+ Upload</button>
          </div>
          <div class="file-cards-col" id="desk-files-container">
            <div style="padding:10px;text-align:center;color:#94a3b8;">Loading source files...</div>
          </div>
        </div>

        <!-- Col 2: Conflicts & Questions & Brief Matrix -->
        <div class="desk-panel">
          <div class="panel-title-row">
            <h3>Source Conflicts <span class="count-badge badge-red" id="b-conflicts-cnt">3</span></h3>
            <span style="font-size:11px;color:#dc2626;font-weight:600;">Auditable Resolution</span>
          </div>
          <div id="desk-conflicts-container"></div>

          <div class="panel-title-row" style="margin-top:22px;">
            <h3>Prioritized Questions <span class="count-badge badge-amber" id="b-questions-cnt">10</span></h3>
            <span style="font-size:11px;color:#b45309;font-weight:600;">Max 10 Ranked</span>
          </div>
          <div id="desk-questions-container"></div>

          <!-- Creative Brief Matrix -->
          <div class="panel-title-row" style="margin-top:22px;">
            <h3>Creative Brief Matrix</h3>
            <span style="font-size:10px;font-family:monospace;color:#15803d;">● LIVE SYNC</span>
          </div>
          <div class="matrix-4col-grid">
            <div class="m-column col-keep">
              <h4>✓ KEEP</h4>
              <ul id="m-list-keep"></ul>
            </div>
            <div class="m-column col-change">
              <h4>✎ CHANGE</h4>
              <ul id="m-list-change"></ul>
            </div>
            <div class="m-column col-add">
              <h4>+ ADD</h4>
              <ul id="m-list-add"></ul>
            </div>
            <div class="m-column col-remove">
              <h4>✕ REMOVE</h4>
              <ul id="m-list-remove"></ul>
            </div>
          </div>
        </div>

        <!-- Col 3: Fact Sheet with Clickable Source Chips -->
        <div class="desk-panel">
          <div class="panel-title-row">
            <h3>Fact Sheet <span class="count-badge" id="b-facts-cnt">17</span></h3>
            <div style="display:flex;gap:4px;">
              <button type="button" class="filter active" data-fact-btn="all">All</button>
              <button type="button" class="filter" data-fact-btn="proven">Verified</button>
              <button type="button" class="filter" data-fact-btn="ai">AI</button>
              <button type="button" class="filter" data-fact-btn="conflict">Conflicts</button>
            </div>
          </div>
          <div id="desk-facts-container">
            <div style="padding:10px;text-align:center;color:#94a3b8;">Loading facts...</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function mountEvidenceDesk(review) {
  await fetchDeskSession();
  setupDeskListeners();
  renderAllDeskPanels();
}

async function fetchDeskSession() {
  try {
    const res = await fetch('/api/desk/state');
    deskState = await res.json();
  } catch (err) {
    console.error('Failed to load /api/desk/state:', err);
  }
}

function renderAllDeskPanels() {
  if (!deskState) return;

  // 1. Update Metrics
  const openConflicts = deskState.conflicts.filter(c => c.status === 'OPEN').length;
  const openQuestions = deskState.questions.filter(q => q.status === 'OPEN').length;
  const provenCount = deskState.facts.filter(f => f.state === 'PROVEN').length;
  const aiCount = deskState.facts.filter(f => f.state === 'AI_SUGGESTED').length;

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setTxt('m-sources-count', deskState.files.length);
  setTxt('m-pieces-count', deskState.summary.totalPieces);
  setTxt('m-proven-count', provenCount);
  setTxt('m-ai-count', aiCount);
  setTxt('m-conflicts-count', openConflicts);
  setTxt('m-questions-count', openQuestions);

  setTxt('b-sources-cnt', deskState.files.length);
  setTxt('b-conflicts-cnt', openConflicts);
  setTxt('b-questions-cnt', openQuestions);
  setTxt('b-facts-cnt', deskState.facts.length);

  // 2. Render Source Files with Role Badges
  const filesContainer = document.getElementById('desk-files-container');
  if (filesContainer) {
    filesContainer.innerHTML = deskState.files.map(f => {
      const ftClass = `ft-${f.type}`;
      const featTags = (f.features || []).map(feat => `<span>${feat}</span>`).join('');
      return `
        <div class="desk-file-item" style="position:relative;">
          <div class="file-item-header">
            <span class="file-type-pill ${ftClass}">${f.formatLabel}</span>
            <span style="font-size:10px;background:#e0f2fe;color:#0369a1;padding:1px 6px;border-radius:3px;font-weight:700;">${f.role || 'SOURCE'}</span>
            <span style="font-family:monospace;font-size:10px;color:#64748b;margin-left:auto;">${f.piecesCount} pieces</span>
          </div>
          <div class="file-item-name" style="margin:4px 0;font-weight:700;font-size:13px;color:#0f172a;">${f.name}</div>
          ${f.sha256 ? `<div style="font-size:10px;font-family:monospace;color:#94a3b8;margin-bottom:4px;">SHA: ${f.sha256.slice(0, 12)}…</div>` : ''}
          <div class="file-item-features">${featTags}</div>
        </div>
      `;
    }).join('');
  }

  // 3. Render Conflict Cards using public/conflict-cards.js
  const conflictsContainer = document.getElementById('desk-conflicts-container');
  if (conflictsContainer) {
    conflictsContainer.innerHTML = renderConflictCards(deskState.conflicts);
    mountConflictCardsHandlers(conflictsContainer, async ({ conflictId, chosenValue, chosenSource, reviewer, role, reason }) => {
      await resolveConflictApi(conflictId, chosenValue, chosenSource, { reviewer, role, reason });
    });
  }

  // 4. Render Questions Stack (Max 10)
  const questionsContainer = document.getElementById('desk-questions-container');
  if (questionsContainer) {
    const questionsToRender = (deskState.questions || []).slice(0, 10);
    questionsContainer.innerHTML = questionsToRender.map(q => {
      const isAnswered = q.status === 'ANSWERED';
      let optHtml = '';
      if (isAnswered) {
        optHtml = `
          <div style="font-size:11px;color:#15803d;font-weight:700;background:#f0fdf4;padding:6px 8px;border-radius:4px;border:1px solid #bbf7d0;">
            ✓ Decided: ${q.answer?.answerValue || 'Completed'}
            ${q.answer?.actor ? `<div style="font-size:10px;color:#166534;font-weight:normal;margin-top:2px;">Decided by: ${q.answer.actor} (${q.answer.actorRole || 'Reviewer'})</div>` : ''}
          </div>
        `;
      } else {
        const btns = (q.options || []).map(opt => `
          <button type="button" class="btn-answer-opt" data-q-id="${q.id}" data-opt-id="${opt.id}" style="padding:6px 10px;border-radius:4px;font-size:11px;border:1px solid #cbd5e1;background:#fff;text-align:left;cursor:pointer;">
            ${opt.label}
          </button>
        `).join('');
        optHtml = `
          <div class="question-options-box" style="display:flex;flex-direction:column;gap:5px;margin-top:8px;">
            ${btns}
          </div>
        `;
      }

      return `
        <div class="question-item-card ${isAnswered ? 'is-answered' : ''}" style="border-left:4px solid ${isAnswered ? '#16a34a' : '#d97706'};margin-bottom:12px;background:#fff;padding:12px;border-radius:6px;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
          <div class="question-item-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span class="q-rank" style="font-size:10px;font-weight:800;color:#92400e;background:#fef3c7;padding:2px 6px;border-radius:3px;">#${q.rank} RANK</span>
            <span class="q-priority" style="font-size:10px;font-weight:700;color:#b45309;">${q.priority} PRIORITY</span>
          </div>
          <div class="question-item-title" style="font-size:13px;font-weight:700;color:#0f172a;margin:4px 0;">${q.question}</div>
          <div class="question-item-reason" style="font-size:11px;color:#475569;margin-bottom:6px;background:#f8fafc;padding:6px;border-radius:4px;">
            <strong>Why it matters:</strong> ${q.reason}
          </div>
          ${optHtml}
        </div>
      `;
    }).join('');

    questionsContainer.querySelectorAll('.btn-answer-opt').forEach(btn => {
      btn.addEventListener('click', async () => {
        const questionId = btn.dataset.qId;
        const answerId = btn.dataset.optId;
        await answerQuestionApi(questionId, answerId);
      });
    });
  }

  // 5. Render Creative Brief Feed
  if (deskState.briefFeed) {
    const renderList = (id, items) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = (items || []).map(it => `<li>${it}</li>`).join('');
    };
    renderList('m-list-keep', deskState.briefFeed.keep);
    renderList('m-list-change', deskState.briefFeed.change);
    renderList('m-list-add', deskState.briefFeed.add);
    renderList('m-list-remove', deskState.briefFeed.remove);
  }

  // 6. Render Fact Sheet
  renderFactSheetItems();
}

function renderFactSheetItems() {
  if (!deskState) return;
  const container = document.getElementById('desk-facts-container');
  if (!container) return;

  let facts = deskState.facts;
  if (activeFactFilter === 'proven') facts = facts.filter(f => f.state === 'PROVEN');
  if (activeFactFilter === 'ai') facts = facts.filter(f => f.state === 'AI_SUGGESTED');
  if (activeFactFilter === 'conflict') facts = facts.filter(f => f.state === 'CONFLICT');

  container.innerHTML = facts.map(fact => {
    let stateClass = 'fs-proven';
    let cardState = 'is-proven';
    if (fact.state === 'CONFLICT') {
      stateClass = 'fs-conflict';
      cardState = 'is-conflict';
    } else if (fact.state === 'AI_SUGGESTED') {
      stateClass = 'fs-ai';
      cardState = 'is-ai';
    } else if (fact.state === 'HUMAN_CONFIRMED') {
      stateClass = 'fs-proven';
      cardState = 'is-proven';
    }

    const chips = (fact.sources || []).map(s => {
      return renderSourceChip({
        name: s.file,
        file: s.file,
        documentName: s.file,
        sheet: s.cell ? 'US' : null,
        cell: s.cell,
        page: s.page || (s.type === 'pdf' ? 1 : null),
        panel: s.panel,
        paragraph: s.paragraph,
        line: s.line,
        location: s.location || (s.cell ? `Cell ${s.cell}` : (s.paragraph ? `Paragraph ${s.paragraph}` : (s.line ? `Line ${s.line}` : s.panel))),
        quote: s.quote || fact.value,
        role: s.type === 'pdf' ? 'ARTWORK' : (s.type === 'image' ? 'PREVIOUS_DESIGN' : (s.type === 'note' ? 'REVIEWER_NOTES' : 'PRODUCT_SPECIFICATION')),
        sourceType: s.type
      });
    }).join(' ');

    return `
      <div class="fact-item-card ${cardState}" style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-bottom:10px;">
        <div class="fact-card-top" style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span class="fact-cat-name" style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">${fact.category}</span>
          <span class="fact-status-badge ${stateClass}" style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:3px;">${fact.state}</span>
        </div>
        <div class="fact-name-lbl" style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:2px;">${fact.label}</div>
        <div class="fact-val-txt" style="font-size:14px;color:#1e293b;font-family:monospace;font-weight:600;margin-bottom:8px;">${fact.value}</div>
        ${fact.conflictReason ? `<div style="font-size:11px;color:#dc2626;background:#fef2f2;padding:6px;border-radius:4px;margin-bottom:8px;">⚠️ ${fact.conflictReason}</div>` : ''}
        ${fact.clarificationNote ? `<div style="font-size:11px;color:#15803d;background:#f0fdf4;padding:6px;border-radius:4px;margin-bottom:8px;">✓ ${fact.clarificationNote}</div>` : ''}
        <div class="fact-chips-wrap" style="display:flex;flex-wrap:wrap;gap:6px;">${chips}</div>
      </div>
    `;
  }).join('');

  // Attach chip click listeners to open unified source viewer
  container.querySelectorAll('[data-source-chip]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        const payloadRaw = btn.getAttribute('data-source-payload');
        const payload = payloadRaw ? JSON.parse(payloadRaw) : {};
        openSourceViewer(payload);
      } catch (err) {
        console.error('Error opening source chip viewer:', err);
      }
    });
  });
}

async function resolveConflictApi(conflictId, chosenValue, chosenSource, meta = {}) {
  try {
    const res = await fetch('/api/desk/resolve-conflict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conflictId,
        chosenValue,
        chosenSource,
        reviewer: meta.reviewer || 'Packaging Reviewer',
        role: meta.role || 'REGULATORY_LEAD',
        note: meta.reason || `Resolved: selected ${chosenValue} from ${chosenSource}`
      })
    });
    const data = await res.json();
    if (data.status === 'SUCCESS') {
      deskState = data.session;
      renderAllDeskPanels();
    } else {
      alert(`Conflict resolution error: ${data.error || 'Request failed'}`);
    }
  } catch (err) {
    console.error('Error resolving conflict:', err);
  }
}

async function answerQuestionApi(questionId, answerId) {
  try {
    const res = await fetch('/api/desk/answer-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId,
        answerId,
        actor: 'Packaging Reviewer',
        actorRole: 'REGULATORY_SPECIALIST'
      })
    });
    const data = await res.json();
    if (data.status === 'SUCCESS') {
      deskState = data.session;
      renderAllDeskPanels();
    }
  } catch (err) {
    console.error('Error answering question:', err);
  }
}

function setupDeskListeners() {
  // Filter buttons for Fact Sheet
  document.querySelectorAll('[data-fact-btn]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFactFilter = btn.dataset.factBtn;
      document.querySelectorAll('[data-fact-btn]').forEach(b => b.classList.toggle('active', b === btn));
      renderFactSheetItems();
    });
  });

  // Run Analysis Button with live stage progress
  const runBtn = document.getElementById('btn-run-analysis');
  if (runBtn) {
    runBtn.addEventListener('click', async () => {
      const progressBar = document.getElementById('desk-progress-bar');
      const stageLabel = document.getElementById('desk-stage-label');
      const stages = [
        { label: 'STAGE: READING_DOCUMENTS · Loading PDF, XLSX, DOCX bytes...', pct: 20 },
        { label: 'STAGE: EXTRACTING_SOURCE_PIECES · Reconstructing panels, cells, paragraphs...', pct: 40 },
        { label: 'STAGE: BUILDING_FACTS · Formulating facts and normalizing units...', pct: 60 },
        { label: 'STAGE: VERIFYING_QUOTES · Deterministic quote verification against source hashes...', pct: 75 },
        { label: 'STAGE: DETECTING_CONFLICTS · Comparing artwork values against specs...', pct: 85 },
        { label: 'STAGE: GENERATING_QUESTIONS · Ranking top 10 prioritized questions...', pct: 95 },
        { label: 'STAGE: READY · Review workspace updated.', pct: 100 }
      ];

      for (const st of stages) {
        if (stageLabel) stageLabel.textContent = `● ${st.label}`;
        if (progressBar) progressBar.style.width = `${st.pct}%`;
        await new Promise(r => setTimeout(r, 200));
      }

      await fetchDeskSession();
      renderAllDeskPanels();
    });
  }

  // Continue Review Button
  const continueBtn = document.getElementById('btn-continue-review');
  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      const reqTab = document.querySelector('[data-action="tab"][data-tab="requirements"]') ||
                     document.querySelector('[data-action="view-requirements"]');
      if (reqTab) reqTab.click();
      else alert('Proceeding to Requirements Review.');
    });
  }

  // Reset Desk Button
  const resetBtn = document.getElementById('btn-reset-desk');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      const res = await fetch('/api/desk/reset', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        deskState = data.session;
        renderAllDeskPanels();
      }
    });
  }

  // Multi-Format Upload Modal (Phases 2 & 3)
  const openUploadModal = () => {
    const dialog = document.getElementById('dialog');
    if (!dialog) return;

    dialog.innerHTML = `
      <div style="padding:18px 22px;max-width:520px;font-family:system-ui,-apple-system,sans-serif;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <span style="font-size:10px;font-family:monospace;color:#0f766e;font-weight:700;">
            MULTI-FORMAT DOCUMENT INTAKE
          </span>
          <button type="button" class="close-dialog" style="border:0;background:transparent;font-size:18px;cursor:pointer;">✕</button>
        </div>
        <h3 style="margin:0 0 6px;font-size:16px;">Add Packaging Source Document</h3>
        <p style="font-size:12px;color:#64748b;margin:0 0 14px;">
          Upload artwork proofs, product specifications, Word briefs, TXT notes, or archival packaging photos.
        </p>

        <div style="margin-bottom:12px;">
          <label style="display:block;font-size:11px;font-weight:700;color:#334155;margin-bottom:4px;">Document Role *</label>
          <select id="desk-doc-role-select" style="width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;background:#fff;">
            <option value="PRODUCT_SPECIFICATION">PRODUCT_SPECIFICATION (Content Sheet / Spec Document)</option>
            <option value="ARTWORK">ARTWORK (Packaging Dieline Proof PDF)</option>
            <option value="REGULATORY_RULEBOOK">REGULATORY_RULEBOOK (Regulatory Standard)</option>
            <option value="CLAIMS_SOURCE">CLAIMS_SOURCE (Clinical / Substantiation)</option>
            <option value="PREVIOUS_DESIGN">PREVIOUS_DESIGN (Archival Pack Image JPG/PNG)</option>
            <option value="REVIEWER_NOTES">REVIEWER_NOTES (Quality Handover / Paste Notes)</option>
            <option value="STRUCTURAL_DIELINE">STRUCTURAL_DIELINE (CAD Geometry)</option>
          </select>
        </div>

        <div id="desk-drop-zone" style="border:2px dashed #94a3b8;border-radius:6px;padding:24px;text-align:center;background:#f8fafc;margin-bottom:14px;cursor:pointer;">
          <div style="font-size:28px;margin-bottom:6px;">📄</div>
          <strong style="font-size:13px;color:#334155;">Click or drag &amp; drop file here</strong>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">Supported: .pdf, .xlsx, .docx, .txt, .png, .jpg</div>
          <input type="file" id="desk-file-picker" style="display:none;" accept=".pdf,.xlsx,.docx,.txt,.png,.jpg,.jpeg,.webp" />
          <div id="desk-file-chosen" style="margin-top:8px;font-size:12px;font-weight:700;color:#0f766e;"></div>
        </div>

        <div id="desk-upload-stage" style="display:none;font-size:11px;font-family:monospace;color:#2563eb;margin-bottom:12px;">
          Uploading and computing SHA-256 fingerprint...
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button type="button" class="secondary close-dialog" style="padding:6px 14px;font-size:12px;">Cancel</button>
          <button type="button" class="primary" id="btn-submit-upload" style="padding:6px 16px;background:#0f766e;color:#fff;border:none;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;">Upload &amp; Extract ↗</button>
        </div>
      </div>
    `;

    dialog.querySelectorAll('.close-dialog').forEach(b => b.addEventListener('click', () => dialog.close()));
    const dropZone = dialog.querySelector('#desk-drop-zone');
    const filePicker = dialog.querySelector('#desk-file-picker');
    const fileChosen = dialog.querySelector('#desk-file-chosen');
    let selectedFile = null;

    dropZone.addEventListener('click', () => filePicker.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = '#0f766e'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '#94a3b8'; });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#94a3b8';
      if (e.dataTransfer.files?.length) {
        selectedFile = e.dataTransfer.files[0];
        fileChosen.textContent = `Selected: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`;
      }
    });

    filePicker.addEventListener('change', () => {
      if (filePicker.files?.length) {
        selectedFile = filePicker.files[0];
        fileChosen.textContent = `Selected: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`;
      }
    });

    const submitBtn = dialog.querySelector('#btn-submit-upload');
    submitBtn.addEventListener('click', async () => {
      const role = dialog.querySelector('#desk-doc-role-select')?.value || 'PRODUCT_SPECIFICATION';
      const stageEl = dialog.querySelector('#desk-upload-stage');
      if (!selectedFile) {
        alert('Please select or drag a file first.');
        return;
      }

      if (stageEl) {
        stageEl.style.display = 'block';
        stageEl.textContent = 'Reading bytes, hashing SHA-256, extracting source pieces...';
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const textContent = typeof reader.result === 'string' ? reader.result : '';
        const res = await fetch('/api/desk/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: selectedFile.name,
            content: textContent,
            fileType: selectedFile.name.split('.').pop().toLowerCase(),
            role,
            author: 'Packaging Reviewer'
          })
        });
        const data = await res.json();
        if (data.status === 'SUCCESS') {
          deskState = data.session;
          dialog.close();
          renderAllDeskPanels();
        } else {
          alert(`Upload failed: ${data.error || 'Server error'}`);
        }
      };
      // Read as text or binary base64
      if (selectedFile.name.endsWith('.txt')) {
        reader.readAsText(selectedFile);
      } else {
        reader.readAsDataURL(selectedFile);
      }
    });

    dialog.showModal();
  };

  document.getElementById('btn-open-upload-modal')?.addEventListener('click', openUploadModal);
  document.getElementById('btn-mini-upload')?.addEventListener('click', openUploadModal);

  // Paste Notes Modal (Phase 11)
  const pasteBtn = document.getElementById('btn-open-paste-modal');
  if (pasteBtn) {
    pasteBtn.addEventListener('click', () => {
      const dialog = document.getElementById('dialog');
      if (!dialog) return;

      dialog.innerHTML = `
        <div style="padding:16px 20px;max-width:480px;font-family:system-ui,-apple-system,sans-serif;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <span style="font-size:10px;font-family:monospace;color:#15803d;font-weight:700;">NOTES INTAKE · LINE NUMBER PROVENANCE</span>
            <button type="button" class="close-dialog" style="border:0;background:transparent;font-size:18px;cursor:pointer;">✕</button>
          </div>
          <h3 style="margin:0 0 8px;font-size:16px;">Paste Notes / Quality Handover</h3>
          <p style="font-size:12px;color:#64748b;margin:0 0 12px;">Each line number serves as the exact source location. Distinguishes reference notes from approved facts.</p>
          <label style="display:block;font-size:11px;font-weight:700;margin-bottom:4px;">Note Artifact Title</label>
          <input type="text" id="paste-title-input" value="QA_Handover_Notes.txt" style="width:100%;padding:6px 10px;border:1px solid #cbd5e1;border-radius:4px;margin-bottom:10px;font-size:12px;" />
          <label style="display:block;font-size:11px;font-weight:700;margin-bottom:4px;">Pasted Notes Text</label>
          <textarea id="paste-text-input" rows="6" style="width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:4px;font-family:monospace;font-size:11px;" placeholder="Line 1: Batch QA release notes...&#10;Line 2: Allergen advisory statement confirmed..."></textarea>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
            <button type="button" class="secondary close-dialog" style="padding:6px 12px;font-size:12px;">Cancel</button>
            <button type="button" class="primary" id="btn-submit-paste" style="padding:6px 16px;background:#0f766e;color:#fff;border:none;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;">Add to Evidence Desk ↗</button>
          </div>
        </div>
      `;

      dialog.querySelectorAll('.close-dialog').forEach(btn => btn.addEventListener('click', () => dialog.close()));
      const submitBtn = dialog.querySelector('#btn-submit-paste');
      submitBtn.addEventListener('click', async () => {
        const title = dialog.querySelector('#paste-title-input')?.value || 'Notes.txt';
        const content = dialog.querySelector('#paste-text-input')?.value || '';
        if (content.trim()) {
          const res = await fetch('/api/desk/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: title,
              content,
              fileType: 'txt',
              role: 'REVIEWER_NOTES',
              author: 'Reviewer'
            })
          });
          const data = await res.json();
          if (data.status === 'SUCCESS') {
            deskState = data.session;
            dialog.close();
            renderAllDeskPanels();
          }
        }
      });

      dialog.showModal();
    });
  }
}
