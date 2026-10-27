/**
 * public/nutrition-studio.js
 * 
 * PackSignal Nutrition Comparison Studio (Phase 2)
 * Renders approved source specifications, artwork declarations, deterministic calculations,
 * mathematical proofs, multi-panel mappings, and evidence drawers.
 */

export function nutritionStudioView(review, filterState = 'all', expandedNutrientId = null) {
  const nutrition = review.nutrition;
  if (!nutrition) {
    return `
      <div class="panel" style="padding:24px;text-align:center;">
        <h2>Nutrition Validation</h2>
        <p class="subtle">Evaluating Nutrition Facts panels and source specifications...</p>
        <button type="button" class="primary" data-action="recheck-nutrition">Run Nutrition Validator</button>
      </div>
    `;
  }

  const {
    validatorVersion = '2.0.0',
    rulePackVersion = '2016-FDA-US-21CFR101.9',
    populationCategory = 'ADULTS_AND_CHILDREN_4_PLUS',
    sourceAuthority = 'UNKNOWN',
    panels = [],
    comparisons = [],
    calculations = {},
    summary = {},
    blockers = []
  } = nutrition;

  // Filter comparisons
  const filteredComparisons = comparisons.filter(c => {
    if (filterState === 'all') return true;
    if (filterState === 'issues') return c.status === 'ISSUE' || c.status === 'issue';
    if (filterState === 'matches') return c.status === 'MATCH' || c.status === 'match';
    if (filterState === 'review') return c.status === 'REVIEW' || c.status === 'review';
    if (filterState === 'unable') return c.status === 'UNABLE' || c.status === 'unable';
    return true;
  });

  const issueCount = comparisons.filter(c => c.status === 'ISSUE' || c.status === 'issue').length;
  const matchCount = comparisons.filter(c => c.status === 'MATCH' || c.status === 'match').length;
  const reviewCount = comparisons.filter(c => c.status === 'REVIEW' || c.status === 'review').length;
  const unableCount = comparisons.filter(c => c.status === 'UNABLE' || c.status === 'unable').length;

  // Authority badge styling
  const isApproved = sourceAuthority === 'APPROVED_SPECIFICATION';
  const authorityBadgeClass = isApproved ? 'match' : sourceAuthority === 'DRAFT' ? 'review' : 'unable';
  const sourceColumnLabel = isApproved ? 'Approved Source Specification' : 'Selected Source — Approval Unconfirmed';

  // Check if serving basis is ambiguous
  const specDoc = (review.documents || []).find(d => d.role === 'spec');
  const variants = specDoc?.variants || [];
  const needsBasisConfirmation = variants.length > 1 && !review.options?.nutritionBasisConfirmed;

  return `
    <div class="nutrition-studio-container" style="display:flex;flex-direction:column;gap:18px;">
      <!-- Header banner -->
      <div class="panel" style="padding:20px 24px;border-left:5px solid #16a34a;background:#fcfdfc;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
          <div>
            <div class="eyebrow" style="color:#15803d;font-weight:700;letter-spacing:1px;font-size:11px;">NUTRITION COMPARISON STUDIO · v${validatorVersion}</div>
            <h2 style="margin:4px 0;font-size:22px;color:#14532d;">Nutrition Declarations &amp; Mathematical Verification</h2>
            <p class="subtle" style="margin:0;font-size:13px;color:#4b6354;">Approved values, artwork declarations, calculations, and evidence.</p>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <button type="button" class="secondary" data-action="recheck-nutrition" style="font-size:12px;padding:6px 12px;">↻ Recompute Checks</button>
            <a class="secondary" href="/api/reviews/${review.id}/nutrition" target="_blank" style="font-size:12px;padding:6px 12px;text-decoration:none;">View JSON API ↗</a>
          </div>
        </div>

        <!-- Metadata context grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;margin-top:16px;padding-top:14px;border-top:1px solid #e2ece3;font-size:12px;">
          <div>
            <span style="color:#6b7280;display:block;text-transform:uppercase;font-size:10px;font-weight:700;">Product</span>
            <strong style="color:#1f2937;">${esc(review.name || 'Sample Product')}</strong>
          </div>
          <div>
            <span style="color:#6b7280;display:block;text-transform:uppercase;font-size:10px;font-weight:700;">Nutrition Source</span>
            <span style="color:#1f2937;">${esc(specDoc?.name || 'Specification')}</span>
          </div>
          <div>
            <span style="color:#6b7280;display:block;text-transform:uppercase;font-size:10px;font-weight:700;">Source Authority</span>
            <span class="status ${authorityBadgeClass}" style="display:inline-block;margin-top:2px;font-size:10px;">${esc(sourceAuthority)}</span>
          </div>
          <div>
            <span style="color:#6b7280;display:block;text-transform:uppercase;font-size:10px;font-weight:700;">Serving Basis</span>
            <span style="color:#1f2937;"><strong>${esc(panels[0]?.columns[0]?.basis || 'PER_SERVING')}</strong></span>
          </div>
          <div>
            <span style="color:#6b7280;display:block;text-transform:uppercase;font-size:10px;font-weight:700;">Panels Detected</span>
            <span style="color:#1f2937;">${panels.length} ${panels.length === 1 ? 'Panel' : 'Panels'} (${panels[0]?.panelType || 'Standard'})</span>
          </div>
        </div>
      </div>

      <!-- Ambiguity Resolution Banner if needed -->
      ${needsBasisConfirmation ? `
        <div class="panel" style="padding:16px 20px;background:#fffbeb;border:1px solid #fef3c7;border-left:5px solid #d97706;border-radius:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
            <div>
              <b style="color:#92400e;font-size:14px;">⚠️ SERVING BASIS REQUIRES CONFIRMATION</b>
              <p style="margin:4px 0 0;font-size:13px;color:#78350f;">
                The source specification contains multiple column variants (<code>${variants.join(', ')}</code>).
                These may represent pack sizes rather than per-serving amounts. Confirm the intended basis before relying on definitive comparisons.
              </p>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <select id="nutrition-variant-select" style="padding:6px 10px;border-radius:6px;border:1px solid #d1d5db;font-size:13px;">
                ${variants.map(v => `<option value="${esc(v)}" ${review.options?.nutritionVariant === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}
              </select>
              <button type="button" class="primary" style="background:#d97706;border-color:#b45309;padding:6px 14px;font-size:13px;" data-action="confirm-nutrition-basis">Confirm Basis</button>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Summary KPI cards -->
      <div class="counts" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px;">
        <div class="count" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center;">
          <b style="font-size:22px;color:#1f2937;display:block;">${summary.nutrientsCompared || comparisons.length}</b>
          <span style="font-size:11px;color:#6b7280;text-transform:uppercase;">Compared</span>
        </div>
        <div class="count match" style="border-radius:8px;padding:12px;text-align:center;">
          <b style="font-size:22px;color:#15803d;display:block;">${matchCount}</b>
          <span style="font-size:11px;color:#15803d;text-transform:uppercase;">Matches</span>
        </div>
        <div class="count issue" style="border-radius:8px;padding:12px;text-align:center;">
          <b style="font-size:22px;color:#b91c1c;display:block;">${issueCount}</b>
          <span style="font-size:11px;color:#b91c1c;text-transform:uppercase;">Discrepancies</span>
        </div>
        <div class="count review" style="border-radius:8px;padding:12px;text-align:center;">
          <b style="font-size:22px;color:#b45309;display:block;">${reviewCount}</b>
          <span style="font-size:11px;color:#b45309;text-transform:uppercase;">Human Review</span>
        </div>
        <div class="count unable" style="border-radius:8px;padding:12px;text-align:center;">
          <b style="font-size:22px;color:#4b5563;display:block;">${unableCount}</b>
          <span style="font-size:11px;color:#4b5563;text-transform:uppercase;">Unable to Verify</span>
        </div>
        <div class="count" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;text-align:center;">
          <b style="font-size:22px;color:#1d4ed8;display:block;">${summary.calculationsExecuted || 0}</b>
          <span style="font-size:11px;color:#1d4ed8;text-transform:uppercase;">Proofs Executed</span>
        </div>
      </div>

      <!-- Plausibility & Screening Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:14px;">
        <!-- Atwater Calorie Card -->
        <div class="panel" style="padding:16px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <b style="font-size:13px;color:#111827;">🔥 Calorie Plausibility (4-4-9 Atwater)</b>
            ${calculations.calories?.[0]?.result?.passes !== undefined ? `
              <span class="status ${calculations.calories[0].result.passes ? 'match' : 'review'}">
                ${calculations.calories[0].result.passes ? 'PLAUSIBLE' : 'REVIEW'}
              </span>
            ` : '<span class="status unable">N/A</span>'}
          </div>
          ${calculations.calories?.[0] ? `
            <div style="font-size:12px;color:#374151;line-height:1.6;">
              <div>Declared: <b>${calculations.calories[0].result.caloriesDeclared} kcal</b></div>
              <div>4-4-9 Estimate: <b>${calculations.calories[0].result.estimatedCalories} kcal</b> (Diff: ${calculations.calories[0].result.percentDifference}%)</div>
              <div style="color:#6b7280;font-size:11px;margin-top:4px;">
                9 × ${calculations.calories[0].result.macronutrients?.fat?.grams || 0}g Fat + 4 × ${calculations.calories[0].result.macronutrients?.carbohydrate?.grams || 0}g Carb + 4 × ${calculations.calories[0].result.macronutrients?.protein?.grams || 0}g Protein
              </div>
            </div>
          ` : '<p class="subtle" style="font-size:12px;">Macronutrients not available on artwork.</p>'}
        </div>

        <!-- Chemical Consistency Card -->
        <div class="panel" style="padding:16px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <b style="font-size:13px;color:#111827;">🧪 Chemical Consistency Inequalities</b>
            <span class="status match">CHECKED</span>
          </div>
          <div style="font-size:12px;color:#374151;display:flex;flex-direction:column;gap:4px;">
            ${(calculations.consistency || []).map(con => `
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span>${esc(con.result.lowerNutrient?.name)} ≤ ${esc(con.result.upperNutrient?.name)}</span>
                <span class="status ${con.result.passes ? 'match' : 'issue'}" style="font-size:10px;">${con.result.passes ? 'VALID' : 'DEFECT'}</span>
              </div>
            `).join('') || '<p class="subtle" style="font-size:12px;">No component pairs detected.</p>'}
          </div>
        </div>

        <!-- Serving Quantity Card -->
        <div class="panel" style="padding:16px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <b style="font-size:13px;color:#111827;">📦 Serving Count × Serving Size</b>
            ${calculations.servings?.[0]?.result?.passes !== undefined ? `
              <span class="status ${calculations.servings[0].result.passes ? 'match' : 'review'}">
                ${calculations.servings[0].result.passes ? 'ALIGNED' : 'REVIEW'}
              </span>
            ` : '<span class="status unable">N/A</span>'}
          </div>
          ${calculations.servings?.[0] ? `
            <div style="font-size:12px;color:#374151;line-height:1.6;">
              <div>Calculated Net: <b>${calculations.servings[0].result.estimatedTotal} ${calculations.servings[0].result.unit}</b></div>
              <div>Declared Net: <b>${calculations.servings[0].result.declaredNet} ${calculations.servings[0].result.unit}</b> (Diff: ${calculations.servings[0].result.percentDifference}%)</div>
              <div style="color:#6b7280;font-size:11px;margin-top:4px;">${esc(calculations.servings[0].result.explanation)}</div>
            </div>
          ` : '<p class="subtle" style="font-size:12px;">Net quantity or servings per container not declared.</p>'}
        </div>
      </div>

      <!-- Main Comparison Table Card -->
      <div class="panel" style="padding:0;overflow:hidden;border:1px solid #e5e7eb;border-radius:8px;background:#ffffff;">
        <!-- Filter Toolbar -->
        <div style="padding:12px 18px;background:#f9fafb;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <div style="display:flex;gap:6px;align-items:center;">
            <span style="font-size:12px;font-weight:700;color:#4b5563;margin-right:6px;">Filter:</span>
            <button type="button" class="tab-btn ${filterState === 'all' ? 'active' : ''}" data-action="filter-nutrition" data-filter="all" style="padding:4px 10px;font-size:12px;border-radius:4px;border:1px solid #d1d5db;background:${filterState === 'all' ? '#1f2937' : '#fff'};color:${filterState === 'all' ? '#fff' : '#374151'};cursor:pointer;">All (${comparisons.length})</button>
            <button type="button" class="tab-btn ${filterState === 'issues' ? 'active' : ''}" data-action="filter-nutrition" data-filter="issues" style="padding:4px 10px;font-size:12px;border-radius:4px;border:1px solid #fca5a5;background:${filterState === 'issues' ? '#b91c1c' : '#fff'};color:${filterState === 'issues' ? '#fff' : '#b91c1c'};cursor:pointer;">Issues (${issueCount})</button>
            <button type="button" class="tab-btn ${filterState === 'matches' ? 'active' : ''}" data-action="filter-nutrition" data-filter="matches" style="padding:4px 10px;font-size:12px;border-radius:4px;border:1px solid #86efac;background:${filterState === 'matches' ? '#15803d' : '#fff'};color:${filterState === 'matches' ? '#fff' : '#15803d'};cursor:pointer;">Matches (${matchCount})</button>
            <button type="button" class="tab-btn ${filterState === 'review' ? 'active' : ''}" data-action="filter-nutrition" data-filter="review" style="padding:4px 10px;font-size:12px;border-radius:4px;border:1px solid #fde68a;background:${filterState === 'review' ? '#d97706' : '#fff'};color:${filterState === 'review' ? '#fff' : '#d97706'};cursor:pointer;">Review (${reviewCount})</button>
            <button type="button" class="tab-btn ${filterState === 'unable' ? 'active' : ''}" data-action="filter-nutrition" data-filter="unable" style="padding:4px 10px;font-size:12px;border-radius:4px;border:1px solid #d1d5db;background:${filterState === 'unable' ? '#4b5563' : '#fff'};color:${filterState === 'unable' ? '#fff' : '#4b5563'};cursor:pointer;">Unable (${unableCount})</button>
          </div>
          <div style="font-size:12px;color:#6b7280;">
            Standard: <strong>21 CFR 101.9 (2016)</strong>
          </div>
        </div>

        <!-- Table -->
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">
            <thead>
              <tr style="background:#f3f4f6;border-bottom:1px solid #e5e7eb;color:#374151;">
                <th style="padding:10px 14px;font-weight:600;">Nutrient</th>
                <th style="padding:10px 14px;font-weight:600;">${esc(sourceColumnLabel)}</th>
                <th style="padding:10px 14px;font-weight:600;">Artwork Declaration</th>
                <th style="padding:10px 14px;font-weight:600;">Computed %DV</th>
                <th style="padding:10px 14px;font-weight:600;">Basis</th>
                <th style="padding:10px 14px;font-weight:600;">Status</th>
                <th style="padding:10px 14px;font-weight:600;text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filteredComparisons.map(c => {
                const isSelected = expandedNutrientId === c.nutrientId;
                const art = c.artworkRecord;
                const src = c.sourceRecord;
                const dvCalc = (calculations.dailyValues || []).find(d => d.nutrientId === c.nutrientId);
                const proofId = dvCalc?.result?.proof?.proofId;

                const statusClass = c.status === 'MATCH' ? 'match' : c.status === 'ISSUE' ? 'issue' : c.status === 'UNABLE' ? 'unable' : 'review';

                return `
                  <tr style="border-bottom:1px solid #e5e7eb;background:${isSelected ? '#f0fdf4' : 'transparent'};">
                    <td style="padding:12px 14px;vertical-align:top;">
                      <button type="button" class="textbutton" data-action="toggle-nutrient-drawer" data-nutrient-id="${esc(c.nutrientId)}" style="font-weight:600;color:#1e3a8a;cursor:pointer;padding:0;text-align:left;">
                        ${esc(c.canonicalName || c.nutrientId)}
                      </button>
                      <small style="display:block;color:#6b7280;font-size:11px;">${esc(c.nutrientId)}</small>
                    </td>
                    <td style="padding:12px 14px;vertical-align:top;">
                      ${src ? `
                        <strong style="color:#111827;">${src.value} ${src.unit}</strong>
                        ${src.sourceCell ? `<small style="display:block;color:#6b7280;font-size:11px;">Cell: <code>${src.sourceSheet ? `${src.sourceSheet}!` : ''}${src.sourceCell}</code></small>` : ''}
                      ` : '<span style="color:#9ca3af;">—</span>'}
                    </td>
                    <td style="padding:12px 14px;vertical-align:top;">
                      ${art ? `
                        <strong style="color:#111827;">${art.printedAmount ?? '—'} ${art.printedUnit || ''}</strong>
                        ${art.printedDvPercent !== null ? `<span style="color:#4b5563;margin-left:4px;">(${art.printedDvPercent}% DV)</span>` : ''}
                        ${art.artworkPage ? `<small style="display:block;color:#6b7280;font-size:11px;">Page ${art.artworkPage}</small>` : ''}
                      ` : '<span style="color:#dc2626;font-size:12px;">Not detected</span>'}
                    </td>
                    <td style="padding:12px 14px;vertical-align:top;">
                      ${dvCalc?.result ? `
                        ${dvCalc.result.expectedDisplayedPercent !== null ? `
                          <strong style="color:#111827;">${dvCalc.result.expectedDisplayedPercent}% DV</strong>
                          ${dvCalc.result.unroundedPercent ? `<small style="display:block;color:#6b7280;font-size:11px;">Raw: ${dvCalc.result.unroundedPercent}%</small>` : ''}
                        ` : `<span style="color:#6b7280;">${dvCalc.result.status === 'NOT_APPLICABLE' ? 'No %DV (Statutory)' : 'N/A'}</span>`}
                      ` : '<span style="color:#9ca3af;">—</span>'}
                    </td>
                    <td style="padding:12px 14px;vertical-align:top;">
                      <span style="font-size:11px;color:#4b5563;">${esc(c.basis || 'PER_SERVING')}</span>
                    </td>
                    <td style="padding:12px 14px;vertical-align:top;">
                      <span class="status ${statusClass}">${esc(c.status)}</span>
                    </td>
                    <td style="padding:12px 14px;vertical-align:top;text-align:right;">
                      <div style="display:inline-flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">
                        ${proofId ? `
                          <button type="button" class="secondary" data-action="view-proof-modal" data-proof-id="${esc(proofId)}" style="font-size:11px;padding:3px 7px;">Formula</button>
                        ` : ''}
                        ${src?.sourceCell ? `
                          <button type="button" class="secondary" data-action="view-source-cell-modal" data-nutrient-id="${esc(c.nutrientId)}" style="font-size:11px;padding:3px 7px;">Cell</button>
                        ` : ''}
                        ${art?.artworkPage ? `
                          <button type="button" class="secondary" data-action="view-artwork-evidence" data-page="${art.artworkPage}" data-box="${JSON.stringify(art.artworkBox || null)}" style="font-size:11px;padding:3px 7px;">Artwork</button>
                        ` : ''}
                        <button type="button" class="secondary" data-action="toggle-nutrient-drawer" data-nutrient-id="${esc(c.nutrientId)}" style="font-size:11px;padding:3px 7px;">${isSelected ? 'Close' : 'Details'}</button>
                      </div>
                    </td>
                  </tr>
                  ${isSelected ? `
                    <tr>
                      <td colspan="7" style="padding:0;background:#f8fafc;border-bottom:2px solid #cbd5e1;">
                        ${renderNutrientDetailDrawer(c, dvCalc, review)}
                      </td>
                    </tr>
                  ` : ''}
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Legal Disclaimer Footer -->
      <div style="padding:12px 16px;background:#f3f4f6;border-radius:6px;font-size:11px;color:#6b7280;line-height:1.5;">
        <b>Statutory &amp; Technical Limitations:</b>
        PackSignal executes deterministic nutritional calculations under FDA 21 CFR 101.9 (2016 Revision).
        Total Sugars and Trans Fat have no established Daily Reference Values. Calorie screening uses general 4-4-9 Atwater factors; specific food matrices or insoluble fiber deductions may lawfully alter declared label calories.
        PackSignal provides packaging artwork verification and discrepancy detection; it does not issue FDA certification or legal authorization for print release.
      </div>
    </div>
  `;
}

/**
 * 5-Section Nutrient Detail Drawer
 * Sections: A. SOURCE, B. ARTWORK, C. CALCULATION, D. RULE, E. REVIEW
 */
function renderNutrientDetailDrawer(comparison, dvCalculation, review) {
  const src = comparison.sourceRecord;
  const art = comparison.artworkRecord;
  const calc = dvCalculation?.result;
  const proof = calc?.proof;

  return `
    <div class="nutrient-drawer-content" style="padding:18px 24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">
        <h3 style="margin:0;font-size:16px;color:#0f172a;">Nutrient Detail Inspector: ${esc(comparison.canonicalName || comparison.nutrientId)}</h3>
        <span class="status ${comparison.status === 'MATCH' ? 'match' : comparison.status === 'ISSUE' ? 'issue' : 'review'}">${esc(comparison.status)}</span>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:16px;font-size:12px;">
        <!-- Section A: SOURCE -->
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
          <b style="color:#0369a1;display:block;margin-bottom:6px;font-size:12px;text-transform:uppercase;">A. Source Specification</b>
          ${src ? `
            <div style="line-height:1.6;color:#334155;">
              <div>Document: <strong>${esc(src.sourceDocumentId)}</strong></div>
              <div>Sheet: <strong>${esc(src.sourceSheet || '—')}</strong></div>
              <div>Cell: <strong><code>${esc(src.sourceCell || '—')}</code></strong></div>
              <div>Declared Value: <strong>${src.value} ${src.unit}</strong></div>
              <div>Serving Basis: <strong>${esc(src.basis)}</strong></div>
              <div>Authority: <span class="status ${src.sourceApprovalState === 'APPROVED_SPECIFICATION' ? 'match' : 'review'}" style="font-size:10px;">${esc(src.sourceApprovalState)}</span></div>
            </div>
          ` : '<p class="subtle">Not present in source specification.</p>'}
        </div>

        <!-- Section B: ARTWORK -->
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
          <b style="color:#0369a1;display:block;margin-bottom:6px;font-size:12px;text-transform:uppercase;">B. Artwork Declaration</b>
          ${art ? `
            <div style="line-height:1.6;color:#334155;">
              <div>Printed Amount: <strong>${art.printedAmount ?? '—'} ${art.printedUnit || ''}</strong></div>
              <div>Printed %DV: <strong>${art.printedDvPercent !== null ? `${art.printedDvPercent}%` : 'Not declared'}</strong></div>
              <div>PDF Page: <strong>Page ${art.artworkPage || 1}</strong></div>
              <div>Panel Column: <strong>${esc(art.columnId)} (${esc(art.basis)})</strong></div>
              <div>Bounding Box: <strong><code>${art.artworkBox ? JSON.stringify(art.artworkBox) : 'Unlocated'}</code></strong></div>
              <div>Quote: <em>"${esc(art.artworkQuote || '')}"</em></div>
            </div>
          ` : '<p class="subtle" style="color:#b91c1c;">Nutrient declaration missing from packaging artwork.</p>'}
        </div>

        <!-- Section C: CALCULATION -->
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
          <b style="color:#0369a1;display:block;margin-bottom:6px;font-size:12px;text-transform:uppercase;">C. Mathematical Proof</b>
          ${proof ? `
            <div style="line-height:1.6;color:#334155;">
              <div>Formula ID: <strong><code>${esc(proof.formulaId)}</code></strong></div>
              <div>Daily Value Reference: <strong>${proof.dailyValueReference} ${proof.referenceUnit}</strong></div>
              <div>Unrounded Result: <strong>${proof.unroundedResult}%</strong></div>
              <div>Displayed Expected: <strong>${proof.displayedExpectedResult}% DV</strong></div>
              <div>Printed Label Result: <strong>${proof.printedResult ?? '—'}% DV</strong></div>
              <div>Rounding Rule: <strong>FDA 21 CFR 101.9 standard</strong></div>
              <div style="margin-top:6px;background:#f8fafc;padding:6px;border-radius:4px;font-family:monospace;font-size:11px;">
                ${esc(proof.roundingSteps?.[0] || 'Raw calculation complete.')}
              </div>
            </div>
          ` : '<p class="subtle">No %DV calculation applicable or executed.</p>'}
        </div>

        <!-- Section D: RULE -->
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
          <b style="color:#0369a1;display:block;margin-bottom:6px;font-size:12px;text-transform:uppercase;">D. Regulatory Reference</b>
          <div style="line-height:1.6;color:#334155;">
            <div>Standard: <strong>US FDA 21 CFR 101.9</strong></div>
            <div>Citation: <strong>${esc(calc?.regulatoryCitation || '21 CFR 101.9(c)')}</strong></div>
            <div>Applicability: <strong>Conventional Food (Adults 4+)</strong></div>
            <div>Dual Route Permitted: <strong>Yes (Declared or Unrounded)</strong></div>
          </div>
        </div>

        <!-- Section E: REVIEW -->
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
          <b style="color:#0369a1;display:block;margin-bottom:6px;font-size:12px;text-transform:uppercase;">E. Review &amp; Audit</b>
          <div style="line-height:1.6;color:#334155;">
            <div>Finding Status: <strong>${esc(comparison.status)}</strong></div>
            <div>Reasoning: <span>${esc(comparison.matchReason || calc?.explanation || 'Aligned with approved reference.')}</span></div>
            <div>Blockers: <span>${comparison.limitations?.join('; ') || 'None'}</span></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Mounts interactive event handlers for the Nutrition Comparison Studio
 */
export function mountNutritionStudio(container, { reviewId, api, onReviewUpdated, onViewArtwork }) {
  if (!container) return;

  // Filter tabs
  container.querySelectorAll('[data-action="filter-nutrition"]').forEach(btn => {
    btn.onclick = () => {
      const filter = btn.dataset.filter;
      container.innerHTML = nutritionStudioView(window.__currentReview || {}, filter);
      mountNutritionStudio(container, { reviewId, api, onReviewUpdated, onViewArtwork });
    };
  });

  // Toggle nutrient drawer
  container.querySelectorAll('[data-action="toggle-nutrient-drawer"]').forEach(btn => {
    btn.onclick = () => {
      const nutId = btn.dataset.nutrientId;
      const currentExpanded = container.querySelector('.nutrient-drawer-content') ? nutId : null;
      const nextExpanded = currentExpanded === nutId ? null : nutId;
      container.innerHTML = nutritionStudioView(window.__currentReview || {}, 'all', nextExpanded);
      mountNutritionStudio(container, { reviewId, api, onReviewUpdated, onViewArtwork });
    };
  });

  // Confirm nutrition basis
  const confirmBtn = container.querySelector('[data-action="confirm-nutrition-basis"]');
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      const select = container.querySelector('#nutrition-variant-select');
      const variant = select?.value;
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Saving...';
      try {
        const res = await api(`/reviews/${reviewId}/nutrition/recheck`, {
          method: 'POST',
          body: {
            nutritionVariant: variant,
            nutritionBasisConfirmed: true
          }
        });
        if (res?.review && onReviewUpdated) {
          window.__currentReview = res.review;
          onReviewUpdated(res.review);
        }
      } catch (err) {
        alert('Failed to update nutrition basis: ' + err.message);
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm Basis';
      }
    };
  }

  // Recheck nutrition
  const recheckBtn = container.querySelector('[data-action="recheck-nutrition"]');
  if (recheckBtn) {
    recheckBtn.onclick = async () => {
      recheckBtn.disabled = true;
      recheckBtn.textContent = 'Recomputing...';
      try {
        const res = await api(`/reviews/${reviewId}/nutrition/recheck`, { method: 'POST' });
        if (res?.review && onReviewUpdated) {
          window.__currentReview = res.review;
          onReviewUpdated(res.review);
        }
      } catch (err) {
        alert('Failed to recompute nutrition: ' + err.message);
      } finally {
        recheckBtn.disabled = false;
        recheckBtn.textContent = '↻ Recompute Checks';
      }
    };
  }

  // View proof modal
  container.querySelectorAll('[data-action="view-proof-modal"]').forEach(btn => {
    btn.onclick = async () => {
      const proofId = btn.dataset.proofId;
      try {
        const proof = await api(`/reviews/${reviewId}/nutrition/proofs/${encodeURIComponent(proofId)}`);
        showFormulaModal(proof);
      } catch (err) {
        alert('Proof not available: ' + err.message);
      }
    };
  });

  // View source cell modal
  container.querySelectorAll('[data-action="view-source-cell-modal"]').forEach(btn => {
    btn.onclick = () => {
      const nutId = btn.dataset.nutrientId;
      const review = window.__currentReview || {};
      const nut = review.nutrition?.comparisons?.find(c => c.nutrientId === nutId)?.sourceRecord;
      if (nut) {
        showSourceCellModal(nut);
      }
    };
  });

  // View artwork evidence
  container.querySelectorAll('[data-action="view-artwork-evidence"]').forEach(btn => {
    btn.onclick = () => {
      const page = Number(btn.dataset.page || 1);
      let box = null;
      try { box = JSON.parse(btn.dataset.box || 'null'); } catch {}
      if (onViewArtwork) {
        onViewArtwork({ page, box });
      }
    };
  });
}

function showFormulaModal(proof) {
  const dialog = document.getElementById('dialog');
  if (!dialog) return;

  const title = `Calculation Proof · ${proof.nutrientId || 'Formula'}`;
  const content = `
    <div style="font-size:13px;line-height:1.6;color:#1e293b;padding:8px 0;">
      <div style="background:#f1f5f9;padding:12px;border-radius:6px;font-family:monospace;margin-bottom:12px;">
        <div><b>Formula ID:</b> ${esc(proof.formulaId)} (v${esc(proof.formulaVersion)})</div>
        <div><b>Daily Value Ref:</b> ${proof.dailyValueReference} ${proof.referenceUnit}</div>
        <div><b>Unrounded Result:</b> ${proof.unroundedResult}%</div>
        <div><b>Displayed Expected:</b> ${proof.displayedExpectedResult}%</div>
        <div><b>Printed Result:</b> ${proof.printedResult ?? '—'}%</div>
        <div><b>Outcome:</b> <strong style="color:${proof.comparisonOutcome === 'MATCH' ? '#16a34a' : '#dc2626'}">${proof.comparisonOutcome}</strong></div>
      </div>
      <div>
        <b>Calculation &amp; Rounding Steps:</b>
        <ul>
          ${(proof.roundingSteps || []).map(s => `<li>${esc(s)}</li>`).join('')}
          ${(proof.conversionSteps || []).map(s => `<li>${esc(s)}</li>`).join('')}
        </ul>
      </div>
      <div style="font-size:11px;color:#64748b;margin-top:12px;">
        ${(proof.limitations || []).map(l => `<div>• ${esc(l)}</div>`).join('')}
      </div>
    </div>
  `;

  dialog.className = 'wide';
  dialog.innerHTML = `
    <div class="dialog-header">
      <h2>${title}</h2>
      <button class="ghost" data-action="close" aria-label="Close dialog">✕</button>
    </div>
    <div class="dialog-content">${content}</div>
  `;

  dialog.querySelector('[data-action="close"]')?.addEventListener('click', () => dialog.close());

  if (!dialog.open && typeof dialog.showModal === 'function') {
    dialog.showModal();
  }
}

function showSourceCellModal(sourceRecord) {
  const dialog = document.getElementById('dialog');
  if (!dialog) return;

  const title = `Source Cell Evidence · ${sourceRecord.canonicalName || sourceRecord.nutrientId}`;
  const content = `
    <div style="font-size:13px;line-height:1.6;color:#1e293b;padding:8px 0;">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:6px;margin-bottom:12px;">
        <div><b>Document ID:</b> ${esc(sourceRecord.sourceDocumentId)}</div>
        <div><b>Spreadsheet Sheet:</b> ${esc(sourceRecord.sourceSheet || '—')}</div>
        <div><b>Cell Coordinate:</b> <code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;">${esc(sourceRecord.sourceCell || '—')}</code></div>
        <div><b>Original Cell Value:</b> <strong>${esc(sourceRecord.value)} ${esc(sourceRecord.unit)}</strong></div>
        <div><b>Serving Basis Context:</b> ${esc(sourceRecord.basis || 'PER_SERVING')}</div>
        <div><b>Authority State:</b> <span class="status ${sourceRecord.sourceApprovalState === 'APPROVED_SPECIFICATION' ? 'match' : 'review'}">${esc(sourceRecord.sourceApprovalState)}</span></div>
      </div>
      <p style="font-size:11px;color:#64748b;">
        Spreadsheet coordinates are extracted directly from native cell formulas and values. Formula cells reflect cached evaluated values without dynamic recalculation.
      </p>
    </div>
  `;

  dialog.className = '';
  dialog.innerHTML = `
    <div class="dialog-header">
      <h2>${title}</h2>
      <button class="ghost" data-action="close" aria-label="Close dialog">✕</button>
    </div>
    <div class="dialog-content">${content}</div>
  `;

  dialog.querySelector('[data-action="close"]')?.addEventListener('click', () => dialog.close());

  if (!dialog.open && typeof dialog.showModal === 'function') {
    dialog.showModal();
  }
}

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
