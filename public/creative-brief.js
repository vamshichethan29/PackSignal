/**
 * @file creative-brief.js
 * 
 * PackSignal Phase 5 — Creative Brief View, Compliance Audit,
 * Sentence Editor, Approval Gate, PDF/Checklist Export,
 * and "Ask about this" Side Panel.
 */

let briefState = null;
let currentAudit = null;
let sidePanelOpen = false;

/**
 * Mounts the Creative Brief workspace into the specified container.
 */
export async function mountCreativeBrief(container) {
  if (!container) return;
  container.innerHTML = `
    <div class="brief-workspace" id="brief-root">
      <div style="text-align: center; padding: 3rem; color: #64748b;">
        <p>⚡ Generating AI draft from Fact Sheet facts & verified sources...</p>
      </div>
    </div>
  `;

  await loadBriefData();
  renderBriefWorkspace(container);
}

/**
 * Fetches latest draft and audit from API.
 */
async function loadBriefData() {
  try {
    const res = await fetch('/api/brief/draft');
    const data = await res.json();
    if (data.status === 'SUCCESS') {
      briefState = data.brief;
      currentAudit = data.audit || data.brief.audit;
    }
  } catch (err) {
    console.error('Failed to load brief data:', err);
  }
}

/**
 * Renders the full Creative Brief UI.
 */
function renderBriefWorkspace(container) {
  const root = container.querySelector('#brief-root') || container;
  if (!briefState) {
    root.innerHTML = `<div style="padding: 2rem; color: #dc2626;">Failed to load creative brief.</div>`;
    return;
  }

  const isApproved = briefState.status === 'APPROVED';
  const audit = currentAudit || briefState.audit || {};
  const isApprovable = audit.isApprovable && !isApproved;

  // Header & Actions
  const headerHtml = `
    <div class="brief-header-card">
      <div class="brief-header-info">
        <h2>
          <span>📋</span> ${escapeHtml(briefState.title)}
          <span class="sentence-status-pill ${isApproved ? 'proven' : (audit.isApprovable ? 'proven' : 'unproven')}">
            ${isApproved ? '✓ APPROVED' : (audit.isApprovable ? 'READY TO APPROVE' : 'DRAFT (NEEDS AUDIT)')}
          </span>
        </h2>
        <div class="brief-meta">
          <span><strong>Jurisdiction:</strong> ${escapeHtml(briefState.market)}</span>
          <span><strong>Status:</strong> ${briefState.status}</span>
          <span><strong>Sections:</strong> ${briefState.sections?.length || 8}</span>
          <span><strong>Updated:</strong> ${new Date(briefState.updatedAt || Date.now()).toLocaleTimeString()}</span>
        </div>
      </div>
      <div class="brief-actions-bar">
        <button id="btn-sync-proven" class="btn btn-secondary" title="Auto-align with proven facts from Fact Sheet">
          🔄 Sync Proven Facts
        </button>
        <button id="btn-reaudit" class="btn btn-secondary" title="Re-evaluate all sentences against Fact Sheet">
          ⚡ Re-Audit Brief
        </button>
        <button id="btn-export-pdf" class="btn btn-secondary" title="Export print-ready PDF specification">
          📄 Export PDF
        </button>
        <button id="btn-export-checklist" class="btn btn-secondary" title="Export production compliance checklist">
          ☑ Export Checklist
        </button>
        <button id="btn-approve-brief" class="btn btn-primary" ${!audit.isApprovable || isApproved ? 'disabled' : ''} style="${isApproved ? 'background:#16a34a;' : ''}">
          ${isApproved ? '✓ Brief Approved' : '✓ Approve Brief'}
        </button>
      </div>
    </div>
  `;

  // Scoreboard
  const scoreboardHtml = `
    <div class="audit-scoreboard">
      <div class="audit-metric-card ${audit.complianceScore === 100 ? 'pass' : (audit.complianceScore > 75 ? 'warn' : 'danger')}">
        <div class="audit-metric-icon">${audit.complianceScore === 100 ? '🛡️' : '⚠️'}</div>
        <div>
          <div class="audit-metric-val">${audit.complianceScore || 0}%</div>
          <div class="audit-metric-label">Compliance Score</div>
        </div>
      </div>
      <div class="audit-metric-card ${audit.unprovenSentences === 0 ? 'pass' : 'danger'}">
        <div class="audit-metric-icon">${audit.unprovenSentences === 0 ? '✓' : '✗'}</div>
        <div>
          <div class="audit-metric-val">${audit.unprovenSentences ?? 0}</div>
          <div class="audit-metric-label">Unproven Sentences</div>
        </div>
      </div>
      <div class="audit-metric-card pass">
        <div class="audit-metric-icon">📑</div>
        <div>
          <div class="audit-metric-val">${audit.provenSentences ?? 0} / ${audit.totalSentences ?? 0}</div>
          <div class="audit-metric-label">Proven Sentences</div>
        </div>
      </div>
      <div class="audit-metric-card ${audit.isApprovable ? 'pass' : 'warn'}">
        <div class="audit-metric-icon">${isApproved ? '🏅' : (audit.isApprovable ? '🟢' : '🔴')}</div>
        <div>
          <div class="audit-metric-val" style="font-size: 1.1rem;">${isApproved ? 'APPROVED' : (audit.isApprovable ? 'READY' : 'ACTION REQ')}</div>
          <div class="audit-metric-label">Approval Gate</div>
        </div>
      </div>
    </div>
  `;

  // Brief Sections List
  const sectionsHtml = (briefState.sections || []).map(sec => {
    const sentencesHtml = (sec.sentences || []).map(sent => {
      const isSentProven = sent.status === 'VERIFIED_PROVEN';
      const factChips = (sent.factIds || []).map(fId => {
        return `<span class="sentence-fact-chip ${isSentProven ? 'proven' : 'conflict'}" data-fact-id="${fId}">📎 ${fId}</span>`;
      }).join(' ');

      const alertHtml = (sent.auditIssues || []).map(issue => `
        <div class="sentence-audit-alert">
          <span>⚠️</span>
          <span><strong>Audit Issue (${issue.type}):</strong> ${escapeHtml(issue.message)}</span>
        </div>
      `).join('');

      return `
        <div class="brief-sentence-row ${isSentProven ? 'proven' : 'unproven'}" id="row-${sent.id}">
          <div class="sentence-content-wrap">
            <div class="sentence-text-display" id="text-${sent.id}">${escapeHtml(sent.text)}</div>
            <span class="sentence-status-pill ${isSentProven ? 'proven' : 'unproven'}">
              ${isSentProven ? '✓ Proven' : '⚠️ Unproven'}
            </span>
          </div>

          <div class="sentence-facts-tray">
            <span style="font-size:0.75rem; color:#64748b; font-weight:600;">Fact IDs:</span>
            ${factChips || '<span style="font-size:0.75rem; color:#94a3b8;">No fact linked</span>'}
            <button class="btn-edit-sentence" data-sec-id="${sec.id}" data-sent-id="${sent.id}" style="margin-left:auto; font-size:0.75rem; background:none; border:none; color:#0284c7; cursor:pointer; text-decoration:underline;">
              ✏️ Edit
            </button>
          </div>

          ${alertHtml}

          <div class="sentence-edit-box" id="edit-box-${sent.id}" style="display:none;">
            <textarea class="sentence-edit-textarea" id="textarea-${sent.id}">${escapeHtml(sent.text)}</textarea>
            <div class="sentence-edit-actions">
              <button class="btn btn-secondary btn-cancel-edit" data-sent-id="${sent.id}">Cancel</button>
              <button class="btn btn-primary btn-save-edit" data-sec-id="${sec.id}" data-sent-id="${sent.id}">Save Sentence</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="brief-section-card">
        <div class="brief-section-header">
          <h3 class="brief-section-title">${escapeHtml(sec.title)}</h3>
          <span style="font-size:0.8rem; color:#64748b;">${sec.sentences?.length || 0} sentences</span>
        </div>
        <div class="brief-sentences-list">
          ${sentencesHtml}
        </div>
      </div>
    `;
  }).join('');

  // Approval Banner (if approved)
  const approvalBannerHtml = briefState.approval ? `
    <div class="approved-certificate-banner">
      <div class="cert-seal-icon">PASSED</div>
      <div class="cert-meta">
        <h3>OFFICIALLY APPROVED PACKAGING CREATIVE BRIEF</h3>
        <p><strong>Approved By:</strong> ${escapeHtml(briefState.approval.approvedBy)} (${escapeHtml(briefState.approval.role)})</p>
        <p><strong>Approved At:</strong> ${briefState.approval.approvedAt}</p>
        <p><strong>Digital Checksum:</strong> <span class="cert-checksum-code">${briefState.approval.auditChecksum}</span></p>
        <p><strong>Provenance Seal:</strong> <strong>${briefState.approval.provenanceSeal}</strong></p>
      </div>
    </div>
  ` : '';

  // "Ask about this" Side Panel HTML (Closed by default)
  const sidePanelHtml = `
    <div class="ask-side-panel ${sidePanelOpen ? 'open' : ''}" id="ask-side-panel">
      <div class="ask-panel-header">
        <h3><span>💬</span> Ask About This Pack</h3>
        <button class="ask-close-btn" id="btn-close-ask">&times;</button>
      </div>

      <div class="ask-panel-body">
        <div class="ask-prompts-tray">
          <div class="ask-prompts-label">Quick Prompts (Facts & Regulations):</div>
          <button class="ask-pill-btn" data-query="What is the approved honey percentage?">
            🍯 What is the approved honey percentage?
          </button>
          <button class="ask-pill-btn" data-query="What allergens are declared on the carton?">
            🥜 What allergens are declared on the carton?
          </button>
          <button class="ask-pill-btn" data-query="What are the storage conditions & shelf life?">
            🌡️ What are the storage conditions & shelf life?
          </button>
          <button class="ask-pill-btn" data-query="What is the net weight and dual declaration?">
            ⚖️ What is the net weight and dual declaration?
          </button>
        </div>

        <div id="ask-conversation-feed">
          <div style="font-size:0.85rem; color:#64748b; line-height:1.5;">
            Ask any question about this pack's formulations, regulatory claims, barcode, or specifications. Answers are proven strictly from the 6 ingested sources.
          </div>
        </div>
      </div>

      <div class="ask-panel-footer">
        <form class="ask-input-form" id="ask-form">
          <input type="text" class="ask-input-field" id="ask-input" placeholder="Ask about ingredients, rules, specs..." />
          <button type="submit" class="btn btn-primary" id="btn-send-ask">Ask</button>
        </form>
      </div>
    </div>

    <!-- Floating Toggle Button for Side Panel -->
    <button class="ask-toggle-tab-btn" id="btn-toggle-ask" title="Open Ask About This Side Panel">
      <span>💬</span> Ask about this
    </button>
  `;

  root.innerHTML = `
    ${headerHtml}
    ${scoreboardHtml}
    ${approvalBannerHtml}
    <div style="margin-top: 1.5rem;">
      ${sectionsHtml}
    </div>
    ${sidePanelHtml}
  `;

  attachBriefListeners(root, container);
}

/**
 * Attaches DOM event handlers for the brief workspace.
 */
function attachBriefListeners(root, container) {
  // Re-Audit Brief
  const reauditBtn = root.querySelector('#btn-reaudit');
  if (reauditBtn) {
    reauditBtn.addEventListener('click', async () => {
      const res = await fetch('/api/brief/audit', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        currentAudit = data.audit;
        renderBriefWorkspace(container);
      }
    });
  }

  // Sync Proven Facts
  const syncBtn = root.querySelector('#btn-sync-proven');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      await loadBriefData();
      renderBriefWorkspace(container);
    });
  }

  // Approve Brief
  const approveBtn = root.querySelector('#btn-approve-brief');
  if (approveBtn) {
    approveBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/brief/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reviewer: {
              name: 'Packaging Quality Reviewer',
              role: 'Brand & Compliance Lead'
            }
          })
        });
        const data = await res.json();
        if (data.status === 'SUCCESS') {
          briefState = data.brief;
          renderBriefWorkspace(container);
          alert('✓ Packaging Creative Brief officially approved! Zero unproven claims or numbers remain.');
        } else {
          alert(`Cannot approve: ${data.error}`);
        }
      } catch (err) {
        alert(`Approval error: ${err.message}`);
      }
    });
  }

  // Export PDF
  const exportPdfBtn = root.querySelector('#btn-export-pdf');
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      window.open('/api/brief/export/pdf', '_blank');
    });
  }

  // Export Checklist
  const exportChecklistBtn = root.querySelector('#btn-export-checklist');
  if (exportChecklistBtn) {
    exportChecklistBtn.addEventListener('click', () => {
      window.open('/api/brief/export/checklist?format=markdown', '_blank');
    });
  }

  // Inline Sentence Edit Toggle
  root.querySelectorAll('.btn-edit-sentence').forEach(btn => {
    btn.addEventListener('click', () => {
      const sentId = btn.getAttribute('data-sent-id');
      const editBox = root.querySelector(`#edit-box-${sentId}`);
      if (editBox) {
        editBox.style.display = editBox.style.display === 'none' ? 'flex' : 'none';
      }
    });
  });

  // Cancel Edit
  root.querySelectorAll('.btn-cancel-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const sentId = btn.getAttribute('data-sent-id');
      const editBox = root.querySelector(`#edit-box-${sentId}`);
      if (editBox) editBox.style.display = 'none';
    });
  });

  // Save Sentence Edit
  root.querySelectorAll('.btn-save-edit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const secId = btn.getAttribute('data-sec-id');
      const sentId = btn.getAttribute('data-sent-id');
      const textarea = root.querySelector(`#textarea-${sentId}`);
      const newText = textarea ? textarea.value.trim() : '';

      if (!newText) return;

      const res = await fetch('/api/brief/sentence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: secId,
          sentenceId: sentId,
          text: newText
        })
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        briefState = data.brief;
        currentAudit = data.audit;
        renderBriefWorkspace(container);
      }
    });
  });

  // Side Panel Toggle
  const toggleBtn = root.querySelector('#btn-toggle-ask');
  const closeBtn = root.querySelector('#btn-close-ask');
  const panel = root.querySelector('#ask-side-panel');

  if (toggleBtn && panel) {
    toggleBtn.addEventListener('click', () => {
      sidePanelOpen = !sidePanelOpen;
      panel.classList.toggle('open', sidePanelOpen);
    });
  }

  if (closeBtn && panel) {
    closeBtn.addEventListener('click', () => {
      sidePanelOpen = false;
      panel.classList.remove('open');
    });
  }

  // Quick Prompt Pills
  root.querySelectorAll('.ask-pill-btn').forEach(pill => {
    pill.addEventListener('click', () => {
      const q = pill.getAttribute('data-query');
      executeAskQuery(q, root, container);
    });
  });

  // Ask Form Submit
  const askForm = root.querySelector('#ask-form');
  const askInput = root.querySelector('#ask-input');
  if (askForm && askInput) {
    askForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = askInput.value.trim();
      if (q) {
        executeAskQuery(q, root, container);
        askInput.value = '';
      }
    });
  }
}

/**
 * Executes a question in the "Ask about this" panel.
 */
async function executeAskQuery(queryText, root, container) {
  const feed = root.querySelector('#ask-conversation-feed');
  if (!feed) return;

  // Add query to feed
  const queryElem = document.createElement('div');
  queryElem.style.cssText = 'background:#0284c7; color:#fff; padding:0.6rem 0.85rem; border-radius:8px 8px 0 8px; margin:0.75rem 0; font-size:0.9rem; align-self:flex-end;';
  queryElem.textContent = queryText;
  feed.appendChild(queryElem);

  // Loading indicator
  const loadElem = document.createElement('div');
  loadElem.style.cssText = 'color:#64748b; font-size:0.85rem; padding:0.5rem;';
  loadElem.textContent = 'Searching evidence sources & facts...';
  feed.appendChild(loadElem);

  try {
    const res = await fetch('/api/brief/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: queryText })
    });
    const data = await res.json();
    loadElem.remove();

    if (data.status === 'SUCCESS') {
      const answerCard = document.createElement('div');
      answerCard.className = 'ask-answer-box';

      const sourcesHtml = (data.sources || []).map(s => `
        <div class="ask-source-item">
          <span>📄 <strong>${escapeHtml(s.file)}</strong> (${escapeHtml(s.location || '')})</span>
          <span style="font-size:0.75rem; color:#64748b;">"${escapeHtml(s.quote || '')}"</span>
        </div>
      `).join('');

      let confirmHtml = '';
      if (data.canConfirmAsFact && data.proposedFact) {
        confirmHtml = `
          <div class="ask-confirm-fact-wrap">
            <span class="ask-confirm-text">✓ Can confirm: "${escapeHtml(data.proposedFact.label)}: ${escapeHtml(data.proposedFact.value)}"</span>
            <button class="btn btn-primary btn-sm btn-confirm-fact" style="padding:0.35rem 0.75rem; font-size:0.8rem;">
              Confirm as Fact
            </button>
          </div>
        `;
      }

      answerCard.innerHTML = `
        <div class="ask-answer-text">${escapeHtml(data.answer)}</div>
        <div class="ask-sources-list">
          <span style="font-size:0.75rem; color:#64748b; font-weight:700;">CITED SOURCES:</span>
          ${sourcesHtml}
        </div>
        ${confirmHtml}
      `;

      feed.appendChild(answerCard);

      // Handle Confirm Fact button
      const confirmBtn = answerCard.querySelector('.btn-confirm-fact');
      if (confirmBtn && data.proposedFact) {
        confirmBtn.addEventListener('click', async () => {
          confirmBtn.disabled = true;
          confirmBtn.textContent = 'Confirming...';
          const confRes = await fetch('/api/brief/confirm-fact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proposedFact: data.proposedFact })
          });
          const confData = await confRes.json();
          if (confData.status === 'SUCCESS') {
            confirmBtn.textContent = '✓ Confirmed!';
            confirmBtn.style.background = '#16a34a';
            briefState = confData.brief;
            currentAudit = confData.audit;
            renderBriefWorkspace(container);
          }
        });
      }

      feed.scrollTop = feed.scrollHeight;
    }
  } catch (err) {
    loadElem.remove();
    console.error('Ask query error:', err);
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
