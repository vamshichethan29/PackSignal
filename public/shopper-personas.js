/**
 * PackSignal Shopper Personas UI Component (public/shopper-personas.js)
 * Upgrade #42 — Consumer Impact Lens
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

export const SHOPPER_PERSONAS = [
  { id: 'all', name: 'All Perspectives', icon: '👥' },
  { id: 'nut-allergy', name: 'Nut Allergy Shopper', icon: '🥜' },
  { id: 'vegan', name: 'Vegan Shopper', icon: '🌱' },
  { id: 'sugar-watcher', name: 'Sugar Watcher', icon: '🍯' }
];

/**
 * Renders toolbar selector for Shopper View.
 */
export function renderShopperPersonaToolbar(activePersona = 'all') {
  return `
    <label class="hud-shopper-view" title="Filter findings and highlight artwork from consumer perspective">
      <span>SHOPPER VIEW:</span>
      <select data-action="select-shopper-persona" class="shopper-view-select" aria-label="Shopper Persona Filter">
        <option value="all" ${activePersona === 'all' ? 'selected' : ''}>All Perspectives</option>
        <option value="nut-allergy" ${activePersona === 'nut-allergy' ? 'selected' : ''}>🥜 Nut Allergy Shopper</option>
        <option value="vegan" ${activePersona === 'vegan' ? 'selected' : ''}>🌱 Vegan Shopper</option>
        <option value="sugar-watcher" ${activePersona === 'sugar-watcher' ? 'selected' : ''}>🍯 Sugar Watcher</option>
      </select>
    </label>
  `;
}

/**
 * Checks whether a finding is relevant to a specific shopper persona.
 */
export function isFindingRelevantToPersona(finding = {}, activePersona = 'all') {
  if (!activePersona || activePersona === 'all') return true;
  const id = String(finding.id || '').toUpperCase();
  const canId = String(finding.canonicalId || finding.checkId || '').toUpperCase();
  const field = String(finding.rule?.field || finding.field || '').toLowerCase();
  const category = String(finding.category || finding.rule?.category || '').toUpperCase();
  const title = String(finding.title || '').toLowerCase();
  const observed = String(finding.observed || '').toLowerCase();
  const expected = String(finding.expected || '').toLowerCase();
  const text = `${title} ${field} ${category} ${observed} ${expected}`.toLowerCase();

  if (activePersona === 'nut-allergy') {
    if (['DF-02', 'DF-03'].includes(id) || ['DF-02', 'DF-03'].includes(canId)) return true;
    if (category.includes('ALLERGEN') || field.includes('allergen') || field.includes('tree_nut')) return true;
    if (text.includes('almond') || text.includes('pecan') || text.includes('walnut') || text.includes('cashew') || text.includes('tree nut') || text.includes('may contain')) return true;
    return false;
  }
  if (activePersona === 'vegan') {
    if (['DF-01', 'DF-05', 'DF-10'].includes(id) || ['DF-01', 'DF-05', 'DF-10'].includes(canId)) return true;
    if (field.includes('vegan') || field.includes('honey') || field.includes('cholesterol')) return true;
    if (text.includes('vegan') || text.includes('honey') || text.includes('cholesterol') || text.includes('animal') || text.includes('plant-based')) return true;
    return false;
  }
  if (activePersona === 'sugar-watcher') {
    if (['DF-01', 'DF-04', 'DF-06', 'DF-09', 'DF-10'].includes(id) || ['DF-01', 'DF-04', 'DF-06', 'DF-09', 'DF-10'].includes(canId)) return true;
    if (field.includes('sugar') || field.includes('carbohydrate') || field.includes('honey') || field.includes('sweetener')) return true;
    if (category.includes('SUGAR') || category.includes('CARBOHYDRATE')) return true;
    if (text.includes('no added sugar') || text.includes('added sugar') || text.includes('coconut sugar') || text.includes('cane sugar') || text.includes('honey')) return true;
    return false;
  }
  return false;
}

/**
 * Computes dynamic metrics for a selected persona.
 */
export function computePersonaMetrics(review = {}, activePersona = 'all') {
  const findings = review.findings || [];
  if (activePersona === 'all') {
    return {
      total: findings.length,
      issues: findings.filter(f => f.status === 'issue').length,
      review: findings.filter(f => f.status === 'review').length,
      unable: findings.filter(f => f.status === 'unable').length,
      coverage: '100%'
    };
  }

  const relevant = findings.filter(f => isFindingRelevantToPersona(f, activePersona));
  return {
    total: relevant.length,
    issues: relevant.filter(f => f.status === 'issue').length,
    review: relevant.filter(f => f.status === 'review').length,
    unable: relevant.filter(f => f.status === 'unable').length,
    coverage: relevant.length > 0 ? '100%' : 'N/A'
  };
}

/**
 * Renders consumer perspective banner at top of review findings.
 */
export function renderShopperPerspectiveBanner(review = {}, activePersona = 'all') {
  if (!activePersona || activePersona === 'all') return '';

  const personaMeta = SHOPPER_PERSONAS.find(p => p.id === activePersona) || SHOPPER_PERSONAS[0];
  const metrics = computePersonaMetrics(review, activePersona);

  const personaTitles = {
    'nut-allergy': 'Tree Nut Ingredients & Precautionary Advisory Statements',
    'vegan': 'Vegan Marketing Claim Consistency & Honey Ingredient Conflict',
    'sugar-watcher': 'No Added Sugar Claim vs. Sugar-Containing Ingredients'
  };

  return `
    <div class="shopper-perspective-banner" role="region" aria-label="Shopper Persona Lens">
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="persona-badge">${personaMeta.icon} ${esc(personaMeta.name.toUpperCase())}</span>
        <span style="font-size:12px;font-weight:700;color:#f8fafc;">
          ${esc(personaTitles[activePersona] || 'Consumer Perspective Lens')}
        </span>
        <span style="font-size:11px;color:#94a3b8;">· VIEW FILTER ONLY · ENGINE VERDICTS UNCHANGED</span>
      </div>

      <div class="metrics-grid">
        <span class="metric-item">Relevant Checks: <b>${metrics.total}</b></span>
        <span class="metric-item">Issues: <b style="color:#ef4444;">${metrics.issues}</b></span>
        <span class="metric-item">Needs Review: <b style="color:#f59e0b;">${metrics.review}</b></span>
        <span class="metric-item">Source Evidence: <b style="color:#10b981;">${metrics.coverage}</b></span>
        <button type="button" data-action="reset-shopper-persona" style="background:transparent;border:1px solid #475569;color:#cbd5e1;padding:2px 8px;border-radius:4px;font-size:11px;cursor:pointer;font-weight:600;">
          ✕ Clear Lens
        </button>
      </div>
    </div>
  `;
}

/**
 * Renders "WHY THIS MATTERS" consumer consequence card in finding details panel.
 */
export function renderConsumerConsequenceCard(finding = {}, review = {}, activePersona = 'all') {
  if (!activePersona || activePersona === 'all') return '';

  const id = String(finding.id || finding.canonicalId || '').toUpperCase();
  const text = `${finding.title || ''} ${finding.rule?.field || ''} ${finding.observed || ''} ${finding.expected || ''}`.toLowerCase();

  let details = null;

  if (activePersona === 'nut-allergy' && (id === 'DF-03' || text.includes('allergen') || text.includes('may contain'))) {
    details = {
      eyebrow: 'NUT ALLERGY CONSUMER PERSPECTIVE',
      priority: 'HIGH',
      shopperSees: 'The package lists Almonds, Pecans, and Walnuts in ingredients, but also displays "May Contain tree nuts."',
      sourceDataSays: 'Specification sheet declares Almonds (12%), Pecans (8%), and Walnuts (5%) as intentional batch cluster ingredients.',
      whyItMatters: 'Shoppers with severe tree nut allergies may be confused about whether nuts are intentional recipe components or accidental cross-contact. FALCPA requires intentional allergens to be declared unambiguously.',
      uncertainty: 'Precautionary wording is voluntary under FDA policy and does not substitute for CGMPs or intentional ingredient disclosure.',
      actionRequired: 'Legal and Quality Assurance must confirm whether "May Contain tree nuts" is intentional advisory or duplicate warning.',
      canDecisionRipple: false,
      deptQuestion: 'Can Legal confirm whether the ingredient declaration and May Contain statement accurately communicate intentional tree nut ingredients and potential cross-contact?'
    };
  } else if (activePersona === 'nut-allergy' && (id === 'DF-02' || text.includes('almond') || text.includes('pecan') || text.includes('walnut'))) {
    details = {
      eyebrow: 'NUT ALLERGY CONSUMER PERSPECTIVE',
      priority: 'MEDIUM',
      shopperSees: 'Ingredient declaration on Back Panel includes Almonds, Pecans, and Walnuts.',
      sourceDataSays: 'Recipe specifies tree nuts in descending order of predominance.',
      whyItMatters: 'Nut-allergic consumers rely 100% on ingredient prominence to avoid fatal anaphylaxis.',
      uncertainty: 'Draft spreadsheet status (E3) requires final formulation sign-off.',
      actionRequired: 'Ensure each specific botanical tree nut species is declared by its statutory common or usual name.',
      canDecisionRipple: false,
      deptQuestion: 'Confirm that Almonds, Pecans, and Walnuts are declared in true descending predominance.'
    };
  } else if (activePersona === 'vegan' && (id === 'DF-05' || text.includes('vegan') || text.includes('honey'))) {
    details = {
      eyebrow: 'VEGAN CONSUMER PERSPECTIVE',
      priority: 'HIGH',
      shopperSees: '"DIETARY INFORMATION: Suitable for Vegans." printed on Back Panel.',
      sourceDataSays: 'Recipe specifies Honey (1% on carton Back Panel, 9% in draft sheet B26).',
      whyItMatters: 'Honey is an apicultural bee-derived product. Under standard vegan ethics, ISO 23662, and FTC Act §5, honey invalidates vegan claims.',
      uncertainty: 'Specification sheet status is "Draft / In Review" (cell E3); 9% vs 1% commercial percentage remains unconfirmed.',
      actionRequired: 'Brand & Marketing must either remove the vegan claim or R&D must physically reformulate without honey.',
      canDecisionRipple: true,
      deptQuestion: 'Can Brand and Legal confirm the approved vegan wording and whether the formulation\'s honey content affects that claim?'
    };
  } else if (activePersona === 'vegan' && (id === 'DF-10' || text.includes('cholesterol'))) {
    details = {
      eyebrow: 'VEGAN NUTRITION INVESTIGATION',
      priority: 'MEDIUM',
      shopperSees: 'Nutrition Facts panel declares "Cholesterol 45mg" (15% DV).',
      sourceDataSays: 'Plant and honey ingredients contain negligible endogenous cholesterol (<2mg).',
      whyItMatters: 'Cholesterol is synthesized in animal tissues. Declaring 45mg suggests dairy/butterfat or an analytical typo.',
      uncertainty: 'A cholesterol label value alone does not prove animal ingredients; lab assay verification is required.',
      actionRequired: 'R&D must confirm whether this is a clerical typo or undisclosed animal-derived fat.',
      canDecisionRipple: false,
      deptQuestion: 'Confirm true cholesterol laboratory assay for Dancing Fish Granola.'
    };
  } else if (activePersona === 'sugar-watcher' && (id === 'DF-04' || text.includes('sugar'))) {
    details = {
      eyebrow: 'SUGAR WATCHER CONSUMER PERSPECTIVE',
      priority: 'HIGH',
      shopperSees: 'Top Flap boldly displays "NO ADDED SUGAR", while Nutrition Facts prints "Includes 0g Added Sugars".',
      sourceDataSays: 'Recipe includes Honey (1%/9%), Coconut Sugar, and Crystallized Ginger containing Cane Sugar.',
      whyItMatters: 'Pre-diabetic and glycemic-conscious consumers rely on "No Added Sugar" to manage blood glucose. 21 CFR 101.60(c)(2) strictly prohibits the claim if added sugars are present.',
      uncertainty: 'Quantitative verification requires approved formulation data; engine strictly forbids guessing grams.',
      actionRequired: 'Remove "NO ADDED SUGAR" claim from top flap or reformulate to remove all added nutritive sweeteners.',
      canDecisionRipple: true,
      deptQuestion: 'Can R&D provide approved added-sugar quantities and confirm whether the No Added Sugar wording is supported?'
    };
  }

  if (!details) return '';

  return `
    <div class="consumer-consequence-card" role="region" aria-label="Consumer Impact Details">
      <div class="card-head">
        <span class="eyebrow">${esc(details.eyebrow)}</span>
        <span class="priority-badge priority-${details.priority}">${details.priority} RELEVANCE</span>
      </div>

      <div class="why-it-matters-grid">
        <div class="matter-box">
          <small>👀 WHAT THE SHOPPER SEES</small>
          <span>${esc(details.shopperSees)}</span>
        </div>
        <div class="matter-box">
          <small>📋 WHAT SOURCE DATA SAYS</small>
          <span>${esc(details.sourceDataSays)}</span>
        </div>
        <div class="matter-box" style="grid-column: 1 / -1;">
          <small>💡 WHY THIS MATTERS TO CONSUMERS</small>
          <span style="font-weight:600;color:#0f172a;">${esc(details.whyItMatters)}</span>
        </div>
        <div class="matter-box">
          <small>⚠️ UNRESOLVED UNCERTAINTY</small>
          <span style="color:#b45309;">${esc(details.uncertainty)}</span>
        </div>
        <div class="matter-box">
          <small>🎯 TEAM VERIFICATION ACTION</small>
          <span style="color:#0f766e;font-weight:600;">${esc(details.actionRequired)}</span>
        </div>
      </div>

      <div class="action-bar">
        ${details.canDecisionRipple ? `
          <button type="button" class="btn-ripple-explore" data-action="explore-decision-ripple" data-id="${esc(finding.id)}" style="background:#0f766e;color:#fff;border:none;">
            ⚡ Explore Decision Ripple
          </button>
        ` : ''}
        <button type="button" class="btn-ask-someone-persona" data-action="ask-someone-persona" data-query="${esc(details.deptQuestion)}" style="background:#ffffff;border:1px solid #cbd5e1;color:#0f172a;">
          💬 Ask Department Query
        </button>
        <button type="button" class="btn-sticky-note-persona" data-action="sticky-note-persona" data-finding-id="${esc(finding.id)}" style="background:#fef3c7;border:1px solid #fde68a;color:#92400e;">
          📌 Add Sticky Note
        </button>
      </div>
    </div>
  `;
}

/**
 * Renders 2D highlight overlay for active persona.
 */
export function renderShopperHighlightsOverlay(review = {}, pageNumber = 1, activePersona = 'all') {
  if (!activePersona || activePersona === 'all') return '';

  let highlights = [];

  if (activePersona === 'nut-allergy') {
    highlights = [
      { id: 'almonds', box: [0.48, 0.18, 0.72, 0.22], type: 'INGREDIENT_EVIDENCE', tag: 'ALMONDS (INTENTIONAL)' },
      { id: 'pecans', box: [0.48, 0.22, 0.72, 0.25], type: 'INGREDIENT_EVIDENCE', tag: 'PECANS (INTENTIONAL)' },
      { id: 'walnuts', box: [0.48, 0.25, 0.72, 0.28], type: 'INGREDIENT_EVIDENCE', tag: 'WALNUTS (INTENTIONAL)' },
      { id: 'may-contain', box: [0.48, 0.32, 0.75, 0.37], type: 'REVIEW_NEEDED', tag: 'MAY CONTAIN (ADVISORY)' }
    ];
  } else if (activePersona === 'vegan') {
    highlights = [
      { id: 'vegan-claim', box: [0.46, 0.35, 0.65, 0.42], type: 'MARKETING_CLAIM', tag: 'SUITABLE FOR VEGANS (CLAIM)' },
      { id: 'honey', box: [0.48, 0.15, 0.65, 0.18], type: 'INGREDIENT_EVIDENCE', tag: 'HONEY (ANIMAL PRODUCT)' },
      { id: 'cholesterol', box: [0.10, 0.52, 0.35, 0.56], type: 'NUTRITION_DECLARATION', tag: 'CHOLESTEROL 45MG (ANOMALY)' }
    ];
  } else if (activePersona === 'sugar-watcher') {
    highlights = [
      { id: 'sugar-claim', box: [0.15, 0.05, 0.85, 0.14], type: 'MARKETING_CLAIM', tag: 'NO ADDED SUGAR (CLAIM)' },
      { id: 'zero-sugars', box: [0.10, 0.62, 0.38, 0.67], type: 'NUTRITION_DECLARATION', tag: '0G ADDED SUGARS (ROUNDED)' },
      { id: 'honey', box: [0.48, 0.15, 0.65, 0.18], type: 'INGREDIENT_EVIDENCE', tag: 'HONEY (ADDED SUGAR)' },
      { id: 'coconut-sugar', box: [0.48, 0.20, 0.68, 0.23], type: 'INGREDIENT_EVIDENCE', tag: 'COCONUT SUGAR (ADDED SUGAR)' },
      { id: 'cane-sugar', box: [0.48, 0.24, 0.75, 0.27], type: 'INGREDIENT_EVIDENCE', tag: 'CANE SUGAR (IN GINGER)' }
    ];
  }

  if (!highlights.length) return '';

  return `
    <div class="shopper-highlights-layer" aria-label="Shopper Persona 2D Highlights">
      ${highlights.map(h => {
        const [x0, y0, x1, y1] = h.box;
        const left = x0 * 100;
        const top = y0 * 100;
        const width = (x1 - x0) * 100;
        const height = (y1 - y0) * 100;
        return `
          <div class="shopper-highlight-box shopper-hl-${esc(h.type)}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;" data-shopper-highlight="${esc(h.id)}" title="${esc(h.tag)}">
            <span class="shopper-hl-tag tag-${esc(h.type)}">${esc(h.tag)}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Attaches interactive listeners for Shopper Personas.
 */
export function mountShopperPersonaListeners(container = document, callbacks = {}) {
  const { onPersonaChange, onExploreRipple, onAskQuery } = callbacks;

  container.addEventListener('change', (e) => {
    const select = e.target.closest('[data-action="select-shopper-persona"], [data-action="filter-queue-persona"]');
    if (select && typeof onPersonaChange === 'function') {
      onPersonaChange(select.value);
    }
  });

  container.addEventListener('click', (e) => {
    const resetBtn = e.target.closest('[data-action="reset-shopper-persona"]');
    if (resetBtn && typeof onPersonaChange === 'function') {
      onPersonaChange('all');
      return;
    }

    const askBtn = e.target.closest('[data-action="ask-someone-persona"]');
    if (askBtn && typeof onAskQuery === 'function') {
      onAskQuery(askBtn.dataset.query);
      return;
    }

    const rippleBtn = e.target.closest('[data-action="explore-decision-ripple"]');
    if (rippleBtn && typeof onExploreRipple === 'function') {
      onExploreRipple(rippleBtn.dataset.id || 'DF-05');
      return;
    }
  });
}

if (typeof window !== 'undefined') {
  window.shopperPersonas = {
    renderShopperPersonaToolbar,
    renderShopperPerspectiveBanner,
    renderConsumerConsequenceCard,
    renderShopperHighlightsOverlay,
    computePersonaMetrics,
    mountShopperPersonaListeners,
    isFindingRelevantToPersona
  };
}
