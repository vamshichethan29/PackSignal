/**
 * PackSignal Deep Verification Dashboard (Vanilla JavaScript).
 * Implements Phase 22 & Phase 24:
 * "Inspect source discrepancies, nutrition arithmetic, PDF structure and rule-backed packaging findings."
 *
 * Categories:
 * - SOURCE & INGREDIENTS
 * - NUTRITION & DV
 * - CLAIMS
 * - ALLERGENS
 * - MARKET COPY
 * - QUANTITY & BUSINESS DETAILS
 * - PDF STRUCTURE
 * - TYPOGRAPHY
 * - GUIDE CONTENT
 * - RULE EXECUTION
 */
import { usFoodPreflightScorecardView } from './regulatory-workbench.js';

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function deepVerificationDashboardView(review, activeCategory = null) {
  const deep = review.deepVerification || {};
  const candidateChecks = deep.candidateChecks || [];
  const rulebook = deep.rulebookLedger || { rules: [], counts: {} };
  const sourceDoc = deep.sourceDoc || {};
  const isSourceDraft = sourceDoc.isDraft || /draft|review/i.test(sourceDoc.approvalStatus || '');

  // Group candidate checks by category
  const categories = [
    {
      id: 'source-ingredients',
      title: 'SOURCE & INGREDIENTS',
      icon: '🌿',
      desc: 'Formulation percentages, artwork-only additions, and source duplicate checks.',
      filter: c => ['INGREDIENT_PERCENTAGE_MISMATCH', 'INGREDIENT_LIST_DIFFERENCE', 'SOURCE_DOCUMENT_QUALITY'].includes(c.checkType)
    },
    {
      id: 'nutrition-dv',
      title: 'NUTRITION & DV',
      icon: '⚖️',
      desc: 'Deterministic FDA 2016 %DV arithmetic, 4-4-9 Atwater calorie screening, and serving math.',
      filter: c => ['DAILY_VALUE_ARITHMETIC', 'CALORIE_PLAUSIBILITY_SCREEN', 'SERVING_SIZE_ARITHMETIC', 'NUTRITION_VALUE_CONFLICT'].includes(c.checkType)
    },
    {
      id: 'claims',
      title: 'CLAIMS',
      icon: '🏷️',
      desc: 'No Added Sugar, Zero Added Sugars, and Vegan claim substantiation screens.',
      filter: c => ['CLAIM_SUBSTANTIATION', 'ADDED_SUGAR_DECLARATION'].includes(c.checkType)
    },
    {
      id: 'allergens',
      title: 'ALLERGENS',
      icon: '🥜',
      desc: 'FALCPA tree nut disclosure routes (ingredient list vs Contains vs May Contain).',
      filter: c => ['ALLERGEN_DISCLOSURE'].includes(c.checkType)
    },
    {
      id: 'market-copy',
      title: 'MARKET COPY',
      icon: '🌐',
      desc: 'Screening for EU Reference Intake icons (kJ, Salt, Saturates, Annex II phrasing) on US packs.',
      filter: c => ['MARKET_SPECIFIC_COPY'].includes(c.checkType)
    },
    {
      id: 'quantity-business',
      title: 'QUANTITY & BUSINESS DETAILS',
      icon: '🏢',
      desc: 'Dual FPLA net quantity placement and 21 CFR 101.5 manufacturer address completeness.',
      filter: c => ['LEGAL_METROLOGY', 'LEGAL_DISCLOSURE', 'BARCODE_CHECK_DIGIT'].includes(c.checkType)
    },
    {
      id: 'pdf-structure',
      title: 'PDF STRUCTURE',
      icon: '📦',
      desc: 'Native drawing sequence occlusion analysis; detects masked/covered legacy tables.',
      filter: c => ['PDF_STRUCTURAL_OCCLUSION'].includes(c.checkType)
    },
    {
      id: 'typography',
      title: 'TYPOGRAPHY',
      icon: '🔤',
      desc: 'Native PDF texttrace font point size vs statutory/brand minimums.',
      filter: c => ['NATIVE_TYPOGRAPHY'].includes(c.checkType)
    },
    {
      id: 'guide-content',
      title: 'GUIDE CONTENT',
      icon: '📐',
      desc: 'Dieline layer and technical construction label filtering ("Art orientation", "Copy free").',
      filter: c => ['PRODUCTION_GUIDE_FILTERING'].includes(c.checkType)
    },
    {
      id: 'rule-execution',
      title: 'RULE EXECUTION',
      icon: '📜',
      desc: 'In-force company rulebook DF-QA-LBL-003 execution ledger and governance lifecycle.',
      isRulebook: true
    }
  ];

  const totalChecks = candidateChecks.length;
  const issueCount = candidateChecks.filter(c => ['CONFIRMED_ISSUE', 'SOURCE_ARTWORK_MISMATCH', 'DV_CALCULATION_DISCREPANCY', 'FONT_SIZE_DEFECT', 'NET_QUANTITY_FORMAT_DEFECT', 'MANUFACTURER_ADDRESS_INCOMPLETE', 'OCCLUDED_OBJECT_DETECTED', 'SOURCE_DOCUMENT_DEFECT'].includes(c.findingStatus)).length;
  const reviewCount = candidateChecks.filter(c => ['CALORIE_PLAUSIBILITY_REVIEW', 'CLAIM_FORMULATION_CONFLICT', 'ADDED_SUGAR_VALUE_QUESTION', 'VEGAN_CLAIM_SUBSTANTIATION_REVIEW', 'ALLERGEN_DECLARATION_REVIEW', 'MIXED_MARKET_TERMINOLOGY', 'SERVING_SIZE_QUESTION'].includes(c.findingStatus)).length;
  const matchCount = candidateChecks.filter(c => ['BARCODE_CHECK_DIGIT_VALID', 'CLASSIFIED_PRODUCTION_GUIDE', 'VERIFIED_CALCULATION', 'CALORIES_PLAUSIBLE'].includes(c.findingStatus)).length;

  return `
    <div class="deep-verification-dashboard" data-deep-dashboard>
      <header class="deep-header">
        <div>
          <div class="deep-eyebrow">PACKAGING QA &amp; REGULATORY INTELLIGENCE</div>
          <h2>Deep Verification Suite</h2>
          <p class="deep-desc">
            Inspect source discrepancies, nutrition arithmetic, PDF structure and rule-backed packaging findings.
            Deterministic checks verify and compare; source draft uncertainty is preserved.
          </p>
        </div>
        <div class="deep-stats-bar">
          <div class="deep-stat ${issueCount > 0 ? 'alert' : ''}">
            <span class="deep-stat-val">${issueCount}</span>
            <span class="deep-stat-lbl">Discrepancies</span>
          </div>
          <div class="deep-stat warn">
            <span class="deep-stat-val">${reviewCount}</span>
            <span class="deep-stat-lbl">Need Review</span>
          </div>
          <div class="deep-stat pass">
            <span class="deep-stat-val">${matchCount}</span>
            <span class="deep-stat-lbl">Verified Matches</span>
          </div>
          <div class="deep-stat info">
            <span class="deep-stat-val">${rulebook.rules.length}</span>
            <span class="deep-stat-lbl">Ledger Rules</span>
          </div>
        </div>
      </header>

      ${isSourceDraft ? `
        <div class="source-draft-banner">
          <div class="source-draft-icon">⚠️</div>
          <div class="source-draft-content">
            <strong>Source Status: "${esc(sourceDoc.approvalStatus || 'Draft / In Review')}"</strong>
            <p>
              The source content sheet contains draft/in-review formulation copy. Discrepancies between source and artwork
              are classified as <code>SOURCE_ARTWORK_MISMATCH</code> or <code>REVIEW</code> pending brand release.
              Deterministic checks do not fabricate definitive legal violations when source authority is unresolved.
            </p>
          </div>
        </div>
      ` : ''}

      ${usFoodPreflightScorecardView(review)}

      <div class="deep-categories-grid">
        ${categories.map(cat => {
          if (cat.isRulebook) {
            return renderRulebookCard(rulebook);
          }
          const catChecks = candidateChecks.filter(cat.filter);
          return renderCategoryCard(cat, catChecks);
        }).join('')}
      </div>

      <!-- Interactive Modal Container for Formula / Rule / Evidence Detail -->
      <div id="deep-modal-container" class="deep-modal-backdrop" style="display:none;"></div>
    </div>
  `;
}

function renderCategoryCard(cat, checks) {
  const issues = checks.filter(c => ['CONFIRMED_ISSUE', 'SOURCE_ARTWORK_MISMATCH', 'DV_CALCULATION_DISCREPANCY', 'FONT_SIZE_DEFECT', 'NET_QUANTITY_FORMAT_DEFECT', 'MANUFACTURER_ADDRESS_INCOMPLETE', 'OCCLUDED_OBJECT_DETECTED', 'SOURCE_DOCUMENT_DEFECT'].includes(c.findingStatus)).length;
  const reviews = checks.filter(c => ['CALORIE_PLAUSIBILITY_REVIEW', 'CLAIM_FORMULATION_CONFLICT', 'ADDED_SUGAR_VALUE_QUESTION', 'VEGAN_CLAIM_SUBSTANTIATION_REVIEW', 'ALLERGEN_DECLARATION_REVIEW', 'MIXED_MARKET_TERMINOLOGY', 'SERVING_SIZE_QUESTION'].includes(c.findingStatus)).length;

  return `
    <div class="deep-card" data-category="${esc(cat.id)}">
      <div class="deep-card-head">
        <span class="deep-card-icon">${cat.icon}</span>
        <div class="deep-card-title-group">
          <h3>${esc(cat.title)}</h3>
          <span class="deep-card-desc">${esc(cat.desc)}</span>
        </div>
        <div class="deep-card-badges">
          ${issues > 0 ? `<span class="badge issue">${issues} issue</span>` : ''}
          ${reviews > 0 ? `<span class="badge review">${reviews} review</span>` : ''}
          ${issues === 0 && reviews === 0 ? `<span class="badge match">${checks.length} match</span>` : ''}
        </div>
      </div>

      <div class="deep-card-items">
        ${checks.length === 0 ? `<div class="deep-empty-item">No findings in this category.</div>` : ''}
        ${checks.map(c => renderCheckItem(c)).join('')}
      </div>
    </div>
  `;
}

function renderCheckItem(c) {
  const isOccluded = c.visibilityStatus === 'POTENTIALLY_OCCLUDED';
  const hasFormula = Boolean(c.calculationProof);
  const hasCell = Boolean(c.sourceCell);
  const hasBox = Boolean(c.artworkBoundingBox);

  return `
    <div class="deep-check-item ${esc((c.findingStatus || '').toLowerCase())}" data-check-id="${esc(c.checkId)}">
      <div class="deep-check-header">
        <span class="status-pill ${c.findingStatus.includes('DEFECT') || c.findingStatus.includes('MISMATCH') || c.findingStatus.includes('DISCREPANCY') ? 'status-issue' : c.findingStatus.includes('REVIEW') || c.findingStatus.includes('QUESTION') ? 'status-review' : 'status-match'}">
          ${esc(c.findingStatus.replace(/_/g, ' '))}
        </span>
        <span class="check-type-tag">${esc(c.checkType.replace(/_/g, ' '))}</span>
        ${c.ruleId ? `<span class="rule-tag">Rule ${esc(c.ruleId)}</span>` : ''}
      </div>

      <div class="deep-check-body">
        <div class="deep-values-comparison">
          <div class="val-box source-val">
            <span class="val-lbl">Source ${c.sourceCell ? `(${c.sourceSheet ? `${c.sourceSheet}!` : ''}${c.sourceCell})` : ''}</span>
            <div class="val-text">${esc(c.sourceQuote || c.expectedValue || '—')}</div>
          </div>
          <div class="val-arrow">↔</div>
          <div class="val-box artwork-val">
            <span class="val-lbl">Artwork ${c.artworkPanel ? `(${c.artworkPanel})` : ''}</span>
            <div class="val-text">${esc(c.artworkQuote || c.observedValue || '—')}</div>
          </div>
        </div>

        ${c.calculationProof ? `
          <div class="deep-proof-snippet">
            <strong>Proof:</strong> <code>${esc(c.calculationProof.split('\n')[0])}</code>
            ${c.calculationProof.includes('\n') ? `<span class="more-proof">+ ${c.calculationProof.split('\n').length - 1} more lines</span>` : ''}
          </div>
        ` : ''}

        ${c.limitations ? `
          <div class="deep-limitations">
            <strong>Limitation:</strong> ${esc(c.limitations)}
          </div>
        ` : ''}
      </div>

      <div class="deep-check-actions">
        ${hasBox ? `
          <button class="deep-btn deep-btn-artwork" data-action="deep-view-artwork" data-check-id="${esc(c.checkId)}" data-page="${esc(c.artworkPage || 1)}" data-box='${JSON.stringify(c.artworkBoundingBox || [])}'>
            🎯 View Artwork
          </button>
        ` : ''}

        ${hasCell ? `
          <button class="deep-btn deep-btn-cell" data-action="deep-view-cell" data-cell="${esc(c.sourceCell)}" data-sheet="${esc(c.sourceSheet || '')}" data-quote="${esc(c.sourceQuote || '')}">
            📊 View Spreadsheet Cell
          </button>
        ` : ''}

        ${hasFormula ? `
          <button class="deep-btn deep-btn-formula" data-action="deep-view-formula" data-check-id="${esc(c.checkId)}">
            🧮 View Formula
          </button>
        ` : ''}

        ${c.ruleId ? `
          <button class="deep-btn deep-btn-rule" data-action="deep-view-rule" data-rule-id="${esc(c.ruleId)}">
            📜 View Rule
          </button>
        ` : ''}

        ${isOccluded ? `
          <button class="deep-btn deep-btn-toggle-view" data-action="deep-toggle-occlusion" data-check-id="${esc(c.checkId)}">
            👁️ Toggle Native / Rendered
          </button>
        ` : ''}

        <button class="deep-btn deep-btn-review" data-action="deep-review-evidence" data-check-id="${esc(c.checkId)}">
          ✍️ Review Evidence
        </button>
      </div>
    </div>
  `;
}

function renderRulebookCard(rulebook) {
  const rules = rulebook.rules || [];
  const counts = rulebook.counts || {};

  return `
    <div class="deep-card deep-rulebook-card" data-category="rule-execution">
      <div class="deep-card-head">
        <span class="deep-card-icon">📜</span>
        <div class="deep-card-title-group">
          <h3>RULE EXECUTION LEDGER</h3>
          <span class="deep-card-desc">${esc(rulebook.metadata?.title || 'DF-QA-LBL-003 Standard')}</span>
        </div>
        <div class="deep-card-badges">
          <span class="badge issue">${counts.fail || 0} fail</span>
          <span class="badge review">${counts.review || 0} review</span>
          <span class="badge match">${counts.pass || 0} pass</span>
          <span class="badge not-applied">${counts.not_applied || 0} not applied</span>
        </div>
      </div>

      <div class="rulebook-provenance-box">
        <strong>Governance:</strong> ${esc(rulebook.metadata?.provenance || '')} (v${esc(rulebook.metadata?.version || '1.0')})
        <p>Tracks in-force statutory and brand requirements with original citations and lifecycle gating.</p>
      </div>

      <div class="rulebook-ledger-table-wrap">
        <table class="rulebook-ledger-table">
          <thead>
            <tr>
              <th>Rule ID</th>
              <th>Requirement Title</th>
              <th>Lifecycle</th>
              <th>Status</th>
              <th>Verdict</th>
              <th>Reason &amp; Evidence</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${rules.map(r => `
              <tr class="rule-row rule-${esc(r.verdict)}">
                <td><strong>${esc(r.ruleId)}</strong></td>
                <td>
                  <div class="rule-title">${esc(r.title)}</div>
                  <div class="rule-quote subtle">"${esc(r.originalQuotation)}"</div>
                </td>
                <td><span class="lifecycle-tag tag-${esc(r.lifecycleState.toLowerCase())}">${esc(r.lifecycleState)}</span></td>
                <td>${esc(r.executionStatus)}</td>
                <td><span class="verdict-pill verdict-${esc(r.verdict)}">${esc(r.verdict.toUpperCase())}</span></td>
                <td>
                  <div class="rule-reason">${esc(r.reason)}</div>
                  ${r.blockers?.length ? `<div class="rule-blockers">⚠️ ${esc(r.blockers.join(', '))}</div>` : ''}
                </td>
                <td>
                  <button class="deep-btn deep-btn-sm" data-action="deep-view-rule" data-rule-id="${esc(r.ruleId)}">
                    Inspect
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
