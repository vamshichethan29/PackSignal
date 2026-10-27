/**
 * PackSignal Multi-Jurisdiction Regulatory Switcher & Comparison Studio (public/regulatory-switcher.js)
 * Instant switching between USA (FDA), EU (Regulation 1169/2011), and India (FSSAI).
 * Target Market Review vs Cross-Market What-If Preview, statutory citations,
 * effective date handling, and 3-column cross-market comparison matrix.
 */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Client-side cache for instant zero-latency market switching
const regulatoryCache = new Map();

export function regulatorySwitcherMarkup(review, activeMarket = 'us', mode = 'target', effectiveDate = '2026-10-23') {
  const normMarket = String(activeMarket || 'us').toLowerCase();
  const isPreview = mode === 'preview';

  const marketDetails = {
    us: {
      flag: '🇺🇸',
      label: 'USA — FDA',
      sub: '21 CFR Part 101',
      authority: 'US Food and Drug Administration',
      governingAct: 'FD&C Act · 21 CFR 101.9, 101.4, FALCPA/FASTER Act',
    },
    eu: {
      flag: '🇪🇺',
      label: 'EU 1169/2011',
      sub: 'FIC Regulation',
      authority: 'European Union (Parliament & Council)',
      governingAct: 'Regulation (EU) No 1169/2011 on Food Information to Consumers',
    },
    india: {
      flag: '🇮🇳',
      label: 'FSSAI — India',
      sub: 'Labelling Reg 2020',
      authority: 'Food Safety and Standards Authority of India',
      governingAct: 'FSSAI (Labelling and Display) Regulations, 2020 as amended',
    },
  };

  const curr = marketDetails[normMarket] || marketDetails.us;

  return `
    <section class="regulatory-switcher-panel panel" data-regulatory-switcher>
      <div class="reg-switcher-top">
        <div class="reg-switcher-left">
          <div class="eyebrow">MULTI-JURISDICTION REGULATORY INTELLIGENCE</div>
          <div class="reg-market-segmented" role="group" aria-label="Target regulatory jurisdiction">
            <button type="button" class="reg-btn ${normMarket === 'us' ? 'active' : ''}" data-reg-market="us">
              <span class="reg-flag">🇺🇸</span>
              <b>USA — FDA</b>
              <small>21 CFR 101</small>
            </button>
            <button type="button" class="reg-btn ${normMarket === 'eu' ? 'active' : ''}" data-reg-market="eu">
              <span class="reg-flag">🇪🇺</span>
              <b>EU 1169/2011</b>
              <small>FIC Annexes</small>
            </button>
            <button type="button" class="reg-btn ${normMarket === 'india' ? 'active' : ''}" data-reg-market="india">
              <span class="reg-flag">🇮🇳</span>
              <b>FSSAI — India</b>
              <small>Labelling 2020</small>
            </button>
          </div>
        </div>

        <div class="reg-switcher-right">
          <div class="reg-mode-toggle" role="group" aria-label="Review mode">
            <button type="button" class="reg-mode-btn ${!isPreview ? 'active' : ''}" data-reg-mode="target" title="Evaluate packaging against designated destination market requirements">
              Target Market Review
            </button>
            <button type="button" class="reg-mode-btn ${isPreview ? 'active' : ''}" data-reg-mode="preview" title="Compare artwork against another market without defect claims">
              Cross-Market What-If
            </button>
          </div>

          <div class="reg-effective-date">
            <label>Law as of:
              <select id="reg-effective-date-select">
                <option value="2026-10-23" ${effectiveDate.startsWith('2026') ? 'selected' : ''}>Oct 2026 (Current Enacted Law)</option>
                <option value="2027-07-01" ${effectiveDate.startsWith('2027') ? 'selected' : ''}>July 2027 (Future Amendments)</option>
              </select>
            </label>
          </div>

          <button type="button" class="secondary reg-worklist-btn" data-reg-action="open-worklist" title="View actionable market worklist and prepress handoff">
            📋 Market Worklist
          </button>
          <button type="button" class="secondary reg-compare-btn" data-reg-action="compare-all-markets" title="Compare identical artwork across USA, EU, and India">
            📊 Compare All Markets
          </button>
        </div>
      </div>

      <div class="reg-jurisdiction-banner ${normMarket}">
        <div class="reg-banner-info">
          <span class="reg-banner-flag">${curr.flag}</span>
          <div>
            <b>${esc(curr.authority)}</b>
            <div class="subtle">${esc(curr.governingAct)}</div>
          </div>
        </div>
        <div class="reg-banner-mode-badge ${isPreview ? 'preview' : 'target'}">
          ${isPreview ? 'WHAT-IF PREVIEW: Not labeled as defect if product is destined for another market' : 'ACTIVE ENFORCEMENT: Verified against applicable destination market requirements'}
        </div>
      </div>
    </section>
  `;
}

/**
 * Builds the dedicated Market Readiness Worklist & Designer Handoff modal
 */
export function buildMarketWorklistModal(evalData, reviewId) {
  const meta = evalData?.jurisdictionMeta || {};
  const worklist = evalData?.worklist || {};
  const satisfied = worklist.satisfied || [];
  const discrepancies = worklist.discrepancies || [];
  const humanVerification = worklist.humanVerificationNeeded || [];
  const missingInfo = worklist.missingInformation || [];
  const exempt = worklist.notApplicable || [];
  const futureReqs = worklist.futureRequirements || [];
  const isPreview = evalData?.mode === 'preview';

  return `
    <div class="reg-matrix-dialog reg-worklist-dialog" id="reg-worklist-dialog">
      <div class="reg-matrix-header">
        <div>
          <div class="eyebrow">${esc(meta.flag || '🌐')} ${esc(meta.authority || 'REGULATORY JURISDICTION')}</div>
          <h2>${esc(meta.fullName || 'Market')} Readiness Worklist</h2>
          <p class="subtle">Target regulation: <b>${esc(meta.governingAct || 'Applicable Law')}</b> · Mode: <b>${isPreview ? 'Cross-Market What-If Adaptation' : 'Target Market Review'}</b></p>
        </div>
      </div>

      <div class="reg-matrix-stats-row">
        <div class="reg-stat-card" style="border-left:3px solid #22c55e">
          <b>Satisfied Checks</b>
          <span>${satisfied.length} requirements verified</span>
        </div>
        <div class="reg-stat-card" style="border-left:3px solid #ef4444">
          <b>Discrepancies</b>
          <span>${discrepancies.length} changes required</span>
        </div>
        <div class="reg-stat-card" style="border-left:3px solid #f59e0b">
          <b>Prepress Inspection</b>
          <span>${humanVerification.length} visual reviews</span>
        </div>
      </div>

      <div class="reg-worklist-sections" style="max-height:50vh;overflow-y:auto;padding-right:6px;display:flex;flex-direction:column;gap:14px;">
        ${discrepancies.length > 0 ? `
          <div class="worklist-group" style="background:#261314;border:1px solid #5c2225;border-radius:8px;padding:12px 14px;">
            <b style="color:#f87171;font-size:13px;display:block;margin-bottom:8px;">⚠️ Discrepancies Requiring Artwork Change (${discrepancies.length})</b>
            <ul style="margin:0;padding-left:18px;font-size:12px;color:#fecaca;line-height:1.6;">
              ${discrepancies.map(d => `
                <li style="margin-bottom:6px;">
                  <b>${esc(d.title)}:</b> ${esc(d.expected)}<br>
                  <span style="color:#fca5a5;">Observed: "${esc(d.observed)}"</span>
                  ${d.rule?.citation ? `<small style="display:block;color:#f87171;font-family:monospace;">Citation: ${esc(d.rule.citation)}</small>` : ''}
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        ${humanVerification.length > 0 ? `
          <div class="worklist-group" style="background:#261f12;border:1px solid #5c451f;border-radius:8px;padding:12px 14px;">
            <b style="color:#fbbf24;font-size:13px;display:block;margin-bottom:8px;">🔍 Items Requiring Prepress / Caliper Inspection (${humanVerification.length})</b>
            <ul style="margin:0;padding-left:18px;font-size:12px;color:#fef08a;line-height:1.6;">
              ${humanVerification.map(h => `
                <li style="margin-bottom:6px;">
                  <b>${esc(h.title)}:</b> ${esc(h.explanation)}
                  ${h.rule?.citation ? `<small style="display:block;color:#fde047;font-family:monospace;">Citation: ${esc(h.rule.citation)}</small>` : ''}
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        ${satisfied.length > 0 ? `
          <div class="worklist-group" style="background:#13261a;border:1px solid #235433;border-radius:8px;padding:12px 14px;">
            <b style="color:#4ade80;font-size:13px;display:block;margin-bottom:8px;">✅ Satisfied Requirements (${satisfied.length})</b>
            <ul style="margin:0;padding-left:18px;font-size:12px;color:#bbf7d0;line-height:1.6;">
              ${satisfied.map(s => `
                <li style="margin-bottom:4px;">
                  <b>${esc(s.title)}:</b> ${esc(s.observed || s.expected)}
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        ${missingInfo.length > 0 ? `
          <div class="worklist-group" style="background:#1c2128;border:1px solid #30363d;border-radius:8px;padding:12px 14px;">
            <b style="color:#94a3b8;font-size:13px;display:block;margin-bottom:8px;">ℹ️ Missing Source Information (${missingInfo.length})</b>
            <ul style="margin:0;padding-left:18px;font-size:12px;color:#cbd5e1;line-height:1.6;">
              ${missingInfo.map(m => `
                <li style="margin-bottom:4px;">
                  <b>${esc(m.title)}:</b> ${esc(m.explanation)}
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}
      </div>

      <div class="reg-handoff-box" style="margin-top:16px;background:#0d1813;border:1px solid #203a2c;border-radius:8px;padding:12px 14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <b style="font-size:12px;color:#e8f2e6;">📦 Designer &amp; Regulatory Prepress Handoff (Markdown)</b>
          <div style="display:flex;gap:8px;">
            <button type="button" class="secondary" id="btn-copy-handoff" style="font-size:11px;padding:5px 10px;">📋 Copy Markdown</button>
            ${reviewId && evalData?.jurisdiction ? `
              <a href="/api/reviews/${encodeURIComponent(reviewId)}/regulatory/${encodeURIComponent(evalData.jurisdiction)}/handoff" download class="secondary" style="font-size:11px;padding:5px 10px;text-decoration:none;display:inline-flex;align-items:center;background:#172c23;border:1px solid #385845;border-radius:6px;color:#e8f2e6;">💾 Download .md</a>
            ` : ''}
          </div>
        </div>
        <textarea id="handoff-markdown-textarea" readonly style="width:100%;height:100px;background:#09120e;color:#b4ceb8;font-family:monospace;font-size:11px;border:1px solid #1a3024;border-radius:6px;padding:8px;box-sizing:border-box;resize:vertical;">${esc(worklist.designerHandoff || '')}</textarea>
      </div>

      <div class="reg-matrix-footer">
        <p class="subtle">Disclaimer: This worklist is an evidence-backed packaging QA checklist. It does not certify official statutory legal approval.</p>
        <button type="button" class="primary" data-action="close">Close Worklist</button>
      </div>
    </div>
  `;
}

/**
 * Builds the interactive 3-column cross-market comparison matrix modal
 */
export function buildComparisonMatrixModal(comparisonData) {
  const matrix = comparisonData?.comparisonMatrix || [];
  const usCounts = comparisonData?.us?.counts || {};
  const euCounts = comparisonData?.eu?.counts || {};
  const inCounts = comparisonData?.india?.counts || {};

  return `
    <div class="reg-matrix-dialog" id="reg-matrix-dialog">
      <div class="reg-matrix-header">
        <div>
          <div class="eyebrow">CROSS-MARKET REGULATORY COMPARISON MATRIX</div>
          <h2>Three-Jurisdiction Packaging Evaluation</h2>
          <p class="subtle">Evaluating the identical artwork across USA (FDA), European Union (FIC 1169/2011), and India (FSSAI) requirements.</p>
        </div>
      </div>

      <div class="reg-matrix-stats-row">
        <div class="reg-stat-card us">
          <b>🇺🇸 USA — FDA</b>
          <span>${usCounts.issue || 0} Issues · ${usCounts.review || 0} Review · ${usCounts.match || 0} Matches</span>
        </div>
        <div class="reg-stat-card eu">
          <b>🇪🇺 EU 1169/2011</b>
          <span>${euCounts.issue || 0} Issues · ${euCounts.review || 0} Review · ${euCounts.match || 0} Matches</span>
        </div>
        <div class="reg-stat-card india">
          <b>🇮🇳 India — FSSAI</b>
          <span>${inCounts.issue || 0} Issues · ${inCounts.review || 0} Review · ${inCounts.match || 0} Matches</span>
        </div>
      </div>

      <div class="reg-matrix-table-wrap">
        <table class="reg-matrix-table">
          <thead>
            <tr>
              <th style="width:22%">Regulatory Requirement</th>
              <th style="width:26%">🇺🇸 USA (FDA)</th>
              <th style="width:26%">🇪🇺 EU (Reg 1169/2011)</th>
              <th style="width:26%">🇮🇳 India (FSSAI)</th>
            </tr>
          </thead>
          <tbody>
            ${matrix.map(row => `
              <tr class="reg-matrix-row">
                <td class="req-topic">
                  <b>${esc(row.topic)}</b>
                  <small>${esc(row.category)}</small>
                  <p class="diff-note">${esc(row.keyDifference)}</p>
                </td>
                <td class="cell-market ${row.usa.status}">
                  <span class="badge ${badgeColor(row.usa.status)}">${esc(row.usa.status)}</span>
                  <div class="cell-desc">${esc(row.usa.requirement)}</div>
                  <small class="cell-cite">${esc(row.usa.citation)}</small>
                </td>
                <td class="cell-market ${row.eu.status}">
                  <span class="badge ${badgeColor(row.eu.status)}">${esc(row.eu.status)}</span>
                  <div class="cell-desc">${esc(row.eu.requirement)}</div>
                  <small class="cell-cite">${esc(row.eu.citation)}</small>
                </td>
                <td class="cell-market ${row.india.status}">
                  <span class="badge ${badgeColor(row.india.status)}">${esc(row.india.status)}</span>
                  <div class="cell-desc">${esc(row.india.requirement)}</div>
                  <small class="cell-cite">${esc(row.india.citation)}</small>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="reg-matrix-footer">
        <p class="subtle">Scope: Screened against versioned regulatory standards. This report supports packaging change control and prepress review; it does not constitute statutory legal certification.</p>
        <button type="button" class="primary" data-action="close">Close Comparison Matrix</button>
      </div>
    </div>
  `;
}

function badgeColor(status) {
  if (status === 'match') return 'green';
  if (status === 'issue') return 'issue';
  if (status === 'review') return 'review';
  if (status === 'not_applicable') return 'gray';
  return 'info';
}

/**
 * Mounts interactive handlers for the Regulatory Switcher
 */
export function mountRegulatorySwitcher(container, { review, onSwitchMarket, onOpenMatrix, onOpenWorklist, onSwitchMode }) {
  if (!container) return;

  // Handle market switcher clicks
  container.querySelectorAll('[data-reg-market]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const market = btn.dataset.regMarket;
      if (onSwitchMarket) {
        onSwitchMarket(market);
      }
    });
  });

  // Handle mode toggle (Target Market Review vs Cross-Market What-If)
  container.querySelectorAll('[data-reg-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.regMode;
      container.querySelectorAll('[data-reg-mode]').forEach(b => b.classList.toggle('active', b === btn));
      const bannerBadge = container.querySelector('.reg-banner-mode-badge');
      if (bannerBadge) {
        if (mode === 'preview') {
          bannerBadge.className = 'reg-banner-mode-badge preview';
          bannerBadge.textContent = 'WHAT-IF PREVIEW: Not labeled as defect if product is destined for another market';
        } else {
          bannerBadge.className = 'reg-banner-mode-badge target';
          bannerBadge.textContent = 'ACTIVE ENFORCEMENT: Verified against applicable destination market requirements';
        }
      }
      if (onSwitchMode) {
        onSwitchMode(mode);
      }
    });
  });

  // Handle effective date change
  const dateSelect = container.querySelector('#reg-effective-date-select');
  if (dateSelect) {
    dateSelect.addEventListener('change', () => {
      const activeBtn = container.querySelector('[data-reg-market].active');
      const market = activeBtn?.dataset.regMarket || 'us';
      if (onSwitchMarket) {
        onSwitchMarket(market, dateSelect.value);
      }
    });
  }

  // Handle Compare All Markets button
  const compareBtn = container.querySelector('[data-reg-action="compare-all-markets"]');
  if (compareBtn) {
    compareBtn.addEventListener('click', async () => {
      if (onOpenMatrix) {
        onOpenMatrix();
      }
    });
  }

  // Handle Market Worklist button
  const worklistBtn = container.querySelector('[data-reg-action="open-worklist"]');
  if (worklistBtn) {
    worklistBtn.addEventListener('click', async () => {
      if (onOpenWorklist) {
        onOpenWorklist();
      }
    });
  }
}
