/**
 * @file reviewer-lenses.js
 * 
 * PackSignal Phase 5A — Reviewer Lenses: Red Pen, Sticky Notes, Track Changes,
 * and A3 Wall Poster Controller.
 */

let lensesData = null;
let currentMode = 'marked'; // 'marked' | 'clean'
let activeOwner = 'All';    // 'All' | 'Legal' | 'R&D' | 'Brand'

/**
 * Mounts the Reviewer Lenses workspace into the provided DOM container.
 */
export async function mountReviewerLenses(container) {
  if (!container) return;
  container.innerHTML = `
    <div class="lenses-workspace" id="lenses-root">
      <div style="text-align: center; padding: 3rem; color: #64748b;">
        <p>⚡ Loading senior reviewer annotations & flat dieline markings...</p>
      </div>
    </div>
  `;

  await loadReviewerLensesData();
  renderLensesWorkspace(container);
}

/**
 * Fetches reviewer lenses markings and dieline geometry from API.
 */
async function loadReviewerLensesData() {
  try {
    const res = await fetch('/api/reviewer-lenses');
    const data = await res.json();
    if (data.status === 'SUCCESS') {
      lensesData = data;
    }
  } catch (err) {
    console.error('Failed to load reviewer lenses data:', err);
  }
}

/**
 * Renders the full Reviewer Lenses workspace.
 */
function renderLensesWorkspace(container) {
  const root = container.querySelector('#lenses-root') || container;
  if (!lensesData) {
    root.innerHTML = `<div style="padding:2rem;color:#dc2626;">Failed to load reviewer lenses.</div>`;
    return;
  }

  const { geometry, findings, stickyNotes, trackChanges, summary } = lensesData;

  // Header & Controls
  const headerHtml = `
    <div class="lenses-header-card">
      <div class="lenses-header-info">
        <h2>
          <span>✍️</span> Senior Reviewer Markup Lens
          <span style="font-size:0.8rem; background:#fee2e2; color:#b91c1c; padding:3px 8px; border-radius:6px; font-weight:700;">
            ${findings.length} ACTIVE REVIEW MARKS
          </span>
        </h2>
        <div class="lenses-header-meta">
          <span><strong>Carton:</strong> ${escapeHtml(lensesData.cartonName)}</span>
          <span><strong>Dieline Size:</strong> ${geometry.canvasWidthMm.toFixed(1)} × ${geometry.canvasHeightMm.toFixed(1)} mm</span>
          <span><strong>Legal:</strong> ${summary.legalCount} | <strong>R&D:</strong> ${summary.rdCount} | <strong>Brand:</strong> ${summary.brandCount}</span>
        </div>
      </div>

      <div style="display:flex; gap:1rem; align-items:center; flex-wrap:wrap;">
        <!-- Clean / Marked Toggle -->
        <div class="lenses-toggle-wrap">
          <button class="lens-mode-btn clean ${currentMode === 'clean' ? 'active' : ''}" id="btn-mode-clean">
            <span>✨</span> Clean Artwork
          </button>
          <button class="lens-mode-btn ${currentMode === 'marked' ? 'active' : ''}" id="btn-mode-marked">
            <span>🔴</span> Marked Up (Senior Reviewer)
          </button>
        </div>

        <!-- A3 Wall Poster Export -->
        <button class="btn btn-secondary" id="btn-export-poster" style="font-weight:700; background:#ffffff; border:1px solid #0284c7; color:#0284c7;">
          🖼️ Export A3 Wall Poster
        </button>
      </div>
    </div>
  `;

  // Panels on Flat Dieline
  const panelsHtml = geometry.panels.map(p => {
    const isPdp = p.id === 'panel-front';
    return `
      <div class="dieline-panel ${isPdp ? 'pdp' : ''}" id="panel-${p.id}" style="
        left: ${(p.xMm / geometry.canvasWidthMm) * 100}%;
        top: ${(p.yMm / geometry.canvasHeightMm) * 100}%;
        width: ${(p.widthMm / geometry.canvasWidthMm) * 100}%;
        height: ${(p.heightMm / geometry.canvasHeightMm) * 100}%;
      ">
        <div class="panel-header-tag">${escapeHtml(p.name)}</div>
        <div class="panel-dimensions-tag">${p.widthMm.toFixed(1)} × ${p.heightMm.toFixed(1)} mm</div>
      </div>
    `;
  }).join('');

  // Finding Pins (Only visible in 'marked' mode)
  const pinsHtml = currentMode === 'marked' ? findings.map((f, idx) => {
    const xPct = (f.dielineMm.x / geometry.canvasWidthMm) * 100;
    const yPct = (f.dielineMm.y / geometry.canvasHeightMm) * 100;
    const ownerClass = f.owner.toLowerCase().replace(/[^a-z]/g, '');

    return `
      <div class="dieline-pin ${ownerClass}" style="left:${xPct}%; top:${yPct}%;" data-finding-id="${f.id}" title="${escapeHtml(f.title)} (${f.panel})">
        <div class="pin-pulse"></div>
        <span>${idx + 1}</span>
      </div>
    `;
  }).join('') : '';

  // Red-Pen Animated Vector SVG Overlay (Only visible in 'marked' mode)
  const redPenSvgHtml = currentMode === 'marked' ? `
    <svg class="redpen-svg-overlay" viewBox="0 0 ${geometry.canvasWidthPt} ${geometry.canvasHeightPt}">
      <defs>
        <marker id="marker-arrow-red" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#dc2626" />
        </marker>
        <marker id="marker-arrow-blue" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284c7" />
        </marker>
      </defs>
      ${findings.map(f => `
        <g class="redpen-group" id="svg-mark-${f.id}">
          <path class="redpen-stroke-animated" d="${f.redPen.svgPath}" fill="none" stroke="${f.color}" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" />
          ${f.redPen.strikePath ? `<path class="redpen-stroke-animated" d="${f.redPen.strikePath}" fill="none" stroke="${f.color}" stroke-width="2.75" stroke-linecap="round" />` : ''}
          ${f.redPen.arrowPath ? `<path class="redpen-stroke-animated" d="${f.redPen.arrowPath}" fill="none" stroke="${f.color}" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#${f.color === '#dc2626' ? 'marker-arrow-red' : 'marker-arrow-blue'})" />` : ''}
          <text class="redpen-callout-text" x="${f.dielinePt[0]}" y="${f.dielinePt[1] - 15}" fill="${f.color}">${escapeHtml(f.redPen.calloutText)}</text>
        </g>
      `).join('')}
    </svg>
  ` : '';

  // Sticky Notes Tray (Filtered by Owner)
  const filteredNotes = stickyNotes.filter(n => activeOwner === 'All' || n.owner === activeOwner);
  const stickyNotesHtml = filteredNotes.map(n => {
    const ownerClass = n.owner.toLowerCase().replace(/[^a-z]/g, '');
    return `
      <div class="reviewer-sticky-note ${ownerClass}" id="note-${n.findingId}" data-finding-id="${n.findingId}">
        <div class="note-head">
          <span class="note-owner-pill ${ownerClass}">${escapeHtml(n.owner)} · ${escapeHtml(n.badge)}</span>
          <span class="note-panel-link">📍 ${escapeHtml(n.panel)}</span>
        </div>
        <div class="note-author-line">${escapeHtml(n.ownerName)}</div>
        <p class="note-body-text">${escapeHtml(n.note)}</p>
        <div class="note-action-tag"><strong>Action Required:</strong> ${escapeHtml(n.actionRequired)}</div>
      </div>
    `;
  }).join('');

  // Track Changes Diff List
  const trackChangesHtml = trackChanges.map(t => {
    const diffHtml = t.diffSegments.map(s => {
      if (s.type === 'deleted') return `<del class="diff-del">${escapeHtml(s.text)}</del>`;
      if (s.type === 'inserted') return `<ins class="diff-ins">${escapeHtml(s.text)}</ins>`;
      return `<span>${escapeHtml(s.text)}</span>`;
    }).join('');

    return `
      <div class="track-change-row">
        <div class="track-row-header">
          <span class="track-title">${escapeHtml(t.title)}</span>
          <span class="track-panel-badge">${escapeHtml(t.panel)}</span>
        </div>
        <div class="track-diff-preview">${diffHtml}</div>
        <div class="track-rationale-note"><em>Rationale:</em> ${escapeHtml(t.rationale)}</div>
      </div>
    `;
  }).join('');

  root.innerHTML = `
    ${headerHtml}

    <div class="lenses-workbench-grid">
      <!-- Left: Flat Dieline Canvas -->
      <div class="dieline-canvas-card">
        <div class="dieline-canvas-header">
          <div class="dieline-canvas-title">
            <span>📦</span> Flat Dieline (Dancing Fish Carton)
            <span style="font-size:0.75rem; color:#64748b; font-weight:normal;">Click any pin to inspect verbatim evidence sources</span>
          </div>
          <span style="font-size:0.8rem; font-weight:700; color:${currentMode === 'clean' ? '#16a34a' : '#dc2626'};">
            ${currentMode === 'clean' ? '✨ CLEAN ARTWORK MODE' : '🔴 SENIOR REVIEWER RED-PEN MARKUP'}
          </span>
        </div>

        <div class="dieline-frame" id="dieline-frame">
          ${panelsHtml}
          ${redPenSvgHtml}
          ${pinsHtml}
        </div>
      </div>

      <!-- Right: Sticky Notes & Track Changes -->
      <div class="reviewer-sidebar">
        <!-- Sticky Notes -->
        <div class="sticky-notes-card">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:1rem; color:#0f172a;">📝 Sticky Notes by Owner</strong>
            <span style="font-size:0.8rem; color:#64748b;">${filteredNotes.length} notes</span>
          </div>

          <div class="sticky-filter-row">
            ${['All', 'Legal', 'R&D', 'Brand'].map(owner => `
              <button class="sticky-filter-btn ${activeOwner === owner ? 'active' : ''}" data-owner="${owner}">
                ${owner} (${owner === 'All' ? stickyNotes.length : stickyNotes.filter(n => n.owner === owner).length})
              </button>
            `).join('')}
          </div>

          <div class="sticky-feed-list">
            ${stickyNotesHtml}
          </div>
        </div>

        <!-- Track Changes -->
        <div class="track-changes-card">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:1rem; color:#0f172a;">🔍 Track Changes (Redline Copy)</strong>
            <span style="font-size:0.75rem; color:#64748b;">Ingredients · Allergens · Claims</span>
          </div>

          <div class="track-changes-list">
            ${trackChangesHtml}
          </div>
        </div>
      </div>
    </div>
  `;

  attachLensesListeners(root, container);
}

/**
 * Attaches interactive click handlers for Clean/Marked toggle, pins, sticky notes, and export.
 */
function attachLensesListeners(root, container) {
  // Toggle: Clean Mode
  const cleanBtn = root.querySelector('#btn-mode-clean');
  if (cleanBtn) {
    cleanBtn.addEventListener('click', () => {
      currentMode = 'clean';
      renderLensesWorkspace(container);
    });
  }

  // Toggle: Marked Mode
  const markedBtn = root.querySelector('#btn-mode-marked');
  if (markedBtn) {
    markedBtn.addEventListener('click', () => {
      currentMode = 'marked';
      renderLensesWorkspace(container);
    });
  }

  // Owner Filter buttons
  root.querySelectorAll('.sticky-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeOwner = btn.getAttribute('data-owner');
      renderLensesWorkspace(container);
    });
  });

  // Export A3 Wall Poster
  const posterBtn = root.querySelector('#btn-export-poster');
  if (posterBtn) {
    posterBtn.addEventListener('click', () => {
      window.open('/api/reviewer-lenses/poster', '_blank');
    });
  }

  // Pin Click: Open File Spot Inspector
  root.querySelectorAll('.dieline-pin').forEach(pin => {
    pin.addEventListener('click', () => {
      const findingId = pin.getAttribute('data-finding-id');
      const finding = lensesData.findings.find(f => f.id === findingId);
      if (finding && finding.sources && finding.sources[0]) {
        openFindingSourceSpot(finding);
      }
    });
  });

  // Sticky Note Click: Highlight pin and open File Spot
  root.querySelectorAll('.reviewer-sticky-note').forEach(note => {
    note.addEventListener('click', () => {
      const findingId = note.getAttribute('data-finding-id');
      const finding = lensesData.findings.find(f => f.id === findingId);
      if (finding) {
        // Highlight corresponding pin
        const pin = root.querySelector(`.dieline-pin[data-finding-id="${findingId}"]`);
        if (pin) {
          pin.style.transform = 'translate(-50%, -50%) scale(1.4)';
          setTimeout(() => {
            pin.style.transform = '';
          }, 1000);
        }
        openFindingSourceSpot(finding);
      }
    });
  });
}

/**
 * Opens the File Spot Inspector modal for a finding.
 */
async function openFindingSourceSpot(finding) {
  const src = finding.sources[0];
  if (!src) return;

  try {
    const url = `/api/file-spot?file=${encodeURIComponent(src.file)}&location=${encodeURIComponent(src.location)}&quote=${encodeURIComponent(src.quote)}`;
    const res = await fetch(url);
    const data = await res.json();

    const dialog = document.querySelector('#file-spot-dialog') || document.querySelector('#dialog');
    if (dialog && typeof dialog.showModal === 'function') {
      const fileEl = dialog.querySelector('#spot-file-name');
      const locEl = dialog.querySelector('#spot-location');
      const quoteEl = dialog.querySelector('#spot-quote');
      const coordEl = dialog.querySelector('#spot-coordinates');

      if (fileEl) fileEl.textContent = data.file;
      if (locEl) locEl.textContent = data.location;
      if (quoteEl) quoteEl.textContent = `"${data.quote}"`;
      if (coordEl) coordEl.textContent = JSON.stringify(data.coordinates || {});

      dialog.showModal();
    } else {
      alert(`[Source Evidence Spot]\nFile: ${src.file}\nLocation: ${src.location}\nQuote: "${src.quote}"\nOwner: ${finding.owner} (${finding.ownerTitle})`);
    }
  } catch (err) {
    console.error('Failed to open file spot:', err);
  }
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
