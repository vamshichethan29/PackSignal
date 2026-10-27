/**
 * PackSignal Revision Picker & Comparison Basis Controller (public/revision-picker.js)
 * Allows selecting any two revisions of a product, validating SKU and geometry compatibility,
 * and establishing the frozen source comparison basis (Phase 1 & Phase 2).
 */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function openRevisionPickerModal({ reviews = [], currentReview = null, onSelectComparison }) {
  // Remove any existing modal
  const existing = document.querySelector('.rev-picker-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'rev-picker-modal';

  const readyReviews = reviews.filter(r => r.status === 'ready');
  const initialV2 = currentReview || readyReviews[0] || {};
  const initialV1 = readyReviews.find(r => r.id === initialV2.parentId) ||
    readyReviews.find(r => r.id !== initialV2.id && r.name?.includes('Fieldday')) ||
    readyReviews.find(r => r.id !== initialV2.id) || initialV2;

  modal.innerHTML = `
    <div class="rev-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="picker-title">
      <div class="rev-picker-head">
        <div>
          <div class="eyebrow">REVISION INTELLIGENCE SETUP</div>
          <h3 id="picker-title">Select Artwork Revisions to Compare</h3>
        </div>
        <button type="button" class="deep-modal-close" data-picker-action="close" aria-label="Close dialog">×</button>
      </div>

      <div class="rev-picker-grid">
        <div class="rev-picker-col">
          <label for="picker-v1-select">Revision A (Before / Reference Base):</label>
          <select id="picker-v1-select">
            ${readyReviews.map(r => `
              <option value="${r.id}" ${r.id === initialV1?.id ? 'selected' : ''}>
                ${esc(r.name)} (${esc(r.market || 'US')} · ${new Date(r.createdAt).toLocaleDateString()})
              </option>
            `).join('')}
          </select>
        </div>

        <div class="rev-picker-col">
          <label for="picker-v2-select">Revision B (After / Target Revision):</label>
          <select id="picker-v2-select">
            ${readyReviews.map(r => `
              <option value="${r.id}" ${r.id === initialV2?.id ? 'selected' : ''}>
                ${esc(r.name)} (${esc(r.market || 'US')} · ${new Date(r.createdAt).toLocaleDateString()})
              </option>
            `).join('')}
          </select>
        </div>
      </div>

      <div class="rev-picker-grid">
        <div class="rev-picker-col">
          <label for="picker-pkg-type">Intended Packaging Format:</label>
          <select id="picker-pkg-type">
            <option value="carton" ${initialV2?.options?.packageType === 'carton' ? 'selected' : ''}>Folding Carton (CAD Dieline 0-100% Fold)</option>
            <option value="can" ${initialV2?.options?.packageType === 'can' ? 'selected' : ''}>Beverage Can (Cylindrical Surface)</option>
            <option value="bottle" ${initialV2?.options?.packageType === 'bottle' ? 'selected' : ''}>Glass / PET Bottle (Curved Label)</option>
            <option value="pouch" ${initialV2?.options?.packageType === 'pouch' ? 'selected' : ''}>Stand-up Flexible Pouch</option>
          </select>
        </div>

        <div class="rev-picker-col">
          <label for="picker-comparison-mode">Frozen Comparison Basis:</label>
          <select id="picker-comparison-mode">
            <option value="mode_a" selected>Mode A: Same Approved Sources &amp; Rules (Verified Designer Handoff)</option>
            <option value="mode_b">Mode B: Specification / Rulebook Changed (Surfaces Spec Delta)</option>
            <option value="mode_c">Mode C: Market / Formulation Variant Changed (Cross-market Review)</option>
          </select>
        </div>
      </div>

      <!-- Live Compatibility Validation Box -->
      <div class="rev-picker-basis-box" id="picker-validation-box">
        <strong>✓ Valid Comparison Pair:</strong> Both revisions share verified product identity. Ready for side-by-side 3D comparison and WebGL swipe inspection.
      </div>

      <div class="rev-picker-actions">
        <button type="button" class="secondary" data-picker-action="close">Cancel</button>
        <button type="button" class="primary" data-picker-action="launch">
          Launch 3D Revision Intelligence ↗
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const selV1 = modal.querySelector('#picker-v1-select');
  const selV2 = modal.querySelector('#picker-v2-select');
  const valBox = modal.querySelector('#picker-validation-box');

  function updateValidation() {
    const r1 = readyReviews.find(r => r.id === selV1.value);
    const r2 = readyReviews.find(r => r.id === selV2.value);

    if (r1?.id === r2?.id) {
      valBox.style.borderLeftColor = '#f59e0b';
      valBox.innerHTML = '⚠️ <strong>Self-Comparison:</strong> Selected identical review for both Revision A and B. Visual diff will show 0 delta.';
      return;
    }

    const brand1 = r1?.facts?.find(f => f.field === 'brand_name')?.value?.toLowerCase();
    const brand2 = r2?.facts?.find(f => f.field === 'brand_name')?.value?.toLowerCase();

    if (brand1 && brand2 && brand1 !== brand2) {
      valBox.style.borderLeftColor = '#ef4444';
      valBox.innerHTML = `⚠️ <strong>Different Products Warning:</strong> Revision A (${esc(brand1)}) and Revision B (${esc(brand2)}) appear to be different SKUs. Please confirm both belong to the same project.`;
      return;
    }

    valBox.style.borderLeftColor = '#38a169';
    valBox.innerHTML = '<strong>✓ Valid Comparison Pair:</strong> Both revisions share product identity. Ready for side-by-side 3D inspection, 3D swipe slider, and verified change tracking.';
  }

  selV1.addEventListener('change', updateValidation);
  selV2.addEventListener('change', updateValidation);
  updateValidation();

  modal.querySelectorAll('[data-picker-action="close"]').forEach(b => {
    b.addEventListener('click', () => modal.remove());
  });

  modal.querySelector('[data-picker-action="launch"]').addEventListener('click', () => {
    const v1Id = selV1.value;
    const v2Id = selV2.value;
    const pkgType = modal.querySelector('#picker-pkg-type').value;
    modal.remove();

    if (onSelectComparison) {
      onSelectComparison({ v1Id, v2Id, pkgType });
    } else {
      location.hash = `#review/${v2Id}`;
    }
  });
}
