/**
 * PackSignal — "Ask Someone" Clarification Assistant Modal
 * public/ask-someone.js
 *
 * Implements the interactive modal for preparing, editing, and copying
 * source-backed Slack & Teams clarification messages.
 */

import {
  DEPARTMENTS,
  suggestDepartment,
  generateClarificationMessage
} from './clarification-message.js';

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let activeFinding = null;
let activeReview = null;
let currentPlatform = 'slack';
let userHasEdited = false;
let previousActiveElement = null;

/**
 * Creates or retrieves the dedicated Ask Someone modal dialog element.
 */
function getOrCreateModal() {
  let modal = document.querySelector('#ask-someone-modal');
  if (!modal) {
    modal = document.createElement('dialog');
    modal.id = 'ask-someone-modal';
    modal.className = 'ask-someone-dialog';
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'ask-someone-title');
    document.body.appendChild(modal);

    modal.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeAskSomeoneModal();
    });

    modal.addEventListener('click', (e) => {
      // Close on backdrop click
      const rect = modal.getBoundingClientRect();
      const inDialog =
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width;
      if (!inDialog) {
        closeAskSomeoneModal();
      }
    });

    // Close on Escape key
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAskSomeoneModal();
      }
    });
  }
  return modal;
}

/**
 * Renders the modal inner content based on active finding & review.
 */
function renderModalContent(finding, review, selectedDept, platform) {
  const prodName = review?.options?.productVariant || review?.productName || 'Dancing Fish Berry Crunch';
  const autoDept = selectedDept || suggestDepartment(finding);

  const initialMessage = generateClarificationMessage({
    finding,
    product: prodName,
    department: autoDept,
    platform,
    reviewerContext: { reviewId: review?.id }
  });

  return `
    <div class="ask-someone-container" role="document">
      <!-- Modal Header -->
      <div class="ask-modal-header">
        <div>
          <div class="ask-eyebrow">PACKSIGNAL COMMUNICATION ASSISTANT</div>
          <h2 id="ask-someone-title" class="ask-title">💬 Ask Someone</h2>
        </div>
        <button type="button" class="ask-close-btn" data-ask-action="close" aria-label="Close clarification modal">✕</button>
      </div>

      <!-- Finding Context Strip -->
      <div class="ask-finding-strip">
        <div class="ask-strip-main">
          <span class="ask-status-badge ${esc(finding.status || 'review')}">${esc((finding.status || 'REVIEW').toUpperCase())}</span>
          <strong class="ask-finding-title">${esc(finding.title || 'Packaging Discrepancy')}</strong>
        </div>
        <div class="ask-strip-meta">
          <span>Product: <b>${esc(prodName)}</b></span>
          <span>Finding ID: <code>${esc(finding.id || 'N/A')}</code></span>
        </div>
      </div>

      <!-- Controls Grid -->
      <div class="ask-controls-grid">
        <!-- Department Selector -->
        <div class="ask-control-group">
          <label for="ask-dept-select" class="ask-label">Responsible Team / Department:</label>
          <select id="ask-dept-select" class="ask-select" data-ask-action="change-dept">
            ${DEPARTMENTS.map(d => `<option value="${esc(d)}" ${d === autoDept ? 'selected' : ''}>${esc(d)}</option>`).join('')}
          </select>
          <small class="ask-hint">Auto-routed from check category. You can adjust the recipient team.</small>
        </div>

        <!-- Platform Selector -->
        <div class="ask-control-group">
          <label class="ask-label">Communication Platform:</label>
          <div class="ask-platform-toggle" role="radiogroup" aria-label="Platform selection">
            <button type="button" class="ask-plat-btn ${platform === 'slack' ? 'active' : ''}" data-ask-platform="slack" aria-pressed="${platform === 'slack'}">
              <span class="plat-icon">💬</span> Slack
            </button>
            <button type="button" class="ask-plat-btn ${platform === 'teams' ? 'active' : ''}" data-ask-platform="teams" aria-pressed="${platform === 'teams'}">
              <span class="plat-icon">👥</span> Teams
            </button>
            <button type="button" class="ask-plat-btn ${platform === 'email' ? 'active' : ''}" data-ask-platform="email" aria-pressed="${platform === 'email'}">
              <span class="plat-icon">✉️</span> Email
            </button>
            <button type="button" class="ask-plat-btn ${platform === 'plain' ? 'active' : ''}" data-ask-platform="plain" aria-pressed="${platform === 'plain'}">
              <span class="plat-icon">📝</span> Plain Text
            </button>
          </div>
          <small class="ask-hint">Tailors bolding, bullet points, and headers for the chosen platform.</small>
        </div>
      </div>

      <!-- Message Editor & Preview -->
      <div class="ask-editor-section">
        <div class="ask-editor-header">
          <label for="ask-message-editor" class="ask-label">Message Preview &amp; Editor:</label>
          <button type="button" class="ask-reset-link" data-ask-action="reset-message" title="Revert to auto-generated template">↻ Reset to Template</button>
        </div>
        <textarea id="ask-message-editor" class="ask-message-textarea" rows="11" aria-label="Clarification message">${esc(initialMessage)}</textarea>
        <div class="ask-editor-footer">
          <small class="ask-security-notice">🔒 <b>Privacy Safe:</b> Local file paths and internal tokens are excluded. Message is not sent automatically.</small>
        </div>
      </div>

      <!-- Feedback Banner -->
      <div id="ask-copy-feedback" class="ask-copy-feedback" role="status" aria-live="polite" style="display:none;"></div>

      <!-- Action Footer -->
      <div class="ask-modal-footer">
        <button type="button" class="ask-btn-secondary" data-ask-action="close">Cancel</button>
        <button type="button" class="ask-btn-audit" data-ask-action="mark-requested" title="Log that clarification was initiated for this finding">
          📌 Mark Clarification Requested
        </button>
        <button type="button" class="ask-btn-primary" data-ask-action="copy">
          <span class="copy-icon">📋</span> Copy Message
        </button>
      </div>
    </div>
  `;
}

/**
 * Re-generates message in textarea without wiping unless requested.
 */
function updateMessagePreview(modal) {
  if (!activeFinding) return;
  const textarea = modal.querySelector('#ask-message-editor');
  if (!textarea) return;

  const deptSelect = modal.querySelector('#ask-dept-select');
  const selectedDept = deptSelect ? deptSelect.value : suggestDepartment(activeFinding);
  const prodName = activeReview?.options?.productVariant || activeReview?.productName || 'Dancing Fish Berry Crunch';

  const generated = generateClarificationMessage({
    finding: activeFinding,
    product: prodName,
    department: selectedDept,
    platform: currentPlatform,
    reviewerContext: { reviewId: activeReview?.id }
  });

  textarea.value = generated;
  userHasEdited = false;
}

/**
 * Copies the current editor text to clipboard with safe fallback.
 */
export async function copyClarificationMessage(modal) {
  const textarea = modal.querySelector('#ask-message-editor');
  if (!textarea) return;

  const textToCopy = textarea.value;
  const feedback = modal.querySelector('#ask-copy-feedback');
  const copyBtn = modal.querySelector('[data-ask-action="copy"]');

  let success = false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(textToCopy);
      success = true;
    } else {
      // Safe fallback
      textarea.select();
      textarea.setSelectionRange(0, 99999);
      success = document.execCommand('copy');
    }
  } catch (err) {
    success = false;
  }

  if (success) {
    if (feedback) {
      feedback.style.display = 'block';
      feedback.className = 'ask-copy-feedback success';
      feedback.textContent = '✓ Copied to clipboard! Ready to paste into Slack or Teams.';
    }
    if (copyBtn) {
      const orig = copyBtn.innerHTML;
      copyBtn.innerHTML = '<span>✓</span> Copied to clipboard';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.innerHTML = orig;
        copyBtn.classList.remove('copied');
      }, 3000);
    }
    // Record audit event asynchronously (does not resolve finding)
    recordClarificationEvent('MESSAGE_COPIED');
  } else {
    if (feedback) {
      feedback.style.display = 'block';
      feedback.className = 'ask-copy-feedback error';
      feedback.textContent = 'Clipboard access denied or unavailable. Please select the text above and copy manually (Ctrl/Cmd+C).';
    }
    textarea.focus();
    textarea.select();
  }
}

/**
 * Records an audited clarification event on the backend without changing
 * finding status or resolving the finding.
 */
async function recordClarificationEvent(statusAction, note = '') {
  if (!activeReview?.id || !activeFinding?.id) return;
  const deptSelect = document.querySelector('#ask-dept-select');
  const dept = deptSelect?.value || 'Other';

  try {
    const csrfToken = window.__PACKSIGNAL_CSRF ||
      (await fetch('/api/status').then(r => r.json()).then(s => s.csrf).catch(() => ''));

    await fetch(`/api/reviews/${activeReview.id}/findings/${activeFinding.id}/clarification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-packproof-token': csrfToken
      },
      body: JSON.stringify({
        department: dept,
        platform: currentPlatform,
        status: statusAction,
        note: note || `Clarification message generated for ${dept} via ${currentPlatform}.`
      })
    });
  } catch (err) {
    // Audit logging is non-blocking
  }
}

/**
 * Closes the Ask Someone modal and restores focus.
 */
export function closeAskSomeoneModal() {
  const modal = document.querySelector('#ask-someone-modal');
  if (modal && modal.open) {
    modal.close();
  }
  if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
    previousActiveElement.focus();
  }
}

/**
 * Opens the Ask Someone modal for a given finding and review context.
 */
export function openAskSomeoneModal(finding, review, preferredDept = null) {
  if (!finding) return;

  activeFinding = finding;
  activeReview = review;
  currentPlatform = 'slack';
  userHasEdited = false;
  previousActiveElement = document.activeElement;

  const modal = getOrCreateModal();
  const autoDept = preferredDept || suggestDepartment(finding);

  modal.innerHTML = renderModalContent(finding, review, autoDept, currentPlatform);

  // Wire event handlers inside modal
  modal.querySelector('[data-ask-action="close"]')?.addEventListener('click', closeAskSomeoneModal);

  modal.querySelector('#ask-dept-select')?.addEventListener('change', () => {
    updateMessagePreview(modal);
  });

  modal.querySelectorAll('[data-ask-platform]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const plat = e.currentTarget.dataset.askPlatform;
      if (plat && plat !== currentPlatform) {
        currentPlatform = plat;
        modal.querySelectorAll('[data-ask-platform]').forEach(b => {
          b.classList.toggle('active', b.dataset.askPlatform === plat);
          b.setAttribute('aria-pressed', b.dataset.askPlatform === plat);
        });
        updateMessagePreview(modal);
      }
    });
  });

  const textarea = modal.querySelector('#ask-message-editor');
  if (textarea) {
    textarea.addEventListener('input', () => {
      userHasEdited = true;
    });
  }

  modal.querySelector('[data-ask-action="reset-message"]')?.addEventListener('click', () => {
    updateMessagePreview(modal);
  });

  modal.querySelector('[data-ask-action="copy"]')?.addEventListener('click', () => {
    copyClarificationMessage(modal);
  });

  modal.querySelector('[data-ask-action="mark-requested"]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = '⏳ Recording…';
    await recordClarificationEvent('CLARIFICATION_REQUESTED_MANUALLY', 'Reviewer recorded that external clarification has been requested.');
    btn.textContent = '✓ Clarification Marked';
    const feedback = modal.querySelector('#ask-copy-feedback');
    if (feedback) {
      feedback.style.display = 'block';
      feedback.className = 'ask-copy-feedback success';
      feedback.textContent = 'Clarification request logged in review audit trail.';
    }
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = '📌 Mark Clarification Requested';
    }, 2500);
  });

  if (!modal.open) {
    modal.showModal();
  }

  // Focus management
  const firstFocus = modal.querySelector('#ask-dept-select');
  if (firstFocus) {
    firstFocus.focus();
  }

  // Record generation event
  recordClarificationEvent('MESSAGE_GENERATED');
}
