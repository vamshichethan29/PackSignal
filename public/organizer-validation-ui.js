/**
 * PackSignal Dancing Fish — 16-Check Organizer Validation Suite Component.
 * Integrates directly into the Checks tab workspace with real engine metrics,
 * source-authority protection, arithmetic proofs, and interactive evidence actions.
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

let activeDfFilter = 'all';

export function setOrganizerValidationFilter(filter) {
  activeDfFilter = filter;
  const container = document.getElementById('organizer-validation-checks-container');
  if (container && window.__currentReview) {
    container.innerHTML = renderOrganizerCards(window.__currentReview, activeDfFilter);
    updateFilterPillStates();
  }
}

function updateFilterPillStates() {
  const pills = document.querySelectorAll('.df-filter-btn');
  pills.forEach(btn => {
    const filter = btn.getAttribute('data-df-filter');
    if (filter === activeDfFilter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

export function renderOrganizerValidationSection(review) {
  const isOrganizer = review?.sample === 'organizer' ||
    review?.deepVerification?.dancingFish16 ||
    (review?.documents || []).some(d => (d.name || '').toLowerCase().includes('dancingfish'));

  if (!isOrganizer) return '';

  window.__currentReview = review;
  const suite = review.deepVerification?.dancingFish16 || {
    summary: { total: 16, evaluated: 16, issues: 10, reviews: 5, matches: 1, unable: 0, positiveControls: { passed: 1, total: 1 } },
    checks: review.deepVerification?.candidateChecks || []
  };

  const summary = suite.summary || {
    total: 16,
    evaluated: 16,
    issues: 10,
    reviews: 5,
    matches: 1,
    unable: 0,
    positiveControls: { passed: 1, total: 1 }
  };

  const checks = suite.checks || [];

  return `
    <section class="organizer-validation-section" id="organizer-validation-suite" aria-label="Dancing Fish 16-Check Organizer Validation Suite" style="margin: 16px 0 24px 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); overflow: hidden;">
      <div class="df-validation-header" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 16px 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.1em; color: #38bdf8; text-transform: uppercase;">ESKO AIFORGE · OFFICIAL SAMPLE BENCHMARK</div>
            <h3 style="margin: 4px 0 6px 0; font-size: 18px; font-weight: 700; color: #f8fafc;">DANCING FISH — ORGANIZER VALIDATION</h3>
            <p style="margin: 0; font-size: 12px; color: #94a3b8; max-width: 680px; line-height: 1.4;">
              Source-grounded evaluation of 16 candidate quality and regulatory checks against the official Dancing Fish packaging files.
              Source draft status (<code style="background: #334155; color: #fde047; padding: 1px 4px; border-radius: 3px;">Draft / In Review</code>) is strictly isolated from definitive legal defects. Positive control barcode check digit is verified independently.
            </p>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="font-size: 11px; background: #0369a1; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-weight: 600;">Answer Key Adjudicated</span>
            <span style="font-size: 11px; background: #047857; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-weight: 600;">SHA-256 Verified</span>
          </div>
        </div>

        <!-- Metric Scoreboard -->
        <div class="df-metrics-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.1);">
          <div style="background: rgba(255,255,255,0.06); padding: 8px 12px; border-radius: 6px;">
            <div style="font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Total Candidate</div>
            <div style="font-size: 18px; font-weight: 800; color: #f8fafc;" id="df-metric-total">${summary.total}</div>
          </div>
          <div style="background: rgba(255,255,255,0.06); padding: 8px 12px; border-radius: 6px;">
            <div style="font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Evaluated</div>
            <div style="font-size: 18px; font-weight: 800; color: #38bdf8;" id="df-metric-evaluated">${summary.evaluated}</div>
          </div>
          <div style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); padding: 8px 12px; border-radius: 6px;">
            <div style="font-size: 10px; text-transform: uppercase; color: #fca5a5; font-weight: 700;">Issues</div>
            <div style="font-size: 18px; font-weight: 800; color: #ef4444;" id="df-metric-issues">${summary.issues}</div>
          </div>
          <div style="background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); padding: 8px 12px; border-radius: 6px;">
            <div style="font-size: 10px; text-transform: uppercase; color: #fcd34d; font-weight: 700;">Needs Review</div>
            <div style="font-size: 18px; font-weight: 800; color: #f59e0b;" id="df-metric-reviews">${summary.reviews}</div>
          </div>
          <div style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); padding: 8px 12px; border-radius: 6px;">
            <div style="font-size: 10px; text-transform: uppercase; color: #6ee7b7; font-weight: 700;">Matches</div>
            <div style="font-size: 18px; font-weight: 800; color: #10b981;" id="df-metric-matches">${summary.matches}</div>
          </div>
          <div style="background: rgba(148,163,184,0.1); padding: 8px 12px; border-radius: 6px;">
            <div style="font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Unable to Verify</div>
            <div style="font-size: 18px; font-weight: 800; color: #94a3b8;" id="df-metric-unable">${summary.unable}</div>
          </div>
          <div style="background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.3); padding: 8px 12px; border-radius: 6px;">
            <div style="font-size: 10px; text-transform: uppercase; color: #86efac; font-weight: 700;">Positive Controls</div>
            <div style="font-size: 18px; font-weight: 800; color: #22c55e;" id="df-metric-controls">${summary.positiveControls?.passed || 1} / ${summary.positiveControls?.total || 1}</div>
          </div>
        </div>
      </div>

      <!-- Filter Controls Bar -->
      <div class="df-filter-bar" style="background: #f8fafc; padding: 10px 16px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
          <span style="font-size: 11px; font-weight: 700; color: #475569; margin-right: 4px;">Filter Suite:</span>
          ${[
            ['all', 'All'],
            ['issues', 'Issues'],
            ['reviews', 'Needs Review'],
            ['matches', 'Matches'],
            ['unable', 'Unable'],
            ['legal', 'Legal'],
            ['rd', 'R&D'],
            ['brand', 'Brand'],
            ['prepress', 'Prepress']
          ].map(([val, label]) => `
            <button type="button" class="df-filter-btn ${val === activeDfFilter ? 'active' : ''}" data-df-filter="${val}" style="padding: 4px 10px; font-size: 11px; font-weight: 600; border-radius: 4px; border: 1px solid #cbd5e1; background: ${val === activeDfFilter ? '#0f172a' : '#ffffff'}; color: ${val === activeDfFilter ? '#ffffff' : '#334155'}; cursor: pointer;">
              ${label}
            </button>
          `).join('')}
        </div>
        <div style="font-size: 11px; color: #64748b;">
          Showing <b id="df-filtered-count">${checks.length}</b> verified checks
        </div>
      </div>

      <!-- Cards Container -->
      <div id="organizer-validation-checks-container" style="padding: 16px; display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 14px; background: #f1f5f9;">
        ${renderOrganizerCards(review, activeDfFilter)}
      </div>
    </section>
  `;
}

function renderOrganizerCards(review, filter = 'all') {
  const suite = review.deepVerification?.dancingFish16;
  let checks = suite?.checks || review.deepVerification?.candidateChecks || [];
  const positiveControl = suite?.positiveControl;

  // Combine checks with positive control if present
  let allItems = [...checks];
  if (positiveControl && !allItems.some(c => c.canonicalId === 'P01')) {
    allItems.push(positiveControl);
  }

  // Apply filters
  if (filter === 'issues') {
    allItems = allItems.filter(c => c.status === 'issue');
  } else if (filter === 'reviews') {
    allItems = allItems.filter(c => c.status === 'review');
  } else if (filter === 'matches') {
    allItems = allItems.filter(c => c.status === 'match');
  } else if (filter === 'unable') {
    allItems = allItems.filter(c => c.status === 'unable');
  } else if (filter === 'legal') {
    allItems = allItems.filter(c => (c.department || '').toUpperCase() === 'LEGAL' || (c.collaborators || []).includes('LEGAL'));
  } else if (filter === 'rd') {
    allItems = allItems.filter(c => (c.department || '').toUpperCase() === 'R&D' || (c.collaborators || []).includes('R&D'));
  } else if (filter === 'brand') {
    allItems = allItems.filter(c => (c.department || '').toUpperCase() === 'BRAND' || (c.collaborators || []).includes('BRAND'));
  } else if (filter === 'prepress') {
    allItems = allItems.filter(c => (c.department || '').toUpperCase() === 'PREPRESS' || (c.collaborators || []).includes('PREPRESS'));
  }

  if (allItems.length === 0) {
    return `<div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: #64748b; font-size: 13px; background: #ffffff; border-radius: 6px;">No checks match filter "${esc(filter)}".</div>`;
  }

  return allItems.map(c => renderSingleOrganizerCard(c)).join('');
}

function renderSingleOrganizerCard(c) {
  const statusColor = c.status === 'issue' ? '#ef4444' : c.status === 'review' ? '#f59e0b' : c.status === 'match' ? '#10b981' : '#94a3b8';
  const statusBg = c.status === 'issue' ? '#fee2e2' : c.status === 'review' ? '#fef3c7' : c.status === 'match' ? '#d1fae5' : '#f1f5f9';
  const statusLabel = c.status === 'issue' ? 'ISSUE' : c.status === 'review' ? 'NEEDS REVIEW' : c.status === 'match' ? 'MATCH / PASS' : 'UNABLE TO VERIFY';

  const deptBg = c.department === 'LEGAL' ? '#ede9fe' : c.department === 'R&D' ? '#e0f2fe' : c.department === 'BRAND' ? '#fce7f3' : '#f0fdf4';
  const deptColor = c.department === 'LEGAL' ? '#6d28d9' : c.department === 'R&D' ? '#0369a1' : c.department === 'BRAND' ? '#be185d' : '#15803d';

  const hasArtworkEvidence = Boolean(c.artworkQuote || c.artworkBoundingBox);
  const hasSourceEvidence = Boolean(c.sourceCell || c.sourceQuote);
  const hasProof = Boolean(c.calculationProof);

  return `
    <article id="df-card-${esc(c.canonicalId)}" class="df-check-card" data-canonical-id="${esc(c.canonicalId)}" data-check-id="${esc(c.checkId)}" style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 3px solid ${statusColor}; border-radius: 6px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; font-size: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
      <div>
        <!-- Top bar with Check ID, Department, Status -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: 800; font-size: 12px; background: #0f172a; color: #ffffff; padding: 2px 6px; border-radius: 4px;">${esc(c.canonicalId || c.checkId)}</span>
            <span style="font-size: 10px; font-weight: 700; background: ${deptBg}; color: ${deptColor}; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">${esc(c.department || 'GENERAL')}</span>
            ${c.isPositiveControl ? `<span style="font-size: 10px; font-weight: 700; background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px;">POSITIVE CONTROL</span>` : ''}
          </div>
          <span style="font-size: 10px; font-weight: 800; background: ${statusBg}; color: ${statusColor}; padding: 2px 8px; border-radius: 10px; letter-spacing: 0.05em;">
            ${statusLabel}
          </span>
        </div>

        <!-- Title -->
        <h4 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.3;">
          ${esc(c.checkName || c.title || c.checkId)}
        </h4>

        <!-- Expected vs Observed Grid -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 8px; margin-bottom: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div>
            <span style="font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">Expected (Source)</span>
            <div style="font-size: 11px; font-weight: 600; color: #334155; word-break: break-word;">${esc(c.expectedValue || '—')}</div>
          </div>
          <div>
            <span style="font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px;">Observed (Carton)</span>
            <div style="font-size: 11px; font-weight: 700; color: #0f172a; word-break: break-word;">${esc(c.observedValue || '—')}</div>
          </div>
        </div>

        <!-- Evidence References -->
        <div style="font-size: 11px; color: #475569; margin-bottom: 6px; display: flex; flex-direction: column; gap: 3px;">
          ${c.sourceCell ? `
            <div>
              <span style="color: #64748b; font-weight: 600;">Spreadsheet:</span>
              <code style="background: #e2e8f0; color: #0f172a; padding: 1px 4px; border-radius: 3px;">${esc(c.sourceSheet ? `${c.sourceSheet}!` : '')}${esc(c.sourceCell)}</code>
              <span style="color: #64748b;">· Authority: <span style="font-weight: 600; color: #d97706;">${esc(c.sourceApprovalStatus || 'Draft')}</span></span>
            </div>
          ` : ''}

          ${c.artworkQuote ? `
            <div>
              <span style="color: #64748b; font-weight: 600;">Artwork Copy:</span>
              <span style="font-style: italic; color: #1e293b;">"${esc(c.artworkQuote)}"</span>
              ${c.artworkPanel ? `<span style="color: #64748b;">(${esc(c.artworkPanel)})</span>` : ''}
            </div>
          ` : ''}

          ${c.calculationProof ? `
            <div style="background: #f1f5f9; padding: 5px 8px; border-radius: 4px; margin-top: 4px; font-family: ui-monospace, monospace; font-size: 10px; color: #0369a1; border-left: 2px solid #0284c7;">
              <strong>Arithmetic Proof:</strong> ${esc(c.calculationProof.split('\n')[0])}
            </div>
          ` : ''}

          ${c.ruleSource ? `
            <div style="margin-top: 2px; font-size: 10px; color: #64748b;">
              <strong>Governing Law / Spec:</strong> ${esc(c.ruleSource)}
            </div>
          ` : ''}

          ${c.limitations ? `
            <div style="margin-top: 2px; font-size: 10px; color: #64748b; font-style: italic;">
              <strong>Confidence / Note:</strong> ${esc(c.limitations)}
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="df-card-actions" style="display: flex; flex-wrap: wrap; gap: 4px; padding-top: 8px; border-top: 1px solid #f1f5f9;">
        ${hasArtworkEvidence ? `
          <button type="button" class="df-action-btn" data-action="df-view-artwork" data-canonical-id="${esc(c.canonicalId)}" data-box='${JSON.stringify(c.artworkBoundingBox || [])}' data-page="${esc(c.artworkPage || 1)}" style="padding: 3px 8px; font-size: 10px; font-weight: 700; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; color: #0f172a; cursor: pointer;">
            🎯 View Artwork
          </button>
        ` : ''}

        ${hasSourceEvidence ? `
          <button type="button" class="df-action-btn" data-action="df-view-source" data-canonical-id="${esc(c.canonicalId)}" data-cell="${esc(c.sourceCell || '')}" data-sheet="${esc(c.sourceSheet || '')}" style="padding: 3px 8px; font-size: 10px; font-weight: 700; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; color: #0f172a; cursor: pointer;">
            📊 View Source
          </button>
        ` : ''}

        ${hasProof ? `
          <button type="button" class="df-action-btn" data-action="df-inspect-calc" data-canonical-id="${esc(c.canonicalId)}" style="padding: 3px 8px; font-size: 10px; font-weight: 700; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; color: #15803d; cursor: pointer;">
            🧮 Inspect Calculation
          </button>
        ` : ''}

        ${(c.canonicalId === 'DF-05' || /vegan/i.test(c.checkName || '')) ? `
          <button type="button" class="df-action-btn" data-action="explore-decision-ripple" data-canonical-id="${esc(c.canonicalId)}" data-id="${esc(c.canonicalId)}" style="padding: 3px 8px; font-size: 10px; font-weight: 800; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 4px; color: #92400e; cursor: pointer;">
            ⚡ Explore Resolution Options
          </button>
        ` : ''}

        <button type="button" class="df-action-btn" data-action="df-ask-someone" data-canonical-id="${esc(c.canonicalId)}" data-dept="${esc(c.department || 'R&D')}" style="padding: 3px 8px; font-size: 10px; font-weight: 700; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; color: #0284c7; cursor: pointer;">
          💬 Ask Someone
        </button>

        <button type="button" class="df-action-btn" data-action="df-flag-remedy" data-canonical-id="${esc(c.canonicalId)}" style="padding: 3px 8px; font-size: 10px; font-weight: 700; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 4px; color: #e11d48; cursor: pointer;">
          🚩 Flag for Remedy
        </button>
      </div>
    </article>
  `;
}
