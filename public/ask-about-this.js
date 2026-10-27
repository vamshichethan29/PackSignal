/**
 * @file public/ask-about-this.js
 * 
 * PackSignal Phase 5 — Contextual "Ask About This" Grounded Assistant
 * - Closed by default
 * - Uses only available source facts & pieces
 * - Safe "Confirm Answer as Fact" workflow with reviewer identity provenance
 */

let panelOpen = false;
let currentProposedFact = null;

export function mountAskAboutThis(container = document.body, sessionId = 'default') {
  // Remove existing instance if present
  const existing = document.getElementById('ask-about-this-wrapper');
  if (existing) existing.remove();

  const wrapper = document.createElement('div');
  wrapper.id = 'ask-about-this-wrapper';

  wrapper.innerHTML = `
    <!-- Floating toggle button: CLOSED BY DEFAULT -->
    <button id="btn-toggle-ask-drawer" class="ask-drawer-toggle-btn" title="Open Ask About This Assistant">
      <span class="icon">💬</span>
      <span class="label">Ask about this</span>
    </button>

    <!-- Side Drawer -->
    <div id="ask-drawer-panel" class="ask-drawer-panel ${panelOpen ? 'open' : ''}">
      <div class="ask-drawer-header">
        <div class="header-title">
          <span class="icon">💬</span>
          <h3>Ask About This Pack</h3>
        </div>
        <button id="btn-close-ask-drawer" class="btn-close-drawer" title="Close Panel">&times;</button>
      </div>

      <div class="ask-drawer-context-notice">
        <span>🛡️ Grounded in 6 ingested document sources. No speculative web browsing or hallucinations.</span>
      </div>

      <div class="ask-drawer-content" id="ask-conversation-scroll">
        <div class="ask-prompts-tray">
          <div class="tray-title">Quick Source Inquiries:</div>
          <button class="quick-ask-chip" data-q="What is the approved honey percentage?">🍯 Honey formulation ratio</button>
          <button class="quick-ask-chip" data-q="What tree nuts are declared in the allergen statement?">🥜 Tree nut allergen compliance</button>
          <button class="quick-ask-chip" data-q="What are the storage conditions and shelf life?">🌡️ Storage temperature & shelf life</button>
          <button class="quick-ask-chip" data-q="What is the net weight dual unit declaration?">⚖️ Net contents dual units</button>
        </div>

        <div id="ask-chat-feed" class="ask-chat-feed">
          <div class="system-intro-msg">
            Hello! I can answer questions about packaging formulations, net quantities, regulations, and source locations.
          </div>
        </div>
      </div>

      <div class="ask-drawer-footer">
        <form id="ask-question-form" class="ask-form">
          <input type="text" id="ask-input-text" class="ask-input" placeholder="Ask about ingredients, rules, specs..." />
          <button type="submit" id="btn-submit-ask" class="btn btn-primary">Ask</button>
        </form>
      </div>
    </div>

    <!-- Confirm Answer as Fact Modal -->
    <div id="confirm-fact-modal" class="confirm-fact-modal" style="display:none;">
      <div class="modal-card">
        <div class="modal-header">
          <h4>Confirm Answer as Authoritative Review Fact</h4>
          <button id="btn-modal-close" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-desc">
            You are creating an auditable <code>REVIEWER_ATTESTED</code> fact in the Fact Sheet based on this grounded inquiry.
          </p>
          <div id="modal-fact-preview" class="fact-preview-box"></div>
          
          <div class="form-group">
            <label>Reviewer Name:</label>
            <input type="text" id="attest-reviewer-name" class="form-control" value="Elena Rostova" />
          </div>
          <div class="form-group">
            <label>Department / Role:</label>
            <select id="attest-reviewer-role" class="form-control">
              <option value="REGULATORY_LEAD">Regulatory Lead</option>
              <option value="QA_SPECIALIST">QA Specialist</option>
              <option value="PACKAGING_ENGINEER">Packaging Engineer</option>
              <option value="LEAD_REVIEWER">Lead Reviewer</option>
            </select>
          </div>
          <div class="form-group">
            <label>Attestation Justification:</label>
            <textarea id="attest-reason" class="form-control" rows="2">Confirmed against verified technical specification.</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button id="btn-cancel-confirm" class="btn btn-secondary">Cancel</button>
          <button id="btn-commit-confirm" class="btn btn-primary">Confirm & Invalidate Brief</button>
        </div>
      </div>
    </div>
  `;

  container.appendChild(wrapper);
  attachAskEvents(wrapper, sessionId);
}

function attachAskEvents(wrapper, sessionId) {
  const toggleBtn = wrapper.querySelector('#btn-toggle-ask-drawer');
  const drawer = wrapper.querySelector('#ask-drawer-panel');
  const closeBtn = wrapper.querySelector('#btn-close-ask-drawer');
  const form = wrapper.querySelector('#ask-question-form');
  const input = wrapper.querySelector('#ask-input-text');
  const feed = wrapper.querySelector('#ask-chat-feed');

  // Toggle open/close
  toggleBtn.addEventListener('click', () => {
    panelOpen = !panelOpen;
    drawer.classList.toggle('open', panelOpen);
  });

  closeBtn.addEventListener('click', () => {
    panelOpen = false;
    drawer.classList.remove('open');
  });

  // Quick chips
  wrapper.querySelectorAll('.quick-ask-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.getAttribute('data-q');
      if (input) input.value = q;
      handleAskQuestion(q, feed, sessionId);
    });
  });

  // Form submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) {
      handleAskQuestion(q, feed, sessionId);
      input.value = '';
    }
  });

  // Confirm Modal events
  const modal = wrapper.querySelector('#confirm-fact-modal');
  wrapper.querySelector('#btn-modal-close').addEventListener('click', () => modal.style.display = 'none');
  wrapper.querySelector('#btn-cancel-confirm').addEventListener('click', () => modal.style.display = 'none');

  wrapper.querySelector('#btn-commit-confirm').addEventListener('click', async () => {
    if (!currentProposedFact) return;
    const reviewerName = wrapper.querySelector('#attest-reviewer-name').value.trim();
    const reviewerRole = wrapper.querySelector('#attest-reviewer-role').value;
    const reason = wrapper.querySelector('#attest-reason').value.trim();

    try {
      const res = await fetch(`/api/brief/confirm-fact?session=${encodeURIComponent(sessionId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposedFact: currentProposedFact,
          reviewer: {
            name: reviewerName,
            role: reviewerRole,
            reason
          }
        })
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        modal.style.display = 'none';
        alert(`✓ Fact "${currentProposedFact.label || currentProposedFact.field}" confirmed as REVIEWER_ATTESTED! Dependent requirements and brief audit have been updated.`);
      }
    } catch (err) {
      alert(`Confirmation failed: ${err.message}`);
    }
  });
}

async function handleAskQuestion(questionText, feed, sessionId) {
  // Append user message
  const userMsgEl = document.createElement('div');
  userMsgEl.className = 'chat-bubble user';
  userMsgEl.textContent = questionText;
  feed.appendChild(userMsgEl);

  // Append assistant loading
  const aiMsgEl = document.createElement('div');
  aiMsgEl.className = 'chat-bubble ai loading';
  aiMsgEl.textContent = 'Searching ground-truth evidence...';
  feed.appendChild(aiMsgEl);
  feed.scrollTop = feed.scrollHeight;

  try {
    const res = await fetch(`/api/brief/ask?session=${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: questionText })
    });
    const data = await res.json();

    aiMsgEl.classList.remove('loading');
    if (data.status === 'SUCCESS') {
      const sourcesHtml = (data.sources || []).map(s => `
        <div class="source-citation-badge">
          <span>📄</span> <strong>${escapeHtml(s.file || 'Spec')}</strong> [${escapeHtml(s.location || '')}]
        </div>
      `).join('');

      aiMsgEl.innerHTML = `
        <div class="ai-answer-text">${escapeHtml(data.answer)}</div>
        ${sourcesHtml ? `<div class="ai-sources-tray"><span class="lbl">Grounded Sources:</span> ${sourcesHtml}</div>` : ''}
        ${data.canConfirmAsFact ? `
          <div class="confirm-fact-prompt-box">
            <span class="prompt-text">💡 Grounded insight can be promoted to an authoritative fact:</span>
            <button class="btn btn-sm btn-confirm-fact" id="btn-trigger-confirm-${Date.now()}">Confirm as Fact</button>
          </div>
        ` : ''}
      `;

      if (data.canConfirmAsFact && data.proposedFact) {
        const confirmBtn = aiMsgEl.querySelector('.btn-confirm-fact');
        if (confirmBtn) {
          confirmBtn.addEventListener('click', () => {
            currentProposedFact = data.proposedFact;
            const modal = document.querySelector('#confirm-fact-modal');
            const preview = document.querySelector('#modal-fact-preview');
            if (modal && preview) {
              preview.innerHTML = `
                <div><strong>Field:</strong> ${escapeHtml(data.proposedFact.field)}</div>
                <div><strong>Value:</strong> ${escapeHtml(data.proposedFact.value)}</div>
                <div><strong>Sources:</strong> ${(data.proposedFact.sources || []).map(s => `${s.file} (${s.location})`).join(', ')}</div>
              `;
              modal.style.display = 'flex';
            }
          });
        }
      }
    } else {
      aiMsgEl.textContent = data.error || "I couldn't establish that from the supplied sources.";
    }
  } catch (err) {
    aiMsgEl.textContent = "Error querying grounded sources.";
  }
  feed.scrollTop = feed.scrollHeight;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
