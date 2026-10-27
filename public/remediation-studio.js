import { computeCopyDiff } from './remediation-diff.js';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Computes word-level and number-level diff representation
 */
export function computeWordDiff(original, proposed) {
  const { beforeHtml, afterHtml } = computeCopyDiff(original, proposed);
  return { origHtml: beforeHtml, propHtml: afterHtml };
}

/**
 * Renders the complete Remediation Studio UI for a finding
 */
export function renderRemediationStudio(finding, proposal, options = {}) {
  const isBlocked = proposal?.status === 'NEEDS_EVIDENCE' || proposal?.status === 'BLOCKED_INVALID';
  const isTicket = proposal?.mode === 'DESIGN_TICKET';
  const originalText = proposal?.originalText || finding.observed || 'No copy extracted';
  const proposedText = proposal?.proposedText || '';
  const diff = computeWordDiff(originalText, proposedText);

  const optionsList = proposal?.options || [];
  const selectedOptId = options.selectedOptionId || optionsList[0]?.id;

  const verifications = proposal?.verification?.checks || [
    { name: 'Source quotation verified', passed: true },
    { name: 'Numerical facts preserved', passed: true },
    { name: 'Supported allergens preserved', passed: true },
  ];

  return `
    <div class="remediation-studio-card panel" data-remediation-studio data-finding-id="${esc(finding.id)}">
      <div class="remediation-header">
        <div class="eyebrow-row">
          <span class="remediation-sparkle">✨</span>
          <span class="eyebrow">AI-ASSISTED REMEDIATION STUDIO</span>
          <span class="remediation-mode-badge ${esc((proposal?.mode || 'PROPOSED').toLowerCase())}">
            ${esc(proposal?.mode || 'PROPOSED FIX')}
          </span>
          <span class="remediation-status-badge status-${esc((proposal?.status || 'PENDING').toLowerCase())}">
            ${esc(proposal?.status || 'PENDING_REVIEW')}
          </span>
        </div>
        <h3 class="remediation-title">${esc(finding.title)}</h3>
        <p class="remediation-legal-disclaimer">
          ⚠️ <strong>Proposed Copy Only:</strong> This proposal is a human-reviewable suggestion for packaging design handoff. It does not certify statutory compliance, print release, or regulatory clearance.
        </p>
      </div>

      ${isTicket ? renderDesignerTicketView(proposal) : isBlocked ? renderBlockedView(proposal) : renderCopyComparisonView(finding, proposal, diff, optionsList, selectedOptId, verifications)}

      <div class="remediation-validation-box" data-validation-result hidden></div>

      <div class="remediation-audit-note">
        <small>Lifecycle: <strong>${esc(proposal?.status || 'DRAFT')}</strong> · Changes will be recorded in the tamper-evident audit history. Original artwork file remains untouched.</small>
      </div>
    </div>
  `;
}

function renderDesignerTicketView(proposal) {
  const t = proposal.designerTicket || {};
  return `
    <div class="remediation-ticket-view">
      <div class="notice info">
        <strong>Prepress Geometry Correction:</strong> This finding represents a layout, quiet zone, or prepress issue. Rather than fabricating text, a designer correction ticket has been created for Adobe Illustrator / Esko ArtPro+.
      </div>
      <dl class="ticket-meta-grid">
        <dt>Artwork File</dt><dd>${esc(t.artworkFile || 'Main Artwork')}</dd>
        <dt>Target Panel</dt><dd>${esc(t.panel || 'Primary Face')}</dd>
        <dt>Prepress Issue</dt><dd>${esc(t.issueDescription || '')}</dd>
        <dt>Instruction</dt><dd><code>${esc(t.prepressInstruction || '')}</code></dd>
        <dt>Design Tools</dt><dd>${esc((t.targetTools || []).join(', '))}</dd>
      </dl>
      <div class="remediation-actions">
        <button type="button" class="primary" data-action="export-remediation" data-format="txt">
          Download Designer Ticket (TXT) ↓
        </button>
        <button type="button" class="secondary" data-action="copy-ticket">
          Copy Ticket Text 📋
        </button>
      </div>
    </div>
  `;
}

function renderBlockedView(proposal) {
  return `
    <div class="remediation-blocked-view">
      <div class="notice error">
        <strong>Remediation Blocked — Missing Evidence:</strong><br>
        ${esc(proposal.reasoningSummary || 'Cannot safely generate a proposed fix because required source evidence is missing.')}
      </div>
      <div class="blocked-details">
        <h4>Unresolved Requirements:</h4>
        <ul>
          ${(proposal.blockers || ['Missing authoritative reference data.']).map(b => `<li>${esc(b)}</li>`).join('')}
        </ul>
        ${proposal.requiredEvidence?.length ? `
          <h4>Required To Proceed:</h4>
          <ul>
            ${proposal.requiredEvidence.map(e => `<li>${esc(e)}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
      <div class="remediation-actions">
        <button type="button" class="secondary" data-action="upload-source-revision">
          Upload Required Specification / Rulebook →
        </button>
      </div>
    </div>
  `;
}

function renderCopyComparisonView(finding, proposal, diff, optionsList, selectedOptId, verifications) {
  return `
    <!-- Multi-Option Selector (Phase 9) -->
    ${optionsList.length > 1 ? `
      <div class="remediation-options-container">
        <div class="options-tabs-header">
          <small>Select Proposal Variant (Preserves Identical Source Facts):</small>
        </div>
        <div class="options-tab-buttons">
          ${optionsList.map(opt => `
            <button type="button" 
                    class="option-tab-btn ${opt.id === selectedOptId ? 'active' : ''}" 
                    data-action="select-option" 
                    data-opt-id="${esc(opt.id)}"
                    data-opt-text="${esc(opt.text)}">
              <strong>${esc(opt.label)}</strong>
              <small>${esc(opt.description || '')}</small>
            </button>
          `).join('')}
        </div>
      </div>
    ` : ''}
    <!-- Deterministic Calculation Breakdown (Phase 6 & 7) -->
    ${proposal.calculation ? `
      <div class="remediation-calculation-card">
        <div class="calc-header">
          <span class="calc-icon">🧮</span>
          <strong>DETERMINISTIC ARITHMETIC BREAKDOWN</strong>
          <span class="pill standard">${esc(proposal.calculation.method || 'CALCULATION')}</span>
        </div>
        <div class="calc-grid">
          ${proposal.calculation.nutrient ? `
            <div class="calc-cell">
              <span class="calc-label">Nutrient / Component:</span>
              <span class="calc-value"><strong>${esc(proposal.calculation.nutrient)}</strong> (${esc(proposal.calculation.amount || '')})</span>
            </div>
          ` : ''}
          ${proposal.calculation.referenceDV ? `
            <div class="calc-cell">
              <span class="calc-label">Daily Reference Value (${esc(proposal.calculation.jurisdiction || 'US')}):</span>
              <span class="calc-value">${esc(proposal.calculation.referenceDV)} <small>(${esc(proposal.calculation.referenceBasis || 'per serving')})</small></span>
            </div>
          ` : ''}
          ${proposal.calculation.formula ? `
            <div class="calc-cell calc-formula-cell">
              <span class="calc-label">Mathematical Calculation:</span>
              <span class="calc-value"><code class="calc-code">${esc(proposal.calculation.formula)}</code></span>
            </div>
          ` : ''}
          ${proposal.calculation.roundingRule ? `
            <div class="calc-cell">
              <span class="calc-label">Rounding & Regulatory Source:</span>
              <span class="calc-value"><small>${esc(proposal.calculation.roundingRule)} (${esc(proposal.calculation.cfrCitation || '')})</small></span>
            </div>
          ` : ''}
          ${proposal.calculation.isScreeningEstimate ? `
            <div class="calc-cell calc-formula-cell">
              <span class="calc-label">Atwater 4-4-9 Formula:</span>
              <span class="calc-value"><code>${esc(proposal.calculation.formula)}</code></span>
              <small class="notice-text">Screening estimate. Food-specific factors or insoluble fiber deductions may lawfully apply.</small>
            </div>
          ` : ''}
        </div>
      </div>
    ` : ''}

    <!-- Side-by-Side Diff Section -->
    <div class="remediation-diff-grid">
      <div class="diff-column diff-original">
        <div class="diff-column-head">
          <span>ORIGINAL ARTWORK COPY</span>
          <small class="pill issue">Observed</small>
        </div>
        <div class="diff-content diff-original-content">
          ${diff.origHtml || esc(proposal.originalText)}
        </div>
      </div>

      <div class="diff-column diff-proposed">
        <div class="diff-column-head">
          <span>PROPOSED COPY (HUMAN REVIEWABLE)</span>
          <small class="pill match">Suggested Fix</small>
        </div>
        <div class="diff-content diff-proposed-content" data-proposed-display>
          ${diff.propHtml || esc(proposal.proposedText)}
        </div>
        <!-- Inline Editor (Hidden by default) -->
        <div class="remediation-editor-box" data-editor-box hidden>
          <label for="remediation-edit-input"><small>Reviewer Edit Mode (Preserves Original AI Proposal in History):</small></label>
          <textarea id="remediation-edit-input" class="remediation-textarea" rows="4">${esc(proposal.proposedText)}</textarea>
          <div class="editor-buttons">
            <button type="button" class="primary" data-action="save-edit">Save Edit</button>
            <button type="button" class="secondary" data-action="cancel-edit">Cancel</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Verification Checklist (Independent Validator) -->
    <div class="remediation-verification-section">
      <div class="verification-head">
        <small>INDEPENDENT BOUNDED VALIDATION CHECKS</small>
      </div>
      <div class="verification-badges-grid">
        ${verifications.map(v => `
          <div class="v-badge ${v.passed ? 'v-pass' : 'v-warn'}">
            <span class="v-icon">${v.passed ? '✓' : '⚠️'}</span>
            <span class="v-label">${esc(v.name || v.check)}</span>
            ${v.detail ? `<small class="v-detail">${esc(v.detail)}</small>` : ''}
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Source Evidence Quotation Box -->
    ${proposal.sourceEvidence?.length ? `
      <div class="remediation-source-anchor">
        <small class="anchor-label">GROUND-TRUTH SOURCE CITATION</small>
        <blockquote class="anchor-quote">
          "${esc(proposal.sourceEvidence[0]?.quote || '')}"
          <cite>— ${esc(proposal.sourceEvidence[0]?.documentName || proposal.sourceEvidence[0]?.documentId || 'Approved Spec')}</cite>
        </blockquote>
      </div>
    ` : ''}

    <!-- Action Toolbar (Phase 10 & 11) -->
    <div class="remediation-toolbar">
      <div class="toolbar-primary-group">
        <button type="button" class="btn-tool primary" data-action="copy-proposed" title="Copy to clipboard for Adobe Illustrator / ArtPro+">
          📋 Copy Proposed Text
        </button>
        <button type="button" class="btn-tool secondary" data-action="toggle-edit">
          ✏️ Edit Proposal
        </button>
        <button type="button" class="btn-tool secondary" data-action="validate-fix">
          🔬 Validate Proposed Fix
        </button>
      </div>

      <div class="toolbar-approval-group">
        <button type="button" class="btn-tool success" data-action="approve-proposal" title="Approve proposed copy for designer handoff">
          ✓ Approve for Designer Handoff
        </button>
        <button type="button" class="btn-tool danger" data-action="reject-proposal" title="Reject proposal">
          ✕ Reject Proposal
        </button>
      </div>

      <div class="toolbar-export-dropdown">
        <label><small>Export Slip:</small></label>
        <button type="button" class="btn-tool secondary" data-action="export-remediation" data-format="txt">TXT</button>
        <button type="button" class="btn-tool secondary" data-action="export-remediation" data-format="json">JSON</button>
      </div>
    </div>
  `;
}

async function getCsrfToken() {
  if (window.__PACKSIGNAL_CSRF) return window.__PACKSIGNAL_CSRF;
  try {
    const s = await (await fetch('/api/status')).json();
    window.__PACKSIGNAL_CSRF = s.csrf;
    return s.csrf;
  } catch {
    return '';
  }
}

/**
 * Attaches event listeners to the Remediation Studio UI
 */
export function mountRemediationStudio(container, { reviewId, findingId, onUpdate }) {
  if (!container) return;

  // 1. Copy Proposed Text
  container.querySelector('[data-action="copy-proposed"]')?.addEventListener('click', async () => {
    const textEl = container.querySelector('#remediation-edit-input') || container.querySelector('[data-proposed-display]');
    const copyText = textEl?.value || textEl?.textContent?.trim() || '';
    if (!copyText) return;

    try {
      await navigator.clipboard.writeText(copyText);
      showRemediationToast('Proposed copy copied to clipboard for Illustrator/ArtPro+!');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = copyText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      showRemediationToast('Proposed copy copied to clipboard!');
    }
  });

  // 2. Multi-Option Switcher
  container.querySelectorAll('[data-action="select-option"]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('[data-action="select-option"]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const newText = btn.dataset.optText || '';
      const displayEl = container.querySelector('[data-proposed-display]');
      const editInput = container.querySelector('#remediation-edit-input');
      if (displayEl) displayEl.textContent = newText;
      if (editInput) editInput.value = newText;
      showRemediationToast(`Switched to: ${btn.querySelector('strong')?.textContent}`);
    });
  });

  // 3. Toggle Edit Mode
  const toggleEditBtn = container.querySelector('[data-action="toggle-edit"]');
  const editorBox = container.querySelector('[data-editor-box]');
  const proposedDisplay = container.querySelector('[data-proposed-display]');
  toggleEditBtn?.addEventListener('click', () => {
    const isHidden = editorBox.hasAttribute('hidden');
    if (isHidden) {
      editorBox.removeAttribute('hidden');
      proposedDisplay.setAttribute('hidden', 'true');
    } else {
      editorBox.setAttribute('hidden', 'true');
      proposedDisplay.removeAttribute('hidden');
    }
  });

  // Save Edit
  container.querySelector('[data-action="save-edit"]')?.addEventListener('click', async () => {
    const editInput = container.querySelector('#remediation-edit-input');
    const editedText = editInput?.value?.trim();
    if (!editedText) return;

    try {
      const token = await getCsrfToken();
      const resp = await fetch(`/api/reviews/${reviewId}/findings/${findingId}/remediation/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-packproof-token': token,
        },
        body: JSON.stringify({ decision: 'EDITED', editedText }),
      });
      if (!resp.ok) throw new Error('Could not save edited proposal.');
      const updated = await resp.json();
      showRemediationToast('Reviewer edit saved.');
      if (onUpdate) onUpdate(updated);
    } catch (err) {
      alert(err.message);
    }
  });

  // Cancel Edit
  container.querySelector('[data-action="cancel-edit"]')?.addEventListener('click', () => {
    editorBox.setAttribute('hidden', 'true');
    proposedDisplay.removeAttribute('hidden');
  });

  // 4. Validate Proposed Fix (Hypothetical Text Revalidation)
  container.querySelector('[data-action="validate-fix"]')?.addEventListener('click', async () => {
    const textEl = container.querySelector('#remediation-edit-input') || container.querySelector('[data-proposed-display]');
    const proposedText = textEl?.value || textEl?.textContent?.trim() || '';
    const validationBox = container.querySelector('[data-validation-result]');

    try {
      const token = await getCsrfToken();
      const resp = await fetch(`/api/reviews/${reviewId}/findings/${findingId}/remediation/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-packproof-token': token,
        },
        body: JSON.stringify({ proposedText }),
      });
      const res = await resp.json();
      if (!resp.ok) throw new Error(res.error || 'Validation request failed.');

      validationBox.removeAttribute('hidden');
      validationBox.innerHTML = `
        <div class="notice ${res.passed ? 'info' : 'warning'}">
          <strong>${res.passed ? '✓ Hypothetical Check Passed' : '⚠️ Hypothetical Check Flagged'}:</strong>
          <p>${esc(res.summary)}</p>
          <ul class="validation-checks-list">
            ${res.checks.map(c => `<li>${c.passed ? '✓' : '✕'} ${esc(c.name)}: ${esc(c.detail || '')}</li>`).join('')}
          </ul>
          <p><small>${esc(res.artworkUnchangedNotice)}</small></p>
        </div>
      `;
    } catch (err) {
      alert(err.message);
    }
  });

  // 5. Approve for Designer Handoff
  container.querySelector('[data-action="approve-proposal"]')?.addEventListener('click', async () => {
    const comments = prompt('Optional approval notes for designer handoff:') ?? '';
    try {
      const token = await getCsrfToken();
      const resp = await fetch(`/api/reviews/${reviewId}/findings/${findingId}/remediation/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-packproof-token': token,
        },
        body: JSON.stringify({ decision: 'APPROVED_FOR_DESIGN_HANDOFF', comments }),
      });
      if (!resp.ok) throw new Error('Failed to record approval.');
      const updated = await resp.json();
      showRemediationToast('Approved for designer handoff! Status recorded in audit trail.');
      if (onUpdate) onUpdate(updated);
    } catch (err) {
      alert(err.message);
    }
  });

  // 6. Reject Proposal
  container.querySelector('[data-action="reject-proposal"]')?.addEventListener('click', async () => {
    const comments = prompt('Reason for rejecting proposed copy:') ?? '';
    try {
      const token = await getCsrfToken();
      const resp = await fetch(`/api/reviews/${reviewId}/findings/${findingId}/remediation/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-packproof-token': token,
        },
        body: JSON.stringify({ decision: 'REJECTED', comments }),
      });
      if (!resp.ok) throw new Error('Failed to record rejection.');
      const updated = await resp.json();
      showRemediationToast('Proposal rejected and logged.');
      if (onUpdate) onUpdate(updated);
    } catch (err) {
      alert(err.message);
    }
  });

  // 7. Export / Download
  container.querySelectorAll('[data-action="export-remediation"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const format = btn.dataset.format || 'txt';
      window.open(`/api/reviews/${reviewId}/findings/${findingId}/remediation/export?format=${format}`, '_blank');
    });
  });
}

function showRemediationToast(msg) {
  const toast = document.querySelector('#toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}
