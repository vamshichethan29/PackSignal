/**
 * PackSignal Review Checks Component (public/review-checks.js)
 * Wave 1B: Standalone findings workspace, filtering, and proof display.
 */

import { renderSourceChip } from './source-chip.js';

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderReviewChecksWorkspace(review, activeFilter = 'all', activePersona = 'all') {
  const findings = review.findings || [];
  const counts = {
    all: findings.length,
    issue: findings.filter(f => f.status === 'issue' || f.findingStatus === 'issue').length,
    review: findings.filter(f => f.status === 'review' || f.findingStatus === 'review').length,
    match: findings.filter(f => f.status === 'match' || f.findingStatus === 'match').length,
    unable: findings.filter(f => f.status === 'unable' || f.findingStatus === 'unable').length,
  };

  const matchesPersona = (f, persona) => {
    if (!persona || persona === 'all') return true;
    const text = `${f.title || ''} ${f.category || ''} ${f.whyItMatters || ''} ${f.explanation || ''} ${f.observed || ''} ${f.expected || ''}`.toLowerCase();
    if (persona === 'nut-allergy') {
      return /allergen|nut|tree\s*nut|almond|peanut|coconut|may\s*contain|cashew|walnut/i.test(text);
    }
    if (persona === 'vegan') {
      return /vegan|honey|dairy|milk|plant[- ]based|animal|gelatin/i.test(text);
    }
    if (persona === 'sugar-watcher') {
      return /sugar|added\s*sugar|carbohydrate|calorie|sweet|glycemic/i.test(text);
    }
    if (persona === 'low-vision') {
      return /typography|font|height|point|contrast|visibility|readability|pt\b/i.test(text);
    }
    return true;
  };

  const filtered = findings.filter(f => {
    const st = f.findingStatus || f.status;
    const statusMatch = activeFilter === 'all' || st === activeFilter;
    const personaMatch = matchesPersona(f, activePersona);
    return statusMatch && personaMatch;
  });

  return `
    <div class="review-checks-container" id="review-checks-workspace">
      <div class="review-checks-header">
        <div>
          <h2 class="review-checks-title">Artwork Verification Checks</h2>
          <span style="font-size:12px;color:#64748b;">
            Deterministic evaluation against verified source specifications and applicable regulatory rules.
          </span>
        </div>
        <div class="review-checks-filters" style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;">
          ${[
            ['all', `All (${counts.all})`],
            ['issue', `Issues (${counts.issue})`],
            ['review', `Needs Review (${counts.review})`],
            ['match', `Matches (${counts.match})`],
            ['unable', `Unable to Verify (${counts.unable})`],
          ].map(([key, label]) => `
            <button type="button" class="review-check-filter-btn ${activeFilter === key ? 'active' : ''}"
              data-action="filter-review-checks" data-filter="${key}">
              ${label}
            </button>
          `).join('')}

          <!-- Shopper Personas Filter Dropdown (Sprint 1) -->
          <label class="shopper-persona-filter-label" style="display:inline-flex;align-items:center;gap:6px;margin-left:6px;font-size:12px;font-weight:700;color:#0f172a;background:#f8fafc;padding:3px 8px;border-radius:6px;border:1px solid #cbd5e1;">
            <span>👥 Shopper Persona:</span>
            <select class="shopper-persona-filter" data-action="filter-shopper-persona" style="padding:3px 6px;border-radius:4px;border:1px solid #cbd5e1;font-size:11px;background:#fff;font-weight:600;cursor:pointer;">
              <option value="all" ${activePersona === 'all' ? 'selected' : ''}>All Shoppers</option>
              <option value="nut-allergy" ${activePersona === 'nut-allergy' ? 'selected' : ''}>🥜 Nut Allergy</option>
              <option value="vegan" ${activePersona === 'vegan' ? 'selected' : ''}>🌱 Vegan</option>
              <option value="sugar-watcher" ${activePersona === 'sugar-watcher' ? 'selected' : ''}>🩺 Sugar Watcher</option>
              <option value="low-vision" ${activePersona === 'low-vision' ? 'selected' : ''}>👁️ Low Vision</option>
            </select>
          </label>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px;">
        ${filtered.map(f => {
          const st = f.findingStatus || f.status || 'review';
          const ruleCitation = f.ruleIds?.[0] || f.rule?.citation;
          const isHoneyVegan = /honey/i.test(`${f.title} ${f.explanation} ${f.observed} ${f.expected}`) &&
                               /vegan/i.test(`${f.title} ${f.explanation} ${f.observed} ${f.expected}`);
          return `
            <article class="review-check-card status-${st}" data-finding-id="${esc(f.findingId || f.id)}">
              <div class="review-check-header-row">
                <div>
                  <h3 class="review-check-headline">${esc(f.title)}</h3>
                  ${ruleCitation ? `<span style="font-size:11px;color:#1e40af;font-weight:600;">⚖️ ${esc(ruleCitation)}</span>` : ''}
                </div>
                <span class="review-check-badge badge-${st}">
                  ${st.toUpperCase()}
                </span>
              </div>

              <p class="review-check-why">${esc(f.whyItMatters || f.explanation)}</p>

              <div class="review-check-comparison">
                <div class="review-check-side side-observed">
                  <label>Observed on Artwork</label>
                  <code>${esc(f.observed || 'Not detected in artwork copy')}</code>
                </div>
                <div class="review-check-side side-expected">
                  <label>Expected per Specification</label>
                  <code>${esc(f.expected || 'No approved reference available')}</code>
                </div>
              </div>

              ${f.proof ? `
                <div class="review-check-proof">
                  <b>Mathematical / Logical Proof:</b> ${esc(f.proof)}
                </div>
              ` : ''}

              <!-- Vegan vs. Honey 1-Tap Decision Ripple (Sprint 1) -->
              ${isHoneyVegan ? `
                <div class="honey-vegan-ripple-card" data-ripple-container="${esc(f.findingId || f.id)}" style="margin-top:12px;padding:10px 12px;border-radius:6px;background:#f0fdf4;border:1px solid #86efac;">
                  <div style="font-size:11px;font-weight:800;color:#166534;margin-bottom:6px;display:flex;align-items:center;gap:4px;">
                    <span>⚡ Vegan vs. Honey 1-Tap Decision Ripple:</span>
                  </div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                    <button type="button" class="carton-3d-btn" data-action="ripple-keep-honey" data-finding-id="${esc(f.findingId || f.id)}" style="background:#15803d;color:#ffffff;border:none;padding:5px 10px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;">
                      🍯 Keep Honey (Drop Vegan Claim)
                    </button>
                    <button type="button" class="carton-3d-btn" data-action="ripple-keep-vegan" data-finding-id="${esc(f.findingId || f.id)}" style="background:#0284c7;color:#ffffff;border:none;padding:5px 10px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;">
                      🌱 Keep Vegan (Substitute Agave/Maple)
                    </button>
                  </div>
                  <div class="ripple-feedback" style="display:none;margin-top:6px;font-size:11px;color:#15803d;font-weight:700;"></div>
                </div>
              ` : ''}

              <div class="review-check-footer">
                <div>
                  ${typeof renderSourceChip === 'function' ? renderSourceChip({
                    name: f.sourceName || 'Specification Sheet',
                    location: f.sourceLocation || 'US!B26',
                    sheet: 'US',
                    cell: 'B26',
                    sourceType: 'spreadsheet'
                  }) : ''}
                </div>
                <div class="review-check-actions">
                  <button type="button" class="btn-primary" data-action="inspect-finding-artwork" data-id="${esc(f.findingId || f.id)}">
                    🎯 Show on Artwork
                  </button>
                  <button type="button" data-action="proof" data-id="${esc(f.findingId || f.id)}">
                    📋 Review Finding
                  </button>
                </div>
              </div>
            </article>
          `;
        }).join('') || '<div style="padding:24px;text-align:center;color:#64748b;">No findings match this filter.</div>'}
      </div>
    </div>
  `;
}

/**
 * Mounts event listeners for Shopper Personas and Honey/Vegan 1-Tap Ripple
 */
export function mountReviewChecksHandlers(container = document, onUpdate = null) {
  // 1-Tap Ripple Decision handlers
  container.addEventListener('click', async (e) => {
    const keepHoney = e.target.closest('[data-action="ripple-keep-honey"]');
    const keepVegan = e.target.closest('[data-action="ripple-keep-vegan"]');
    if (!keepHoney && !keepVegan) return;

    e.preventDefault();
    const btn = keepHoney || keepVegan;
    const findingId = btn.dataset.findingId;
    const rippleBox = btn.closest('.honey-vegan-ripple-card');
    const feedback = rippleBox?.querySelector('.ripple-feedback');

    if (keepHoney) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.color = '#166534';
        feedback.textContent = '✓ Ripple applied: Dropped "Certified Vegan" claim from front PDP. Retained authentic Honey in ingredient specification.';
      }
    } else if (keepVegan) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.color = '#0284c7';
        feedback.textContent = '✓ Ripple applied: Substituted Honey with Organic Agave Nectar in formula spec. Preserved "Certified Vegan" front claim.';
      }
    }

    if (typeof onUpdate === 'function') {
      onUpdate({ findingId, action: keepHoney ? 'KEEP_HONEY' : 'KEEP_VEGAN' });
    }
  });

  // Persona select dropdown handler
  container.addEventListener('change', (e) => {
    const select = e.target.closest('[data-action="filter-shopper-persona"]');
    if (!select) return;
    const selectedPersona = select.value;
    const cards = container.querySelectorAll('.review-check-card');
    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      let match = true;
      if (selectedPersona === 'nut-allergy') {
        match = /allergen|nut|tree\s*nut|almond|peanut|coconut|may\s*contain/i.test(text);
      } else if (selectedPersona === 'vegan') {
        match = /vegan|honey|dairy|milk|plant[- ]based|animal/i.test(text);
      } else if (selectedPersona === 'sugar-watcher') {
        match = /sugar|added\s*sugar|carbohydrate|calorie|sweet/i.test(text);
      } else if (selectedPersona === 'low-vision') {
        match = /typography|font|height|point|contrast|visibility|readability|pt\b/i.test(text);
      }
      card.style.display = match ? '' : 'none';
    });
  });
}
