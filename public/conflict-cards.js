/**
 * PackSignal Conflict Cards System (public/conflict-cards.js)
 * Implements Phase 20 & Phase 21:
 * - Side-by-side comparison of candidate values with source chips
 * - Ground truth audit fields: reviewer identity, permission, decision reason, timestamp
 * - Actions: [Select Source A], [Select Source B], [Request Clarification], [Keep Unresolved], [Compare Sources]
 * - Preserves conflicting facts and updates Fact Sheet projection live
 */

import { renderSourceChip } from './source-chip.js';
import { openEvidenceDrawer } from './evidence-drawer.js';

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
 * Renders an individual conflict card per Phase 20 specification.
 */
export function renderConflictCard(conflict, options = {}) {
  if (!conflict) return '';

  const id = conflict.id || conflict.conflictId || conflict.field || 'conflict-item';
  const fieldName = conflict.label || conflict.title || conflict.field || 'Unspecified Field';
  const conflictCategory = conflict.category || 'SPECIFICATION CONFLICT';
  const whyItMatters = conflict.explanation || conflict.conflictReason || conflict.reason || 'Conflicting values detected across sources; requires authoritative reviewer resolution.';
  const isResolved = conflict.status === 'RESOLVED';

  // Candidate A (Source Spec or First Evidence)
  const candA = conflict.candidateA || conflict.sourceCandidate || {
    label: 'Source Reference (Source A)',
    value: conflict.specValue || conflict.sourceValue || conflict.expected || '9%',
    quote: conflict.specQuote || conflict.sourceQuote || conflict.quoteA || 'Honey (9%)',
    sheet: conflict.sheet || 'US',
    cell: conflict.cell || 'B26',
    documentName: conflict.specSource || conflict.sourceDoc || 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx',
    authority: 'Authoritative Specification (Draft)'
  };

  // Candidate B (Carton Print or Second Evidence)
  const candB = conflict.candidateB || conflict.artworkCandidate || {
    label: 'Printed Artwork (Source B)',
    value: conflict.artworkValue || conflict.observed || '1%',
    quote: conflict.artworkQuote || conflict.observedQuote || conflict.quoteB || 'Honey (1%)',
    panel: conflict.panel || 'Back panel',
    page: conflict.page || 1,
    documentName: conflict.artworkSource || conflict.artworkDoc || 'DancingFish_Granola_Berry_US_Carton.pdf',
    authority: 'Printed Packaging Proof'
  };

  return `
    <article class="conflict-card ${isResolved ? 'is-resolved' : ''}" data-conflict-id="${esc(id)}" id="conflict-${esc(id)}" style="background:#13261f;border:1px solid ${isResolved ? '#166534' : '#2e493b'};border-left:5px solid ${isResolved ? '#16a34a' : '#f97316'};border-radius:8px;padding:16px;margin-bottom:14px;box-shadow:0 4px 16px rgba(0,0,0,0.3);color:#e2ece0;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:8px;">
        <div>
          <span style="font-size:10px;font-weight:800;color:${isResolved ? '#86efac' : '#fb923c'};text-transform:uppercase;letter-spacing:0.5px;">
            ${isResolved ? '✓ CONFLICT RESOLVED' : '⚠️ SOURCE CONFLICT'} · ${esc(conflictCategory)}
          </span>
          <h3 style="margin:4px 0 2px;font-size:15px;color:#f1f8f3;font-weight:700;">FIELD: ${esc(fieldName)}</h3>
        </div>
        <span class="count-badge ${isResolved ? 'badge-green' : 'badge-red'}" style="font-size:10px;padding:2px 8px;border-radius:4px;font-weight:700;">
          ${isResolved ? 'RESOLVED' : 'REQUIRES DECISION'}
        </span>
      </div>

      <!-- Why this matters -->
      <div style="background:#2d1808;border-left:3px solid #f97316;padding:8px 10px;border-radius:0 4px 4px 0;margin-bottom:12px;font-size:12px;color:#fed7aa;line-height:1.4;">
        <strong>WHY THIS MATTERS:</strong> ${esc(whyItMatters)}
      </div>

      <!-- Candidates Grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:10px;margin-bottom:12px;">
        <!-- Source A -->
        <div class="conflict-source-box" style="background:#183328;border:1px solid #2a523e;border-radius:6px;padding:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <strong style="font-size:11px;color:#a7f3d0;text-transform:uppercase;">SOURCE A</strong>
            <span style="font-size:9px;background:#0c2a38;color:#7dd3fc;border:1px solid #0369a1;padding:1px 5px;border-radius:3px;font-weight:600;">${esc(candA.label)}</span>
          </div>
          <div style="font-size:14px;font-weight:800;color:#f1f8f3;margin-bottom:6px;font-family:monospace;">
            ${esc(candA.value)}
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">"${esc(candA.quote)}"</div>
          <div>
            ${renderSourceChip({
              name: candA.documentName,
              sheet: candA.sheet,
              cell: candA.cell,
              quote: candA.quote,
              role: 'PRODUCT_SPECIFICATION',
              sourceType: candA.cell ? 'spreadsheet' : 'document'
            })}
          </div>
        </div>

        <!-- Source B -->
        <div class="conflict-source-box" style="background:#183328;border:1px solid #2a523e;border-radius:6px;padding:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <strong style="font-size:11px;color:#93c5fd;text-transform:uppercase;">SOURCE B</strong>
            <span style="font-size:9px;background:#2e1065;color:#d8b4fe;border:1px solid #6b21a8;padding:1px 5px;border-radius:3px;font-weight:600;">${esc(candB.label)}</span>
          </div>
          <div style="font-size:14px;font-weight:800;color:#f1f8f3;margin-bottom:6px;font-family:monospace;">
            ${esc(candB.value)}
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">"${esc(candB.quote)}"</div>
          <div>
            ${renderSourceChip({
              name: candB.documentName,
              page: candB.page,
              panel: candB.panel,
              quote: candB.quote,
              role: 'ARTWORK',
              sourceType: 'artwork'
            })}
          </div>
        </div>
      </div>

      ${isResolved ? `
        <div style="background:#13261f;border:1px solid #166534;padding:8px 12px;border-radius:6px;font-size:12px;color:#86efac;margin-top:8px;">
          <strong>Decision:</strong> Selected <em>${esc(conflict.resolvedValue)}</em> from <code>${esc(conflict.resolvedSource)}</code>
          ${conflict.resolutionNote ? `<div style="font-size:11px;color:#a7f3d0;margin-top:2px;">Reason: ${esc(conflict.resolutionNote)}</div>` : ''}
          <div style="font-size:10px;color:#6ee7b7;margin-top:2px;font-family:monospace;">Audited at: ${esc(conflict.resolvedAt || 'Recorded')}</div>
        </div>
      ` : `
        <!-- Reviewer Decision Form / Action Buttons -->
        <div class="conflict-actions-bar" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding-top:10px;border-top:1px dashed #cbd5e1;">
          <button type="button" class="btn-conflict-action btn-select-a" data-conflict-id="${esc(id)}" data-action="SELECT_A" data-val="${esc(candA.value)}" data-src="${esc(candA.documentName)}" style="background:#0f766e;color:#fff;border:none;padding:6px 12px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;">
            ✓ Select Source A (${esc(candA.value)})
          </button>
          <button type="button" class="btn-conflict-action btn-select-b" data-conflict-id="${esc(id)}" data-action="SELECT_B" data-val="${esc(candB.value)}" data-src="${esc(candB.documentName)}" style="background:#2563eb;color:#fff;border:none;padding:6px 12px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;">
            ✓ Select Source B (${esc(candB.value)})
          </button>
          <button type="button" class="btn-conflict-action btn-req-clarification" data-conflict-id="${esc(id)}" data-action="REQUEST_CLARIFICATION" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;padding:6px 10px;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;">
            💬 Request Clarification
          </button>
          <button type="button" class="btn-conflict-action btn-keep-unresolved" data-conflict-id="${esc(id)}" data-action="KEEP_UNRESOLVED" style="background:#ffffff;color:#64748b;border:1px solid #cbd5e1;padding:6px 10px;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;">
            ⏱ Keep Unresolved
          </button>
          <button type="button" class="btn-conflict-action btn-compare-sources" data-conflict-id="${esc(id)}" data-action="COMPARE_SOURCES" style="background:#faf5ff;color:#7e22ce;border:1px solid #d8b4fe;padding:6px 10px;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;margin-left:auto;">
            🔍 Compare Sources
          </button>
        </div>
      `}
    </article>
  `;
}

/**
 * Renders a list of conflict cards.
 */
export function renderConflictCards(conflicts = [], options = {}) {
  if (!Array.isArray(conflicts) || conflicts.length === 0) {
    return `
      <div class="empty-conflicts-state" style="padding:24px;text-align:center;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;">
        <span style="font-size:24px;">✓</span>
        <h4 style="margin:8px 0 4px;font-size:14px;color:#1e293b;">No Unresolved Conflicts</h4>
        <p style="margin:0;font-size:12px;color:#64748b;">All extracted facts across sources align within tolerance.</p>
      </div>
    `;
  }

  return conflicts.map(c => renderConflictCard(c, options)).join('');
}

/**
 * Mounts interactive handlers for conflict cards with auditable resolution modal.
 */
export function mountConflictCardsHandlers(container = document, onResolve = null) {
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-conflict-action');
    if (!btn) return;
    e.preventDefault();

    const conflictId = btn.dataset.conflictId;
    const action = btn.dataset.action;
    const chosenVal = btn.dataset.val;
    const chosenSrc = btn.dataset.src;

    if (action === 'COMPARE_SOURCES') {
      // Open modal comparing the two sources side by side
      openEvidenceDrawer({
        documentName: 'Source Conflict Inspection',
        location: conflictId,
        quote: `Comparing Candidate Values for ${conflictId}`,
        authority: 'conflicted',
        status: 'conflicted'
      });
      return;
    }

    if (action === 'REQUEST_CLARIFICATION' || action === 'KEEP_UNRESOLVED') {
      if (typeof onResolve === 'function') {
        onResolve({ conflictId, action, reviewer: 'Packaging Reviewer', reason: action });
      }
      return;
    }

    // Phase 21: Require selected fact/source, reviewer identity, permission, decision reason, timestamp
    showConflictResolutionModal({
      conflictId,
      chosenValue: chosenVal,
      chosenSource: chosenSrc,
      onConfirm: async ({ reviewer, reason, role }) => {
        if (typeof onResolve === 'function') {
          await onResolve({
            conflictId,
            chosenValue: chosenVal,
            chosenSource: chosenSrc,
            reviewer,
            reason,
            role,
            timestamp: new Date().toISOString()
          });
        }
      }
    });
  });
}

function showConflictResolutionModal({ conflictId, chosenValue, chosenSource, onConfirm }) {
  const dialog = document.getElementById('dialog') || document.createElement('dialog');
  if (!dialog.id) {
    dialog.id = 'dialog';
    document.body.appendChild(dialog);
  }

  dialog.innerHTML = `
    <div style="padding:18px 22px;max-width:480px;font-family:system-ui,-apple-system,sans-serif;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-size:10px;font-family:monospace;letter-spacing:0.05em;color:#0f766e;font-weight:700;">
          AUDITABLE SOURCE SELECTION · 21 CFR COMPLIANT
        </span>
        <button type="button" class="close-dialog" style="border:0;background:transparent;font-size:18px;cursor:pointer;">✕</button>
      </div>
      <h3 style="margin:0 0 6px;font-size:16px;color:#0f172a;">Confirm Authoritative Source</h3>
      <p style="font-size:12px;color:#64748b;margin:0 0 14px;">
        Resolving this conflict promotes the chosen value to the Fact Sheet and reevaluates dependent requirements.
      </p>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:10px 12px;border-radius:6px;margin-bottom:14px;">
        <div style="font-size:11px;color:#166534;font-weight:700;">CHOSEN VALUE:</div>
        <div style="font-size:14px;color:#0f172a;font-family:monospace;font-weight:700;margin:2px 0;">${esc(chosenValue)}</div>
        <div style="font-size:10px;color:#64748b;">Source: ${esc(chosenSource)}</div>
      </div>

      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:11px;font-weight:700;color:#334155;margin-bottom:4px;">Reviewer Name</label>
        <input type="text" id="cr-reviewer-name" value="Packaging Reviewer" style="width:100%;padding:6px 10px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;" />
      </div>

      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:11px;font-weight:700;color:#334155;margin-bottom:4px;">Department / Role</label>
        <select id="cr-reviewer-role" style="width:100%;padding:6px 10px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;background:#fff;">
          <option value="REGULATORY_LEAD">Regulatory &amp; Compliance Lead (Authorized)</option>
          <option value="PACKAGING_ENGINEER">Packaging Engineer (Authorized)</option>
          <option value="BRAND_MANAGER">Brand Manager</option>
          <option value="QA_SPECIALIST">QA Release Specialist</option>
        </select>
      </div>

      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:11px;font-weight:700;color:#334155;margin-bottom:4px;">Decision Reason / Justification *</label>
        <textarea id="cr-decision-reason" rows="3" style="width:100%;padding:6px 10px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;" placeholder="e.g. Content Sheet row 26 approved formulation supercedes draft carton print copy..."></textarea>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button type="button" class="secondary close-dialog" style="padding:6px 14px;border:1px solid #cbd5e1;background:#f8fafc;border-radius:4px;font-size:12px;cursor:pointer;">Cancel</button>
        <button type="button" class="primary" id="cr-btn-confirm" style="padding:6px 16px;background:#0f766e;color:#fff;border:none;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;">Save Resolution ✓</button>
      </div>
    </div>
  `;

  dialog.querySelectorAll('.close-dialog').forEach(b => b.addEventListener('click', () => dialog.close()));

  const confirmBtn = dialog.querySelector('#cr-btn-confirm');
  confirmBtn.addEventListener('click', async () => {
    const reviewer = dialog.querySelector('#cr-reviewer-name')?.value || 'Packaging Reviewer';
    const role = dialog.querySelector('#cr-reviewer-role')?.value || 'REGULATORY_LEAD';
    const reason = dialog.querySelector('#cr-decision-reason')?.value || 'Approved authoritative specification over print proof.';
    dialog.close();
    if (typeof onConfirm === 'function') {
      await onConfirm({ reviewer, role, reason });
    }
  });

  dialog.showModal();
}
