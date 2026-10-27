/**
 * PackSignal Universal SourceChip Component (public/source-chip.js)
 * Implements Part 2 & Part 4:
 * - Clickable, compact source chips carrying full document & cell provenance
 * - Displays source document, sheet, cell, page, panel, and authority state
 * - Triggers the Universal Evidence Drawer on click
 * - Preserves fact states separately from check finding statuses
 */

import { openEvidenceDrawer } from './evidence-drawer.js';
import { openSourceViewer } from './source-viewer.js';

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Standardized Fact Trust State Badges
 * States: CONFIRMED_SOURCE, HUMAN_CONFIRMED, AI_SUGGESTED, MISSING, CONFLICTED, UNVERIFIED, SUPERSEDED
 */
export function renderFactBadge(state = 'UNVERIFIED', customLabel = null) {
  const normState = String(state).toUpperCase().replace(/\s+/g, '_');
  const map = {
    CONFIRMED_SOURCE: { label: 'CONFIRMED SOURCE', icon: '✓', cls: 'badge-confirmed-source' },
    HUMAN_CONFIRMED: { label: 'HUMAN CONFIRMED', icon: '👤', cls: 'badge-human-confirmed' },
    AI_SUGGESTED: { label: 'AI SUGGESTED', icon: '✨', cls: 'badge-ai-suggested' },
    MISSING: { label: 'SOURCE MISSING', icon: '✕', cls: 'badge-missing' },
    CONFLICTED: { label: 'CONFLICTED', icon: '⚠️', cls: 'badge-conflicted' },
    UNVERIFIED: { label: 'UNVERIFIED', icon: '⏱', cls: 'badge-unverified' },
    SUPERSEDED: { label: 'SUPERSEDED', icon: '↷', cls: 'badge-superseded' }
  };
  const cfg = map[normState] || { label: normState, icon: '•', cls: 'badge-unverified' };
  const text = customLabel || cfg.label;
  return `<span class="fact-badge ${cfg.cls}" data-fact-state="${esc(normState)}"><span class="fact-badge-icon" aria-hidden="true">${cfg.icon}</span><span class="fact-badge-text">${esc(text)}</span></span>`;
}

/**
 * Formats a clean, readable label for a source chip per Phase 8, 10, 16, 17 specs
 */
export function formatSourceLabel(source) {
  if (!source) return 'Source unavailable';
  const role = String(source.role || source.sourceRole || '').toUpperCase();
  const type = String(source.sourceType || source.type || '').toLowerCase();
  const docName = source.name || source.documentName || source.file || source.id || 'Document';
  const cleanDoc = docName.replace(/\.[a-zA-Z0-9]+$/, '').slice(0, 18);

  // 1. Image / Old Design (Phase 16)
  if (role === 'PREVIOUS_DESIGN' || type === 'image' || /\.(png|jpe?g|webp)$/i.test(docName)) {
    return 'IMAGE · Old Design · AI Suggested';
  }

  // 2. DOCX Word Document (Phase 8)
  if (type === 'docx' || /\.docx$/i.test(docName) || source.paragraph) {
    if (source.paragraph) return `DOCX · Paragraph ${source.paragraph}`;
    if (source.location && source.location.includes('Table')) return `DOCX · ${source.location}`;
    if (source.location) return `DOCX · ${source.location}`;
    return 'DOCX · Specification';
  }

  // 3. Plain PDF Specification (Phase 10)
  if ((role === 'PRODUCT_SPECIFICATION' && /\.pdf$/i.test(docName)) || type === 'plain_pdf') {
    if (source.page && source.line) return `PDF · Page ${source.page} · Line ${source.line}`;
    if (source.page) return `PDF · Page ${source.page}`;
    if (source.location) return `PDF · ${source.location}`;
    return 'PDF · Specification';
  }

  // 4. Pasted Notes & TXT (Phase 11 & 12)
  if (role === 'REVIEWER_NOTES' || /\.txt$/i.test(docName) || type === 'note') {
    if (source.line) return `Notes · Line ${source.line}`;
    if (source.location && /Line\s*\d+/i.test(source.location)) return `Notes · ${source.location}`;
    return source.location ? `Notes · ${source.location}` : 'Notes · Reference';
  }

  // 5. Excel Spreadsheet (Phase 1 & 2)
  if (source.sheet && source.cell) {
    return `${cleanDoc} · ${source.sheet}!${source.cell}`;
  }
  if (source.cell) {
    return `${cleanDoc} · Cell ${source.cell}`;
  }

  // 6. Packaging PDF Artwork
  if (source.panel && source.page) {
    return `${cleanDoc} · p.${source.page} · ${source.panel}`;
  }
  if (source.panel) {
    return `${cleanDoc} · ${source.panel}`;
  }
  if (source.page) {
    return `${cleanDoc} · p.${source.page}`;
  }
  if (source.location) {
    return `${cleanDoc} · ${source.location}`;
  }
  return `${cleanDoc} · Location unconfirmed`;
}

/**
 * Returns icon based on document or source type
 */
function getSourceIcon(source) {
  const role = String(source.role || source.sourceRole || '').toUpperCase();
  const type = (source.sourceType || source.role || source.type || '').toLowerCase();
  const name = (source.name || source.documentName || source.file || '').toLowerCase();
  if (role === 'PREVIOUS_DESIGN' || type.includes('image') || /\.(png|jpe?g|webp)$/.test(name)) return '🖼️';
  if (type.includes('spreadsheet') || name.endsWith('.xlsx') || name.endsWith('.xls') || source.cell) return '📊';
  if (type.includes('artwork') || name.includes('carton') || name.includes('dieline')) return '🎨';
  if (type.includes('docx') || name.endsWith('.docx')) return '📝';
  if (role === 'REVIEWER_NOTES' || name.endsWith('.txt') || type.includes('note')) return '📌';
  if (role === 'PRODUCT_SPECIFICATION' && name.endsWith('.pdf')) return '📋';
  if (type.includes('rulebook') || type.includes('rule')) return '⚖️';
  return '📄';
}

/**
 * Renders a single SourceChip
 */
export function renderSourceChip(source, options = {}) {
  if (!source) {
    return `<span class="source-chip source-chip--unavailable"><span class="source-chip-icon">⚠️</span><span class="source-chip-label">Source location unavailable</span></span>`;
  }

  const icon = options.icon || getSourceIcon(source);
  const label = options.label || formatSourceLabel(source);
  const docId = source.documentId || source.id || '';
  const sheet = source.sheet || (source.sourceContext?.sheet) || '';
  const cell = source.cell || (source.sourceContext?.cell) || '';
  const page = source.page || '';
  const quote = source.quote || '';
  const authority = source.authority || source.sourceApprovalStatus || 'draft';
  const verification = source.quoteVerification || (quote ? 'verified' : 'unverified');

  // Payload serialized as JSON attribute for full provenance inspection
  const payloadJson = esc(JSON.stringify({
    documentId: docId,
    documentName: source.name || source.documentName || 'Source Document',
    documentHash: source.sha256 || source.documentHash || '',
    sourceType: source.sourceType || source.role || 'source',
    sheet,
    cell,
    page,
    panel: source.panel || '',
    quote,
    quoteVerification: verification,
    authority,
    location: source.location || (sheet && cell ? `${sheet}!${cell}` : (page ? `Page ${page}` : 'Location unconfirmed')),
    findingId: options.findingId || source.findingId || null,
    field: source.field || options.field || null
  }));

  const authorityPill = authority === 'approved' 
    ? '<span class="source-chip-auth approved" title="Approved source">✓</span>' 
    : '<span class="source-chip-auth draft" title="Draft / In-Review source">?</span>';

  const chipType = (source.sourceType || source.role || (cell ? 'spreadsheet' : (source.panel || page ? 'artwork' : 'generic'))).toLowerCase();
  const cls = `source-chip source-chip-${esc(chipType)}${options.extraClass ? ' ' + options.extraClass : ''}`;

  return `
    <button type="button" 
      class="${cls}" 
      data-source-chip="true" 
      data-source-payload="${payloadJson}"
      ${sheet ? `data-sheet="${esc(sheet)}"` : ''}
      ${cell ? `data-cell="${esc(cell)}"` : ''}
      ${page ? `data-page="${esc(page)}"` : ''}
      ${source.panel ? `data-panel="${esc(source.panel)}"` : ''}
      title="Click to inspect source evidence: ${esc(label)}">
      <span class="source-chip-icon" aria-hidden="true">${icon}</span>
      <span class="source-chip-label">${esc(label)}</span>
      ${authorityPill}
    </button>
  `.trim();
}

/**
 * Renders an array of SourceChips
 */
export function renderSourceChips(sources = [], options = {}) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return `<span class="source-chip source-chip--empty"><span class="source-chip-label">No source reference</span></span>`;
  }
  return `
    <div class="source-chips-container" style="display:inline-flex;flex-wrap:wrap;gap:6px;align-items:center;">
      ${sources.map(src => renderSourceChip(src, options)).join('')}
    </div>
  `;
}

/**
 * Mounts event listeners for all source chips inside a container
 */
export function attachSourceChipListeners(container = document, onSelect = null) {
  container.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-source-chip]');
    if (!chip) return;
    e.preventDefault();
    e.stopPropagation();

    const payloadRaw = chip.getAttribute('data-source-payload');
    if (!payloadRaw) return;

    try {
      const payload = JSON.parse(payloadRaw);
      if (typeof onSelect === 'function') {
        onSelect(payload);
      } else {
        openSourceViewer(payload);
      }
    } catch (err) {
      console.error('Failed to parse source-chip payload:', err);
    }
  });
}
