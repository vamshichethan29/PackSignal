/**
 * PackSignal Phase 1 — Extracted Source Pieces Inspector
 * (public/source-pieces-ui.js)
 * 
 * Developer and reviewer inspector modal for unified source pieces:
 * - PDF source pieces: Text, Page, Panel, Layer, Visibility, Extraction method, Quads, Classification
 * - Excel source pieces: Text, Worksheet, Cell, Column, Source status, Formula/cache warning
 * - Filters: [All], [Visible Artwork], [Ignored Guides], [Hidden], [Visibility Uncertain], [Excel Source]
 * - Inspection & 2D Artwork alignment
 */

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let cachedData = null;
let currentFilter = 'all';
let currentSearch = '';
let selectedPieceId = null;

export async function openSourcePiecesInspector(review, initialFilter = 'all') {
  currentFilter = initialFilter;
  currentSearch = '';
  selectedPieceId = null;

  let modal = document.getElementById('source-pieces-modal');
  if (!modal) {
    modal = document.createElement('dialog');
    modal.id = 'source-pieces-modal';
    modal.className = 'source-pieces-modal';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="sp-header">
      <div class="sp-header-left">
        <span style="font-size:22px;">🧩</span>
        <div>
          <h2 class="sp-header-title">Extracted Source Pieces — Phase 1 Pipeline</h2>
          <p class="sp-header-subtitle">Unified document provenance, geometry, panel mapping &amp; render verification</p>
        </div>
      </div>
      <button class="sp-close-btn" data-action="close-sp-modal" aria-label="Close">✕</button>
    </div>
    <div class="sp-diagnostics-bar" id="sp-diag-bar">
      <div class="sp-diag-card"><span class="sp-diag-num" id="diag-pdf-native">…</span><span class="sp-diag-label">Native PDF</span></div>
      <div class="sp-diag-card"><span class="sp-diag-num" id="diag-pdf-rebuilt">…</span><span class="sp-diag-label">Reconstructed</span></div>
      <div class="sp-diag-card"><span class="sp-diag-num" id="diag-pdf-panels">…</span><span class="sp-diag-label">Mapped Panels</span></div>
      <div class="sp-diag-card"><span class="sp-diag-num" id="diag-pdf-ignored" style="color:#94a3b8;">…</span><span class="sp-diag-label">Ignored Guides</span></div>
      <div class="sp-diag-card"><span class="sp-diag-num" id="diag-pdf-hidden" style="color:#f87171;">…</span><span class="sp-diag-label">Render Hidden</span></div>
      <div class="sp-diag-card"><span class="sp-diag-num" id="diag-xlsx-ac" style="color:#4ade80;">…</span><span class="sp-diag-label">Excel A–C Cells</span></div>
      <div class="sp-diag-card"><span class="sp-diag-num" id="diag-xlsx-excluded" style="color:#fbbf24;">…</span><span class="sp-diag-label">Excluded D+ Formulas</span></div>
    </div>
    <div class="sp-controls">
      <div class="sp-filters" id="sp-filters">
        <button class="sp-filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">All Pieces</button>
        <button class="sp-filter-btn ${currentFilter === 'visible' ? 'active' : ''}" data-filter="visible">Visible Artwork</button>
        <button class="sp-filter-btn ${currentFilter === 'ignored' ? 'active' : ''}" data-filter="ignored">Ignored Guides</button>
        <button class="sp-filter-btn ${currentFilter === 'hidden' ? 'active' : ''}" data-filter="hidden">Hidden Copy</button>
        <button class="sp-filter-btn ${currentFilter === 'uncertain' ? 'active' : ''}" data-filter="uncertain">Visibility Uncertain</button>
        <button class="sp-filter-btn ${currentFilter === 'excel' ? 'active' : ''}" data-filter="excel">Excel Sources (A–C)</button>
      </div>
      <div class="sp-search-box">
        <span class="sp-search-icon">🔍</span>
        <input type="text" class="sp-search-input" id="sp-search-input" placeholder="Search text, cell, panel, layer…">
      </div>
    </div>
    <div class="sp-body">
      <div class="sp-list-container" id="sp-list-container">
        <div style="padding:24px;text-align:center;color:#94a3b8;">Loading source pieces…</div>
      </div>
      <div class="sp-detail-panel" id="sp-detail-panel">
        <div style="color:#64748b;text-align:center;margin-top:40px;">Select a piece to inspect provenance and geometry</div>
      </div>
    </div>
  `;

  modal.querySelector('[data-action="close-sp-modal"]')?.addEventListener('click', () => {
    modal.close();
  });

  modal.querySelectorAll('.sp-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.sp-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderPiecesList();
    });
  });

  const searchInput = modal.querySelector('#sp-search-input');
  searchInput?.addEventListener('input', (e) => {
    currentSearch = e.target.value.toLowerCase().trim();
    renderPiecesList();
  });

  if (!modal.open) {
    modal.showModal();
  }

  // Load data
  try {
    const res = await fetch('/api/source-pieces');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cachedData = data;
    updateDiagnostics(data);
    renderPiecesList();
  } catch (err) {
    console.error('Failed to load source pieces from API, using fallback review docs:', err);
    cachedData = extractFromReview(review);
    updateDiagnostics(cachedData);
    renderPiecesList();
  }
}

function extractFromReview(review) {
  const artDoc = (review?.documents || []).find(d => d.role === 'artwork');
  const xlsxDoc = (review?.documents || []).find(d => d.role === 'spec' && d.name?.endsWith('.xlsx'));

  const pdfPieces = artDoc?.sourcePieces || [];
  const pdfIgnored = artDoc?.ignoredSourcePieces || [];
  const pdfHidden = pdfPieces.filter(p => p.visibility === 'HIDDEN' || p.hidden);
  const excelPieces = xlsxDoc?.sourcePieces || [];

  return {
    samples: {
      pdf: {
        pieces: pdfPieces,
        activePieces: pdfPieces.filter(p => !p.hidden && !p.ignored),
        ignoredList: pdfIgnored,
        hiddenPieces: pdfHidden,
        extractionDiagnostics: artDoc?.extractionDiagnostics || {}
      },
      excel: {
        pieces: excelPieces,
        ignoredList: xlsxDoc?.ignoredSourcePieces || [],
        metadataPieces: xlsxDoc?.metadataPieces || [],
        extractionDiagnostics: xlsxDoc?.extractionDiagnostics || {}
      }
    }
  };
}

function updateDiagnostics(data) {
  const pdfDiag = data?.samples?.pdf?.extractionDiagnostics || {};
  const xlsxDiag = data?.samples?.excel?.extractionDiagnostics || {};

  const pdfNativeEl = document.getElementById('diag-pdf-native');
  const pdfRebuiltEl = document.getElementById('diag-pdf-rebuilt');
  const pdfPanelsEl = document.getElementById('diag-pdf-panels');
  const pdfIgnoredEl = document.getElementById('diag-pdf-ignored');
  const pdfHiddenEl = document.getElementById('diag-pdf-hidden');
  const xlsxAcEl = document.getElementById('diag-xlsx-ac');
  const xlsxExEl = document.getElementById('diag-xlsx-excluded');

  if (pdfNativeEl) pdfNativeEl.textContent = pdfDiag.nativePieces || data?.samples?.pdf?.pieces?.length || '0';
  if (pdfRebuiltEl) pdfRebuiltEl.textContent = (pdfDiag.reconstructedPieces || 0) + (pdfDiag.curvedPieces || 0);
  if (pdfPanelsEl) pdfPanelsEl.textContent = pdfDiag.mappedPanels || '0';
  if (pdfIgnoredEl) pdfIgnoredEl.textContent = pdfDiag.guidePiecesIgnored || data?.samples?.pdf?.ignoredList?.length || '0';
  if (pdfHiddenEl) pdfHiddenEl.textContent = pdfDiag.hiddenPieces || data?.samples?.pdf?.hiddenPieces?.length || '0';
  if (xlsxAcEl) xlsxAcEl.textContent = xlsxDiag.acPopulatedSourceCells || data?.samples?.excel?.pieces?.length || '0';
  if (xlsxExEl) xlsxExEl.textContent = xlsxDiag.excludedFormulaColumns || '0';
}

function getAllPieces() {
  if (!cachedData?.samples) return [];
  const pdfPieces = cachedData.samples.pdf?.pieces || [];
  const pdfIgnored = cachedData.samples.pdf?.ignoredList || [];
  const xlsxPieces = cachedData.samples.excel?.pieces || [];
  const xlsxMeta = cachedData.samples.excel?.metadataPieces || [];

  return [
    ...pdfPieces,
    ...pdfIgnored,
    ...xlsxPieces,
    ...xlsxMeta
  ];
}

function renderPiecesList() {
  const container = document.getElementById('sp-list-container');
  if (!container) return;

  const all = getAllPieces();

  const filtered = all.filter(p => {
    // 1. Tab filter
    if (currentFilter === 'visible') {
      if (p.sourceType === 'excel' || p.sourceType === 'xlsx') return false;
      if (p.ignored || p.hidden || p.visibility === 'HIDDEN' || p.classification !== 'PRINTABLE_COPY') return false;
    } else if (currentFilter === 'ignored') {
      if (!p.ignored && !['CONSTRUCTION_GUIDE', 'DIELINE_LABEL', 'ANNOTATION'].includes(p.classification)) return false;
    } else if (currentFilter === 'hidden') {
      if (!p.hidden && p.visibility !== 'HIDDEN' && p.classification !== 'HIDDEN_COPY') return false;
    } else if (currentFilter === 'uncertain') {
      if (p.visibility !== 'VISIBILITY_UNCERTAIN') return false;
    } else if (currentFilter === 'excel') {
      if (p.sourceType !== 'excel' && p.sourceType !== 'xlsx') return false;
    }

    // 2. Search query
    if (currentSearch) {
      const q = currentSearch;
      const textMatch = (p.text || '').toLowerCase().includes(q) || (p.rawText || '').toLowerCase().includes(q);
      const panelMatch = (p.panel || p.location?.panelRole || '').toLowerCase().includes(q);
      const cellMatch = (p.cell || p.location?.cell || '').toLowerCase().includes(q);
      const layerMatch = (p.layer || p.location?.layer || '').toLowerCase().includes(q);
      return textMatch || panelMatch || cellMatch || layerMatch;
    }

    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="padding:32px;text-align:center;color:#64748b;">No matching source pieces found for filter: <b>${esc(currentFilter)}</b></div>`;
    return;
  }

  container.innerHTML = filtered.map(p => {
    const isPdf = (p.sourceType === 'pdf');
    const isReconstructed = p.letterSpacedRebuilt || p.isCurved || p.reconstructed;
    const isHidden = (p.visibility === 'HIDDEN' || p.hidden);
    const isIgnored = (p.ignored || p.classification === 'CONSTRUCTION_GUIDE' || p.classification === 'DIELINE_LABEL');
    const isSelected = (p.id === selectedPieceId);

    const tagSource = isPdf ? '<span class="sp-tag sp-tag-pdf">PDF</span>' : '<span class="sp-tag sp-tag-excel">EXCEL</span>';
    const tagStatus = isHidden
      ? '<span class="sp-tag sp-tag-hidden">HIDDEN COPY</span>'
      : isIgnored
      ? '<span class="sp-tag sp-tag-ignored">GUIDE (IGNORED)</span>'
      : '<span class="sp-tag sp-tag-visible">VISIBLE</span>';
    const tagRebuilt = isReconstructed ? '<span class="sp-tag sp-tag-reconstructed">RECONSTRUCTED</span>' : '';
    const tagPanel = isPdf && p.panel ? `<span class="sp-tag sp-tag-panel">${esc(p.panel)}</span>` : '';
    const tagCell = !isPdf && p.cell ? `<span class="sp-tag sp-tag-panel">${esc(p.sheet ? p.sheet + '!' : '')}${esc(p.cell)}</span>` : '';

    return `
      <div class="sp-piece-row ${isSelected ? 'selected' : ''}" data-piece-id="${esc(p.id)}">
        <div class="sp-row-top">
          <div class="sp-tags">
            ${tagSource}
            ${tagStatus}
            ${tagRebuilt}
            ${tagPanel}
            ${tagCell}
          </div>
          <span style="font-size:11px;color:#64748b;font-family:monospace;">${esc(p.id.slice(0, 18))}…</span>
        </div>
        <div class="sp-row-text">${esc(p.text)}</div>
        ${p.rawText && p.rawText !== p.text ? `<div style="font-size:12px;color:#d97706;font-family:monospace;">raw: "${esc(p.rawText)}"</div>` : ''}
        <div class="sp-row-meta">
          <span>📄 ${esc(p.documentName || p.file)}</span>
          ${isPdf ? `<span>Page ${p.location?.page || p.page || 1}</span>` : `<span>Cell ${esc(p.cell || p.location?.cell)}</span>`}
          ${p.layer ? `<span>Layer: ${esc(p.layer)}</span>` : ''}
          ${p.extractionMethod ? `<span>Method: ${esc(p.extractionMethod)}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.sp-piece-row').forEach(row => {
    row.addEventListener('click', () => {
      container.querySelectorAll('.sp-piece-row').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      const pid = row.dataset.pieceId;
      selectedPieceId = pid;
      const target = all.find(x => x.id === pid);
      if (target) renderPieceDetail(target);
    });
  });

  if (!selectedPieceId && filtered.length > 0) {
    selectedPieceId = filtered[0].id;
    container.querySelector('.sp-piece-row')?.classList.add('selected');
    renderPieceDetail(filtered[0]);
  }
}

function renderPieceDetail(p) {
  const detailPanel = document.getElementById('sp-detail-panel');
  if (!detailPanel) return;

  const isPdf = (p.sourceType === 'pdf');
  const loc = p.location || {};
  const isHidden = (p.visibility === 'HIDDEN' || p.hidden);
  const isIgnored = (p.ignored || p.classification === 'CONSTRUCTION_GUIDE');

  detailPanel.innerHTML = `
    <h3 class="sp-detail-title">${isPdf ? 'PDF Artwork Source Piece' : 'Excel Content Source Piece'}</h3>

    <div class="sp-detail-section">
      <div class="sp-section-heading">Text &amp; Reconstruction</div>
      <div class="sp-prop-row">
        <span class="sp-prop-label">Normalized Text:</span>
        <span class="sp-prop-val" style="color:#38bdf8;font-size:13px;">${esc(p.text)}</span>
      </div>
      <div class="sp-prop-row">
        <span class="sp-prop-label">Raw Source Text:</span>
        <span class="sp-prop-val" style="font-family:monospace;">${esc(p.rawText || p.text)}</span>
      </div>
      <div class="sp-prop-row">
        <span class="sp-prop-label">Classification:</span>
        <span class="sp-prop-val" style="color:${isIgnored ? '#94a3b8' : isHidden ? '#f87171' : '#4ade80'};">${esc(p.classification || 'PRINTABLE_COPY')}</span>
      </div>
      <div class="sp-prop-row">
        <span class="sp-prop-label">Visibility State:</span>
        <span class="sp-prop-val">${esc(p.visibility || (isHidden ? 'HIDDEN' : 'VISIBLE'))}</span>
      </div>
      ${p.hiddenReason ? `
        <div class="sp-prop-row">
          <span class="sp-prop-label">Occlusion Proof:</span>
          <span class="sp-prop-val" style="color:#f87171;">${esc(p.hiddenReason)}</span>
        </div>
      ` : ''}
      ${p.ignoreReason ? `
        <div class="sp-prop-row">
          <span class="sp-prop-label">Filtering Reason:</span>
          <span class="sp-prop-val" style="color:#94a3b8;">${esc(p.ignoreReason)}</span>
        </div>
      ` : ''}
    </div>

    <div class="sp-detail-section">
      <div class="sp-section-heading">Location &amp; Provenance</div>
      <div class="sp-prop-row">
        <span class="sp-prop-label">Document:</span>
        <span class="sp-prop-val">${esc(p.documentName || p.file)}</span>
      </div>
      <div class="sp-prop-row">
        <span class="sp-prop-label">Document SHA-256:</span>
        <span class="sp-prop-val" style="font-size:10px;font-family:monospace;">${esc((p.documentSha256 || '').slice(0, 24))}…</span>
      </div>
      <div class="sp-prop-row">
        <span class="sp-prop-label">Deterministic ID:</span>
        <span class="sp-prop-val" style="font-size:10px;font-family:monospace;">${esc(p.id)}</span>
      </div>
      ${isPdf ? `
        <div class="sp-prop-row">
          <span class="sp-prop-label">Page Number:</span>
          <span class="sp-prop-val">${loc.page || p.page || 1}</span>
        </div>
        <div class="sp-prop-row">
          <span class="sp-prop-label">Panel:</span>
          <span class="sp-prop-val" style="color:#a78bfa;">${esc(p.panel || loc.panelRole || 'Unknown')}</span>
        </div>
        <div class="sp-prop-row">
          <span class="sp-prop-label">PDF Layer:</span>
          <span class="sp-prop-val">${esc(p.layer || loc.layer || 'Unknown')}</span>
        </div>
        <div class="sp-prop-row">
          <span class="sp-prop-label">Bounding Box (pt):</span>
          <span class="sp-prop-val" style="font-family:monospace;">${JSON.stringify((p.box || []).map(x => Math.round(x)))}</span>
        </div>
        <div class="sp-prop-row">
          <span class="sp-prop-label">Normalized Box:</span>
          <span class="sp-prop-val" style="font-family:monospace;">${JSON.stringify((loc.normalizedBox || p.boxNorm || []).map(x => Math.round(x * 1000) / 1000))}</span>
        </div>
      ` : `
        <div class="sp-prop-row">
          <span class="sp-prop-label">Worksheet:</span>
          <span class="sp-prop-val">${esc(loc.sheet || p.sheet)}</span>
        </div>
        <div class="sp-prop-row">
          <span class="sp-prop-label">Cell Coordinate:</span>
          <span class="sp-prop-val" style="color:#4ade80;font-weight:700;">${esc(loc.cell || p.cell)}</span>
        </div>
        <div class="sp-prop-row">
          <span class="sp-prop-label">Column &amp; Row:</span>
          <span class="sp-prop-val">Col ${esc(loc.column || p.col)}, Row ${esc(loc.row || p.row)}</span>
        </div>
        <div class="sp-prop-row">
          <span class="sp-prop-label">Source Status:</span>
          <span class="sp-prop-val" style="color:#38bdf8;">${loc.column && ['A', 'B', 'C'].includes(loc.column) ? 'Trusted Product Fact (A–C)' : 'Metadata Exception'}</span>
        </div>
        <div class="sp-prop-row">
          <span class="sp-prop-label">Formula Policy:</span>
          <span class="sp-prop-val" style="color:#fbbf24;font-size:11px;">Cached values only — zero formulas/macros executed</span>
        </div>
      `}
    </div>

    ${Array.isArray(p.transforms) && p.transforms.length > 0 ? `
      <div class="sp-detail-section">
        <div class="sp-section-heading">Reconstruction Transforms (${p.transforms.length})</div>
        <div class="sp-transforms-list">
          ${p.transforms.map(t => `
            <div class="sp-transform-card">
              <b style="color:#fbbf24;">${esc(t.type || 'transform')}</b>: ${esc(t.reason || '')}
              ${t.pattern ? `<div>Pattern: <code>${esc(t.pattern)}</code></div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <div style="margin-top:auto;padding-top:12px;">
      ${isPdf ? `
        <button type="button" class="primary" style="width:100%;padding:10px;background:#0d9488;color:#fff;border-radius:6px;font-weight:700;" id="sp-inspect-2d-btn">
          🔍 Inspect on 2D Artwork Map →
        </button>
      ` : `
        <div style="background:#1e293b;padding:10px;border-radius:6px;border:1px solid #334155;text-align:center;font-size:12px;color:#94a3b8;">
          Excel cell <b>${esc(p.cell || loc.cell)}</b> exists in sheet <b>${esc(p.sheet || loc.sheet)}</b> (no physical PDF coordinates).
        </div>
      `}
    </div>
  `;

  if (isPdf) {
    document.getElementById('sp-inspect-2d-btn')?.addEventListener('click', () => {
      document.getElementById('source-pieces-modal')?.close();
      const tabBtn = document.querySelector('[data-action="tab"][data-tab="artwork"]');
      if (tabBtn) tabBtn.click();
    });
  }
}
