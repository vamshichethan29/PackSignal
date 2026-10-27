/**
 * PackSignal — Quick Triage Keyboard Controller & Workflow
 * Superhuman-style high-speed packaging review.
 * 
 * Target Shortcuts:
 * J — Next finding
 * K — Previous finding
 * 1 — Accept / Acknowledge finding
 * 2 — Flag for Remedy
 * 3 — Needs Evidence
 * 4 — Skip for Now
 * ? — Open keyboard shortcut reference
 * Esc — Close shortcut help or active triage dialog / composer
 */

/**
 * Pure testable shortcut interpreter.
 * Returns an action identifier or 'IGNORE'.
 */
export function interpretTriageShortcut(event, context = {}) {
  if (!event || typeof event !== 'object') return 'IGNORE';

  // 1. Modifiers check: never intercept Cmd/Ctrl/Alt combinations
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return 'IGNORE';
  }

  // 2. IME Composition check
  if (event.isComposing) {
    return 'IGNORE';
  }

  const target = event.target;
  const isEditable = target && (
    ['input', 'textarea', 'select'].includes(target.tagName?.toLowerCase()) ||
    target.isContentEditable ||
    (typeof target.closest === 'function' && (
      target.closest('[contenteditable="true"]') ||
      target.closest('.monaco-editor') ||
      target.closest('.team-form') ||
      target.closest('#decision-form') ||
      target.closest('#source-form')
    ))
  );

  const key = event.key;
  const lowerKey = typeof key === 'string' ? key.toLowerCase() : '';

  // 3. If focus is inside an editable input
  if (isEditable) {
    // Only Escape can close a composer or modal from an input
    if (key === 'Escape') {
      if (context.isComposerOpen) return 'CANCEL_COMPOSER';
      if (context.isHelpOpen) return 'CLOSE_HELP';
      return 'ESCAPE';
    }
    // Enter key inside triage composer (without shift) submits the composer
    if (key === 'Enter' && !event.shiftKey && context.isComposerOpen && target.closest?.('.triage-composer')) {
      return 'SUBMIT_COMPOSER';
    }
    return 'IGNORE';
  }

  // 4. Modal suppression: if an unrelated blocking modal is open
  if (context.isModalOpen && !context.isComposerOpen && !context.isHelpOpen) {
    if (key === 'Escape') return 'CLOSE_MODAL';
    return 'IGNORE';
  }

  // 5. If Shortcut Help is open
  if (context.isHelpOpen) {
    if (key === 'Escape' || key === '?') return 'CLOSE_HELP';
    return 'IGNORE';
  }

  // 6. If Triage Composer is open
  if (context.isComposerOpen) {
    if (key === 'Escape') return 'CANCEL_COMPOSER';
    return 'IGNORE';
  }

  // 7. Active Workspace Scoping: Quick Triage only active when findings workspace is active
  if (context.tab && context.tab !== 'findings') {
    return 'IGNORE';
  }

  // 8. Prevent duplicate rapid writes on held/repeated keys
  if (event.repeat && ['1', '2', '3', '4'].includes(key)) {
    return 'IGNORE';
  }

  // 9. Match triage actions
  if (lowerKey === 'j') return 'NAVIGATE_NEXT';
  if (lowerKey === 'k') return 'NAVIGATE_PREVIOUS';
  if (key === '1') return 'ACCEPT';
  if (key === '2') return 'FLAG_REMEDY';
  if (key === '3') return 'NEEDS_EVIDENCE';
  if (key === '4') return 'SKIP';
  if (key === '?') return 'OPEN_HELP';
  if (key === 'Escape') return 'ESCAPE';

  return 'IGNORE';
}

/**
 * Finding Navigation Algorithm.
 * Pure function that determines next/previous finding respecting boundaries.
 */
export function getNavigatedFinding(visibleFindings = [], currentFindingId, direction = 1) {
  if (!Array.isArray(visibleFindings) || visibleFindings.length === 0) {
    return { finding: null, findingId: null, index: -1, isStart: true, isEnd: true, total: 0 };
  }

  const total = visibleFindings.length;
  if (total === 1) {
    const f = visibleFindings[0];
    const id = f.id || f;
    return { finding: f, findingId: id, index: 0, isStart: true, isEnd: true, total: 1 };
  }

  const currentIndex = visibleFindings.findIndex(f => (f.id || f) === currentFindingId);

  if (direction > 0) {
    // Navigate Next (J)
    if (currentIndex === -1) {
      const f = visibleFindings[0];
      return { finding: f, findingId: f.id || f, index: 0, isStart: true, isEnd: false, total };
    }
    if (currentIndex >= total - 1) {
      // Reached boundary: stay on last finding
      const f = visibleFindings[total - 1];
      return { finding: f, findingId: f.id || f, index: total - 1, isStart: false, isEnd: true, total, hitBoundary: true };
    }
    const nextIndex = currentIndex + 1;
    const f = visibleFindings[nextIndex];
    return { finding: f, findingId: f.id || f, index: nextIndex, isStart: false, isEnd: nextIndex === total - 1, total };
  } else {
    // Navigate Previous (K)
    if (currentIndex <= 0) {
      // Reached boundary: stay on first finding
      const f = visibleFindings[0];
      return { finding: f, findingId: f.id || f, index: 0, isStart: true, isEnd: false, total, hitBoundary: true };
    }
    const prevIndex = currentIndex - 1;
    const f = visibleFindings[prevIndex];
    return { finding: f, findingId: f.id || f, index: prevIndex, isStart: prevIndex === 0, isEnd: false, total };
  }
}

/**
 * Session Progress Tracker.
 */
export class QuickTriageSession {
  constructor() {
    this.reset();
  }

  reset() {
    this.sessionStart = new Date().toISOString();
    this.decisionsCount = 0;
    this.acknowledgedCount = 0;
    this.flaggedCount = 0;
    this.needsEvidenceCount = 0;
    this.skippedCount = 0;
    this.skippedFindingIds = new Set();
    this.reviewedFindingIds = new Set();
    this.inFlightFindingId = null;
    this.lastAction = null;
  }

  recordDecision(findingId, disposition) {
    this.decisionsCount++;
    this.reviewedFindingIds.add(findingId);
    this.skippedFindingIds.delete(findingId);
    if (disposition === 'acknowledged') this.acknowledgedCount++;
    else if (disposition === 'needs_changes') this.flaggedCount++;
    else if (disposition === 'needs_evidence') this.needsEvidenceCount++;
    this.lastAction = { findingId, disposition, timestamp: new Date().toISOString() };
  }

  recordSkip(findingId) {
    this.skippedCount++;
    this.skippedFindingIds.add(findingId);
    this.lastAction = { findingId, action: 'skip', timestamp: new Date().toISOString() };
  }

  getProgress(visibleFindings = [], reviewDecisions = {}) {
    const total = visibleFindings.length;
    let persistedCount = 0;
    let ack = 0;
    let flag = 0;
    let evidence = 0;

    for (const f of visibleFindings) {
      const dec = reviewDecisions[f.id];
      if (dec && !dec.stale && dec.disposition && dec.disposition !== 'open') {
        persistedCount++;
        if (dec.disposition === 'acknowledged') ack++;
        else if (dec.disposition === 'needs_changes') flag++;
        else if (dec.disposition === 'needs_evidence') evidence++;
      }
    }

    return {
      total,
      reviewed: persistedCount,
      remaining: Math.max(0, total - persistedCount),
      acknowledged: ack,
      flagged: flag,
      needsEvidence: evidence,
      skipped: this.skippedFindingIds.size,
      sessionDecisions: this.decisionsCount,
    };
  }
}

/**
 * Mounts Quick Triage UI & Global Keyboard Listener.
 */
export function mountQuickTriage({
  getReview,
  getVisibleFindings,
  getSelectedFindingId,
  selectFinding,
  getPermissions,
  saveDecision,
  announce = () => {},
  openEvidence = () => {},
  showFeedback = () => {},
  onSessionUpdate = () => {}
}) {
  let session = new QuickTriageSession();
  let isComposerOpen = false;
  let isHelpOpen = false;
  let activeComposerAction = null; // 'flag' or 'evidence'
  let activeComposerFindingId = null;
  let inFlight = false;

  // Root container in DOM
  let toolbarElement = null;
  let composerElement = null;
  let helpElement = null;

  function getContext() {
    const r = getReview();
    const perms = typeof getPermissions === 'function' ? getPermissions() : { canReview: true };
    const visible = typeof getVisibleFindings === 'function' ? getVisibleFindings() : [];
    const dialogElem = document.getElementById('dialog');
    const isModalOpen = (dialogElem && dialogElem.open) || false;

    return {
      tab: 'findings',
      isModalOpen,
      isComposerOpen,
      isHelpOpen,
      canReview: perms.canReview !== false,
      selectedFindingId: getSelectedFindingId(),
      findingsCount: visible.length,
    };
  }

  function renderToolbar() {
    const mount = document.getElementById('quick-triage-mount');
    if (!mount) return;

    const visible = getVisibleFindings ? getVisibleFindings() : [];
    const r = getReview();
    const currentId = getSelectedFindingId();
    const currentIndex = visible.findIndex(f => f.id === currentId);
    const progress = session.getProgress(visible, r?.decisions || {});
    const perms = typeof getPermissions === 'function' ? getPermissions() : { canReview: true };
    const canReview = perms.canReview !== false;

    const countText = visible.length > 0
      ? `${currentIndex >= 0 ? currentIndex + 1 : 1} of ${visible.length} Findings`
      : '0 Findings';

    const html = `
      <div class="quick-triage-toolbar" role="region" aria-label="Quick Triage Keyboard Controls">
        <div class="triage-header">
          <div class="triage-title-group">
            <span class="triage-badge">⚡ QUICK TRIAGE</span>
            <span class="triage-counter" id="triage-counter">${countText}</span>
          </div>
          <div class="triage-stats-pill" title="Triage decisions recorded in this review session">
            <span>Reviewed: <b>${progress.reviewed} / ${progress.total}</b></span>
            <span>·</span>
            <span class="stat-flag">Remedy: <b>${progress.flagged}</b></span>
            <span>·</span>
            <span class="stat-evidence">Evidence: <b>${progress.needsEvidence}</b></span>
            <span>·</span>
            <span class="stat-ack">Ack: <b>${progress.acknowledged}</b></span>
            ${progress.skipped > 0 ? `<span>·</span><span class="stat-skip">Skipped: <b>${progress.skipped}</b></span>` : ''}
          </div>
        </div>

        <div class="triage-actions" role="toolbar" aria-label="Triage Navigation and Decisions">
          <div class="triage-nav-group">
            <button type="button" class="triage-btn triage-nav" data-triage-action="prev" title="Previous finding (K)" aria-keyshortcuts="k">
              <kbd>K</kbd> Prev
            </button>
            <button type="button" class="triage-btn triage-nav" data-triage-action="next" title="Next finding (J)" aria-keyshortcuts="j">
              <kbd>J</kbd> Next
            </button>
          </div>

          <div class="triage-decision-group">
            <button type="button" class="triage-btn triage-accept" data-triage-action="1" title="Accept / Acknowledge finding (1)" aria-keyshortcuts="1" ${!canReview ? 'disabled title="Read-only: sign-offs not assigned to your account"' : ''}>
              <kbd>1</kbd> Accept / Acknowledge
            </button>
            <button type="button" class="triage-btn triage-flag" data-triage-action="2" title="Flag for Remedy (2)" aria-keyshortcuts="2" ${!canReview ? 'disabled title="Read-only: sign-offs not assigned to your account"' : ''}>
              <kbd>2</kbd> Flag for Remedy
            </button>
            <button type="button" class="triage-btn triage-evidence" data-triage-action="3" title="Needs Evidence (3)" aria-keyshortcuts="3" ${!canReview ? 'disabled title="Read-only: sign-offs not assigned to your account"' : ''}>
              <kbd>3</kbd> Needs Evidence
            </button>
            <button type="button" class="triage-btn triage-skip" data-triage-action="4" title="Skip for Now without recording decision (4)" aria-keyshortcuts="4">
              <kbd>4</kbd> Skip
            </button>
          </div>

          <div class="triage-help-group">
            <button type="button" class="triage-btn triage-help-trigger" data-triage-action="help" title="Keyboard Shortcuts Reference (?)" aria-keyshortcuts="?">
              <kbd>?</kbd> Help
            </button>
          </div>
        </div>

        ${!canReview ? '<div class="triage-read-only-banner">ℹ️ Read-only mode: Keyboard navigation (J/K/4) is enabled, but submitting decisions (1/2/3) requires an authorized reviewer account.</div>' : ''}
      </div>
    `;

    mount.innerHTML = html;
    toolbarElement = mount.firstElementChild;
    onSessionUpdate(progress);
  }

  function openComposer(actionType, finding) {
    if (!finding) return;
    isComposerOpen = true;
    activeComposerAction = actionType;
    activeComposerFindingId = finding.id;

    let existing = document.getElementById('quick-triage-composer-container');
    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'quick-triage-composer-container';
      document.body.appendChild(existing);
    }
    composerElement = existing;

    const isRemedy = actionType === 'flag';
    const title = isRemedy ? 'Flag for Remedy (Request Correction)' : 'Needs Additional Evidence';
    const placeholder = isRemedy
      ? 'Explain the defect or required artwork modification (e.g. Correct net weight to 750 g on back panel)...'
      : 'Explain what evidence or source specification is missing (e.g. Missing signed nutritional specification)...';

    composerElement.innerHTML = `
      <div class="triage-composer-backdrop" data-triage-close="true">
        <div class="triage-composer" role="dialog" aria-modal="true" aria-labelledby="triage-composer-title">
          <div class="triage-composer-header ${isRemedy ? 'remedy' : 'evidence'}">
            <span class="triage-composer-icon">${isRemedy ? '⚠️' : '🔍'}</span>
            <div>
              <h3 id="triage-composer-title">${title}</h3>
              <p class="triage-composer-finding-title">${finding.title || finding.id}</p>
            </div>
            <button type="button" class="triage-composer-close" data-triage-close="true" aria-label="Close (Esc)">✕</button>
          </div>

          <form id="triage-composer-form" class="triage-composer-body">
            ${!isRemedy ? `
              <div class="triage-field">
                <label for="triage-evidence-type">Missing Evidence Type</label>
                <select id="triage-evidence-type" name="requestedEvidenceType">
                  <option value="Product Specification Sheet">Product Specification Sheet</option>
                  <option value="Nutritional Analysis / Lab Certificate">Nutritional Analysis / Lab Certificate</option>
                  <option value="Statutory Legal Gazette / Regulatory Rulebook">Statutory Legal Gazette / Regulatory Rulebook</option>
                  <option value="GS1 Barcode Verification Report">GS1 Barcode Verification Report</option>
                  <option value="Approved Brand Packaging Copy Sheet">Approved Brand Packaging Copy Sheet</option>
                  <option value="Other Evidence">Other Evidence</option>
                </select>
              </div>
            ` : ''}

            <div class="triage-field">
              <label for="triage-note-input">${isRemedy ? 'Reason for Remedy (3–2,000 chars)' : 'Evidence Request Detail (3–2,000 chars)'}</label>
              <textarea id="triage-note-input" name="note" required minlength="3" maxlength="2000" rows="4" placeholder="${placeholder}"></textarea>
            </div>

            <p id="triage-composer-error" class="triage-error" role="alert" style="display:none;"></p>

            <div class="triage-composer-footer">
              <span class="triage-shortcut-hint"><kbd>Enter</kbd> to save & advance · <kbd>Esc</kbd> to cancel</span>
              <div class="triage-composer-buttons">
                <button type="button" class="triage-secondary-btn" data-triage-close="true">Cancel (Esc)</button>
                <button type="submit" class="triage-primary-btn" id="triage-composer-submit">
                  ${isRemedy ? 'Flag & Next Finding' : 'Request Evidence & Next'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    const textarea = composerElement.querySelector('#triage-note-input');
    if (textarea) {
      setTimeout(() => textarea.focus(), 50);
    }

    // Attach form handler
    const form = composerElement.querySelector('#triage-composer-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitComposer();
    });

    // Close on backdrop click
    composerElement.addEventListener('click', (e) => {
      if (e.target.dataset.triageClose) {
        closeComposer();
      }
    });
  }

  function closeComposer() {
    isComposerOpen = false;
    activeComposerAction = null;
    activeComposerFindingId = null;
    if (composerElement) {
      composerElement.innerHTML = '';
    }
  }

  async function submitComposer() {
    if (!composerElement || inFlight) return;
    const noteInput = composerElement.querySelector('#triage-note-input');
    const errElem = composerElement.querySelector('#triage-composer-error');
    const submitBtn = composerElement.querySelector('#triage-composer-submit');
    const evidenceTypeInput = composerElement.querySelector('#triage-evidence-type');

    const note = noteInput?.value?.trim() || '';
    if (note.length < 3) {
      if (errElem) {
        errElem.textContent = 'Please enter a note of at least 3 characters.';
        errElem.style.display = 'block';
      }
      return;
    }

    const disposition = activeComposerAction === 'flag' ? 'needs_changes' : 'needs_evidence';
    const requestedEvidenceType = evidenceTypeInput?.value || null;
    const findingId = activeComposerFindingId;

    try {
      inFlight = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
      }

      await saveDecision({
        findingId,
        disposition,
        note,
        requestedEvidenceType
      });

      session.recordDecision(findingId, disposition);
      const actionName = disposition === 'needs_changes' ? 'Flagged for remedy' : 'Evidence requested';
      showFeedback(`Saved: ${actionName}. Original engine result preserved.`, 'success');
      announce(`Decision recorded: ${actionName}. Advancing to next finding.`);

      closeComposer();

      // Save & Next: Advance to next finding in queue
      handleNavigate(1);
    } catch (err) {
      if (errElem) {
        errElem.textContent = err.message || 'Failed to save decision.';
        errElem.style.display = 'block';
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = activeComposerAction === 'flag' ? 'Flag & Next Finding' : 'Request Evidence & Next';
      }
      showFeedback(`Save failed: ${err.message}`, 'error');
    } finally {
      inFlight = false;
    }
  }

  function openHelpModal() {
    isHelpOpen = true;
    let existing = document.getElementById('quick-triage-help-container');
    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'quick-triage-help-container';
      document.body.appendChild(existing);
    }
    helpElement = existing;

    helpElement.innerHTML = `
      <div class="triage-composer-backdrop" data-triage-close-help="true">
        <div class="triage-help-modal" role="dialog" aria-modal="true" aria-labelledby="triage-help-title">
          <div class="triage-help-header">
            <span class="triage-badge">⚡ SUPERHUMAN-STYLE TRIAGE</span>
            <h2 id="triage-help-title">Keyboard Quick Triage Shortcuts</h2>
            <button type="button" class="triage-composer-close" data-triage-close-help="true" aria-label="Close help (Esc)">✕</button>
          </div>

          <div class="triage-help-body">
            <div class="triage-shortcut-grid">
              <div class="triage-shortcut-item">
                <kbd class="triage-kbd">J</kbd>
                <div class="triage-shortcut-desc">
                  <b>Next Finding</b>
                  <p>Move down the active filtered queue. Respects active department and status filters.</p>
                </div>
              </div>

              <div class="triage-shortcut-item">
                <kbd class="triage-kbd">K</kbd>
                <div class="triage-shortcut-desc">
                  <b>Previous Finding</b>
                  <p>Move up the active filtered queue safely without crossing boundaries.</p>
                </div>
              </div>

              <div class="triage-shortcut-item">
                <kbd class="triage-kbd">1</kbd>
                <div class="triage-shortcut-desc">
                  <b>Accept / Acknowledge</b>
                  <p>Records reviewer acknowledgement (<code class="triage-code">acknowledged</code>). Does NOT mutate engine status from Issue to Match.</p>
                </div>
              </div>

              <div class="triage-shortcut-item">
                <kbd class="triage-kbd">2</kbd>
                <div class="triage-shortcut-desc">
                  <b>Flag for Remedy</b>
                  <p>Flags finding for prepress or brand correction (<code class="triage-code">needs_changes</code>) with an explanation.</p>
                </div>
              </div>

              <div class="triage-shortcut-item">
                <kbd class="triage-kbd">3</kbd>
                <div class="triage-shortcut-desc">
                  <b>Needs Evidence</b>
                  <p>Requests missing source documentation (<code class="triage-code">needs_evidence</code>) before final regulatory judgment.</p>
                </div>
              </div>

              <div class="triage-shortcut-item">
                <kbd class="triage-kbd">4</kbd>
                <div class="triage-shortcut-desc">
                  <b>Skip for Now</b>
                  <p>Advances to the next finding without recording any substantive verdict or changing approval state.</p>
                </div>
              </div>

              <div class="triage-shortcut-item">
                <kbd class="triage-kbd">?</kbd>
                <div class="triage-shortcut-desc">
                  <b>Toggle Shortcuts Reference</b>
                  <p>Open or close this quick reference overlay at any time.</p>
                </div>
              </div>

              <div class="triage-shortcut-item">
                <kbd class="triage-kbd">Esc</kbd>
                <div class="triage-shortcut-desc">
                  <b>Close / Cancel</b>
                  <p>Closes shortcut help or cancels any active inline triage composer without saving.</p>
                </div>
              </div>
            </div>

            <div class="triage-help-disclaimer">
              <b>Important Review Safeguard:</b> Keyboard actions save reviewer dispositions. They do not change PackSignal's deterministic artwork verification results. All decisions remain permission-controlled, auditable, and source-linked.
            </div>
          </div>

          <div class="triage-help-footer">
            <button type="button" class="triage-primary-btn" data-triage-close-help="true">Got it (Esc)</button>
          </div>
        </div>
      </div>
    `;

    helpElement.addEventListener('click', (e) => {
      if (e.target.dataset.triageCloseHelp) {
        closeHelpModal();
      }
    });

    const closeBtn = helpElement.querySelector('.triage-primary-btn');
    if (closeBtn) closeBtn.focus();
  }

  function closeHelpModal() {
    isHelpOpen = false;
    if (helpElement) {
      helpElement.innerHTML = '';
    }
  }

  function handleNavigate(direction) {
    const visible = getVisibleFindings ? getVisibleFindings() : [];
    if (!visible.length) return;

    const currentId = getSelectedFindingId();
    const nav = getNavigatedFinding(visible, currentId, direction);

    if (nav.findingId && nav.findingId !== currentId) {
      selectFinding(nav.findingId);
      renderToolbar();
      announce(`Finding ${nav.index + 1} of ${nav.total}: ${nav.finding.title || nav.findingId}. Status: ${nav.finding.status || 'unknown'}.`);
    } else if (nav.hitBoundary) {
      const boundaryMsg = nav.isEnd ? 'End of findings queue reached.' : 'Start of findings queue reached.';
      showFeedback(boundaryMsg, 'info');
      announce(boundaryMsg);
    }
  }

  async function handleAccept() {
    const perms = typeof getPermissions === 'function' ? getPermissions() : { canReview: true };
    if (!perms.canReview) {
      showFeedback('Permission denied: You are not assigned to review this finding.', 'error');
      return;
    }

    const currentId = getSelectedFindingId();
    if (!currentId || inFlight) return;

    try {
      inFlight = true;
      showFeedback('Saving acknowledgement...', 'info');

      await saveDecision({
        findingId: currentId,
        disposition: 'acknowledged',
        note: 'Acknowledged finding during triage.'
      });

      session.recordDecision(currentId, 'acknowledged');
      showFeedback('Saved: Acknowledged finding. Original check preserved.', 'success');
      announce('Finding acknowledged and saved. Next finding.');

      // Advance
      handleNavigate(1);
    } catch (err) {
      showFeedback(`Save failed: ${err.message}`, 'error');
    } finally {
      inFlight = false;
    }
  }

  function handleFlagRemedy() {
    const perms = typeof getPermissions === 'function' ? getPermissions() : { canReview: true };
    if (!perms.canReview) {
      showFeedback('Permission denied: You are not assigned to review this finding.', 'error');
      return;
    }

    const currentId = getSelectedFindingId();
    const r = getReview();
    const finding = r?.findings?.find(f => f.id === currentId);
    if (!finding) return;

    openComposer('flag', finding);
  }

  function handleNeedsEvidence() {
    const perms = typeof getPermissions === 'function' ? getPermissions() : { canReview: true };
    if (!perms.canReview) {
      showFeedback('Permission denied: You are not assigned to review this finding.', 'error');
      return;
    }

    const currentId = getSelectedFindingId();
    const r = getReview();
    const finding = r?.findings?.find(f => f.id === currentId);
    if (!finding) return;

    openComposer('evidence', finding);
  }

  function handleSkip() {
    const currentId = getSelectedFindingId();
    if (currentId) {
      session.recordSkip(currentId);
    }
    showFeedback('Skipped finding (preserved unresolved).', 'info');
    announce('Finding skipped. Advancing to next finding.');
    handleNavigate(1);
  }

  // Global Keydown Handler
  function onKeydown(e) {
    const ctx = getContext();
    const action = interpretTriageShortcut(e, ctx);

    if (action === 'IGNORE') return;

    // We consumed this shortcut!
    e.preventDefault();

    switch (action) {
      case 'NAVIGATE_NEXT':
        handleNavigate(1);
        break;
      case 'NAVIGATE_PREVIOUS':
        handleNavigate(-1);
        break;
      case 'ACCEPT':
        handleAccept();
        break;
      case 'FLAG_REMEDY':
        handleFlagRemedy();
        break;
      case 'NEEDS_EVIDENCE':
        handleNeedsEvidence();
        break;
      case 'SKIP':
        handleSkip();
        break;
      case 'OPEN_HELP':
        if (isHelpOpen) closeHelpModal();
        else openHelpModal();
        break;
      case 'CLOSE_HELP':
        closeHelpModal();
        break;
      case 'CANCEL_COMPOSER':
        closeComposer();
        break;
      case 'SUBMIT_COMPOSER':
        submitComposer();
        break;
      case 'ESCAPE':
        if (isComposerOpen) closeComposer();
        else if (isHelpOpen) closeHelpModal();
        break;
    }
  }

  // Delegate clicks on toolbar
  function onToolbarClick(e) {
    const btn = e.target.closest('[data-triage-action]');
    if (!btn) return;

    const action = btn.dataset.triageAction;
    switch (action) {
      case 'next':
        handleNavigate(1);
        break;
      case 'prev':
        handleNavigate(-1);
        break;
      case '1':
        handleAccept();
        break;
      case '2':
        handleFlagRemedy();
        break;
      case '3':
        handleNeedsEvidence();
        break;
      case '4':
        handleSkip();
        break;
      case 'help':
        openHelpModal();
        break;
    }
  }

  window.addEventListener('keydown', onKeydown, true);
  document.addEventListener('click', onToolbarClick);

  // Initial render
  renderToolbar();

  return {
    destroy() {
      window.removeEventListener('keydown', onKeydown, true);
      document.removeEventListener('click', onToolbarClick);
      closeComposer();
      closeHelpModal();
    },
    update() {
      renderToolbar();
    },
    getSession() {
      return session;
    },
    openHelp() {
      openHelpModal();
    }
  };
}
