/**
 * PackSignal — Pack Quantity Consistency Card Component
 * public/pack-quantity-card.js
 * 
 * Renders structured, interactive mathematical proof for:
 * Servings per Container × Serving Size vs Declared Net Weight
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

export function isPackQuantityFinding(finding) {
  if (!finding) return false;
  return Boolean(
    finding.packQuantity ||
    finding.id === 'pack-quantity:servings-net-mass' ||
    finding.id === 'nutrition-sanity:serving-quantity' ||
    finding.key === 'pack-quantity:servings-net-mass' ||
    finding.key === 'nutrition-sanity:serving-quantity' ||
    finding.method === 'serving_net_weight_arithmetic' ||
    /servings vs net weight|serving count vs net quantity|pack quantity consistency/i.test(finding.title || '')
  );
}

export function renderPackQuantityCard(finding, review) {
  if (!isPackQuantityFinding(finding)) return '';

  const pq = finding.packQuantity || {};
  const inputs = pq.inputs || {};

  const servingsCount = finding.servingsCount ?? pq.servingsCount ?? inputs.servings?.value ?? 8;
  const servingsQualifier = inputs.servings?.qualifier || (finding.isApproximate || pq.isApproximate ? 'APPROXIMATE' : 'EXACT');
  const servingsText = inputs.servings?.originalText || `${servingsCount} servings`;

  const sAmount = inputs.servingSize?.amount ?? (finding.servingSizeGrams || 85);
  const sUnit = inputs.servingSize?.unit || 'g';
  const sBasis = inputs.servingSize?.basis || finding.basis || 'AS_PACKAGED';

  const netAmount = inputs.netWeight?.amount ?? (finding.declaredPackMassG || 480);
  const netUnit = inputs.netWeight?.unit || 'g';

  const expectedPackMassG = finding.expectedPackMassG ?? pq.expectedPackMassG ?? (servingsCount * sAmount);
  const declaredPackMassG = finding.declaredPackMassG ?? pq.declaredPackMassG ?? netAmount;
  const diffG = finding.differenceG ?? pq.differenceG ?? (expectedPackMassG - declaredPackMassG);
  const absDiffG = finding.absoluteDifferenceG ?? pq.absoluteDifferenceG ?? Math.abs(diffG);
  const rawPctDiff = finding.percentDifference ?? pq.percentDifference ?? ((absDiffG / Math.max(declaredPackMassG, 1)) * 100);
  const pctDiff = Number(Number(rawPctDiff).toFixed(1));

  const isApprox = finding.isApproximate ?? pq.isApproximate ?? servingsQualifier === 'APPROXIMATE';
  const isBasisMismatch = finding.isBasisMismatch ?? pq.isBasisMismatch ?? false;

  let alertBanner = '';
  if (isBasisMismatch) {
    alertBanner = `
      <div class="pack-qty-alert basis-mismatch">
        <div class="alert-icon">⚠️</div>
        <div class="alert-content">
          <div class="alert-title">Preparation Basis Mismatch</div>
          <div class="alert-body">
            Serving size is declared on a prepared basis (<strong>${esc(sBasis)}</strong>), which includes added ingredients or water absorption.
            It cannot be multiplied directly against package dry net contents without yield data.
          </div>
        </div>
      </div>
    `;
  } else if (isApprox && pctDiff > 5) {
    alertBanner = `
      <div class="pack-qty-alert approx-warning">
        <div class="alert-icon">ℹ️</div>
        <div class="alert-content">
          <div class="alert-title">Approximate Serving Count Screen</div>
          <div class="alert-body">
            Serving count is declared as <em>"${esc(servingsText)}"</em>. Under packaging conventions, approximate counts indicate variable portions.
            This screen flags a <strong>${absDiffG} g (${pctDiff}%)</strong> difference for formulation review, not a statutory violation.
          </div>
        </div>
      </div>
    `;
  } else if (pctDiff > 5) {
    alertBanner = `
      <div class="pack-qty-alert discrepancy-alert">
        <div class="alert-icon">⚠️</div>
        <div class="alert-content">
          <div class="alert-title">Material Package Quantity Discrepancy</div>
          <div class="alert-body">
            Expected package mass (${expectedPackMassG} g) differs from declared net weight (${declaredPackMassG} g) by
            <strong>${absDiffG} g (${pctDiff}%)</strong>.
          </div>
        </div>
      </div>
    `;
  }

  const calculationSteps = pq.calculationSteps || [
    `Servings per container: ${servingsText}`,
    `Serving size: ${sAmount} ${sUnit} (${sBasis})`,
    `Expected package mass: ${servingsCount} × ${sAmount} ${sUnit} = ${expectedPackMassG} g`,
    `Declared net weight: ${netAmount} ${netUnit} = ${declaredPackMassG} g`,
    `Difference: ${expectedPackMassG} g - ${declaredPackMassG} g = ${diffG >= 0 ? '+' : ''}${diffG} g (${pctDiff}% discrepancy)`
  ];

  return `
    <div class="pack-quantity-card panel" data-pack-quantity-card data-finding-id="${esc(finding.id)}">
      <div class="pack-qty-header">
        <div class="pack-qty-title-group">
          <span class="pack-qty-eyebrow">MATHEMATICAL PROOF · NET QUANTITY CONSISTENCY</span>
          <h4 class="pack-qty-title">Pack Quantity Consistency · Servings × Serving Size</h4>
        </div>
        <div class="pack-qty-status-badge ${finding.status}">
          ${finding.status === 'match' ? '✓ MATCH' : finding.status === 'issue' ? '✕ ISSUE' : '⚠ REVIEW'}
        </div>
      </div>

      <!-- 3 Input Metric Cards -->
      <div class="pack-qty-metrics-grid">
        <div class="pack-qty-metric-box qty-metric-box servings">
          <div class="metric-label">SERVINGS PER CONTAINER</div>
          <div class="metric-val metric-value">${servingsCount} ${isApprox ? '<span class="qualifier-tag">approx</span>' : ''}</div>
          <div class="metric-sub">${esc(servingsText)}</div>
          <button type="button" class="btn-micro-focus" data-focus-qty="servings" title="Locate servings on artwork">🔍 Find on Art</button>
        </div>

        <div class="pack-qty-metric-box qty-metric-box serving-size">
          <div class="metric-label">SERVING SIZE</div>
          <div class="metric-val metric-value">${sAmount} <span class="metric-unit">${esc(sUnit)}</span></div>
          <div class="metric-sub">${esc(sBasis)}</div>
          <button type="button" class="btn-micro-focus" data-focus-qty="serving_size" title="Locate serving size on artwork">🔍 Find on Art</button>
        </div>

        <div class="pack-qty-metric-box qty-metric-box net-weight declared">
          <div class="metric-label">DECLARED NET WEIGHT</div>
          <div class="metric-val metric-value">${netAmount} <span class="metric-unit">${esc(netUnit)}</span></div>
          <div class="metric-sub">${declaredPackMassG} g mass</div>
          <button type="button" class="btn-micro-focus" data-focus-qty="net_quantity" title="Locate net weight on artwork">🔍 Find on Art</button>
        </div>
      </div>

      <!-- Comparison Math Box -->
      <div class="pack-qty-proof-box">
        <div class="proof-row formula-main">
          <span class="proof-label">Implied Pack Mass:</span>
          <span class="proof-equation calc-term highlight-expected">${servingsCount} servings × ${sAmount} ${esc(sUnit)} = <strong><b>${expectedPackMassG} g</b></strong> expected</span>
        </div>
        <div class="proof-row formula-diff calc-difference">
          <span class="proof-label">Discrepancy:</span>
          <span class="proof-equation calc-term highlight-declared">${expectedPackMassG} g - <b>${declaredPackMassG} g</b> = <strong class="diff-val">${absDiffG} g difference</strong> (<span class="diff-pct">${pctDiff}%</span>)</span>
        </div>
      </div>

      ${alertBanner}

      <!-- Metadata Grid -->
      <div class="pack-qty-meta-grid">
        <div class="meta-cell">
          <span class="meta-label">CALCULATION METHOD</span>
          <span class="meta-val">Serving Net Weight Arithmetic (NIST HB 133 / 21 CFR 101.9(b))</span>
        </div>
        <div class="meta-cell">
          <span class="meta-label">PREPARATION BASIS</span>
          <span class="meta-val">${esc(sBasis)}</span>
        </div>
        <div class="meta-cell">
          <span class="meta-label">COUNT QUALIFIER</span>
          <span class="meta-val">${esc(servingsQualifier)}</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="pack-qty-actions-bar">
        <button type="button" class="btn-pack-qty-action secondary" data-action="toggle-pack-qty-proof">
          📐 Show Math Proof
        </button>
        <button type="button" class="btn-pack-qty-action secondary" data-action="focus-qty-panel">
          🔎 Show on Artwork
        </button>
        <button type="button" class="btn-pack-qty-action primary btn-ask-rd" data-action="ask-rd-qty" data-finding-id="${esc(finding.id)}">
          💬 Ask R&D
        </button>
      </div>

      <!-- Expandable Step-by-Step Detail -->
      <div class="pack-qty-proof-expandable" id="pack-qty-proof-detail" style="display:none;">
        <div class="proof-expandable-head">Audit Verification Trail</div>
        <ul class="proof-steps-list">
          ${calculationSteps.map(step => `<li>${esc(step)}</li>`).join('')}
        </ul>
        <div class="proof-disclaimer">
          <em>Verification Policy:</em> Implied package weight comparison is a deterministic mass-balance screen. Approximate counts ("about"), preparation basis variations, or density differences must be confirmed with R&D and packaging engineering before initiating a regulatory non-compliance action.
        </div>
      </div>
    </div>
  `;
}
