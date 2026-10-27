/**
 * PackSignal Smart Conflict Comparison Cards (public/conflict-card.js)
 * Implements Part 5:
 * - Side-by-side comparison of candidate values with provenance
 * - Explicit source approval states (Draft vs Production)
 * - Reviewer resolution actions with backend persistence and dependency invalidation
 */

import { renderSourceChip } from './source-chip.js';

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderConflictCard(conflict, options = {}) {
  if (!conflict) return '';

  const id = conflict.id || conflict.field || 'conflict-item';
  const title = conflict.title || conflict.label || conflict.field || 'Unresolved Conflict';
  const conflictType = conflict.type || conflict.conflictType || 'SPECIFICATION_ARTWORK_MISMATCH';

  // Candidate A (Source)
  const candA = conflict.candidateA || conflict.sourceCandidate || {
    label: 'Source Reference',
    value: conflict.sourceValue || conflict.expected || 'Unspecified in source',
    quote: conflict.sourceQuote || conflict.expectedQuote || '',
    sheet: conflict.sheet || 'US',
    cell: conflict.cell || 'B26',
    documentName: conflict.sourceDoc || 'Content Sheet.xlsx',
    authority: conflict.sourceAuthority || 'Draft / In Review'
  };

  // Candidate B (Artwork)
  const candB = conflict.candidateB || conflict.artworkCandidate || {
    label: 'Printed Artwork',
    value: conflict.artworkValue || conflict.observed || 'Unspecified in artwork',
    quote: conflict.artworkQuote || conflict.observedQuote || '',
    panel: conflict.panel || 'Back Panel',
    page: conflict.page || 1,
    documentName: conflict.artworkDoc || 'Carton.pdf',
    authority: 'Current Printed Design'
  };

  const affectedCount = conflict.affectedChecks?.length || conflict.affectedCount || 2;
  const currentResolution = conflict.resolution || options.currentResolution || null;

  return `
    <article class="conflict-card" data-conflict-id="${esc(id)}" style="background:#13261f;border:1px solid #2e493b;border-radius:8px;padding:18px;margin-bottom:14px;box-shadow:0 4px 16px rgba(0,0,0,0.3);border-left:4px solid #f97316;color:#e2ece0;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;gap:12px;">
        <div>
          <div style="font-size:11px;font-weight:700;color:#fb923c;text-transform:uppercase;letter-spacing:0.5px;">
            ⚠️ CONFLICT DETECTION · ${esc(conflictType)}
          </div>
          <h3 style="margin:4px 0 2px;font-size:16px;color:#f1f8f3;font-weight:700;">${esc(title)}</h3>
          <p style="margin:0;font-size:12px;color:#94a3b8;">
            Conflicting data detected between source specification and printed artwork. Reviewer judgment required.
          </p>
        </div>
        <div style="text-align:right;">
          <span style="display:inline-block;background:#451a03;color:#fdba74;border:1px solid #9a3412;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;">
            ${affectedCount} dependent check${affectedCount === 1 ? '' : 's'} affected
          </span>
        </div>
      </div>

      <!-- Side by Side Candidates Grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:12px;margin:14px 0;">
        <!-- Candidate A: Source -->
        <div style="background:#183328;border:1px solid #2a523e;border-radius:6px;padding:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:11px;font-weight:700;color:#a7f3d0;text-transform:uppercase;">${esc(candA.label)}</span>
            <span style="font-size:10px;background:#362b0d;color:#fde047;border:1px solid #854d0e;padding:2px 6px;border-radius:3px;font-weight:600;">${esc(candA.authority)}</span>
          </div>
          <div style="font-size:15px;font-weight:700;color:#f1f8f3;margin-bottom:6px;font-family:monospace;">
            ${esc(candA.value)}
          </div>
          <div style="margin-top:6px;">
            ${renderSourceChip({
              name: candA.documentName,
              sheet: candA.sheet,
              cell: candA.cell,
              quote: candA.quote || candA.value,
              authority: 'draft',
              sourceType: 'spreadsheet'
            })}
          </div>
        </div>

        <!-- Candidate B: Artwork -->
        <div style="background:#183328;border:1px solid #2a523e;border-radius:6px;padding:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:11px;font-weight:700;color:#93c5fd;text-transform:uppercase;">${esc(candB.label)}</span>
            <span style="font-size:10px;background:#172554;color:#93c5fd;border:1px solid #1e40af;padding:2px 6px;border-radius:3px;font-weight:600;">${esc(candB.authority)}</span>
          </div>
          <div style="font-size:15px;font-weight:700;color:#f1f8f3;margin-bottom:6px;font-family:monospace;">
            ${esc(candB.value)}
          </div>
          <div style="margin-top:6px;">
            ${renderSourceChip({
              name: candB.documentName,
              page: candB.page,
              panel: candB.panel,
              quote: candB.quote || candB.value,
              authority: 'approved',
              sourceType: 'artwork'
            })}
          </div>
        </div>
      </div>

      <!-- Action Buttons Bar -->
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding-top:8px;border-top:1px dashed #2e493b;">
        <span style="font-size:12px;font-weight:700;color:#94a3b8;margin-right:4px;">Resolve Conflict:</span>
        <button type="button" class="conflict-act-btn" data-conflict-action="USE_SOURCE" data-conflict-id="${esc(id)}" style="background:#059669;color:#fff;border:none;padding:5px 10px;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;">
          ✓ Use Verified Source
        </button>
        <button type="button" class="conflict-act-btn" data-conflict-action="CONFIRM_ARTWORK" data-conflict-id="${esc(id)}" style="background:#0284c7;color:#fff;border:none;padding:5px 10px;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;">
          ✓ Confirm Intended Change
        </button>
        <button type="button" class="conflict-act-btn" data-conflict-action="REQUEST_CLARIFICATION" data-conflict-id="${esc(id)}" style="background:#1b382c;color:#a7f3d0;border:1px solid #2e493b;padding:5px 10px;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;">
          💬 Request Clarification
        </button>
        <button type="button" class="conflict-act-btn" data-conflict-action="LEAVE_UNRESOLVED" data-conflict-id="${esc(id)}" style="background:#13261f;color:#94a3b8;border:1px solid #2e493b;padding:5px 10px;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;">
          ⏱ Leave Unresolved
        </button>
        ${currentResolution ? `
          <span style="margin-left:auto;font-size:11px;color:#0f766e;font-weight:700;">
            Current Choice: ${esc(currentResolution)}
          </span>
        ` : ''}
      </div>

      <!-- Vegan vs. Honey 1-Tap Ripple (Sprint 1 & Upgrade #41) -->
      ${(/honey/i.test(`${title} ${candA.value} ${candB.value}`) && /vegan/i.test(`${title} ${candA.value} ${candB.value}`)) || id.includes('honey') || id.includes('vegan') ? `
        <div class="honey-vegan-ripple-section" style="margin-top:10px;padding:8px 12px;border-radius:6px;background:#f0fdf4;border:1px solid #86efac;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          <span style="font-size:11px;font-weight:800;color:#166534;">⚡ Vegan vs. Honey 1-Tap Ripple:</span>
          <div style="display:flex;gap:6px;">
            <button type="button" class="btn-explore-ripple" data-action="explore-decision-ripple" data-conflict-id="${esc(id)}" data-ripple-choice="RIPPLE_KEEP_HONEY" style="background:#047857;color:#fff;border:none;padding:5px 12px;border-radius:4px;font-size:11px;font-weight:800;cursor:pointer;">
              ⚡ Explore Resolution Options (Option A: Keep Honey / Drop Vegan Claim · RIPPLE_KEEP_HONEY)
            </button>
            <button type="button" class="btn-explore-ripple" data-action="explore-decision-ripple" data-conflict-id="${esc(id)}" data-ripple-choice="RIPPLE_KEEP_VEGAN" style="background:#059669;color:#fff;border:none;padding:5px 12px;border-radius:4px;font-size:11px;font-weight:800;cursor:pointer;">
              🌱 Option B: Keep Vegan (R&D Reformulation · RIPPLE_KEEP_VEGAN)
            </button>
          </div>
        </div>
      ` : ''}
    </article>
  `;
}

/**
 * Attaches conflict card action listeners
 */
export function mountConflictCardHandlers(container = document, onResolve = null) {
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-conflict-action]');
    if (!btn) return;
    e.preventDefault();

    const action = btn.dataset.conflictAction;
    const conflictId = btn.dataset.conflictId;

    if (typeof onResolve === 'function') {
      onResolve({ conflictId, action });
    }
  });
}
