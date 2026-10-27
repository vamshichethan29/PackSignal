/**
 * PackSignal — Atwater Calorie Consistency Card Component
 * public/atwater-proof-card.js
 * 
 * Renders rich, interactive 9/4/4 mathematical proof breakdown,
 * macronutrient source links, serving basis warnings, and Ask R&D trigger.
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

export function isAtwaterFinding(finding) {
  if (!finding) return false;
  return Boolean(
    finding.atwater ||
    finding.id === 'nutrition-sanity:atwater' ||
    finding.id?.startsWith('nutrition:calories:') ||
    /calories vs macronutrients|atwater|4-4-9/i.test(finding.title || '')
  );
}

export function renderAtwaterProofCard(finding, review) {
  if (!isAtwaterFinding(finding)) return '';

  const atw = finding.atwater || {};
  const macros = finding.macronutrients || atw.macronutrients || {};
  
  const fatG = macros.fat?.grams ?? macros.fat?.amount ?? 15;
  const carbG = macros.carbohydrate?.netGrams ?? macros.carbohydrate?.grams ?? macros.carbohydrate?.amount ?? 66;
  const protG = macros.protein?.grams ?? macros.protein?.amount ?? 34;

  const fatFactor = macros.fat?.factor ?? 9;
  const carbFactor = macros.carbohydrate?.factor ?? 4;
  const protFactor = macros.protein?.factor ?? 4;

  const fatKcal = macros.fat?.subtotalKcal ?? (fatG * fatFactor);
  const carbKcal = macros.carbohydrate?.subtotalKcal ?? (carbG * carbFactor);
  const protKcal = macros.protein?.subtotalKcal ?? (protG * protFactor);

  const declaredKcal = finding.declaredCalories ?? atw.declaredCalories ?? 166;
  const estimatedKcal = finding.estimatedCalories ?? atw.estimatedCalories ?? (fatKcal + carbKcal + protKcal);
  const diffKcal = finding.differenceKcal ?? atw.differenceKcal ?? Math.abs(declaredKcal - estimatedKcal);
  const pctDiff = finding.percentDifference ?? atw.percentDifference ?? Math.round((diffKcal / Math.max(declaredKcal, 1)) * 100);

  const basis = finding.basis || atw.basis || 'PER_SERVING';
  const method = atw.method || 'GENERAL_ATWATER_4_4_9';
  const fdaRounded = atw.fdaRoundedExpectedCalories ?? Math.round(estimatedKcal / 10) * 10;

  // Mass balance check
  const mb = finding.massBalance || atw.massBalance;
  let mbHtml = '';
  if (mb && !mb.passes) {
    mbHtml = `
      <div class="atwater-warning-banner mass-balance-alert">
        <div class="alert-icon">⚠️</div>
        <div class="alert-content">
          <div class="alert-title">Macronutrient Mass-Balance Discrepancy</div>
          <div class="alert-body">
            Sum of macros (${mb.totalMacroGrams} g = ${fatG}g Fat + ${carbG}g Carbs + ${protG}g Protein)
            exceeds declared serving/basis mass (${mb.expectedMaxGrams} g) by <strong>${mb.excessGrams} g</strong>.
          </div>
          <div class="alert-causes">
            Possible causes: OCR decimal loss (e.g. 6.6g printed as 66g), multi-column basis confusion, or wrong formulation variant.
          </div>
        </div>
      </div>
    `;
  }

  const proofSteps = atw.proofSteps || [
    `Fat: ${fatG} g × ${fatFactor} = ${fatKcal} kcal`,
    `Carbohydrates: ${carbG} g × ${carbFactor} = ${carbKcal} kcal`,
    `Protein: ${protG} g × ${protFactor} = ${protKcal} kcal`,
    `Total 4-4-9 Calculation: ${estimatedKcal} kcal`,
    `Declared: ${declaredKcal} kcal (Difference: ${diffKcal} kcal / ${pctDiff}%)`,
    `FDA Rounding (21 CFR 101.9): ${fdaRounded} kcal`
  ];

  return `
    <div class="atwater-proof-card panel" data-atwater-card data-finding-id="${esc(finding.id)}">
      <div class="atwater-card-header">
        <div class="atwater-card-title-group">
          <span class="atwater-eyebrow">MATHEMATICAL PROOF · 21 CFR 101.9(c)(1)(i)</span>
          <h4 class="atwater-title">Calorie Consistency & Atwater Verification</h4>
        </div>
        <div class="atwater-status-badge ${finding.status}">
          ${finding.status === 'match' ? '✓ MATCH' : finding.status === 'issue' ? '✕ ISSUE' : '⚠ REVIEW'}
        </div>
      </div>

      <div class="atwater-metrics-grid">
        <div class="atwater-metric-box declared">
          <div class="metric-label">DECLARED CALORIES</div>
          <div class="metric-value">${declaredKcal} <span class="metric-unit">kcal</span></div>
          <button type="button" class="btn-micro-focus" data-focus-macro="calories" title="Locate Calories on artwork">🔍 Find on Art</button>
        </div>

        <div class="atwater-metric-box estimated">
          <div class="metric-label">ESTIMATED ENERGY (9/4/4)</div>
          <div class="metric-value">${estimatedKcal} <span class="metric-unit">kcal</span></div>
          <div class="metric-sub">${diffKcal} kcal diff (${pctDiff}%)</div>
        </div>
      </div>

      <div class="atwater-breakdown-table">
        <div class="breakdown-header">
          <span>Macronutrient</span>
          <span>Contribution</span>
          <span>Energy Subtotal</span>
          <span>Evidence</span>
        </div>
        
        <div class="breakdown-row">
          <span class="macro-name"><strong>Total Fat</strong> (${fatG} g)</span>
          <span class="macro-calc">${fatG} × ${fatFactor} kcal/g</span>
          <span class="macro-subtotal"><strong>${fatKcal}</strong> kcal</span>
          <span><button type="button" class="btn-micro-focus" data-focus-macro="fat">🔍 Focus</button></span>
        </div>

        <div class="breakdown-row">
          <span class="macro-name"><strong>Carbohydrates</strong> (${carbG} g)</span>
          <span class="macro-calc">${carbG} × ${carbFactor} kcal/g</span>
          <span class="macro-subtotal"><strong>${carbKcal}</strong> kcal</span>
          <span><button type="button" class="btn-micro-focus" data-focus-macro="carbohydrate">🔍 Focus</button></span>
        </div>

        <div class="breakdown-row">
          <span class="macro-name"><strong>Protein</strong> (${protG} g)</span>
          <span class="macro-calc">${protG} × ${protFactor} kcal/g</span>
          <span class="macro-subtotal"><strong>${protKcal}</strong> kcal</span>
          <span><button type="button" class="btn-micro-focus" data-focus-macro="protein">🔍 Focus</button></span>
        </div>

        <div class="breakdown-row total-row">
          <span class="macro-name"><strong>Total Calculated</strong></span>
          <span class="macro-calc">Sum of contributions</span>
          <span class="macro-subtotal"><strong>${estimatedKcal}</strong> kcal</span>
          <span></span>
        </div>
      </div>

      ${mbHtml}

      <div class="atwater-meta-grid">
        <div class="meta-cell">
          <span class="meta-label">CALCULATION METHOD</span>
          <span class="meta-val">General Atwater 9/4/4 screening (21 CFR 101.9(c)(1)(i)(B))</span>
        </div>
        <div class="meta-cell">
          <span class="meta-label">MEASUREMENT BASIS</span>
          <span class="meta-val">${esc(basis)}</span>
        </div>
        <div class="meta-cell">
          <span class="meta-label">FDA ROUNDED EXPECTED</span>
          <span class="meta-val">${fdaRounded} kcal</span>
        </div>
      </div>

      <div class="atwater-actions-bar">
        <button type="button" class="btn-atwater-action secondary" data-action="toggle-atwater-proof">
          📐 Show Math Proof
        </button>
        <button type="button" class="btn-atwater-action secondary" data-action="focus-nutrition-panel">
          🔎 Focus Nutrition Panel
        </button>
        <button type="button" class="btn-atwater-action primary btn-ask-rd" data-action="ask-rd" data-finding-id="${esc(finding.id)}">
          💬 Ask R&D
        </button>
      </div>

      <div class="atwater-proof-expandable" id="atwater-proof-detail" style="display:none;">
        <div class="proof-expandable-head">Audit Verification Trail</div>
        <ul class="proof-steps-list">
          ${proofSteps.map(step => `<li>${esc(step)}</li>`).join('')}
        </ul>
        <div class="proof-disclaimer">
          <em>Statutory Notice:</em> General 4-4-9 factor summation is an internal plausibility screen. Food-specific factors (USDA Handbook 74), unrounded laboratory assays, or insoluble fiber deductions may lawfully alter final label values under 21 CFR 101.9(c)(1)(i).
        </div>
      </div>
    </div>
  `;
}
