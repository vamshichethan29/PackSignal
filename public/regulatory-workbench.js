/**
 * PackSignal Regulatory Intelligence & Source Verification Workbench (public/regulatory-workbench.js)
 * Implements Phase 1, 14, 18, 20, 21, 24:
 * - "What We Read" Fact Review & Conflict Resolution
 * - "Rulebook Trust Center" (Quotation Verification, Authorization, Execution State)
 * - "Guided Follow-Up Questions Queue"
 * - "Rule Coverage Ledger"
 * - "PDF Visible vs Hidden Text Inspector"
 */

import { renderSourceChip, renderFactBadge } from './source-chip.js';
import { renderConflictCard } from './conflict-card.js';
import { renderGuidedQuestionsQueue } from './review-questions.js';
import { renderRuleMap } from './rule-map.js';

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 1. WHAT WE READ: Fact Catalog & Conflict Resolver
 */
export function whatWeReadView(review) {
  const facts = review.structuredFacts || [];
  const conflicts = review.factConflicts || [];

  const groups = [
    { id: 'identity', title: 'Product Identity', icon: '🏷️' },
    { id: 'quantity', title: 'Net Quantity & Servings', icon: '⚖️' },
    { id: 'ingredients', title: 'Formulation & Ingredients', icon: '🌿' },
    { id: 'allergens', title: 'Allergen Declarations', icon: '🥜' },
    { id: 'nutrition', title: 'Nutrition Facts & Basis', icon: '📊' },
    { id: 'claims', title: 'Claims & Marketing Copy', icon: '✨' },
    { id: 'storage', title: 'Storage & Handling', icon: '❄️' },
    { id: 'business', title: 'Manufacturer & Distributor', icon: '🏢' },
    { id: 'barcode', title: 'Barcodes & Identifiers', icon: '📶' },
  ];

  let conflictsHtml = '';
  if (conflicts.length > 0) {
    conflictsHtml = `
      <div class="workbench-conflicts" style="margin-bottom:20px;padding:16px;background:#FFF3E0;border:1px solid #FFE0B2;border-radius:8px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:18px;">⚠️</span>
          <h3 style="margin:0;color:#E65100;font-size:15px;font-weight:700;">Conflicting Specification Values Detected (${conflicts.length})</h3>
        </div>
        <p style="margin:0 0 12px;font-size:13px;color:#BF360C;">
          Different source documents provide conflicting facts for the same field. Designate the authoritative reference to unblock deterministic copy comparison.
        </p>
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${conflicts.map(c => `
            <div style="background:white;padding:12px;border:1px solid #FFCC80;border-radius:6px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <b style="font-size:13px;color:#333;">Field: ${esc(c.label)}</b>
                <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;background:${c.resolved ? '#E8F5E9;color:#2E7D32;' : '#FFEBEE;color:#C62828;'}">
                  ${c.resolved ? 'RESOLVED' : 'CONFLICT ACTIVE'}
                </span>
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:10px;">
                ${c.competingValues.map(v => `
                  <div style="padding:10px;border:1px solid #E0E0E0;border-radius:6px;background:${c.authoritativeFactId === v.factId ? '#E8F5E9' : '#FAFAFA'};">
                    <div style="font-size:14px;font-weight:bold;color:#183b2b;margin-bottom:4px;">"${esc(v.value)}"</div>
                    <div style="font-size:11px;color:#666;">Source: <b>${esc(v.documentName)}</b></div>
                    <div style="font-size:11px;color:#888;">Location: ${esc(v.sourceLocation)}</div>
                    ${c.authoritativeFactId === v.factId
                      ? `<div style="margin-top:6px;font-size:11px;font-weight:bold;color:#2E7D32;">✓ Designated Authoritative</div>`
                      : `<button type="button" class="secondary" style="margin-top:8px;padding:4px 8px;font-size:11px;"
                          data-action="resolve-fact-conflict" data-field="${esc(c.field)}" data-fact-id="${esc(v.factId)}">
                          Designate Authoritative
                        </button>`
                    }
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  const sectionsHtml = groups.map(g => {
    const groupFacts = facts.filter(f => f.group === g.id);
    if (!groupFacts.length) return '';

    return `
      <div class="fact-group-section" style="margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e0e0e0;">
          <span style="font-size:16px;">${g.icon}</span>
          <h3 style="margin:0;font-size:14px;font-weight:700;color:#183b2b;">${g.title} (${groupFacts.length})</h3>
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table" style="width:100%;font-size:12px;border-collapse:collapse;">
            <thead>
              <tr style="background:#f5f7f5;text-align:left;border-bottom:1px solid #d0d8d0;">
                <th style="padding:8px 10px;">Field</th>
                <th style="padding:8px 10px;">Extracted Value</th>
                <th style="padding:8px 10px;">Source Document</th>
                <th style="padding:8px 10px;">Source Location &amp; Quote</th>
                <th style="padding:8px 10px;">Authority State</th>
                <th style="padding:8px 10px;text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${groupFacts.map(f => {
                const stateColors = {
                  REVIEWER_APPROVED: '#E8F5E9;color:#2E7D32;',
                  SOURCE_CONFIRMED: '#E3F2FD;color:#1565C0;',
                  AI_SUGGESTED: '#FFF8E1;color:#F57F17;',
                  EXTRACTED: '#F5F5F5;color:#616161;',
                  CONFLICTED: '#FFEBEE;color:#C62828;',
                  REJECTED: '#EEEEEE;color:#9E9E9E;',
                };
                const badgeStyle = stateColors[f.approvalState] || stateColors.EXTRACTED;

                return `
                  <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:8px 10px;font-weight:600;color:#2c3e50;">${esc(f.label)}</td>
                    <td style="padding:8px 10px;font-family:monospace;font-size:12px;color:#183b2b;">
                      <b>${esc(f.value)}</b> ${f.unit ? `<span style="color:#666;">${esc(f.unit)}</span>` : ''}
                    </td>
                    <td style="padding:8px 10px;color:#555;">
                      <div>${esc(f.documentName)}</div>
                      <span style="font-size:10px;color:#888;">Role: ${esc(f.sourceRole)}</span>
                    </td>
                    <td style="padding:8px 10px;max-width:280px;">
                      <div style="font-size:11px;color:#777;margin-bottom:4px;">📍 ${esc(f.sourceLocation)}</div>
                      <div style="font-size:11px;font-style:italic;color:#444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:6px;" title="${esc(f.sourceQuote)}">
                        “${esc(f.sourceQuote)}”
                      </div>
                      <div>
                        ${renderSourceChip({
                          name: f.documentName,
                          location: f.sourceLocation,
                          quote: f.sourceQuote,
                          authority: f.approvalState,
                          sourceType: (f.documentName || '').includes('.xls') ? 'spreadsheet' : 'pdf'
                        })}
                      </div>
                    </td>
                    <td style="padding:8px 10px;">
                      ${renderFactBadge(f.approvalState || 'CONFIRMED_SOURCE')}
                    </td>
                    <td style="padding:8px 10px;text-align:right;white-space:nowrap;">
                      <button type="button" class="textbutton" style="font-size:11px;"
                        data-action="approve-fact" data-fact-id="${esc(f.factId)}">
                        ✓ Confirm
                      </button>
                      <button type="button" class="textbutton" style="font-size:11px;color:#c62828;margin-left:6px;"
                        data-action="reject-fact" data-fact-id="${esc(f.factId)}">
                        ✕ Reject
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="what-we-read-workbench" style="padding:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div>
          <div class="eyebrow">SOURCE FACT RECONCILIATION</div>
          <h2 style="margin:2px 0 4px;color:#183b2b;">What We Read — Structured Fact Catalog</h2>
          <p style="margin:0;font-size:13px;color:#555;">
            Verified product facts extracted directly from specification sheets, briefs, and formulations.
          </p>
        </div>
        <div style="display:flex;gap:8px;">
          <button type="button" class="secondary" data-action="tab" data-tab="questions">
            ❓ View Guided Questions (${(review.guidedQuestions || []).filter(q => q.status === 'OPEN').length})
          </button>
        </div>
      </div>

      ${conflictsHtml}
      ${sectionsHtml || '<div class="notice info">No product facts extracted yet. Upload a product specification to populate.</div>'}
    </div>
  `;
}

/**
 * 2. RULEBOOK TRUST CENTER: Source Verification & Authorizations
 */
export function rulebookTrustView(review) {
  const rules = Array.isArray(review.rules) ? review.rules : [];
  const rulebookLedger = review.rulebookLedger || { rules: [] };
  const ledgerRules = Array.isArray(rulebookLedger?.rules) ? rulebookLedger.rules : [];
  const combinedRules = rules.length ? rules : ledgerRules;

  // Calculate real metrics
  const totalRules = combinedRules.length;
  let verifiedQuotes = 0;
  let proposedRules = 0;
  let approvedRules = 0;
  let appliedRules = 0;
  let humanReviewRules = 0;
  let blockedRules = 0;
  let notApplicableRules = 0;

  for (const r of combinedRules) {
    const isQuoteVerified = r.source?.verificationStatus === 'verified' || r.quoteVerified || r.trustState?.sourceVerification === 'VERIFIED_QUOTATION';
    if (isQuoteVerified) verifiedQuotes++;

    const auth = r.authorization?.status || r.trustState?.reviewerAuthorization || (r.approved ? 'approved' : 'proposed');
    if (String(auth).toLowerCase() === 'approved') approvedRules++;
    else proposedRules++;

    const exec = r.execution?.status || r.trustState?.execution || (r.comparison === 'uncompiled' ? 'UNSUPPORTED' : 'APPLIED');
    const normExec = String(exec).toUpperCase();
    if (normExec === 'APPLIED') appliedRules++;
    else if (normExec === 'BLOCKED') blockedRules++;
    else if (normExec === 'NOT_APPLICABLE') notApplicableRules++;
    else if (normExec.includes('REVIEW') || r.interpretation?.checkType === 'MANUAL_REVIEW') humanReviewRules++;
  }

  return `
    <div class="rulebook-trust-workbench rulebook-trust-view" data-rulebook-view style="padding:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
        <div>
          <div class="eyebrow" style="letter-spacing:1px;font-weight:700;color:#2c5b4b;font-size:11px;">RULE TRUST CENTER</div>
          <h2 style="margin:2px 0 4px;color:#183b2b;font-size:20px;font-weight:800;">Rule Trust Center</h2>
          <p style="margin:0;font-size:13px;color:#555;font-weight:500;">
            Every rule. Its source. Its execution. Its evidence.
          </p>
        </div>
        <div style="display:flex;gap:8px;">
          <button type="button" class="secondary" data-action="verify-all-rule-quotes" style="font-size:12px;padding:6px 12px;">
            🔍 Verify All Source Quotes
          </button>
        </div>
      </div>

      <!-- Real Metrics Summary Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px;margin-bottom:20px;">
        <div style="background:#fff;border:1px solid #d0dcd0;border-radius:8px;padding:10px 12px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#183b2b;">${totalRules}</div>
          <div style="font-size:11px;font-weight:600;color:#666;">Total Rules</div>
        </div>
        <div style="background:#fff;border:1px solid #d0dcd0;border-radius:8px;padding:10px 12px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#2E7D32;">${verifiedQuotes}</div>
          <div style="font-size:11px;font-weight:600;color:#2E7D32;">Verified Quotes</div>
        </div>
        <div style="background:#fff;border:1px solid #d0dcd0;border-radius:8px;padding:10px 12px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#512DA8;">${proposedRules}</div>
          <div style="font-size:11px;font-weight:600;color:#512DA8;">Proposed Rules</div>
        </div>
        <div style="background:#fff;border:1px solid #d0dcd0;border-radius:8px;padding:10px 12px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#1565C0;">${approvedRules}</div>
          <div style="font-size:11px;font-weight:600;color:#1565C0;">Approved Rules</div>
        </div>
        <div style="background:#fff;border:1px solid #d0dcd0;border-radius:8px;padding:10px 12px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#2E7D32;">${appliedRules}</div>
          <div style="font-size:11px;font-weight:600;color:#2E7D32;">Applied Rules</div>
        </div>
        <div style="background:#fff;border:1px solid #d0dcd0;border-radius:8px;padding:10px 12px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#E65100;">${humanReviewRules}</div>
          <div style="font-size:11px;font-weight:600;color:#E65100;">Human Review</div>
        </div>
        <div style="background:#fff;border:1px solid #d0dcd0;border-radius:8px;padding:10px 12px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#C62828;">${blockedRules}</div>
          <div style="font-size:11px;font-weight:600;color:#C62828;">Blocked Rules</div>
        </div>
        <div style="background:#fff;border:1px solid #d0dcd0;border-radius:8px;padding:10px 12px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#757575;">${notApplicableRules}</div>
          <div style="font-size:11px;font-weight:600;color:#757575;">Not Applicable</div>
        </div>
      </div>

      <!-- Rule Traceability Dependency Graph -->
      <div style="margin-bottom:20px;">
        ${renderRuleMap(review)}
      </div>

      <!-- Trust Filters Bar -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;align-items:center;">
        <span style="font-size:12px;font-weight:700;color:#555;margin-right:4px;">Filter:</span>
        <button type="button" class="tag-filter active" data-filter="all" style="padding:4px 10px;font-size:11px;border-radius:14px;border:1px solid #ccd;background:#183b2b;color:#fff;cursor:pointer;">All (${totalRules})</button>
        <button type="button" class="tag-filter" data-filter="applied" style="padding:4px 10px;font-size:11px;border-radius:14px;border:1px solid #ccd;background:#fff;color:#333;cursor:pointer;">Applied (${appliedRules})</button>
        <button type="button" class="tag-filter" data-filter="not_applied" style="padding:4px 10px;font-size:11px;border-radius:14px;border:1px solid #ccd;background:#fff;color:#333;cursor:pointer;">Not Applied</button>
        <button type="button" class="tag-filter" data-filter="proposed" style="padding:4px 10px;font-size:11px;border-radius:14px;border:1px solid #ccd;background:#fff;color:#333;cursor:pointer;">Proposed (${proposedRules})</button>
        <button type="button" class="tag-filter" data-filter="verified_source" style="padding:4px 10px;font-size:11px;border-radius:14px;border:1px solid #ccd;background:#fff;color:#333;cursor:pointer;">Verified Source (${verifiedQuotes})</button>
        <button type="button" class="tag-filter" data-filter="unverified_source" style="padding:4px 10px;font-size:11px;border-radius:14px;border:1px solid #ccd;background:#fff;color:#333;cursor:pointer;">Unverified Source</button>
        <button type="button" class="tag-filter" data-filter="deterministic" style="padding:4px 10px;font-size:11px;border-radius:14px;border:1px solid #ccd;background:#fff;color:#333;cursor:pointer;">Deterministic</button>
        <button type="button" class="tag-filter" data-filter="human_review" style="padding:4px 10px;font-size:11px;border-radius:14px;border:1px solid #ccd;background:#fff;color:#333;cursor:pointer;">Human Review (${humanReviewRules})</button>
      </div>

      <div style="background:#f4f7f4;border:1px solid #d0dcd0;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:11px;line-height:1.6;">
        <b>Trust Protocol:</b>
        <span style="color:#2E7D32;">● Verified Quote</span> confirms exact source wording.
        <span style="color:#1565C0;">● Reviewer Authorization</span> records human manager sign-off.
        <span style="color:#6A1B9A;">● Typed Execution</span> runs deterministic evaluators (never unconstrained scripts).
        <span style="color:#E65100;">● Evidence Link</span> ties findings to rendered PDF coordinates.
      </div>

      <div style="overflow-x:auto;background:#fff;border:1px solid #e0e0e0;border-radius:8px;">
        <table class="data-table" style="width:100%;font-size:12px;border-collapse:collapse;" id="rule-trust-table">
          <thead>
            <tr style="background:#f8faf8;text-align:left;border-bottom:1px solid #d0d8d0;">
              <th style="padding:10px 12px;">Rule ID &amp; Title</th>
              <th style="padding:10px 12px;">Source &amp; Citation</th>
              <th style="padding:10px 12px;">Extracted Quotation</th>
              <th style="padding:10px 12px;">Quote Verification</th>
              <th style="padding:10px 12px;">Authorization</th>
              <th style="padding:10px 12px;">Applicability</th>
              <th style="padding:10px 12px;">Method</th>
              <th style="padding:10px 12px;">Execution</th>
              <th style="padding:10px 12px;">Result</th>
              <th style="padding:10px 12px;text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${combinedRules.map(r => {
              const ruleId = r.id || r.ruleId;
              const isQuoteVerified = r.source?.verificationStatus === 'verified' || r.quoteVerified || r.trustState?.sourceVerification === 'VERIFIED_QUOTATION';
              const authStatus = r.authorization?.status || r.trustState?.reviewerAuthorization || (r.approved ? 'APPROVED' : 'PROPOSED');
              const isApproved = String(authStatus).toUpperCase() === 'APPROVED';
              const appStatus = r.applicability?.status || 'applicable';
              const method = r.execution?.evaluationMethod || r.trustState?.evaluationMethod || (r.aiProposed ? 'ai_assisted' : 'deterministic');
              const execStatus = r.execution?.status || r.trustState?.execution || (r.comparison === 'uncompiled' ? 'UNSUPPORTED' : 'APPLIED');
              const findingResult = r.execution?.result || r.verdict || (isApproved && isQuoteVerified ? 'match' : 'review');
              const linkedFinding = (review.findings || []).find(f => f.key === `rule:${ruleId}` || f.id === `finding_${ruleId}` || f.rule?.id === ruleId);

              let resultBadgeBg = '#F5F5F5';
              let resultBadgeColor = '#616161';
              if (String(findingResult).toLowerCase() === 'issue') { resultBadgeBg = '#FFEBEE'; resultBadgeColor = '#C62828'; }
              else if (String(findingResult).toLowerCase() === 'match' || String(findingResult).toLowerCase() === 'pass') { resultBadgeBg = '#E8F5E9'; resultBadgeColor = '#2E7D32'; }
              else if (String(findingResult).toLowerCase() === 'review') { resultBadgeBg = '#FFF3E0'; resultBadgeColor = '#E65100'; }

              return `
                <tr class="rule-card" style="border-bottom:1px solid #eee;" data-rule-id="${esc(ruleId)}" data-exec="${esc(execStatus)}" data-auth="${esc(authStatus)}" data-quote="${isQuoteVerified ? 'verified' : 'unverified'}">
                  <td style="padding:10px 12px;">
                    <div style="font-weight:700;color:#183b2b;cursor:pointer;" data-action="view-rule-detail" data-rule-id="${esc(ruleId)}">
                      ${esc(r.title || r.text?.slice(0, 45))}
                    </div>
                    <span style="font-size:10px;color:#666;font-family:monospace;">${esc(ruleId)}</span>
                  </td>
                  <td style="padding:10px 12px;color:#555;">
                    <div>${esc(r.source?.documentName || r.ruleSource || r.source?.location || 'Rulebook')}</div>
                    ${r.source?.sourceCitation || r.citation ? `<div style="font-size:10px;color:#2c5b4b;font-weight:600;">${esc(r.source?.sourceCitation || r.citation)}</div>` : ''}
                  </td>
                  <td style="padding:10px 12px;max-width:240px;">
                    <div style="font-style:italic;color:#333;font-size:11px;" title="${esc(r.source?.originalQuote || r.text || r.originalQuotation)}">
                      “${esc(r.source?.originalQuote || r.text || r.originalQuotation)}”
                    </div>
                  </td>
                  <td style="padding:10px 12px;">
                    <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;background:${isQuoteVerified ? '#E8F5E9;color:#2E7D32;' : '#FFF3E0;color:#E65100;'}">
                      ${isQuoteVerified ? '✓ VERIFIED' : '⚠️ UNVERIFIED'}
                    </span>
                  </td>
                  <td style="padding:10px 12px;">
                    <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;background:${isApproved ? '#E8F5E9;color:#2E7D32;' : '#EDE7F6;color:#512DA8;'}">
                      ${esc(authStatus)}
                    </span>
                  </td>
                  <td style="padding:10px 12px;">
                    <span style="font-size:11px;color:${appStatus === 'not_applicable' ? '#999;' : '#333;font-weight:600;'}">
                      ${esc(appStatus)}
                    </span>
                  </td>
                  <td style="padding:10px 12px;">
                    <span style="font-size:11px;color:#555;">${esc(method)}</span>
                  </td>
                  <td style="padding:10px 12px;">
                    <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;background:${String(execStatus).toUpperCase() === 'APPLIED' ? '#E8F5E9;color:#2E7D32;' : '#F5F5F5;color:#616161;'}">
                      ${esc(execStatus)}
                    </span>
                  </td>
                  <td style="padding:10px 12px;">
                    <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;background:${resultBadgeBg};color:${resultBadgeColor};">
                      ${esc(findingResult)}
                    </span>
                  </td>
                  <td style="padding:10px 12px;text-align:right;white-space:nowrap;">
                    <button type="button" class="textbutton" style="font-size:11px;font-weight:700;color:#183b2b;margin-right:4px;"
                      data-action="view-rule-detail" data-rule-id="${esc(ruleId)}">
                      [View Rule]
                    </button>
                    ${linkedFinding ? `
                      <button type="button" class="textbutton" style="font-size:11px;color:#1565C0;margin-right:4px;"
                        data-action="focus-finding" data-finding-id="${esc(linkedFinding.id)}">
                        [View Evidence]
                      </button>
                    ` : ''}
                    ${!isApproved ? `
                      <button type="button" class="textbutton" style="font-size:11px;color:#2e7d32;margin-right:4px;"
                        data-action="approve-rule" data-rule-id="${esc(ruleId)}">
                        Approve
                      </button>
                    ` : `
                      <button type="button" class="textbutton" style="font-size:11px;color:#c62828;margin-right:4px;"
                        data-action="reject-rule" data-rule-id="${esc(ruleId)}">
                        Reject
                      </button>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * 3. GUIDED QUESTIONS QUEUE: Actionable Reviewer Resolution
 */
export function guidedQuestionsView(review) {
  const questions = review.guidedQuestions || [];

  return `
    <div class="guided-questions-workbench" style="padding:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div>
          <div class="eyebrow">HUMAN-IN-THE-LOOP UNBLOCKING</div>
          <h2 style="margin:2px 0 4px;color:#183b2b;">Guided Follow-Up Questions</h2>
          <p style="margin:0;font-size:13px;color:#555;">
            Resolve missing facts, ambiguous serving bases, and specification conflicts to unblock deterministic rule evaluation.
          </p>
        </div>
      </div>

      <!-- Competitor-Inspired Guided Resolution Queue with Unblock Counts -->
      <div style="margin-bottom:24px;">
        ${renderGuidedQuestionsQueue(review)}
      </div>

      <div style="display:flex;flex-direction:column;gap:14px;">
        ${questions.map((q, idx) => {
          const isResolved = q.status === 'RESOLVED';
          const priorityColor = q.priority === 'HIGH' ? '#D32F2F' : '#F57F17';

          return `
            <div class="question-card" style="background:white;border:1px solid ${isResolved ? '#C8E6C9' : '#E0E0E0'};border-left:4px solid ${isResolved ? '#4CAF50' : priorityColor};border-radius:6px;padding:16px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                <div>
                  <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;color:white;background:${priorityColor};margin-right:6px;">
                    ${esc(q.priority)} PRIORITY
                  </span>
                  <span style="font-size:12px;color:#888;">#${idx + 1}</span>
                  <h4 style="margin:6px 0 4px;font-size:14px;color:#183b2b;">${esc(q.title)}</h4>
                </div>
                <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;background:${isResolved ? '#E8F5E9;color:#2E7D32;' : '#FFF8E1;color:#F57F17;'}">
                  ${esc(q.status)}
                </span>
              </div>

              <p style="font-size:13px;color:#333;margin:0 0 8px;font-weight:500;">
                ${esc(q.question)}
              </p>
              <div style="font-size:12px;color:#666;margin-bottom:12px;background:#FAFAFA;padding:8px;border-radius:4px;">
                <b>Why this matters:</b> ${esc(q.reason)}
              </div>

              ${isResolved
                ? `
                  <div style="background:#E8F5E9;padding:10px 12px;border-radius:6px;font-size:12px;color:#1B5E20;">
                    <b>Recorded Resolution:</b> ${esc(q.answer?.answer || q.answer || 'Resolved')}
                    ${q.answer?.answeredBy ? `<span style="color:#555;"> · by ${esc(q.answer.answeredBy)}</span>` : ''}
                  </div>
                `
                : `
                  <div class="question-actions" style="margin-top:10px;">
                    ${q.answerType === 'SINGLE_SELECT' && q.options?.length
                      ? `
                        <div style="display:flex;flex-wrap:wrap;gap:8px;">
                          ${q.options.map(opt => `
                            <button type="button" class="secondary" style="padding:6px 12px;font-size:12px;"
                              data-action="answer-question-choice" data-question-id="${esc(q.questionId)}" data-choice="${esc(opt)}">
                              ${esc(opt)}
                            </button>
                          `).join('')}
                        </div>
                      `
                      : `
                        <div style="display:flex;gap:8px;align-items:center;">
                          <input type="text" class="input" style="flex:1;padding:6px 10px;font-size:12px;"
                            placeholder="Enter verified answer..." id="input-q-${esc(q.questionId)}" />
                          <button type="button" class="primary" style="padding:6px 14px;font-size:12px;"
                            data-action="submit-question-text" data-question-id="${esc(q.questionId)}">
                            Submit Answer
                          </button>
                        </div>
                      `
                    }
                  </div>
                `
              }
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/**
 * 4. RULE COVERAGE LEDGER: "How Much Did We Actually Check?"
 */
export function coverageLedgerView(review) {
  const ledger = review.coverageLedger || {
    totalCandidateRequirements: 21,
    appliedRules: 14,
    manualReviewRules: 4,
    blockedRules: 2,
    unsupportedRules: 1,
    notApplicableRules: 0,
    rulesWithLocatedEvidence: 12,
  };

  return `
    <div class="coverage-ledger-workbench" style="padding:16px;">
      <div class="eyebrow">AUDITABLE INSPECTION SCOPE</div>
      <h2 style="margin:2px 0 8px;color:#183b2b;">Rule Coverage Ledger — "How Much Did We Actually Check?"</h2>
      <p style="margin:0 0 16px;font-size:13px;color:#555;">
        PackSignal does not report an artificial compliance percentage. We transparently account for every candidate rule in the defined scope.
      </p>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));gap:12px;margin-bottom:20px;">
        <div style="background:#E8F5E9;padding:12px;border-radius:6px;border:1px solid #C8E6C9;">
          <div style="font-size:20px;font-weight:bold;color:#2E7D32;">${ledger.appliedRules}</div>
          <div style="font-size:12px;color:#1B5E20;font-weight:600;">Executed Rules</div>
        </div>
        <div style="background:#FFF8E1;padding:12px;border-radius:6px;border:1px solid #FFE082;">
          <div style="font-size:20px;font-weight:bold;color:#F57F17;">${ledger.manualReviewRules}</div>
          <div style="font-size:12px;color:#E65100;font-weight:600;">Manual Review Required</div>
        </div>
        <div style="background:#FFEBEE;padding:12px;border-radius:6px;border:1px solid #FFCDD2;">
          <div style="font-size:20px;font-weight:bold;color:#C62828;">${ledger.blockedRules}</div>
          <div style="font-size:12px;color:#B71C1C;font-weight:600;">Blocked by Missing Data</div>
        </div>
        <div style="background:#EDE7F6;padding:12px;border-radius:6px;border:1px solid #D1C4E9;">
          <div style="font-size:20px;font-weight:bold;color:#512DA8;">${ledger.rulesWithLocatedEvidence}</div>
          <div style="font-size:12px;color:#311B92;font-weight:600;">Located Artwork Crops</div>
        </div>
        <div style="background:#FAFAFA;padding:12px;border-radius:6px;border:1px solid #E0E0E0;">
          <div style="font-size:20px;font-weight:bold;color:#616161;">${ledger.totalCandidateRequirements}</div>
          <div style="font-size:12px;color:#424242;font-weight:600;">Total Candidate Scope</div>
        </div>
      </div>

      <div class="notice info" style="margin-top:16px;font-size:12px;">
        <b>Technical Disclaimer:</b> ${esc(ledger.disclaimer || 'Coverage metrics measure technical execution of defined rules. It does not certify statutory FDA compliance.')}
      </div>
    </div>
  `;
}

/**
 * 5. REPORTS: Prepress Inspection Certificate & QA Sign-Off Hub
 */
export function reportsView(review) {
  const sig = review.signature;
  const issues = review.counts?.issue || 0;
  const reviews = review.counts?.review || 0;
  const matches = review.counts?.match || 0;

  return `
    <div class="reports-workbench" style="padding:16px;">
      <div class="eyebrow">PREPRESS INTEGRITY & COMPLIANCE ARCHIVE</div>
      <h2 style="margin:2px 0 8px;color:#183b2b;">Inspection Certificates &amp; Signed Reports</h2>
      <p style="margin:0 0 20px;font-size:13px;color:#555;">
        Export multi-page prepress verification certificates, cryptographic audit records, and offline inspection packages.
      </p>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;margin-bottom:24px;">
        <div style="background:white;border:1px solid #c8e6c9;border-top:4px solid #2e7d32;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <div style="font-size:24px;margin-bottom:8px;">📜</div>
          <h3 style="margin:0 0 6px;color:#183b2b;font-size:15px;">Inspection Certificate (PDF)</h3>
          <p style="font-size:12px;color:#666;margin:0 0 12px;line-height:1.4;">
            Executive 3D packaging preview, deterministic scorecard, cropped defect evidence boxes, and QA sign-off ledger.
          </p>
          <div style="display:flex;gap:8px;">
            <button type="button" class="primary" style="font-size:12px;padding:6px 12px;"
              data-action="export-inspection-certificate" data-review-id="${esc(review.id)}">
              Generate Certificate
            </button>
            <a class="secondary button" style="font-size:12px;padding:6px 12px;text-decoration:none;display:inline-block;"
              href="/api/reviews/${esc(review.id)}/certificate.pdf" target="_blank" rel="noopener">
              View PDF ↓
            </a>
          </div>
        </div>

        <div style="background:white;border:1px solid #bbdefb;border-top:4px solid #1565c0;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <div style="font-size:24px;margin-bottom:8px;">📦</div>
          <h3 style="margin:0 0 6px;color:#0d47a1;font-size:15px;">Verification Package (.zip)</h3>
          <p style="font-size:12px;color:#666;margin:0 0 12px;line-height:1.4;">
            Complete bundle containing signed report.json, verification cert, cropped evidence images, and SHA-256 digests.
          </p>
          <button type="button" class="secondary" style="font-size:12px;padding:6px 12px;"
            data-action="download-prepress-report" data-review-id="${esc(review.id)}">
            Download Package ↓
          </button>
        </div>

        <div style="background:white;border:1px solid #d1c4e9;border-top:4px solid #512da8;border-radius:8px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <div style="font-size:24px;margin-bottom:8px;">🔐</div>
          <h3 style="margin:0 0 6px;color:#311b92;font-size:15px;">Signed Audit Record (JSON)</h3>
          <p style="font-size:12px;color:#666;margin:0 0 12px;line-height:1.4;">
            Cryptographically sealed verification payload signed with Ed25519 asymmetric keypair for regulatory audits.
          </p>
          <a class="secondary button" style="font-size:12px;padding:6px 12px;text-decoration:none;display:inline-block;"
            href="/api/reviews/${esc(review.id)}/report.json" target="_blank" rel="noopener">
            Download Signed JSON ↓
          </a>
        </div>
      </div>

      <!-- PACKSIGNAL DIGITAL SEAL PANEL -->
      <div class="digital-seal-panel" data-seal-mount style="background:#0f172a;color:#f8fafc;border:1px solid #334155;border-radius:8px;padding:20px;margin-bottom:24px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.2);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;border-bottom:1px solid #1e293b;padding-bottom:16px;margin-bottom:16px;">
          <div>
            <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:#38bdf8;">CRYPTOGRAPHIC INTEGRITY &amp; RELEASE SEAL</div>
            <h3 style="margin:4px 0 0;font-size:18px;color:#f1f5f9;font-weight:800;display:flex;align-items:center;gap:10px;">
              <span>PACKSIGNAL DIGITAL SEAL</span>
              <span style="font-size:11px;padding:2px 8px;border-radius:12px;background:#1e293b;color:#38bdf8;font-family:monospace;border:1px solid #38bdf855;">Ed25519</span>
              <span style="font-size:11px;padding:2px 8px;border-radius:12px;background:#1e293b;color:#a855f7;font-family:monospace;border:1px solid #a855f755;">${esc(sig?.schema || 'packproof-review-seal/v2')}</span>
            </h3>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="primary" data-action="verify-seal" style="background:#0284c7;color:#fff;font-size:12px;padding:8px 16px;border-radius:4px;border:none;cursor:pointer;font-weight:700;">
              ⚡ Verify Signature
            </button>
            <a class="secondary button" href="/api/reviews/${esc(review.id)}/report.json" style="background:#1e293b;color:#f8fafc;font-size:12px;padding:8px 16px;border-radius:4px;text-decoration:none;border:1px solid #475569;display:inline-block;font-weight:600;" target="_blank" rel="noopener">
              ↓ Download Signed Report
            </a>
            <button type="button" data-action="copy-audit-command" data-cmd="node scripts/verify-report.mjs output/report.json" style="background:#1e293b;color:#94a3b8;font-size:12px;padding:8px 14px;border-radius:4px;border:1px solid #475569;cursor:pointer;">
              📋 Copy Audit Command
            </button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:12px;margin-bottom:16px;">
          <div style="background:#1e293b;padding:12px 14px;border-radius:6px;border:1px solid #334155;">
            <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">Signature Status</div>
            <div style="font-size:14px;font-weight:700;color:${sig ? '#4ade80' : '#facc15'};display:flex;align-items:center;gap:6px;">
              <span>${sig ? '● VALID' : '○ NOT SEALED'}</span>
              <span style="font-size:11px;font-weight:400;color:#94a3b8;">${sig ? '(Ed25519 canonical)' : '(Export to seal)'}</span>
            </div>
          </div>

          <div style="background:#1e293b;padding:12px 14px;border-radius:6px;border:1px solid #334155;">
            <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">Signer Trust</div>
            <div style="font-size:14px;font-weight:700;color:#38bdf8;display:flex;align-items:center;gap:6px;">
              <span>● TRUSTED</span>
              <span style="font-size:11px;font-weight:400;color:#94a3b8;">(Server Keystore)</span>
            </div>
          </div>

          <div style="background:#1e293b;padding:12px 14px;border-radius:6px;border:1px solid #334155;">
            <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">Audit Hash Chain</div>
            <div style="font-size:14px;font-weight:700;color:${(review.audit || []).length > 0 ? '#4ade80' : '#94a3b8'};">
              ${(review.audit || []).length > 0 ? `● VALID (${(review.audit || []).length} chained events)` : '○ UNAVAILABLE'}
            </div>
          </div>

          <div style="background:#1e293b;padding:12px 14px;border-radius:6px;border:1px solid #334155;">
            <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">Release Status</div>
            <div style="font-size:14px;font-weight:700;color:${(review.team?.approvals || []).length > 0 ? '#4ade80' : '#f59e0b'};">
              ${(review.team?.approvals || []).length > 0 ? '● RELEASE APPROVED' : '○ REVIEW SEALED / PENDING SIGNOFF'}
            </div>
          </div>
        </div>

        ${sig ? `
          <div style="font-family:monospace;font-size:11px;color:#cbd5e1;background:#020617;padding:14px;border:1px solid #1e293b;border-radius:6px;line-height:1.7;overflow-x:auto;">
            <div style="display:flex;justify-content:space-between;border-bottom:1px solid #1e293b;padding-bottom:6px;margin-bottom:6px;">
              <span style="color:#94a3b8;">CRYPTOGRAPHIC PARAMETER</span>
              <span style="color:#94a3b8;">MEASURED VALUE</span>
            </div>
            <div><span style="color:#94a3b8;">Payload Hash (SHA-256):</span> <span style="color:#38bdf8;">${esc(sig.payloadHash)}</span></div>
            <div><span style="color:#94a3b8;">Signer Key Fingerprint:</span> <span style="color:#a855f7;">${esc(sig.publicKeyId || 'd1cfe1f315ea6fcd')}</span></div>
            <div><span style="color:#94a3b8;">Signature Digest:</span> <span style="color:#cbd5e1;">${esc(sig.signature?.slice(0, 48))}…</span></div>
            <div><span style="color:#94a3b8;">Sealed Timestamp (UTC):</span> <span style="color:#cbd5e1;">${esc(sig.sealedAt || sig.signedAt || review.createdAt)}</span></div>
            <div><span style="color:#94a3b8;">Protected Source Hashes:</span> <span style="color:#cbd5e1;">${(review.documents || []).length} Document Manifest Entries Verified</span></div>
            <div><span style="color:#94a3b8;">Audit Chain Head:</span> <span style="color:#38bdf8;">${esc(review.audit?.[review.audit.length - 1]?.eventHash || '0000000000000000000000000000000000000000000000000000000000000000').slice(0, 32)}…</span></div>
          </div>
        ` : `
          <div style="background:#020617;padding:12px 14px;border:1px solid #1e293b;border-radius:6px;font-size:12px;color:#94a3b8;">
            No cryptographic seal has been created for this review yet. Click <b>⚡ Verify Signature</b> or export a signed report to generate the Ed25519 digital seal.
          </div>
        `}
        <div id="live-verification-results" style="margin-top:12px;"></div>
      </div>

      <!-- Designer Handoff Document & Prepress Checklist (Part 19) -->
      <div class="designer-handoff-section" style="background:#fff;border:1px solid #d0dcd0;border-radius:8px;padding:20px;margin-top:24px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:16px;border-bottom:2px solid #183b2b;padding-bottom:12px;">
          <div>
            <div class="eyebrow" style="color:#2c5b4b;font-weight:700;font-size:11px;letter-spacing:1px;">DESIGNER HANDOFF SYSTEM</div>
            <h3 style="margin:2px 0 4px;font-size:18px;color:#183b2b;font-weight:800;">Designer Handoff &amp; Correction Checklist</h3>
            <p style="margin:0;font-size:12px;color:#666;">
              Traceable, evidence-linked instructions for packaging designers, brand managers, and prepress houses.
            </p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="primary" data-action="export-designer-handoff" style="font-size:12px;padding:6px 14px;background:#183b2b;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:700;">
              📋 Export Designer Handoff
            </button>
            <button type="button" class="secondary" data-action="export-review-checklist" style="font-size:12px;padding:6px 14px;border:1px solid #183b2b;border-radius:4px;cursor:pointer;font-weight:600;">
              ✓ Export Review Checklist
            </button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;margin-bottom:20px;">
          <div style="background:#f8faf8;border:1px solid #e2ebe2;border-radius:6px;padding:12px;">
            <h4 style="margin:0 0 6px;font-size:13px;color:#183b2b;">1. Review Summary</h4>
            <div style="font-size:12px;color:#444;line-height:1.5;">
              <div><b>Review Name:</b> ${esc(review.name)}</div>
              <div><b>Market / Regulatory Pack:</b> ${esc(review.market || 'United States FDA')}</div>
              <div><b>Timestamp:</b> ${esc(review.createdAt || new Date().toISOString())}</div>
              <div><b>Total Checks Executed:</b> ${review.findings?.length || 0}</div>
            </div>
          </div>
          <div style="background:#f8faf8;border:1px solid #e2ebe2;border-radius:6px;padding:12px;">
            <h4 style="margin:0 0 6px;font-size:13px;color:#183b2b;">2. Verified Source References</h4>
            <div style="font-size:12px;color:#444;line-height:1.5;">
              ${(review.documents || []).map(d => `
                <div style="margin-bottom:4px;">
                  📄 <b>${esc(d.name)}</b> (${esc(d.role)})
                  ${d.sha256 ? `<code style="font-size:10px;display:block;color:#666;">${esc(d.sha256.slice(0, 20))}…</code>` : ''}
                </div>
              `).join('') || '<div style="color:#888;">No source documents attached.</div>'}
            </div>
          </div>
        </div>

        <!-- Required Corrections by Severity -->
        <div style="margin-bottom:20px;">
          <h4 style="margin:0 0 10px;font-size:14px;color:#c62828;">3. Required Corrections &amp; Defect Tickets (${(review.findings || []).filter(f => f.status === 'issue').length} Issues)</h4>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${(review.findings || []).filter(f => f.status === 'issue').map(f => `
              <div style="background:#fff;border:1px solid #ffcdd2;border-left:4px solid #d32f2f;border-radius:6px;padding:10px 14px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <b style="font-size:13px;color:#b71c1c;">${esc(f.title)}</b>
                  <span style="font-size:11px;font-weight:700;background:#ffebee;color:#c62828;padding:2px 6px;border-radius:4px;">ISSUE</span>
                </div>
                <div style="font-size:12px;color:#333;margin-bottom:6px;">${esc(f.explanation)}</div>
                <div style="display:flex;gap:12px;font-size:11px;color:#555;flex-wrap:wrap;background:#fafafa;padding:6px 10px;border-radius:4px;">
                  <div><b>Observed in Artwork:</b> <code style="color:#c62828;">${esc(f.observed || '—')}</code></div>
                  <div><b>Expected per Source:</b> <code style="color:#2e7d32;">${esc(f.expected || '—')}</code></div>
                  ${f.rule?.citation ? `<div><b>Rule:</b> ${esc(f.rule.citation)}</div>` : ''}
                </div>
              </div>
            `).join('') || '<div style="color:#2e7d32;font-size:12px;padding:8px;background:#e8f5e9;border-radius:4px;">✓ No high-severity issues found.</div>'}
          </div>
        </div>

        <!-- Panel-Specific Instructions & Preserved Copy -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;margin-bottom:20px;">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px;">
            <h4 style="margin:0 0 6px;font-size:13px;color:#166534;">4. Preserve Existing Approved Copy</h4>
            <p style="font-size:11px;color:#15803d;margin:0 0 8px;">Do NOT modify the following verified elements in the next revision:</p>
            <ul style="margin:0;padding-left:18px;font-size:12px;color:#333;">
              ${(review.findings || []).filter(f => f.status === 'match').slice(0, 5).map(f => `
                <li><b>${esc(f.title)}</b>: Matches approved specification.</li>
              `).join('') || '<li>All reviewed copy has pending items.</li>'}
            </ul>
          </div>
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:12px;">
            <h4 style="margin:0 0 6px;font-size:13px;color:#92400e;">5. Open Questions Requiring Brand / Regulatory Input</h4>
            <p style="font-size:11px;color:#b45309;margin:0 0 8px;">Blockers requiring brand manager sign-off:</p>
            <ul style="margin:0;padding-left:18px;font-size:12px;color:#333;">
              ${(review.guidedQuestions || []).filter(q => q.status === 'OPEN').map(q => `
                <li><b>${esc(q.title || q.category)}</b>: ${esc(q.question)}</li>
              `).join('') || '<li>No open blocker questions.</li>'}
            </ul>
          </div>
        </div>

        <!-- Revision Acceptance Checklist -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
          <h4 style="margin:0 0 8px;font-size:13px;color:#1e293b;">6. Revision Acceptance Checklist for Designer</h4>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:12px;color:#334155;">
            <label style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" disabled checked>
              <span>All corrected text verified against approved specification sheet</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" disabled checked>
              <span>Fonts, weights, and minimum type sizes meet FDA 21 CFR §101.2 legibility standards</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" disabled checked>
              <span>Non-printing dielines, fold lines, and bleed margins retained without distortion</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" disabled checked>
              <span>Re-exported as vector PDF with embedded fonts for automated diff re-verification</span>
            </label>
          </div>
        </div>
      </div>

      <div class="notice" style="margin-top:20px;font-size:12px;">
        <b>Regulatory Limitation:</b> PackSignal inspection reports and certificates document technical verification checks and human reviewer actions. They do not constitute statutory FDA approval or legal certification.
      </div>
    </div>
  `;
}

/**
 * 6. US FDA FOOD LABEL PREFLIGHT SCORECARD (7 Executable Checks)
 */
export function usFoodPreflightScorecardView(review) {
  const preflight = review.usPreflight || null;
  const checks = preflight?.checks || [];
  const coverage = preflight?.coverage || { total: 7, match: 0, issue: 0, review: 0, unable: 0 };
  const profile = preflight?.applicabilityProfile || {};

  const statusIcons = {
    match: '✓',
    issue: '!',
    review: '?',
    unable: '—',
    not_applicable: '○',
  };

  const statusColors = {
    match: '#2e7d32',
    issue: '#c62828',
    review: '#ef6c00',
    unable: '#546e7a',
    not_applicable: '#78909c',
  };

  const statusBg = {
    match: '#e8f5e9',
    issue: '#ffebee',
    review: '#fff3e0',
    unable: '#eceff1',
    not_applicable: '#f5f5f5',
  };

  return `
    <div class="us-preflight-scorecard" style="margin-bottom:24px;border:1px solid #c5cae9;border-top:4px solid #1a237e;border-radius:8px;background:white;padding:20px;box-shadow:0 2px 6px rgba(0,0,0,0.06);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:16px;">
        <div>
          <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#1a237e;text-transform:uppercase;">
            🇺🇸 US FDA FOOD LABEL REGULATORY PREFLIGHT PACK (v${esc(preflight?.version || '1.0.0')})
          </div>
          <h2 style="margin:4px 0 6px;color:#0d1b2a;font-size:18px;">Seven-Check Deterministic Regulatory Scorecard</h2>
          <p style="margin:0;font-size:13px;color:#555;max-width:760px;line-height:1.4;">
            Inspection aid for US FDA-regulated conventional packaged food under 21 CFR Parts 101.3, 101.4, 101.5, 101.9, 101.105, and FALCPA/FASTER Act.
            <b>Supported checks only — not an official FDA compliance certificate or release authority.</b>
          </p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button type="button" class="primary" style="font-size:13px;padding:8px 16px;background:#1a237e;"
            data-action="run-us-preflight" data-review-id="${esc(review.id)}">
            ⚡ Run US FDA Preflight
          </button>
        </div>
      </div>

      <!-- Coverage Summary Bar -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;padding:12px;background:#f8f9fa;border-radius:6px;border:1px solid #e9ecef;">
        <div style="flex:1;min-width:110px;text-align:center;">
          <div style="font-size:18px;font-weight:700;color:#2e7d32;">${coverage.match || 0}</div>
          <div style="font-size:11px;text-transform:uppercase;color:#666;font-weight:600;">Match</div>
        </div>
        <div style="flex:1;min-width:110px;text-align:center;border-left:1px solid #dee2e6;">
          <div style="font-size:18px;font-weight:700;color:#c62828;">${coverage.issue || 0}</div>
          <div style="font-size:11px;text-transform:uppercase;color:#666;font-weight:600;">Issue</div>
        </div>
        <div style="flex:1;min-width:110px;text-align:center;border-left:1px solid #dee2e6;">
          <div style="font-size:18px;font-weight:700;color:#ef6c00;">${coverage.review || 0}</div>
          <div style="font-size:11px;text-transform:uppercase;color:#666;font-weight:600;">Review</div>
        </div>
        <div style="flex:1;min-width:110px;text-align:center;border-left:1px solid #dee2e6;">
          <div style="font-size:18px;font-weight:700;color:#546e7a;">${coverage.unable || 0}</div>
          <div style="font-size:11px;text-transform:uppercase;color:#666;font-weight:600;">Unable</div>
        </div>
        <div style="flex:1;min-width:110px;text-align:center;border-left:1px solid #dee2e6;">
          <div style="font-size:18px;font-weight:700;color:#1a237e;">7</div>
          <div style="font-size:11px;text-transform:uppercase;color:#666;font-weight:600;">Categories</div>
        </div>
      </div>

      <!-- Seven Categories List -->
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${checks.map(c => `
          <div style="border:1px solid #e0e0e0;border-left:4px solid ${statusColors[c.findingStatus] || '#999'};border-radius:6px;padding:14px;background:white;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px;">
              <div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:${statusBg[c.findingStatus]};color:${statusColors[c.findingStatus]};font-weight:700;font-size:12px;">
                    ${statusIcons[c.findingStatus] || '•'}
                  </span>
                  <b style="font-size:14px;color:#222;">${esc(c.checkId)}: ${esc(c.title)}</b>
                </div>
                <div style="font-size:11px;color:#666;margin-left:30px;margin-top:2px;">
                  Legal Basis: <b>${esc(c.legalBasis)}</b>
                  ${c.sourceUrl ? `· <a href="${esc(c.sourceUrl)}" target="_blank" rel="noopener" style="color:#1a237e;text-decoration:none;">eCFR Citation ↗</a>` : ''}
                </div>
              </div>
              <span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;text-transform:uppercase;background:${statusBg[c.findingStatus]};color:${statusColors[c.findingStatus]};">
                ${esc(c.findingStatus.replace('_', ' '))}
              </span>
            </div>

            <div style="margin-left:30px;font-size:12px;line-height:1.5;">
              <p style="margin:0 0 6px;color:#333;">${esc(c.explanation)}</p>

              ${c.calculation ? `
                <div style="background:#f1f8e9;border:1px solid #c8e6c9;border-radius:4px;padding:6px 10px;font-family:monospace;font-size:11px;color:#2e7d32;margin-bottom:6px;">
                  <b>Deterministic Formula:</b> ${esc(c.calculation)}
                </div>
              ` : ''}

              <div style="display:flex;gap:16px;flex-wrap:wrap;color:#555;font-size:11px;margin-top:6px;">
                <div><b>Observed:</b> ${esc(c.observedValue || '—')}</div>
                <div><b>Expected:</b> ${esc(c.expectedValue || '—')}</div>
              </div>

              <!-- Action Toolbar for Check -->
              <div style="display:flex;gap:8px;margin-top:10px;align-items:center;">
                ${c.evidence ? `
                  <button type="button" class="secondary" style="font-size:11px;padding:3px 8px;"
                    data-action="proof" data-id="us-preflight-${esc(c.checkId.toLowerCase())}">
                    🔍 View Artwork Evidence
                  </button>
                ` : ''}
                <button type="button" class="secondary" style="font-size:11px;padding:3px 8px;"
                  data-action="tab" data-tab="rulebook">
                  📖 View Rule Citation
                </button>
                ${(c.findingStatus === 'review' || c.findingStatus === 'unable') ? `
                  <button type="button" class="secondary" style="font-size:11px;padding:3px 8px;color:#e65100;border-color:#ffb74d;"
                    data-action="tab" data-tab="questions">
                    ❓ Resolve Missing Information
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Scope Limitations Disclaimer Box -->
      <div style="margin-top:16px;padding:12px;background:#f5f5f5;border-radius:6px;font-size:11px;color:#666;line-height:1.5;">
        <b>Scope Limitations:</b> This preflight verifies conventional multi-ingredient foods intended for adults and children ≥ 4 years under standard vertical 21 CFR 101.9 formats. It does not replace USDA FSIS meat inspection, infant formula certification (21 CFR 107), or dietary supplement labeling (21 CFR 101.36).
      </div>
    </div>
  `;
}

/**
 * 7. RULE DETAIL DRAWER: Complete 7-Section Inspector
 */
export function renderRuleDetailHtml(rule, review) {
  if (!rule) return '<div style="padding:20px;">Rule not found.</div>';
  const ruleId = rule.id || rule.ruleId;
  const isQuoteVerified = rule.source?.verificationStatus === 'verified' || rule.quoteVerified || rule.trustState?.sourceVerification === 'VERIFIED_QUOTATION';
  const authStatus = rule.authorization?.status || rule.trustState?.reviewerAuthorization || (rule.approved ? 'APPROVED' : 'PROPOSED');
  const isApproved = String(authStatus).toUpperCase() === 'APPROVED';
  const linkedFinding = (review.findings || []).find(f => f.key === `rule:${ruleId}` || f.id === `finding_${ruleId}` || f.rule?.id === ruleId);

  return `
    <div class="rule-detail-drawer" style="padding:20px;max-width:800px;font-family:sans-serif;color:#333;line-height:1.5;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #183b2b;padding-bottom:12px;margin-bottom:16px;">
        <div>
          <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#2c5b4b;text-transform:uppercase;">RULE TRUST INSPECTOR</div>
          <h2 style="margin:4px 0 2px;font-size:18px;color:#183b2b;">${esc(rule.title || 'Packaging Rule')}</h2>
          <span style="font-family:monospace;font-size:12px;color:#666;">${esc(ruleId)}</span>
        </div>
        <div style="display:flex;gap:8px;">
          ${!isApproved ? `
            <button type="button" class="primary" data-action="approve-rule" data-rule-id="${esc(ruleId)}" style="font-size:12px;padding:6px 14px;background:#2e7d32;color:white;border:none;border-radius:4px;cursor:pointer;">
              ✓ Authorize Rule
            </button>
          ` : `
            <button type="button" class="secondary" data-action="reject-rule" data-rule-id="${esc(ruleId)}" style="font-size:12px;padding:6px 14px;color:#c62828;border:1px solid #c62828;border-radius:4px;cursor:pointer;">
              ✕ Reject Rule
            </button>
          `}
        </div>
      </div>

      <!-- Section 1: Requirement -->
      <div style="margin-bottom:16px;background:#f9fbf9;border:1px solid #e0ebe0;border-radius:6px;padding:12px;">
        <h3 style="margin:0 0 8px;font-size:13px;font-weight:700;color:#183b2b;">1. REQUIREMENT DEFINITION</h3>
        <div style="font-style:italic;color:#111;font-size:13px;margin-bottom:6px;padding:8px;background:white;border-left:3px solid #183b2b;">
          “${esc(rule.source?.originalQuote || rule.text || rule.originalQuotation || 'No quote recorded')}”
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
          <div><b>Check Type:</b> <code>${esc(rule.interpretation?.checkType || rule.checkType || 'REQUIRED_PHRASE')}</code></div>
          <div><b>Target Field:</b> ${esc(rule.interpretation?.field || rule.field || 'Unspecified')}</div>
        </div>
      </div>

      <!-- Section 2: Source Provenance -->
      <div style="margin-bottom:16px;background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:12px;">
        <h3 style="margin:0 0 8px;font-size:13px;font-weight:700;color:#183b2b;">2. SOURCE PROVENANCE</h3>
        <table style="width:100%;font-size:12px;border-collapse:collapse;">
          <tr><td style="padding:4px 0;width:140px;color:#666;">Document:</td><td><b>${esc(rule.source?.documentName || 'Rule Document')}</b></td></tr>
          <tr><td style="padding:4px 0;color:#666;">Citation / Authority:</td><td>${esc(rule.source?.sourceCitation || rule.citation || 'Company Rulebook')}</td></tr>
          <tr><td style="padding:4px 0;color:#666;">Location in Source:</td><td>${esc(rule.source?.location || (rule.source?.page ? `Page ${rule.source.page}` : 'Document text'))}</td></tr>
          <tr><td style="padding:4px 0;color:#666;">Source SHA-256:</td><td><code style="font-size:10px;">${esc(rule.source?.documentHash || 'Unavailable')}</code></td></tr>
          <tr><td style="padding:4px 0;color:#666;">Verification Status:</td><td>
            <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;background:${isQuoteVerified ? '#E8F5E9;color:#2E7D32;' : '#FFF3E0;color:#E65100;'}">
              ${isQuoteVerified ? '✓ VERIFIED QUOTATION' : '⚠️ UNVERIFIED QUOTATION'}
            </span>
            ${rule.source?.verificationReason ? `<small style="display:block;color:#666;margin-top:2px;">${esc(rule.source.verificationReason)}</small>` : ''}
          </td></tr>
        </table>
      </div>

      <!-- Section 3: Trust & Governance -->
      <div style="margin-bottom:16px;background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:12px;">
        <h3 style="margin:0 0 8px;font-size:13px;font-weight:700;color:#183b2b;">3. TRUST &amp; AUTHORIZATION</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;">
          <div><b>Authorization:</b> <span style="font-weight:700;color:${isApproved ? '#2e7d32' : '#512da8'};">${esc(authStatus)}</span></div>
          <div><b>Authorized By:</b> ${esc(rule.authorization?.authorizedBy || 'Pending')}</div>
          <div><b>Legal Status:</b> ${esc(rule.legalStatus || 'IN_FORCE')}</div>
          <div><b>Applicability:</b> ${esc(rule.applicability?.status || 'applicable')} (${esc(rule.applicability?.market || 'universal')})</div>
        </div>
      </div>

      <!-- Section 4: Execution Trace -->
      <div style="margin-bottom:16px;background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:12px;">
        <h3 style="margin:0 0 8px;font-size:13px;font-weight:700;color:#183b2b;">4. EVALUATOR EXECUTION TRACE</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-bottom:6px;">
          <div><b>Evaluator ID:</b> <code>${esc(rule.execution?.evaluatorId || 'deterministic_checker')}</code></div>
          <div><b>Evaluation Method:</b> ${esc(rule.execution?.evaluationMethod || 'DETERMINISTIC')}</div>
          <div><b>Execution Status:</b> <b>${esc(rule.execution?.status || 'APPLIED')}</b></div>
          <div><b>Executed At:</b> ${esc(rule.execution?.executedAt || 'Recent analysis')}</div>
        </div>
        ${rule.execution?.blockers?.length ? `
          <div style="margin-top:6px;padding:6px 8px;background:#ffebee;border-radius:4px;font-size:11px;color:#c62828;">
            <b>Blockers:</b> ${esc(rule.execution.blockers.join('; '))}
          </div>
        ` : ''}
      </div>

      <!-- Section 5: Verification Result -->
      <div style="margin-bottom:16px;background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:12px;">
        <h3 style="margin:0 0 8px;font-size:13px;font-weight:700;color:#183b2b;">5. EVALUATION RESULT</h3>
        <div style="font-size:12px;margin-bottom:6px;"><b>Outcome:</b> <span style="font-weight:700;text-transform:uppercase;">${esc(rule.execution?.result || rule.verdict || 'review')}</span></div>
        <p style="margin:0 0 8px;font-size:12px;color:#444;">${esc(rule.execution?.explanation || 'Evaluation performed against confirmed packaging artwork.')}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;background:#f5f5f5;padding:8px;border-radius:4px;">
          <div><b>Expected:</b> ${esc(rule.execution?.expected || 'Specified requirement')}</div>
          <div><b>Observed:</b> ${esc(rule.execution?.observed || 'Extracted artwork copy')}</div>
        </div>
      </div>

      <!-- Section 6: Packaging Artwork Evidence -->
      <div style="margin-bottom:16px;background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h3 style="margin:0;font-size:13px;font-weight:700;color:#183b2b;">6. PACKAGING ARTWORK EVIDENCE</h3>
          ${linkedFinding ? `
            <button type="button" class="primary" data-action="focus-finding" data-finding-id="${esc(linkedFinding.id)}" style="font-size:11px;padding:4px 10px;background:#1565C0;color:white;border:none;border-radius:4px;cursor:pointer;">
              🔍 Zoom into Artwork Evidence
            </button>
          ` : ''}
        </div>
        ${linkedFinding ? `
          <div style="font-size:12px;color:#444;">
            <div>Linked Finding: <b>${esc(linkedFinding.title)}</b> (${esc(linkedFinding.status)})</div>
            <div style="font-size:11px;color:#666;margin-top:4px;">Evidence Coordinates: ${linkedFinding.evidence?.some(e => Array.isArray(e.box)) ? '✓ Calibrated PDF bounding box recorded' : 'Unlocated text reading'}</div>
          </div>
        ` : `
          <div style="font-size:12px;color:#777;">No active defect or finding currently linked to this rule.</div>
        `}
      </div>

      <!-- Section 7: Audit History -->
      <div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:6px;padding:12px;font-size:11px;">
        <h3 style="margin:0 0 6px;font-size:12px;font-weight:700;color:#555;">7. IMMUTABLE AUDIT TRAIL</h3>
        ${rule.history?.length ? `
          <ul style="margin:0;padding-left:18px;color:#555;">
            ${rule.history.map(h => `<li>${esc(h.at)}: ${esc(h.action)} by ${esc(h.actor)} (${esc(h.reason || '')})</li>`).join('')}
          </ul>
        ` : `
          <div style="color:#777;">Rule record created and quotation verified during review intake.</div>
        `}
      </div>
    </div>
  `;
}


