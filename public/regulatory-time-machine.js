/**
 * @file regulatory-time-machine.js
 * 
 * PackSignal — Regulatory Time Machine & Launch Date Slider
 * 
 * Interactive temporal controls:
 * - 2026 → 2027 → 2028 Launch Date Slider with exact calendar date picker
 * - Timeline markers for verified regulatory cutovers
 * - Client-side responsive preview + debounced server reanalysis
 * - Categorized "What Changed for This Launch Date?" change summary
 * - Date A vs Date B comparison studio
 * - Authoritative rule trust center integration
 */

const START_DATE = '2026-01-01';
const END_DATE = '2028-12-31';
const BASELINE_DATE = '2026-10-25';

function dateToDays(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const start = new Date(START_DATE + 'T00:00:00Z');
  return Math.round((d - start) / 86400000);
}

function daysToDate(days) {
  const start = new Date(START_DATE + 'T00:00:00Z');
  const d = new Date(start.getTime() + days * 86400000);
  return d.toISOString().slice(0, 10);
}

const TOTAL_DAYS = dateToDays(END_DATE);

export function mountRegulatoryTimeMachine(container, {
  review,
  api,
  onDateChanged,
  onOpenSourceModal,
  onOpenAskSomeone
} = {}) {
  if (!container) return;

  let currentLaunchDate = review.options?.launchDate || review.launchDate || BASELINE_DATE;
  let currentCategory = review.options?.productCategory || 'food';
  const rawMarket = String(review.options?.marketPreset || review.market || 'india').toLowerCase();
  let currentMarket = /in|india/.test(rawMarket) ? 'india' : (/eu|europe/.test(rawMarket) ? 'eu' : 'us');
  let isPanelOpen = container.dataset.panelOpen === 'true';
  let debounceTimer = null;
  let requestCounter = 0;
  let lastEvaluatedData = null;

  function render() {
    const sliderVal = Math.min(Math.max(0, dateToDays(currentLaunchDate)), TOTAL_DAYS);

    container.innerHTML = `
      <div class="regulatory-time-machine-bar" id="rtm-root">
        <div class="rtm-header-row">
          <div class="rtm-brand-badge">
            <span class="rtm-pill">⏱ TIME MACHINE</span>
            <span class="rtm-title">Regulatory Launch Horizon</span>
          </div>

          <div class="rtm-selectors-group">
            <label class="rtm-control-label" for="rtm-market-select">Market:</label>
            <select id="rtm-market-select" class="rtm-select" aria-label="Target Market">
              <option value="india" ${currentMarket === 'india' ? 'selected' : ''}>India (FSSAI / LM)</option>
              <option value="us" ${currentMarket === 'us' ? 'selected' : ''}>United States (FDA)</option>
              <option value="eu" ${currentMarket === 'eu' ? 'selected' : ''}>European Union</option>
            </select>

            <label class="rtm-control-label" for="rtm-category-select">Product Scope:</label>
            <select id="rtm-category-select" class="rtm-select" aria-label="Product Category">
              <option value="food" ${currentCategory === 'food' ? 'selected' : ''}>Food / Granola</option>
              <option value="cosmetic" ${currentCategory === 'cosmetic' ? 'selected' : ''}>Cosmetics / Personal Care</option>
              <option value="supplement" ${currentCategory === 'supplement' ? 'selected' : ''}>Dietary Supplement</option>
              <option value="beverage" ${currentCategory === 'beverage' ? 'selected' : ''}>Beverage</option>
            </select>

            <label class="rtm-control-label" for="rtm-exact-date">Launch Date:</label>
            <input type="date" id="rtm-exact-date" class="rtm-date-input" min="${START_DATE}" max="${END_DATE}" value="${currentLaunchDate}" aria-label="Exact Planned Launch Date">
          </div>
        </div>

        <!-- Slider Track with Markers -->
        <div class="rtm-slider-container">
          <div class="rtm-slider-track-wrap">
            <input type="range" id="rtm-slider" class="rtm-range-slider" min="0" max="${TOTAL_DAYS}" value="${sliderVal}" aria-label="Launch Year Slider 2026 to 2028">

            <!-- Real Timeline Markers on Track -->
            <!-- 1. Review Baseline -->
            <div class="rtm-timeline-marker rtm-marker-solid" style="left:${(dateToDays('2026-10-25') / TOTAL_DAYS) * 100}%" title="25 Oct 2026: Current Review Baseline" data-date="2026-10-25"></div>

            <!-- 2. FSSAI Amendment 1 July 2027 -->
            <div class="rtm-timeline-marker rtm-marker-amendment" style="left:${(dateToDays('2027-07-01') / TOTAL_DAYS) * 100}%" title="01 Jul 2027: FSSAI 2026 1st Amendment (Mandatory Bold % RDA)" data-date="2027-07-01" data-rule="FSSAI-LDR-2026-AMEND-BOLD-RDA"></div>

            <!-- 3. Company PCR Standard 1 Jan 2028 -->
            <div class="rtm-timeline-marker rtm-marker-company" style="left:${(dateToDays('2028-01-01') / TOTAL_DAYS) * 100}%" title="01 Jan 2028: Corporate PCR Content Standard" data-date="2028-01-01" data-rule="COMPANY-SUSTAINABLE-PACK-2028"></div>
          </div>

          <div class="rtm-slider-ticks">
            <span>2026 (Baseline)</span>
            <span>Mid 2026</span>
            <span style="color:#ea580c;">01 Jul 2027 (FSSAI Cutover)</span>
            <span>Late 2027</span>
            <span style="color:#16a34a;">01 Jan 2028 (PCR Standard)</span>
            <span>End 2028</span>
          </div>
        </div>

        <!-- Quick Buttons & Live Metric Summary -->
        <div class="rtm-footer-row">
          <div class="rtm-quick-buttons">
            <button type="button" class="rtm-btn" id="rtm-btn-today" title="Set to review baseline">Today (${BASELINE_DATE})</button>
            <button type="button" class="rtm-btn" id="rtm-btn-fssai" title="Jump to FSSAI amendment commencement" style="color:#ea580c;border-color:#fdba74;">01 Jul 2027</button>
            <button type="button" class="rtm-btn" id="rtm-btn-compare">Compare Dates</button>
            <button type="button" class="rtm-btn rtm-btn-primary" id="rtm-btn-toggle-changes">
              ${isPanelOpen ? 'Hide Change Details ▲' : 'What Changed for This Date? ▼'}
            </button>
          </div>

          <div class="rtm-metrics-strip" id="rtm-metrics-container">
            <span class="rtm-metric-badge rtm-metric-active" id="rtm-badge-active">Loading rules…</span>
            <span class="rtm-metric-badge rtm-metric-new" id="rtm-badge-new" style="display:none;">0 New</span>
            <span class="rtm-metric-badge rtm-metric-proposed" id="rtm-badge-proposed">Draft / Monitor</span>
            <span class="rtm-metric-badge rtm-metric-snapshot" id="rtm-badge-snapshot" title="Regulatory Audit Snapshot">Snapshot</span>
          </div>
        </div>

        <!-- Collapsible Change Summary Panel -->
        <div class="rtm-change-panel" id="rtm-change-panel" style="display:${isPanelOpen ? 'flex' : 'none'};">
          <div class="rtm-change-header">
            <span class="rtm-change-title">What Changed for Launch Date: <b>${currentLaunchDate}</b></span>
            <span style="font-size:12px;color:#64748b;">Market: <b>${currentMarket.toUpperCase()}</b> · Scope: <b>${currentCategory.toUpperCase()}</b></span>
          </div>
          <div id="rtm-change-content">
            <p style="font-size:13px;color:#64748b;">Evaluating temporal regulatory differences…</p>
          </div>
        </div>
      </div>
    `;

    bindEvents();
    fetchEvaluationData();
  }

  function bindEvents() {
    const slider = container.querySelector('#rtm-slider');
    const dateInput = container.querySelector('#rtm-exact-date');
    const marketSelect = container.querySelector('#rtm-market-select');
    const categorySelect = container.querySelector('#rtm-category-select');
    const btnToday = container.querySelector('#rtm-btn-today');
    const btnFssai = container.querySelector('#rtm-btn-fssai');
    const btnCompare = container.querySelector('#rtm-btn-compare');
    const btnToggle = container.querySelector('#rtm-btn-toggle-changes');

    // Slider movement
    slider.addEventListener('input', (e) => {
      const nextDate = daysToDate(Number(e.target.value));
      currentLaunchDate = nextDate;
      dateInput.value = nextDate;
      handleDateChange(nextDate);
    });

    // Exact date input change
    dateInput.addEventListener('change', (e) => {
      let val = e.target.value;
      if (val < START_DATE) val = START_DATE;
      if (val > END_DATE) val = END_DATE;
      currentLaunchDate = val;
      slider.value = dateToDays(val);
      handleDateChange(val);
    });

    // Market change
    marketSelect.addEventListener('change', (e) => {
      currentMarket = e.target.value;
      handleDateChange(currentLaunchDate, true);
    });

    // Category change
    categorySelect.addEventListener('change', (e) => {
      currentCategory = e.target.value;
      handleDateChange(currentLaunchDate, true);
    });

    // Quick buttons
    btnToday.addEventListener('click', () => {
      currentLaunchDate = BASELINE_DATE;
      slider.value = dateToDays(BASELINE_DATE);
      dateInput.value = BASELINE_DATE;
      handleDateChange(BASELINE_DATE);
    });

    btnFssai.addEventListener('click', () => {
      const fssaiDate = '2027-07-01';
      currentLaunchDate = fssaiDate;
      slider.value = dateToDays(fssaiDate);
      dateInput.value = fssaiDate;
      handleDateChange(fssaiDate, true);
    });

    btnCompare.addEventListener('click', () => {
      openDateComparisonModal();
    });

    btnToggle.addEventListener('click', () => {
      isPanelOpen = !isPanelOpen;
      container.dataset.panelOpen = isPanelOpen ? 'true' : 'false';
      const panel = container.querySelector('#rtm-change-panel');
      if (panel) {
        panel.style.display = isPanelOpen ? 'flex' : 'none';
        btnToggle.textContent = isPanelOpen ? 'Hide Change Details ▲' : 'What Changed for This Date? ▼';
      }
    });

    // Timeline markers click
    container.querySelectorAll('.rtm-timeline-marker').forEach(marker => {
      marker.addEventListener('click', (e) => {
        const d = e.target.getAttribute('data-date');
        const ruleId = e.target.getAttribute('data-rule');
        if (d) {
          currentLaunchDate = d;
          slider.value = dateToDays(d);
          dateInput.value = d;
          handleDateChange(d);
        }
        if (ruleId && onOpenSourceModal) {
          onOpenSourceModal(ruleId);
        }
      });
    });
  }

  function handleDateChange(newDate, forceServer = false) {
    clearTimeout(debounceTimer);
    updateClientPreview(newDate);

    debounceTimer = setTimeout(() => {
      saveLaunchDate(newDate, currentCategory);
    }, forceServer ? 0 : 300);
  }

  function updateClientPreview(dateStr) {
    const badgeActive = container.querySelector('#rtm-badge-active');
    const badgeNew = container.querySelector('#rtm-badge-new');
    const badgeProposed = container.querySelector('#rtm-badge-proposed');

    // Quick reactive feedback
    const isJuly2027 = dateStr >= '2027-07-01';
    if (badgeActive) {
      badgeActive.textContent = `Evaluating for ${dateStr}…`;
    }
    if (badgeNew) {
      if (isJuly2027 && currentMarket === 'india' && currentCategory === 'food') {
        badgeNew.style.display = 'inline-flex';
        badgeNew.textContent = '+1 New Requirement';
      } else {
        badgeNew.style.display = 'none';
      }
    }
  }

  async function fetchEvaluationData() {
    const thisToken = ++requestCounter;
    try {
      const res = await api(`/api/reviews/${review.id}/regulatory-timeline?market=${currentMarket}&category=${currentCategory}&launchDate=${currentLaunchDate}`);
      if (thisToken !== requestCounter) return; // Stale request guard
      if (res.status === 'SUCCESS' || res.temporalEvaluation) {
        lastEvaluatedData = res;
        updateUIWithData(res);
      }
    } catch (err) {
      console.warn('Could not fetch regulatory timeline:', err);
    }
  }

  async function saveLaunchDate(dateStr, categoryStr) {
    const thisToken = ++requestCounter;
    try {
      const res = await api(`/api/reviews/${review.id}/launch-date`, {
        method: 'POST',
        body: { launchDate: dateStr, productCategory: categoryStr, market: currentMarket }
      });
      if (thisToken !== requestCounter) return;

      lastEvaluatedData = res.timeMachine || res;
      updateUIWithData(res.timeMachine || res);

      if (onDateChanged) {
        onDateChanged(res);
      }
    } catch (err) {
      console.error('Error updating launch date:', err);
    }
  }

  function updateUIWithData(data) {
    const evalData = data.temporalEvaluation;
    if (!evalData) return;

    const badgeActive = container.querySelector('#rtm-badge-active');
    const badgeNew = container.querySelector('#rtm-badge-new');
    const badgeProposed = container.querySelector('#rtm-badge-proposed');
    const badgeSnapshot = container.querySelector('#rtm-badge-snapshot');
    const changeContent = container.querySelector('#rtm-change-content');

    const counts = evalData.summaryCounts || {};

    if (badgeActive) {
      badgeActive.textContent = `Rules Active: ${counts.applicableNow || 0}`;
    }
    if (badgeNew) {
      if ((counts.confirmedFuture || 0) > 0) {
        badgeNew.style.display = 'inline-flex';
        badgeNew.textContent = `+${counts.confirmedFuture} New at Launch`;
      } else {
        badgeNew.style.display = 'none';
      }
    }
    if (badgeProposed) {
      badgeProposed.textContent = `${counts.proposedInitiatives || 0} Proposed / Monitor`;
    }
    if (badgeSnapshot) {
      badgeSnapshot.textContent = `Snapshot: ${evalData.snapshotId.slice(0, 15)}…`;
      badgeSnapshot.title = `Immutable Snapshot ID: ${evalData.snapshotId} (Knowledge Date: ${evalData.knowledgeDate})`;
    }

    if (changeContent) {
      renderChangeContent(changeContent, evalData);
    }
  }

  function renderChangeContent(target, evalData) {
    const { categorized } = evalData;
    const newlyActive = categorized.confirmedFutureRequirements || [];
    const proposed = categorized.proposedInitiatives || [];
    const superseded = categorized.supersededOrWithdrawn || [];
    const notApplicable = categorized.notApplicable || [];

    let html = '';

    // Section 1: Newly Effective / Confirmed Upcoming
    if (newlyActive.length > 0) {
      html += `
        <div class="rtm-accordion" open>
          <summary style="color:#c2410c;">
            <span>🚨 NEWLY EFFECTIVE REQUIREMENTS AT LAUNCH (${newlyActive.length})</span>
            <span style="font-size:11px;">Enforceable on ${currentLaunchDate}</span>
          </summary>
          <div class="rtm-accordion-content">
            ${newlyActive.map(r => `
              <div class="rtm-rule-card newly-effective">
                <div class="rtm-rule-top">
                  <span class="rtm-rule-name">${r.title || r.name}</span>
                  <span class="rtm-pill" style="background:#fed7aa;color:#c2410c;">Effective ${r.effectiveDate}</span>
                </div>
                <div class="rtm-rule-meta">
                  <span><b>Regulator:</b> ${r.regulator}</span>
                  <span><b>Citation:</b> ${r.originalSource || r.citation}</span>
                </div>
                <div class="rtm-rule-desc">${r.description}</div>
                <div style="display:flex;gap:8px;margin-top:6px;">
                  ${r.officialSourceUrl ? `<a href="${r.officialSourceUrl}" target="_blank" rel="noopener" class="rtm-btn" style="font-size:11px;">View Official Source ↗</a>` : ''}
                  <button type="button" class="rtm-btn rtm-btn-ask" data-rule-id="${r.ruleId}" style="font-size:11px;">Ask Someone Clarification</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Section 2: Proposed & Draft Initiatives
    if (proposed.length > 0) {
      html += `
        <div class="rtm-accordion">
          <summary style="color:#a16207;">
            <span>📋 PROPOSED / FORWARD-MONITORING INITIATIVES (${proposed.length})</span>
            <span style="font-size:11px;color:#a16207;">Non-binding Draft</span>
          </summary>
          <div class="rtm-accordion-content">
            <p style="font-size:12px;color:#64748b;margin:0 0 6px;">
              <b>Important:</b> Proposed regulatory initiatives are NOT binding statutory mandates. They do not trigger artwork non-compliance failures or penalties.
            </p>
            ${proposed.map(p => `
              <div class="rtm-rule-card proposed">
                <div class="rtm-rule-top">
                  <span class="rtm-rule-name">${p.title || p.name}</span>
                  <span class="rtm-pill" style="background:#fef08a;color:#854d0e;">DRAFT / PROPOSED</span>
                </div>
                <div class="rtm-rule-meta">
                  <span><b>Regulator:</b> ${p.regulator}</span>
                  <span><b>Effective Date:</b> Not confirmed from binding source</span>
                </div>
                <div class="rtm-rule-desc">${p.description}</div>
                <div style="display:flex;gap:8px;margin-top:6px;">
                  ${p.officialSourceUrl ? `<a href="${p.officialSourceUrl}" target="_blank" rel="noopener" class="rtm-btn" style="font-size:11px;">Read Draft Paper ↗</a>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Section 3: Requirements No Longer In Force
    if (superseded.length > 0) {
      html += `
        <div class="rtm-accordion">
          <summary style="color:#64748b;">
            <span>📁 SUPERSEDED OR WITHDRAWN RULES (${superseded.length})</span>
            <span style="font-size:11px;">Archived</span>
          </summary>
          <div class="rtm-accordion-content">
            ${superseded.map(s => `
              <div class="rtm-rule-card" style="opacity:0.8;">
                <div class="rtm-rule-top">
                  <span class="rtm-rule-name"><del>${s.title || s.name}</del></span>
                  <span class="rtm-pill" style="background:#f1f5f9;color:#64748b;">SUPERSEDED</span>
                </div>
                <div class="rtm-rule-desc">${s.description}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Section 4: Out-of-Scope / Category Exclusions
    if (notApplicable.length > 0) {
      html += `
        <div class="rtm-accordion">
          <summary style="color:#64748b;">
            <span>🚫 OUT-OF-SCOPE / EXCLUDED RULES (${notApplicable.length})</span>
            <span style="font-size:11px;">Product Category Gating</span>
          </summary>
          <div class="rtm-accordion-content">
            <p style="font-size:12px;color:#64748b;margin:0 0 6px;">
              Rules excluded due to product category or jurisdiction mismatch (e.g. US MoCRA cosmetics rules do not apply to Food/Granola).
            </p>
            ${notApplicable.slice(0, 5).map(na => `
              <div style="font-size:11px;color:#64748b;padding:4px 0;border-bottom:1px solid #f1f5f9;">
                <b>${na.ruleId || na.id}:</b> ${na.title || na.name} <span style="color:#94a3b8;">(${na.productCategory} only)</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (newlyActive.length === 0 && proposed.length === 0) {
      html = `<p style="font-size:13px;color:#64748b;">No verified applicable rule changes were identified for the selected period in the currently loaded rule packs.</p>`;
    }

    target.innerHTML = html;

    // Bind Ask Someone buttons
    target.querySelectorAll('.rtm-btn-ask').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const ruleId = e.target.getAttribute('data-rule-id');
        if (onOpenAskSomeone) {
          onOpenAskSomeone({
            ruleId,
            launchDate: currentLaunchDate,
            market: currentMarket
          });
        }
      });
    });
  }

  function openDateComparisonModal() {
    let dateA = BASELINE_DATE;
    let dateB = currentLaunchDate !== BASELINE_DATE ? currentLaunchDate : '2027-07-01';

    const modal = document.createElement('div');
    modal.className = 'rtm-modal-backdrop';
    modal.innerHTML = `
      <div class="rtm-modal-card">
        <div class="rtm-modal-header">
          <h3>Compare Regulatory Requirements Across Launch Dates</h3>
          <button type="button" class="rtm-btn" id="rtm-modal-close">✕</button>
        </div>
        <div class="rtm-modal-body">
          <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;background:#f8fafc;padding:12px;border-radius:8px;">
            <div>
              <label style="font-size:12px;font-weight:600;display:block;">Date A (Baseline):</label>
              <input type="date" id="rtm-diff-date-a" class="rtm-date-input" value="${dateA}">
            </div>
            <div style="font-size:18px;color:#94a3b8;padding-top:14px;">➔</div>
            <div>
              <label style="font-size:12px;font-weight:600;display:block;">Date B (Future Launch):</label>
              <input type="date" id="rtm-diff-date-b" class="rtm-date-input" value="${dateB}">
            </div>
            <button type="button" class="rtm-btn rtm-btn-primary" id="rtm-diff-run" style="margin-top:16px;">Recompute Diff</button>
          </div>

          <div id="rtm-diff-results-container">
            <p>Loading regulatory difference…</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#rtm-modal-close');
    const runBtn = modal.querySelector('#rtm-diff-run');
    const inputA = modal.querySelector('#rtm-diff-date-a');
    const inputB = modal.querySelector('#rtm-diff-date-b');
    const resultsContainer = modal.querySelector('#rtm-diff-results-container');

    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    async function loadDiff() {
      resultsContainer.innerHTML = '<p style="color:#64748b;">Computing exact regulatory delta…</p>';
      try {
        const res = await api(`/api/reviews/${review.id}/regulatory-diff?dateA=${inputA.value}&dateB=${inputB.value}`);
        if (res.status === 'SUCCESS') {
          renderDiffMatrix(resultsContainer, res);
        }
      } catch (err) {
        resultsContainer.innerHTML = `<p style="color:#b91c1c;">Failed to compute comparison: ${err.message}</p>`;
      }
    }

    runBtn.addEventListener('click', loadDiff);
    loadDiff();
  }

  function renderDiffMatrix(container, diff) {
    container.innerHTML = `
      <div style="margin-bottom:12px;padding:10px;background:#f0f9ff;border-radius:6px;border:1px solid #bae6fd;font-size:13px;color:#0369a1;">
        <b>Temporal Narrative:</b> ${diff.narrative}
      </div>

      <table class="rtm-diff-matrix">
        <thead>
          <tr>
            <th>Regulatory Metric</th>
            <th>Date A (${diff.dateA})</th>
            <th>Date B (${diff.dateB})</th>
            <th>Statutory Difference</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>Active Binding Rules</b></td>
            <td><b>${diff.summary.activeAtDateA}</b> active</td>
            <td><b>${diff.summary.activeAtDateB}</b> active</td>
            <td><span class="status ${diff.summary.newlyApplicableCount > 0 ? 'review' : 'match'}">+${diff.summary.newlyApplicableCount} Newly Applicable</span></td>
          </tr>
          <tr>
            <td><b>Newly Effective Rules</b></td>
            <td>—</td>
            <td colspan="2">
              ${diff.newlyApplicable.length ? diff.newlyApplicable.map(r => `<div><b>${r.title || r.name}</b> (${r.ruleId}) · Effective: <code>${r.effectiveDate}</code></div>`).join('') : 'None'}
            </td>
          </tr>
          <tr>
            <td><b>Retired / Superseded</b></td>
            <td colspan="3">${diff.summary.retiredCount > 0 ? `${diff.summary.retiredCount} rules retired` : 'None'}</td>
          </tr>
          <tr>
            <td><b>Proposed Initiatives</b></td>
            <td colspan="3">${diff.summary.proposedCount} draft proposals monitored (non-binding across both dates)</td>
          </tr>
        </tbody>
      </table>
    `;
  }

  render();
}
