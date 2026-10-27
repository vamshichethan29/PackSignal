/**
 * PackSignal Ambiguity Resolution Studio (public/source-ambiguity.js)
 * Implements Phase 1, 14, 15, 19, 20:
 * - Dedicated "Resolve Source Ambiguity" workspace tab
 * - Side-by-side source candidate comparison with actual cell coordinates
 * - Live dry-run dependency impact preview
 * - Server-validated incremental resolution with Before/After summary
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

let activeQuestionId = null;
let currentFilter = 'ALL';
let impactPreviewData = null;
let lastImpactResult = null;

export function sourceAmbiguityDashboardView(review) {
  const questions = review.ambiguityQuestions || [];
  const resolutions = review.ambiguityResolutions || {};

  const total = questions.length;
  const openCount = questions.filter(q => q.status === 'OPEN').length;
  const needsEvidenceCount = questions.filter(q => q.status === 'NEEDS_EVIDENCE').length;
  const resolvedCount = questions.filter(q => q.status === 'RESOLVED').length;

  // Filter questions
  let filtered = questions;
  if (currentFilter === 'OPEN') filtered = questions.filter(q => q.status === 'OPEN');
  else if (currentFilter === 'NEEDS_EVIDENCE') filtered = questions.filter(q => q.status === 'NEEDS_EVIDENCE');
  else if (currentFilter === 'RESOLVED') filtered = questions.filter(q => q.status === 'RESOLVED');

  if (!activeQuestionId && filtered.length > 0) {
    activeQuestionId = filtered[0].questionId;
  }
  const activeQuestion = questions.find(q => q.questionId === activeQuestionId) || filtered[0] || null;

  return `
    <div class="ambiguity-studio-container" data-ambiguity-studio style="display:flex;flex-direction:column;gap:18px;">
      <!-- Studio Header -->
      <div style="background:white;border:1px solid #c5cae9;border-top:4px solid #303f9f;border-radius:8px;padding:20px;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;">
          <div>
            <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#303f9f;text-transform:uppercase;">
              PACKSIGNAL INTELLIGENCE · SOURCE VERIFICATION WORKBENCH
            </div>
            <h2 style="margin:4px 0 6px;color:#0d1b2a;font-size:20px;">Resolve Source Ambiguity &amp; Fact Conflicts</h2>
            <p style="margin:0;font-size:13px;color:#555;max-width:820px;line-height:1.45;">
              Identify conflicting specifications, multi-column nutrition bases, and unconfirmed sources.
              Designate authoritative references with full provenance, preview dependent impacts, and re-run <b>only affected checks</b>.
            </p>
          </div>
          <!-- Filter Buttons -->
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            <button type="button" class="secondary ${currentFilter === 'ALL' ? 'active' : ''}" style="font-size:12px;padding:5px 12px;" data-action="ambiguity-filter" data-filter="ALL">
              All (${total})
            </button>
            <button type="button" class="secondary ${currentFilter === 'OPEN' ? 'active' : ''}" style="font-size:12px;padding:5px 12px;color:#c62828;" data-action="ambiguity-filter" data-filter="OPEN">
              Open (${openCount})
            </button>
            <button type="button" class="secondary ${currentFilter === 'NEEDS_EVIDENCE' ? 'active' : ''}" style="font-size:12px;padding:5px 12px;color:#ef6c00;" data-action="ambiguity-filter" data-filter="NEEDS_EVIDENCE">
              Needs Evidence (${needsEvidenceCount})
            </button>
            <button type="button" class="secondary ${currentFilter === 'RESOLVED' ? 'active' : ''}" style="font-size:12px;padding:5px 12px;color:#2e7d32;" data-action="ambiguity-filter" data-filter="RESOLVED">
              Resolved (${resolvedCount})
            </button>
          </div>
        </div>
      </div>

      <!-- Before/After Impact Banner (if an action was recently performed) -->
      ${lastImpactResult ? renderImpactBanner(lastImpactResult) : ''}

      <!-- Main 3-Column Workspace -->
      <div style="display:grid;grid-template-columns:310px 1fr 340px;gap:18px;align-items:start;">
        
        <!-- LEFT: Questions Queue -->
        <div style="background:white;border:1px solid #e0e0e0;border-radius:8px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,0.04);">
          <div style="font-size:12px;font-weight:700;color:#333;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;">
            Ambiguity Queue (${filtered.length})
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;max-height:650px;overflow-y:auto;">
            ${filtered.length === 0 ? `
              <div style="padding:20px;text-align:center;color:#888;font-size:13px;">
                No ambiguity questions match this filter.
              </div>
            ` : filtered.map((q, idx) => {
              const isSelected = q.questionId === activeQuestionId;
              const priorityColors = {
                HIGH: '#c62828',
                MEDIUM: '#ef6c00',
                LOW: '#546e7a',
              };
              const statusBadges = {
                OPEN: '<span style="font-size:10px;padding:2px 6px;border-radius:3px;background:#ffebee;color:#c62828;font-weight:700;">OPEN</span>',
                NEEDS_EVIDENCE: '<span style="font-size:10px;padding:2px 6px;border-radius:3px;background:#fff3e0;color:#ef6c00;font-weight:700;">NEEDS EVIDENCE</span>',
                RESOLVED: '<span style="font-size:10px;padding:2px 6px;border-radius:3px;background:#e8f5e9;color:#2e7d32;font-weight:700;">RESOLVED</span>',
              };

              return `
                <div class="ambiguity-item ${isSelected ? 'active-item' : ''}" 
                     style="padding:12px;border:1px solid ${isSelected ? '#303f9f' : '#e0e0e0'};border-left:4px solid ${priorityColors[q.priority] || '#999'};border-radius:6px;cursor:pointer;background:${isSelected ? '#f5f6fc' : 'white'};transition:all 0.15s ease;"
                     data-action="select-ambiguity-question" data-question-id="${esc(q.questionId)}">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span style="font-size:11px;font-weight:700;color:${priorityColors[q.priority] || '#666'};">
                      ${esc(q.priority)} PRIORITY
                    </span>
                    ${statusBadges[q.status] || ''}
                  </div>
                  <div style="font-size:13px;font-weight:600;color:#183b2b;margin-bottom:4px;line-height:1.3;">
                    ${esc(q.title)}
                  </div>
                  <div style="font-size:11px;color:#666;display:flex;gap:10px;">
                    <span>Blocks: <b>${q.affectedCheckIds?.length || 1} checks</b></span>
                    <span>Field: <code>${esc(q.field)}</code></span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- CENTER: Active Question & Source Candidates -->
        <div style="background:white;border:1px solid #e0e0e0;border-radius:8px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,0.04);">
          ${!activeQuestion ? `
            <div style="padding:40px;text-align:center;color:#666;">
              Select a question from the queue on the left to inspect candidate sources.
            </div>
          ` : `
            <div>
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px;">
                <div>
                  <div style="font-size:11px;color:#666;text-transform:uppercase;font-weight:600;">
                    Question ID: <code>${esc(activeQuestion.questionId)}</code> · Target Field: <code>${esc(activeQuestion.field)}</code>
                  </div>
                  <h3 style="margin:4px 0 6px;font-size:16px;color:#0d1b2a;">
                    ${esc(activeQuestion.question)}
                  </h3>
                </div>
                ${activeQuestion.status === 'RESOLVED' ? `
                  <button type="button" class="secondary" style="font-size:11px;padding:4px 10px;color:#c62828;"
                    data-action="reopen-ambiguity" data-question-id="${esc(activeQuestion.questionId)}">
                    ↻ Reopen Question
                  </button>
                ` : ''}
              </div>

              <div style="background:#f8f9fa;border-left:3px solid #303f9f;padding:10px 14px;border-radius:4px;font-size:12px;color:#444;margin-bottom:16px;">
                <b>Why this clarification is required:</b> ${esc(activeQuestion.reason)}
              </div>

              <!-- Candidate Sources Side-by-Side Comparison -->
              <div style="margin-bottom:20px;">
                <div style="font-size:12px;font-weight:700;color:#222;margin-bottom:8px;text-transform:uppercase;">
                  Candidate Source Specifications (${activeQuestion.sourceCandidates?.length || 0})
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:12px;">
                  ${(activeQuestion.sourceCandidates || []).map(cand => {
                    const isResolvedSelected = activeQuestion.resolution?.candidateId === cand.candidateId || activeQuestion.resolution?.value === cand.value;
                    return `
                      <div class="candidate-card ${isResolvedSelected ? 'candidate-selected' : ''}" 
                           style="border:2px solid ${isResolvedSelected ? '#2e7d32' : '#e0e0e0'};border-radius:6px;padding:14px;background:${isResolvedSelected ? '#f1f8e9' : 'white'};display:flex;flex-direction:column;justify-content:space-between;">
                        <div>
                          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                            <b style="font-size:13px;color:#183b2b;">${esc(cand.label)}</b>
                            <span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:3px;background:${cand.approvalStatus === 'DRAFT' ? '#fff3e0;color:#e65100;' : '#e8f5e9;color:#2e7d32;'}">
                              ${esc(cand.approvalStatus || 'SOURCE SPEC')}
                            </span>
                          </div>

                          <div style="font-size:14px;font-weight:bold;color:#111;margin-bottom:8px;padding:6px 8px;background:#f5f7f5;border-radius:4px;font-family:monospace;">
                            "${esc(cand.value)}"
                          </div>

                          <div style="font-size:11px;color:#666;line-height:1.5;margin-bottom:8px;">
                            <div>📄 Document: <b>${esc(cand.documentName)}</b></div>
                            ${cand.location ? `<div>📍 Location: <code>${esc(cand.location)}</code></div>` : ''}
                            ${cand.column ? `<div>📊 Spreadsheet Column: <b>Column ${esc(cand.column)}</b></div>` : ''}
                          </div>

                          <div style="font-size:11px;font-style:italic;color:#444;background:#fafafa;border:1px solid #eee;border-radius:4px;padding:6px;margin-bottom:10px;">
                            “${esc(cand.quote)}”
                          </div>
                        </div>

                        <div>
                          ${activeQuestion.status !== 'RESOLVED' ? `
                            <button type="button" class="primary" style="width:100%;font-size:12px;padding:6px;"
                              data-action="choose-candidate" data-question-id="${esc(activeQuestion.questionId)}" data-candidate-id="${esc(cand.candidateId)}" data-candidate-value="${esc(cand.value)}">
                              Select This Source
                            </button>
                          ` : `
                            ${isResolvedSelected ? `
                              <div style="text-align:center;font-size:11px;font-weight:700;color:#2e7d32;padding:4px;">
                                ✓ Approved Reference
                              </div>
                            ` : ''}
                          `}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- Decision Form -->
              ${activeQuestion.status !== 'RESOLVED' ? `
                <div style="border-top:1px solid #e0e0e0;padding-top:16px;">
                  <h4 style="margin:0 0 8px;font-size:13px;color:#222;">Reviewer Confirmation &amp; Rationale:</h4>
                  <div style="display:flex;flex-direction:column;gap:10px;">
                    <div>
                      <label style="font-size:11px;font-weight:600;color:#555;display:block;margin-bottom:4px;">
                        Selected Reference Value / Basis:
                      </label>
                      <input type="text" id="ambiguity-selected-val" value="${esc(activeQuestion.sourceCandidates?.[0]?.value || '')}" 
                        style="width:100%;padding:8px;font-size:13px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;" readonly>
                      <input type="hidden" id="ambiguity-selected-cand-id" value="${esc(activeQuestion.sourceCandidates?.[0]?.candidateId || '')}">
                    </div>
                    <div>
                      <label style="font-size:11px;font-weight:600;color:#555;display:block;margin-bottom:4px;">
                        Reviewer Rationale / Authority Evidence Note:
                      </label>
                      <textarea id="ambiguity-rationale" rows="2" style="width:100%;padding:8px;font-size:12px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;" 
                        placeholder="e.g. Confirmed against production master brief DF-US-001 Section 4..."></textarea>
                    </div>
                    <div style="display:flex;gap:10px;align-items:center;margin-top:6px;">
                      <button type="button" class="secondary" style="font-size:12px;padding:7px 14px;"
                        data-action="preview-ambiguity-impact" data-question-id="${esc(activeQuestion.questionId)}">
                        🔬 Preview Impact
                      </button>
                      <button type="button" class="primary" style="background:#2e7d32;font-size:12px;padding:7px 16px;"
                        data-action="confirm-ambiguity-resolution" data-question-id="${esc(activeQuestion.questionId)}">
                        ✓ Confirm Resolution
                      </button>
                      <button type="button" class="secondary" style="font-size:12px;padding:7px 12px;color:#e65100;"
                        data-action="request-more-evidence" data-question-id="${esc(activeQuestion.questionId)}">
                        ⚠️ Need More Evidence
                      </button>
                    </div>
                  </div>
                </div>
              ` : `
                <!-- Resolution Details Box -->
                <div style="border-top:1px solid #e0e0e0;padding-top:16px;">
                  <div style="background:#f1f8e9;border:1px solid #c8e6c9;border-radius:6px;padding:14px;">
                    <div style="font-size:12px;font-weight:700;color:#2e7d32;margin-bottom:6px;">
                      ✓ Source Ambiguity Resolved by ${esc(activeQuestion.resolution?.reviewerName || 'Reviewer')}
                    </div>
                    <div style="font-size:12px;color:#333;line-height:1.5;">
                      <div><b>Authoritative Value:</b> "${esc(activeQuestion.resolution?.value)}"</div>
                      <div><b>Reviewer Rationale:</b> ${esc(activeQuestion.resolution?.rationale || 'Confirmed')}</div>
                      <div><b>Resolved At:</b> ${esc(activeQuestion.resolution?.resolvedAt)}</div>
                    </div>
                  </div>
                </div>
              `}
            </div>
          `}
        </div>

        <!-- RIGHT: Dependent Checks & Live Impact Preview -->
        <div style="display:flex;flex-direction:column;gap:14px;">
          <!-- Dependent Checks Card -->
          <div style="background:white;border:1px solid #e0e0e0;border-radius:8px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.04);">
            <div style="font-size:11px;font-weight:700;color:#1a237e;text-transform:uppercase;margin-bottom:8px;">
              Checks Blocked / Affected (${activeQuestion?.affectedCheckIds?.length || 0})
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">
              ${(activeQuestion?.affectedCheckIds || []).map(cid => `
                <div style="padding:6px 8px;background:#f5f6fa;border:1px solid #dcdde1;border-radius:4px;font-size:12px;display:flex;align-items:center;gap:6px;">
                  <span style="color:#e65100;font-weight:bold;">⚡</span>
                  <span style="font-family:monospace;font-size:11px;">${esc(cid)}</span>
                </div>
              `).join('')}
            </div>

            <div style="font-size:11px;font-weight:700;color:#2e7d32;text-transform:uppercase;margin-bottom:6px;border-top:1px solid #eee;padding-top:8px;">
              Checks Unaffected &amp; Preserved
            </div>
            <div style="font-size:11px;color:#666;line-height:1.4;">
              Barcode checksum, Manufacturer business address, Environmental copy, and Dieline geometry checks remain untouched.
            </div>
          </div>

          <!-- Dynamic Dry-Run Impact Preview Box -->
          <div id="ambiguity-impact-preview-container" style="background:#fafafa;border:1px solid #e0e0e0;border-radius:8px;padding:16px;">
            ${impactPreviewData ? renderPreviewCard(impactPreviewData) : `
              <div style="text-align:center;padding:16px 8px;color:#777;font-size:12px;">
                Click <b>[🔬 Preview Impact]</b> to inspect which checks will be re-run and which findings will transition before committing.
              </div>
            `}
          </div>
        </div>

      </div>
    </div>
  `;
}

function renderImpactBanner(impact) {
  return `
    <div style="background:#e8f5e9;border:1px solid #a5d6a7;border-left:5px solid #2e7d32;border-radius:6px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
      <div>
        <b style="color:#1b5e20;font-size:14px;">✓ Source Ambiguity Resolved: Selected "${esc(impact.decision)}"</b>
        <p style="margin:2px 0 0;font-size:12px;color:#2e7d32;">
          <b>${impact.affectedChecksRerun?.length || 0} dependent checks</b> were re-evaluated incrementally. All unrelated findings and reviewer sign-offs were preserved without rerun.
        </p>
      </div>
      <button type="button" class="textbutton" style="font-size:12px;color:#1b5e20;" data-action="dismiss-impact-banner">
        Dismiss ✕
      </button>
    </div>
  `;
}

function renderPreviewCard(preview) {
  return `
    <div>
      <div style="font-size:12px;font-weight:700;color:#303f9f;margin-bottom:8px;text-transform:uppercase;">
        🔬 Dry-Run Dependency Impact Preview
      </div>
      <div style="font-size:12px;color:#333;margin-bottom:8px;">
        Proposed Reference: <b>"${esc(preview.proposedValue)}"</b>
      </div>
      <div style="font-size:11px;color:#555;margin-bottom:6px;">
        <b>Scheduled for Reevaluation:</b> ${preview.dependentChecks?.length || 0} checks
      </div>
      <ul style="margin:0 0 10px 18px;padding:0;font-size:11px;color:#222;">
        ${(preview.dependentChecks || []).map(c => `<li>${esc(c.title)}</li>`).join('')}
      </ul>
      <div style="font-size:11px;color:#2e7d32;margin-bottom:4px;">
        <b>Preserved Unaltered:</b> ${preview.unaffectedChecks?.length || 0} checks
      </div>
      <div style="font-size:10px;color:#666;">
        No review mutations occur during preview. Click [Confirm Resolution] to apply.
      </div>
    </div>
  `;
}

/**
 * Mounts event listeners for Ambiguity Studio
 */
export function mountAmbiguityStudio(container, { reviewId, api, onReviewUpdated }) {
  if (!container) return;

  container.addEventListener('click', async event => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'ambiguity-filter') {
      currentFilter = btn.dataset.filter || 'ALL';
      onReviewUpdated();
    }

    if (action === 'select-ambiguity-question') {
      activeQuestionId = btn.dataset.questionId;
      impactPreviewData = null;
      onReviewUpdated();
    }

    if (action === 'choose-candidate') {
      const qId = btn.dataset.questionId;
      const candId = btn.dataset.candidateId;
      const candVal = btn.dataset.candidateValue;
      const valInput = container.querySelector('#ambiguity-selected-val');
      const idInput = container.querySelector('#ambiguity-selected-cand-id');
      if (valInput) valInput.value = candVal;
      if (idInput) idInput.value = candId;

      // Highlight card visually
      container.querySelectorAll('.candidate-card').forEach(card => card.style.borderColor = '#e0e0e0');
      btn.closest('.candidate-card').style.borderColor = '#303f9f';
    }

    if (action === 'preview-ambiguity-impact') {
      const qId = btn.dataset.questionId;
      const candId = container.querySelector('#ambiguity-selected-cand-id')?.value;
      const val = container.querySelector('#ambiguity-selected-val')?.value;
      btn.disabled = true;
      try {
        const res = await api(`/reviews/${reviewId}/ambiguities/${qId}/preview`, {
          method: 'POST',
          body: { candidateId: candId, value: val },
        });
        impactPreviewData = res.preview;
        const prevContainer = container.querySelector('#ambiguity-impact-preview-container');
        if (prevContainer) prevContainer.innerHTML = renderPreviewCard(res.preview);
      } catch (err) {
        alert(err.message || 'Failed to preview impact.');
      } finally {
        btn.disabled = false;
      }
    }

    if (action === 'confirm-ambiguity-resolution') {
      const qId = btn.dataset.questionId;
      const candId = container.querySelector('#ambiguity-selected-cand-id')?.value;
      const val = container.querySelector('#ambiguity-selected-val')?.value;
      const rationale = container.querySelector('#ambiguity-rationale')?.value || 'Confirmed by reviewer';
      btn.disabled = true;
      try {
        const res = await api(`/reviews/${reviewId}/ambiguities/${qId}/resolve`, {
          method: 'POST',
          body: { candidateId: candId, value: val, rationale },
        });
        if (res.impact) {
          lastImpactResult = res.impact;
        }
        onReviewUpdated(res.review);
      } catch (err) {
        alert(err.message || 'Failed to resolve ambiguity.');
      } finally {
        btn.disabled = false;
      }
    }

    if (action === 'request-more-evidence') {
      const qId = btn.dataset.questionId;
      const rationale = prompt('State the specific evidence required from product management:', 'Need signed specification or formulation certificate.');
      if (rationale != null) {
        btn.disabled = true;
        try {
          const res = await api(`/reviews/${reviewId}/ambiguities/${qId}/resolve`, {
            method: 'POST',
            body: { answerType: 'REQUEST_EVIDENCE', rationale },
          });
          onReviewUpdated(res.review);
        } catch (err) {
          alert(err.message);
        } finally {
          btn.disabled = false;
        }
      }
    }

    if (action === 'reopen-ambiguity') {
      const qId = btn.dataset.questionId;
      const reason = prompt('Reason for reopening this ambiguity question:', 'Revised specification uploaded.');
      if (reason != null) {
        btn.disabled = true;
        try {
          const res = await api(`/reviews/${reviewId}/ambiguities/${qId}/reopen`, {
            method: 'POST',
            body: { reason },
          });
          lastImpactResult = null;
          onReviewUpdated(res.review);
        } catch (err) {
          alert(err.message);
        } finally {
          btn.disabled = false;
        }
      }
    }

    if (action === 'dismiss-impact-banner') {
      lastImpactResult = null;
      onReviewUpdated();
    }
  });
}
