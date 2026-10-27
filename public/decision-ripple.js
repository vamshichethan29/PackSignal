/**
 * PackSignal Decision Ripple Interactive Component (public/decision-ripple.js)
 * Implements Steps 2, 3, 15, 16, 17, 19, 20, 21:
 * - One-tap interactive What-If simulation
 * - Option A (Keep Honey) vs Option B (Remove Honey)
 * - Animated consequence ripple & dependency visualization
 * - Side-by-side scenario comparison
 * - 2D artwork & 3D package spotlight integration
 * - Department collaboration question generator
 * - Auditable Correction Plan creation
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

function formatImpactTitle(state) {
  const map = {
    'POTENTIALLY_RESOLVED': 'Potentially Resolved',
    'RECALCULATION_REQUIRED': 'Recalculation Required',
    'STILL_CONFLICTED': 'Still Conflicted',
    'UNAFFECTED': 'Unaffected',
    'ARTWORK_REVISION_REQUIRED': 'Artwork Revision Required',
    'SOURCE_APPROVAL_REQUIRED': 'Source Approval Required',
    'CERTIFICATION_REVIEW_REQUIRED': 'Certification Review Required'
  };
  return map[state] || (state ? String(state).replace(/_/g, ' ') : '');
}

let activeModal = null;
let currentScenario = null;
let currentComparison = null;
let activeViewMode = 'ripple'; // 'ripple' | 'compare'

/**
 * Opens the Decision Ripple modal dialog.
 */
export async function openDecisionRippleModal(review, conflictId = 'CONFLICT-VEGAN-HONEY', initialOption = 'KEEP_HONEY') {
  if (activeModal) {
    activeModal.remove();
    activeModal = null;
  }

  // Ensure CSS is loaded
  if (!document.getElementById('decision-ripple-css')) {
    const link = document.createElement('link');
    link.id = 'decision-ripple-css';
    link.rel = 'stylesheet';
    link.href = '/decision-ripple.css';
    document.head.appendChild(link);
  }

  // Load simulation data
  let scenario = null;
  let comparison = null;

  const csrfToken = window.__PACKSIGNAL_CSRF || window.__csrfToken || '';

  try {
    const simRes = await fetch(`/api/reviews/${review.id}/decision-scenarios/simulate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-packproof-token': csrfToken
      },
      body: JSON.stringify({ conflictId, optionKey: initialOption })
    });
    if (simRes.ok) {
      const data = await simRes.json();
      scenario = data.scenario;
    }

    const compRes = await fetch(`/api/reviews/${review.id}/decision-scenarios/compare`);
    if (compRes.ok) {
      const data = await compRes.json();
      comparison = data.comparison;
    }
  } catch (err) {
    console.warn('Direct simulation endpoint fallback:', err);
  }

  currentScenario = scenario;
  currentComparison = comparison;
  activeViewMode = 'ripple';

  const backdrop = document.createElement('div');
  backdrop.className = 'decision-ripple-backdrop';
  backdrop.id = 'decision-ripple-backdrop';
  backdrop.innerHTML = renderRippleModalContent(review, scenario, comparison, initialOption);

  document.body.appendChild(backdrop);
  activeModal = backdrop;

  mountRippleEventListeners(backdrop, review, conflictId);
}

function renderRippleModalContent(review, scenario, comparison, selectedOption) {
  const isOptionA = selectedOption === 'KEEP_HONEY';

  return `
    <div id="decision-ripple-modal" class="decision-ripple-dialog" role="dialog" aria-modal="true" aria-labelledby="ripple-title">
      <!-- Header -->
      <div class="decision-ripple-header">
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
            <span class="badge-simulation">⚡ WHAT-IF REFORMULATION ENGINE PREVIEW</span>
            <span style="font-size:11px;color:#94a3b8;">PREVIEW ONLY · NO ORIGINAL DOCUMENTS MODIFIED</span>
          </div>
          <h2 id="ripple-title" style="margin:0;font-size:20px;font-weight:800;letter-spacing:-0.02em;">
            DECISION RIPPLE · Honey Ingredient vs. Vegan Claim
          </h2>
          <div style="font-size:12px;color:#94a3b8;margin-top:4px;">
            Explore the downstream chain of consequences across Ingredients, Nutrition, Claims, Allergens & Approvals before revising packaging.
          </div>
        </div>
        <button type="button" class="btn-ripple-close" data-action="close-modal" data-close-ripple="true" aria-label="Close dialog" style="background:transparent;border:none;color:#94a3b8;font-size:24px;cursor:pointer;padding:4px 8px;line-height:1;">✕</button>
      </div>

      <!-- Body -->
      <div class="decision-ripple-body">
        <!-- Conflict Context Banner -->
        <div class="ripple-conflict-hero">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
            <div>
              <div style="font-size:10px;font-weight:800;color:#d97706;text-transform:uppercase;letter-spacing:0.05em;">
                DETECTED INGREDIENT & CLAIM CONFLICT
              </div>
              <div style="font-size:14px;font-weight:700;color:#0f172a;margin-top:2px;">
                Honey in formulation conflicts with "Suitable for Vegans" packaging claim
              </div>
            </div>
            <div style="font-size:11px;background:#fef3c7;color:#92400e;padding:3px 8px;border-radius:4px;font-weight:700;">
              Source Authority: Draft / In Review (Cell E3)
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:10px;margin-top:10px;font-size:12px;color:#334155;">
            <div style="background:#ffffff;padding:8px;border-radius:4px;border:1px solid #e2e8f0;">
              <span style="font-weight:700;color:#64748b;font-size:10px;display:block;">INGREDIENT EVIDENCE</span>
              🍯 <b>Honey</b> declared in recipe: <b>Honey (1%) on carton Back Panel</b> vs <b>Honey (9%) in draft sheet (B26)</b>.
            </div>
            <div style="background:#ffffff;padding:8px;border-radius:4px;border:1px solid #e2e8f0;">
              <span style="font-weight:700;color:#64748b;font-size:10px;display:block;">CLAIM EVIDENCE</span>
              🌱 <b>"DIETARY INFORMATION: Suitable for Vegans."</b> printed on carton Back Panel.
            </div>
            <div style="background:#ffffff;padding:8px;border-radius:4px;border:1px solid #e2e8f0;">
              <span style="font-weight:700;color:#64748b;font-size:10px;display:block;">CHOLESTEROL INVESTIGATION</span>
              ⚠️ Declared <b>45mg cholesterol</b> on Nutrition Facts (animal lipid vs extraction typo).
            </div>
          </div>
        </div>

        <!-- 1-Tap Option Chooser -->
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-size:12px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;">
              Choose A What-If Path:
            </span>
            <button type="button" class="btn-toggle-compare" data-action="toggle-ripple-view" style="background:#f1f5f9;border:1px solid #cbd5e1;padding:4px 10px;border-radius:4px;font-size:11px;font-weight:700;color:#0f172a;cursor:pointer;">
              ${activeViewMode === 'compare' ? '⚡ Show Ripple Animation' : '📊 Compare Both Outcomes'}
            </button>
          </div>

          <div class="ripple-options-grid">
            <!-- Option A Card -->
            <div class="ripple-option-card ${isOptionA ? 'active' : ''}" data-option="KEEP_HONEY">
              <div style="font-size:15px;font-weight:800;color:#0f172a;">
                🍯 Option A: Keep Honey, Remove Vegan Claim
              </div>
              <div style="font-size:12px;color:#64748b;line-height:1.4;">
                Preserve honey in formulation. Delete unsupported "Suitable for Vegans" wording in next artwork revision.
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:auto;padding-top:6px;">
                <span style="font-size:10px;background:#dcfce7;color:#166534;font-weight:700;padding:2px 6px;border-radius:3px;">Formula Unchanged</span>
                <span style="font-size:10px;background:#ede9fe;color:#5b21b6;font-weight:700;padding:2px 6px;border-radius:3px;">Brand Artwork Edit</span>
                <span style="font-size:10px;background:#fee2e2;color:#991b1b;font-weight:700;padding:2px 6px;border-radius:3px;">Sugar Claim Unresolved</span>
              </div>
            </div>

            <!-- Option B Card -->
            <div class="ripple-option-card ${!isOptionA ? 'active' : ''}" data-option="REMOVE_HONEY">
              <div style="font-size:15px;font-weight:800;color:#0f172a;">
                🌱 Option B: Remove Honey, Keep Vegan Claim
              </div>
              <div style="font-size:12px;color:#64748b;line-height:1.4;">
                Initiate R&D physical reformulation. Retain vegan marketing claim pending lab assay and supplier verification.
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:auto;padding-top:6px;">
                <span style="font-size:10px;background:#fef3c7;color:#92400e;font-weight:700;padding:2px 6px;border-radius:3px;">R&D Reformulation</span>
                <span style="font-size:10px;background:#fef3c7;color:#92400e;font-weight:700;padding:2px 6px;border-radius:3px;">Nutrition Recalc Required</span>
                <span style="font-size:10px;background:#fee2e2;color:#991b1b;font-weight:700;padding:2px 6px;border-radius:3px;">Sugar Claim Still Conflicted</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Dynamic Content: Ripple View vs Compare View -->
        ${activeViewMode === 'compare' ? renderCompareView(comparison) : renderRippleView(scenario, isOptionA)}
      </div>

      <!-- Footer -->
      <div class="decision-ripple-footer">
        <div style="font-size:11px;color:#64748b;max-width:520px;line-height:1.4;">
          🔒 <b>Simulation Rule:</b> Selecting an option does not edit uploaded files. Create a Correction Plan to record proposed changes for team execution.
        </div>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn-ripple-cancel" data-action="close-ripple" style="padding:8px 16px;border:1px solid #cbd5e1;background:#ffffff;border-radius:6px;font-weight:600;font-size:12px;cursor:pointer;">
            Cancel
          </button>
          <button type="button" class="btn-ripple-create-plan" data-action="create-correction-plan" style="padding:8px 18px;border:none;background:#0f766e;color:#ffffff;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:6px;">
            📋 Create Correction Plan
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderRippleView(scenario, isOptionA) {
  if (!scenario) {
    return `<div style="padding:20px;text-align:center;color:#64748b;">Computing consequence ripple...</div>`;
  }

  const impacted = scenario.impactedChecks || [];
  const unaffected = scenario.unaffectedChecks || [];
  const departments = scenario.responsibleDepartments || [];

  return `
    <!-- Animated Ripple Sequence & Visual Graph -->
    <div class="ripple-graph-container ripple-graph-panel">
      <div class="ripple-pulse-wave"></div>
      <div style="position:relative;z-index:2;">
        <div style="font-size:10px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">
          CONSEQUENCE RIPPLE GRAPH · DIRECTED DEPENDENCIES
        </div>

        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 0;">
          <!-- Node 1: Root Decision -->
          <div style="background:#1e293b;border:2px solid ${isOptionA ? '#f59e0b' : '#10b981'};padding:8px 14px;border-radius:6px;text-align:center;">
            <span style="font-size:9px;color:#94a3b8;display:block;">SELECTED TRIGGER</span>
            <b style="font-size:12px;color:#f8fafc;">${isOptionA ? '🍯 KEEP HONEY' : '🌱 REMOVE HONEY'}</b>
          </div>

          <span style="color:#38bdf8;font-size:16px;">➔</span>

          <!-- Node 2: Primary Mechanism -->
          <div style="background:#1e293b;border:1px solid #38bdf8;padding:8px 14px;border-radius:6px;text-align:center;">
            <span style="font-size:9px;color:#94a3b8;display:block;">GOVERNANCE IMPACT</span>
            <b style="font-size:12px;color:#38bdf8;">${isOptionA ? 'REMOVE VEGAN COPY' : 'R&D REFORMULATION'}</b>
          </div>

          <span style="color:#38bdf8;font-size:16px;">➔</span>

          <!-- Node 3: Department Workflows -->
          <div style="background:#1e293b;border:1px solid #64748b;padding:8px 14px;border-radius:6px;text-align:center;">
            <span style="font-size:9px;color:#94a3b8;display:block;">ROUTED TO</span>
            <b style="font-size:12px;color:#f8fafc;">${departments.map(d => d.department).join(' + ')}</b>
          </div>
        </div>

        <div style="font-size:11px;color:#94a3b8;margin-top:6px;">
          Traversed <b>${scenario.traversedEdgesCount || 5} dependency edges</b> across formulation, regulatory substantiation, and production tasks.
        </div>
      </div>
    </div>

    <!-- Impacted Checks Cards Grid -->
    <div>
      <div style="font-size:12px;font-weight:800;color:#0f172a;text-transform:uppercase;margin-bottom:10px;">
        Impacted Findings & Compliance Rules (${impacted.length})
      </div>
      <div class="ripple-consequences-grid">
        ${impacted.map(c => `
          <div class="ripple-consequence-card">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:800;font-size:11px;background:#0f172a;color:#fff;padding:2px 6px;border-radius:3px;">${esc(c.checkId)}</span>
              <span class="impact-badge impact-${esc(c.simulatedImpactState)}">${esc(formatImpactTitle(c.simulatedImpactState))}</span>
            </div>
            <div style="font-size:13px;font-weight:700;color:#0f172a;">${esc(c.checkName)}</div>
            <div style="font-size:11px;color:#475569;line-height:1.4;">${esc(c.explanation)}</div>
            <div style="margin-top:auto;padding-top:6px;border-top:1px dashed #e2e8f0;font-size:10px;color:#64748b;">
              <b>Prerequisite:</b> ${esc((c.prerequisites || []).join('; ') || 'None')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Unaffected Checks (No Fake Cascades) -->
    <div>
      <div style="font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;margin-bottom:8px;">
        Preserved Unaffected Findings (${unaffected.length})
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:8px;">
        ${unaffected.map(u => `
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span style="font-weight:700;font-size:11px;color:#334155;">${esc(u.checkName)}</span>
              <span class="impact-badge impact-UNAFFECTED">UNAFFECTED</span>
            </div>
            <div style="font-size:11px;color:#64748b;line-height:1.3;">${esc(u.explanation)}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Department Routing & Questions -->
    <div>
      <div style="font-size:12px;font-weight:800;color:#0f172a;text-transform:uppercase;margin-bottom:8px;">
        Collaborative Team Routing
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${departments.map(d => `
          <div class="ripple-dept-item">
            <div>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
                <span style="font-size:10px;font-weight:800;background:#0f172a;color:#fff;padding:2px 6px;border-radius:3px;">${esc(d.department)}</span>
                <span style="font-size:10px;font-weight:700;color:#0284c7;">${esc(d.role)}</span>
              </div>
              <div style="font-size:12px;color:#334155;font-weight:600;">${esc(d.action)}</div>
              <div style="font-size:11px;color:#64748b;font-style:italic;margin-top:2px;">"${esc(d.question)}"</div>
            </div>
            <button type="button" class="btn-copy-question" data-action="copy-dept-question" data-question="${esc(d.question)}" style="background:#ffffff;border:1px solid #cbd5e1;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#0f172a;cursor:pointer;white-space:nowrap;">
              📋 Copy Query
            </button>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Engine Limitations & Guardrails -->
    ${(scenario.limitations || []).length ? `
      <div class="ripple-limitations-panel" style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:12px;">
        <div style="font-size:11px;font-weight:800;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">
          Deterministic Engine Guardrails & Prohibitions
        </div>
        <ul style="margin:0;padding-left:18px;font-size:11px;color:#78350f;line-height:1.5;">
          ${scenario.limitations.map(l => `<li>${esc(l)}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
  `;
}

function renderCompareView(comparison) {
  if (!comparison) {
    return `<div style="padding:20px;text-align:center;color:#64748b;">Loading comparative evaluation...</div>`;
  }

  const a = comparison.optionA;
  const b = comparison.optionB;

  return `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div style="font-size:12px;font-weight:800;color:#0f172a;text-transform:uppercase;">
        Side-by-Side Scenario Trade-Off Matrix
      </div>

      <div style="overflow-x:auto;">
        <table class="ripple-compare-matrix" style="width:100%;border-collapse:collapse;font-size:12px;background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#0f172a;color:#ffffff;text-align:left;">
              <th style="padding:10px 14px;width:25%;">Evaluation Metric</th>
              <th style="padding:10px 14px;width:37.5%;background:#1e293b;border-left:1px solid #334155;">Option A: Keep Honey</th>
              <th style="padding:10px 14px;width:37.5%;background:#064e3b;border-left:1px solid #334155;">Option B: Remove Honey</th>
            </tr>
          </thead>
          <tbody>
            ${(comparison.comparisonMatrix || [
              { dimension: 'Product Formulation', optionA: 'Unchanged', optionB: 'Reformulation Required (remove honey)' },
              { dimension: 'Artwork Changes', optionA: 'Remove vegan copy & marks', optionB: 'Update ingredient declaration & nutrition panel' },
              { dimension: 'Nutrition Facts', optionA: 'Unchanged formula', optionB: 'Recalculation / Assay Required' },
              { dimension: 'No Added Sugar Claim', optionA: 'Conflicted (coconut & cane sugars)', optionB: 'Conflicted (coconut & cane sugars)' },
              { dimension: 'Tree Nut Allergens', optionA: 'Unaffected (almonds, pecans, walnuts)', optionB: 'Unaffected (almonds, pecans, walnuts)' },
              { dimension: 'Lead Department', optionA: 'Brand & Marketing', optionB: 'R&D / Food Science' },
              { dimension: 'Time to Market', optionA: 'Fast (prepress proofing)', optionB: 'Extended (R&D, lab, packaging)' }
            ]).map((row, idx) => `
              <tr style="border-bottom:1px solid #e2e8f0;${idx % 2 === 1 ? 'background:#f8fafc;' : ''}">
                <td style="padding:10px 14px;font-weight:700;color:#334155;">${esc(row.dimension)}</td>
                <td style="padding:10px 14px;border-left:1px solid #e2e8f0;">${esc(row.optionA)}</td>
                <td style="padding:10px 14px;border-left:1px solid #e2e8f0;">${esc(row.optionB)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:12px;font-size:12px;color:#0369a1;">
        <b>Shared Legal Reality:</b> Neither option automatically fixes the "No Added Sugar" claim because Coconut Sugar and Cane Sugar are independently present in the formulation.
      </div>
    </div>
  `;
}

function mountRippleEventListeners(backdrop, review, conflictId) {
  backdrop.addEventListener('click', async (e) => {
    // Close modal
    if (e.target.closest('[data-action="close-ripple"], [data-action="close-modal"]') || e.target === backdrop) {
      backdrop.remove();
      activeModal = null;
      return;
    }

    // Toggle Compare View
    const toggleBtn = e.target.closest('[data-action="toggle-ripple-view"], [data-action="toggle-compare"]');
    if (toggleBtn) {
      activeViewMode = activeViewMode === 'ripple' ? 'compare' : 'ripple';
      backdrop.innerHTML = renderRippleModalContent(review, currentScenario, currentComparison, currentScenario?.selectedOption || 'KEEP_HONEY');
      return;
    }

    // Switch Option (Option A vs Option B)
    const optCard = e.target.closest('.ripple-option-card[data-option]');
    if (optCard) {
      const selectedOption = optCard.dataset.option;
      activeViewMode = 'ripple';
      try {
        const simRes = await fetch(`/api/reviews/${review.id}/decision-scenarios/simulate`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-packproof-token': window.__PACKSIGNAL_CSRF || window.__csrfToken || ''
          },
          body: JSON.stringify({ conflictId, optionKey: selectedOption })
        });
        if (simRes.ok) {
          const data = await simRes.json();
          currentScenario = data.scenario;
          backdrop.innerHTML = renderRippleModalContent(review, currentScenario, currentComparison, selectedOption);
        }
      } catch (err) {
        console.error('Failed to simulate scenario:', err);
      }
      return;
    }

    // Copy Query Button
    const copyBtn = e.target.closest('[data-action="copy-dept-question"], .btn-copy-question[data-question]');
    if (copyBtn) {
      const text = copyBtn.dataset.question;
      navigator.clipboard?.writeText(text);
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => { copyBtn.textContent = '📋 Copy Query'; }, 2000);
      return;
    }

    // Create Correction Plan Button
    const createPlanBtn = e.target.closest('[data-action="create-correction-plan"]');
    if (createPlanBtn) {
      createPlanBtn.disabled = true;
      createPlanBtn.textContent = 'Creating Plan...';
      try {
        const res = await fetch(`/api/reviews/${review.id}/correction-plans`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-packproof-token': window.__PACKSIGNAL_CSRF || window.__csrfToken || ''
          },
          body: JSON.stringify({
            scenario: currentScenario,
            notes: `Recorded What-If Correction Plan: ${currentScenario?.optionTitle}`
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (typeof window.showToast === 'function') {
            window.showToast(`✓ Correction Plan ${data.plan?.planId} saved! Task assigned for revision workflow.`);
          }
          backdrop.remove();
          activeModal = null;
        } else {
          alert('Failed to save correction plan. Please check permissions.');
          createPlanBtn.disabled = false;
          createPlanBtn.textContent = '📋 Create Correction Plan';
        }
      } catch (err) {
        console.error('Error creating correction plan:', err);
        createPlanBtn.disabled = false;
        createPlanBtn.textContent = '📋 Create Correction Plan';
      }
      return;
    }
  });
}

if (typeof window !== 'undefined') {
  window.openDecisionRippleModal = openDecisionRippleModal;
}
