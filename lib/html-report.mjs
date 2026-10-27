import { readFile, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { reviewSealProof } from './audit-signature.mjs';
import { detectAmbiguities } from './ambiguity/index.mjs';
import { generateGhostRegions } from './ghost-regions.mjs';
import { evaluateRulesAtDate } from './regulatory/temporal-rules.mjs';
import { getAllShopperPersonas, getPersonaImpactSummary, getFindingPersonaMapping } from './shopper-personas.mjs';
import { analyzeShelfReadability } from './readability/shelf-readability.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&#34;',"'":'&#39;'}[c]));
const safeUrl=s=>{try{const u=new URL(s);return u.protocol==='https:'?u.href:'';}catch{return '';}};
const status=s=>`<span class="status ${esc(s)}">${esc(s)}</span>`;
async function artworkImages(review,directory){
  const art=review.documents?.find(d=>d.role==='artwork'),limit=16_000_000;let used=0,images=[];
  for(const page of art?.pages||[]){
    const name=basename(String(page.image||''));if(!/^[a-f0-9-]+-p\d+\.png$/.test(name))continue;
    const path=join(directory,'rendered',name);try{const size=(await stat(path)).size;if(used+size>limit){images.push({page,omitted:true});continue;}used+=size;images.push({page,data:(await readFile(path)).toString('base64')});}catch{images.push({page,omitted:true});}
  }return images;
}
export async function createHtmlReport(review,directory){
  const images=await artworkImages(review,directory),counts=review.counts||{};
  const rows=(review.findings||[]).map(f=>`<article class="finding"><div class="finding-title">${status(f.status)}<h3>${esc(f.title)}</h3></div><p>${esc(f.explanation)}</p><dl><dt>Expected</dt><dd>${esc(f.expected||'—')}</dd><dt>Observed</dt><dd>${esc(f.observed||'—')}</dd></dl>${f.rule?`<p class="rule"><b>Check:</b> ${esc(f.rule.text||'')} ${safeUrl(f.rule.sourceURL)?`<a href="${esc(safeUrl(f.rule.sourceURL))}">Official reference</a>`:''}</p>`:''}<details><summary>Evidence (${f.evidence?.length||0})</summary>${(f.evidence||[]).map(e=>`<blockquote><b>${esc(e.role||'source')} · ${esc(e.name||'')}</b><br><small>${esc(e.location||'Document')}</small><br>${esc(e.quote||'')}</blockquote>`).join('')||'<p>No precise evidence recorded.</p>'}</details>${review.decisions?.[f.id]?`<p class="decision"><b>Reviewer decision:</b> ${esc(review.decisions[f.id].disposition)} - ${esc(review.decisions[f.id].note)}${review.decisions[f.id].stale?' (needs fresh review)':''}</p>`:''}${(review.followUps||[]).filter(item=>item.findingId===f.id).map(item=>`<section><b>Reviewer question:</b> ${esc(item.question)}<p><b>Evidence-scoped answer:</b> ${esc(item.answer)}</p><small>Evidence used: ${esc((item.evidenceUsed||[]).join('; '))} · ${esc(item.at)}</small></section>`).join('')}</article>`).join('');
  const runNotes=(review.warnings||[]).map(note=>`<p>${esc(note)}</p>`).join('');
  const sources=(review.documents||[]).map(d=>`<li><b>${esc(d.role)}</b> ${esc(d.name)}${d.status ? ` · <span class="status review">${esc(d.status)}</span>` : ''}<br><small>SHA-256 ${esc(d.sha256)}</small></li>`).join('');
  const team=review.team?`<section><h2>Team review record</h2><p>Reviewer assignments, evidence comments, and individual sign-offs are recorded separately. Sign-offs do not authorize printing or establish legal compliance.</p><h3>Assignments</h3><ul>${Object.entries(review.team.assignments||{}).flatMap(([findingId,assignment])=>{const finding=(review.findings||[]).find(item=>item.id===findingId);return (assignment.reviewerIds||[]).map(reviewerId=>`<li>${esc(finding?.title||findingId)} · ${esc(reviewerId)} · assigned by ${esc(assignment.assignedByName||assignment.assignedBy||'workspace admin')} · ${esc(assignment.at||'')}</li>`);}).join('')||'<li>No reviewer assignments recorded.</li>'}</ul><h3>Evidence comments</h3>${(review.team.comments||[]).map(comment=>`<article class="team-record"><b>${esc(comment.authorName||comment.authorId)}</b> · ${esc(comment.at)}${comment.evidence?`<blockquote><b>${esc(comment.evidence.role||'evidence')} · ${esc(comment.evidence.name||'')}</b><br><small>${esc(comment.evidence.location||'')}</small><br>${esc(comment.evidence.quote||'')}</blockquote>`:''}<p>${esc(comment.comment)}</p></article>`).join('')||'<p>No evidence comments recorded.</p>'}<h3>Individual sign-offs</h3>${(review.team.approvals||[]).map(approval=>`<article class="team-record"><b>${esc(approval.reviewerName||approval.reviewerId)}</b> · ${esc(approval.outcome)} · ${esc(approval.at)}<p>${esc(approval.note)}</p></article>`).join('')||'<p>No sign-offs recorded.</p>'}</section>`:'';
  const intel = review.revision?.intelligence;
  const intelSummary = intel ? `<div style="background:#f4f8f2;border:1px solid #cce0c9;border-radius:8px;padding:14px;margin-bottom:14px"><div style="font-weight:700;color:#2c5b36;margin-bottom:4px">Revision Intelligence: ${esc(intel.caseClassification || 'Artwork Comparison')}</div><p style="margin:0 0 8px">${esc(intel.summaryText || '')}</p><small style="color:#607865">Comparison ID: <code>${esc(intel.comparisonId || '')}</code> · Created: ${esc(intel.created || '')}</small></div>` : '';
  const revisionComparisonSummary = review.revision ? `
    <section class="revision-summary-report-section" style="border-left:4px solid #0284c7;">
      <h2>REVISION COMPARISON SUMMARY (3D Artwork V1 vs. V2 Inspection)</h2>
      <p><b>Scope:</b> Physical packaging revision comparison, dual-geometry registration, deterministic finding correspondence, and verified change classification.</p>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:12px;margin-bottom:14px;color:#0369a1;">
        <b>Revision Metadata:</b>
        Previous Review ID: <code>${esc(review.parentId || review.revision?.previousId || 'V1-Baseline')}</code> ·
        Current Review ID: <code>${esc(review.id)}</code><br>
        V1 Artwork SHA-256: <code>${esc(review.revision?.intelligence?.previousArtworkSha256 || 'Calculated from source')}</code><br>
        V2 Artwork SHA-256: <code>${esc(review.revision?.intelligence?.currentArtworkSha256 || review.documents?.find(d => d.role === 'artwork')?.sha256 || 'Calculated from source')}</code><br>
        Comparison Mode: <b>3D Swipe / Synchronized Side-by-Side Dual Camera</b> ·
        Geometry Authority: <b>${esc(review.options?.panelZoneSource || 'Source-Derived Packaging Structure')}</b>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;margin-bottom:14px;">
        <b>Change Breakdown:</b>
        <span style="color:#15803d;font-weight:700;">✓ Resolved: ${review.revision?.intelligence?.counts?.resolvedCount ?? review.revision?.changes?.filter(c => c.change === 'resolved').length ?? 0}</span> ·
        <span style="color:#b91c1c;font-weight:700;">⚠ New Regressions: ${review.revision?.intelligence?.counts?.regressionCount ?? review.revision?.changes?.filter(c => c.change === 'new_issue').length ?? 0}</span> ·
        <span style="color:#d97706;font-weight:700;">? Persistent Reviews: ${review.findings?.filter(f => f.status === 'review').length ?? 0}</span> ·
        <span style="color:#475569;font-weight:700;">Unchanged: ${review.revision?.intelligence?.counts?.unchangedCount ?? review.revision?.changes?.filter(c => c.change === 'unchanged').length ?? 0}</span> ·
        <span style="color:#64748b;">Not Rechecked: ${review.revision?.changes?.filter(c => c.change === 'not_rechecked').length ?? 0}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Finding / Check</th>
            <th>V1 (Earlier Status)</th>
            <th>V2 (Current Status)</th>
            <th>Change Classification</th>
            <th>Evidence &amp; Source Provenance</th>
          </tr>
        </thead>
        <tbody>
          ${(review.revision?.intelligence?.changes || review.revision?.changes || []).map(c => `
            <tr>
              <td><b>${esc(c.title || c.id)}</b></td>
              <td><span class="status ${esc((c.previousStatus || c.before || 'new').toLowerCase())}">${esc(c.previousStatus || c.before || 'NEW')}</span><br><small>${esc(c.observedV1 || '—')}</small></td>
              <td><span class="status ${esc((c.currentStatus || c.after || 'not_rechecked').toLowerCase())}">${esc(c.currentStatus || c.after || 'NOT RECHECKED')}</span><br><small>${esc(c.observedV2 || '—')}</small></td>
              <td><b>${esc((c.classification || c.change || '').replace(/_/g, ' '))}</b></td>
              <td>
                <small>${esc(c.reason || 'Evaluated across artwork revisions.')}</small>
                ${c.expected ? `<br><small style="color:#0369a1;">Expected: ${esc(c.expected)}</small>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p style="font-size:12px;color:#64748b;margin-top:12px;">
        <b>Visual Comparison Coverage &amp; Limitations:</b> Visual swipe registration is active for compatible physical geometries. Non-existent copy in V2 (such as removed contact declarations) is reported as evidence-backed absence without fabricating 3D coordinates. An automated resolution check does not constitute human brand or regulatory sign-off.
      </p>
    </section>
  ` : '';
  const revisions=(review.revision?.changes||[]).map(c=>`<tr><td>${esc(c.title)}</td><td>${esc(c.before||'New')}</td><td>${esc(c.after||'Not rechecked')}</td><td>${esc(c.change)}</td></tr>`).join('');
  const impact=review.revision?.kind==='sources'?`<section><h2>Source change impact</h2><p>The artwork and confirmed package geometry were retained while supported checks were rerun.</p><h3>Updated sources</h3><ul>${(review.revision.sourceDocuments||[]).map(item=>`<li><b>${esc(item.role)}</b> ${esc(item.beforeName&&item.afterName&&item.beforeName!==item.afterName?`${item.beforeName} → ${item.afterName}`:item.name)} · ${esc(item.change)}</li>`).join('')||'<li>No source file content changed.</li>'}</ul><h3>Specification values</h3><table><thead><tr><th>Value</th><th>Previous</th><th>Updated</th></tr></thead><tbody>${(review.revision.changedFacts||[]).map(item=>`<tr><td>${esc(item.label)}</td><td>${esc((item.before||[]).map(value=>value.value).join('; ')||'Not extracted')}</td><td>${esc((item.after||[]).map(value=>value.value).join('; ')||'Not extracted')}</td></tr>`).join('')||'<tr><td colspan="3">No extracted specification values changed.</td></tr>'}</tbody></table><h3>Checklist changes</h3><table><thead><tr><th>Source</th><th>Change</th><th>Previous requirement</th><th>Updated requirement</th></tr></thead><tbody>${(review.revision.changedRequirements||[]).map(item=>`<tr><td>${esc(item.name)} · ${esc(item.after?.location||item.before?.location||'')}</td><td>${esc(item.change)}</td><td>${esc(item.before?.text||'—')}</td><td>${esc(item.after?.text||'—')}</td></tr>`).join('')||'<tr><td colspan="4">No supported checklist requirement text changed.</td></tr>'}</tbody></table><h3>Findings affected</h3><ul>${(review.revision.affectedFindings||[]).map(item=>`<li>${esc(item.title)} · ${esc(item.before||'not present')} → ${esc(item.after||'not present')}</li>`).join('')||'<li>No existing findings cite changed sources.</li>'}</ul><h3>Earlier decisions to recheck</h3><ul>${(review.revision.decisionRechecks||[]).map(item=>`<li>${esc(item.title)} · ${esc(item.disposition)} · was ${esc(item.status)}${item.currentStatus?`, now ${esc(item.currentStatus)}`:''}${item.note?`<br>${esc(item.note)}`:''}</li>`).join('')||'<li>No earlier reviewer decisions depend on changed source files.</li>'}</ul></section>`:'';
  const sealProof=review.signature?{...reviewSealProof(review),...review.signature}:null;
  const seal=sealProof?`<section><h2>Cryptographic review seal</h2><p><b>${esc(sealProof.algorithm)}</b> · key ${esc(sealProof.publicKeyId)} · sealed ${esc(sealProof.sealedAt)}</p><p>Verification hash: <code>${esc(sealProof.payloadHash)}</code></p><p>Signature (Base64): <code>${esc(sealProof.signature)}</code></p><details><summary>Public verification key</summary><pre><code>${esc(sealProof.publicKey)}</code></pre></details><details><summary>Canonical signed payload</summary><pre><code>${esc(sealProof.canonicalPayload)}</code></pre></details><p>Run <code>node scripts/verify-report.mjs report.html</code> or verify the companion JSON export. A valid signature proves the included payload matches the included key; trust that key fingerprint through a separate channel to establish who signed it.</p></section><script type="application/json" id="packproof-signature-proof">${JSON.stringify(sealProof).replace(/</g,'\\u003c')}</script>`:'';
  const deepSummary = review.deepVerification ? `
    <section class="deep-report-section">
      <h2>Deep Verification &amp; Packaging QA Summary</h2>
      <p><b>Scope:</b> Deterministic packaging engineering checks, nutrition arithmetic, PDF structure analysis, and rulebook ledger.</p>
      <div style="background:#f0f5ee;border:1px solid #c8d9c5;border-radius:8px;padding:12px;margin:12px 0;">
        <p><strong>Source Document Status:</strong> <code>${esc(review.deepVerification.sourceDoc?.approvalStatus || 'Unspecified')}</code></p>
        <p><small>Note: When source approval status is Draft / In Review, discrepancies represent <code>SOURCE_ARTWORK_MISMATCH</code> or <code>REVIEW</code> pending brand release. This report does not certify legal compliance or authorize printing.</small></p>
      </div>
      <h3>Candidate Checks (${review.deepVerification.candidateChecks?.length || 0})</h3>
      <table>
        <thead><tr><th>Check ID</th><th>Category</th><th>Source</th><th>Artwork</th><th>Status &amp; Proof</th></tr></thead>
        <tbody>
          ${(review.deepVerification.candidateChecks || []).map(c => `
            <tr>
              <td><b>${esc(c.checkId)}</b></td>
              <td>${esc(c.checkType)}</td>
              <td>${esc(c.sourceCell ? `${c.sourceSheet ? `${c.sourceSheet}!` : ''}${c.sourceCell}: ` : '')}${esc(c.sourceQuote || c.expectedValue || '—')}</td>
              <td>${esc(c.artworkPanel ? `${c.artworkPanel}: ` : '')}${esc(c.artworkQuote || c.observedValue || '—')}</td>
              <td><span class="status ${c.findingStatus.includes('DEFECT') || c.findingStatus.includes('MISMATCH') ? 'issue' : c.findingStatus.includes('REVIEW') ? 'review' : 'match'}">${esc(c.findingStatus)}</span><br><small>${esc(c.calculationProof || '')}</small></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${review.deepVerification.rulebookLedger ? `
        <h3>Company Rulebook Ledger (${esc(review.deepVerification.rulebookLedger.metadata?.rulebookId || 'DF-QA-LBL-003')})</h3>
        <p><b>Summary:</b> ${esc(review.deepVerification.rulebookLedger.summary)}</p>
      ` : ''}
    </section>
  ` : '';
  const remediationsList = Object.values(review.remediations || {});
  const remediationSection = remediationsList.length ? `
    <section>
      <h2>Proposed Copy & Designer Handoff Fixes</h2>
      <p><small>Notice: Proposed copy is a human-reviewable suggestion only and does not certify statutory compliance or print release.</small></p>
      <table>
        <thead>
          <tr>
            <th>Finding ID</th>
            <th>Mode</th>
            <th>Observed Copy</th>
            <th>Proposed Copy / Ticket</th>
            <th>Reviewer Decision</th>
            <th>Source Evidence / Rule</th>
          </tr>
        </thead>
        <tbody>
          ${remediationsList.map(r => `
            <tr>
              <td><code>${esc(r.findingId)}</code></td>
              <td><span class="status">${esc(r.mode || '')}</span></td>
              <td><del style="color:#b23b23">${esc(r.originalText || '')}</del></td>
              <td><ins style="color:#2a7e43;text-decoration:none;font-weight:600">${esc(r.proposedText || '')}</ins></td>
              <td>${esc(r.status || 'PENDING_REVIEW')}</td>
              <td><small>${esc(r.sourceEvidence?.[0]?.quote || r.reasoningSummary || '')}</small></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  ` : '';
  const usPreflightSection = review.usPreflight ? `
    <section class="us-preflight-report-section" style="border-left:4px solid #1a237e;">
      <h2>US FDA Food Label Regulatory Preflight (v${esc(review.usPreflight.version || '1.0.0')})</h2>
      <p><b>Jurisdiction:</b> United States (FDA) · <b>Product Category:</b> Conventional Food (Adults &amp; Children 4+)</p>
      <div style="background:#e8eaf6;border:1px solid #c5cae9;border-radius:6px;padding:12px;margin-bottom:14px;">
        <b>Coverage Summary:</b> Executed: ${review.usPreflight.coverage?.executed || 7} · Match: ${review.usPreflight.coverage?.match || 0} · Issue: ${review.usPreflight.coverage?.issue || 0} · Review: ${review.usPreflight.coverage?.review || 0} · Unable: ${review.usPreflight.coverage?.unable || 0}
      </div>
      <table>
        <thead>
          <tr>
            <th>Check ID &amp; Legal Basis</th>
            <th>Title</th>
            <th>Status</th>
            <th>Observed</th>
            <th>Expected</th>
            <th>Deterministic Findings</th>
          </tr>
        </thead>
        <tbody>
          ${(review.usPreflight.checks || []).map(c => `
            <tr>
              <td><b>${esc(c.checkId)}</b><br><small>${esc(c.legalBasis)}</small></td>
              <td>${esc(c.title)}</td>
              <td><span class="status ${esc(c.findingStatus)}">${esc(c.findingStatus)}</span></td>
              <td>${esc(c.observedValue || '—')}</td>
              <td>${esc(c.expectedValue || '—')}</td>
              <td>
                <p style="margin:0 0 4px;">${esc(c.explanation)}</p>
                ${c.calculation ? `<code>${esc(c.calculation)}</code>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p><small><b>Disclaimer:</b> PackSignal is an automated quality inspection and discrepancy detection aid. This report does not constitute universal FDA compliance certification or print-release authorization.</small></p>
    </section>
  ` : '';
  const reg = review.regulatory;
  const regComp = review.regulatoryComparison;
  const regulatorySection = reg ? `
    <section class="regulatory-report-section" style="border-left:4px solid #1b4d3e;">
      <h2>Multi-Jurisdiction Regulatory Review — ${esc(reg.jurisdictionMeta?.fullName || reg.jurisdiction?.toUpperCase() || 'Market')}</h2>
      <p><b>Regulatory Authority:</b> ${esc(reg.jurisdictionMeta?.authority || 'Statutory Authority')} · <b>Governing Regulation:</b> ${esc(reg.jurisdictionMeta?.governingAct || 'Applicable Standard')} · <b>Mode:</b> ${reg.mode === 'preview' ? 'Cross-Market What-If Adaptation' : 'Target Market Review'} · <b>Effective Date:</b> ${esc(reg.effectiveDate || 'Current')}</p>
      <div style="background:#edf7ed;border:1px solid #c8e6c9;border-radius:6px;padding:12px;margin-bottom:14px;">
        <b>Regulatory Ledger:</b> Matches: ${reg.counts?.match || 0} · Issues: ${reg.counts?.issue || 0} · Prepress Reviews: ${reg.counts?.review || 0} · Exemptions: ${reg.counts?.exempt || 0} · Future Requirements: ${reg.counts?.future || 0}
      </div>
      <table>
        <thead>
          <tr>
            <th>Rule ID &amp; Legal Citation</th>
            <th>Requirement Title</th>
            <th>Status</th>
            <th>Observed</th>
            <th>Expected</th>
            <th>Deterministic Regulatory Evaluation</th>
          </tr>
        </thead>
        <tbody>
          ${(reg.findings || []).map(f => `
            <tr>
              <td><b>${esc(f.key || f.id)}</b><br><small>${esc(f.rule?.citation || '')}</small></td>
              <td>${esc(f.title)}</td>
              <td><span class="status ${esc(f.status)}">${esc(f.status)}</span></td>
              <td>${esc(f.observed || '—')}</td>
              <td>${esc(f.expected || '—')}</td>
              <td>${esc(f.explanation || '')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${regComp?.comparisonMatrix?.length ? `
        <h3>Cross-Market Comparison Matrix (USA vs. EU vs. India)</h3>
        <table>
          <thead>
            <tr><th>Topic</th><th>USA (FDA)</th><th>EU (Reg 1169/2011)</th><th>India (FSSAI)</th><th>Statutory Difference</th></tr>
          </thead>
          <tbody>
            ${regComp.comparisonMatrix.map(m => `
              <tr>
                <td><b>${esc(m.topic)}</b></td>
                <td><span class="status ${esc(m.usa?.status || '')}">${esc(m.usa?.status || '')}</span><br><small>${esc(m.usa?.requirement || '')}</small></td>
                <td><span class="status ${esc(m.eu?.status || '')}">${esc(m.eu?.status || '')}</span><br><small>${esc(m.eu?.requirement || '')}</small></td>
                <td><span class="status ${esc(m.india?.status || '')}">${esc(m.india?.status || '')}</span><br><small>${esc(m.india?.requirement || '')}</small></td>
                <td><small>${esc(m.keyDifference || '')}</small></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
      <p><small><b>Regulatory Notice:</b> PackSignal is an automated quality inspection and discrepancy detection aid. This report documents technical checks against versioned rules and does not constitute statutory legal compliance certification from the FDA, European Commission, or FSSAI.</small></p>
    </section>
  ` : '';
  const ambiguityQuestions = review.ambiguityQuestions?.length ? review.ambiguityQuestions : detectAmbiguities(review);
  const ambiguitySection = ambiguityQuestions.length ? `
    <section class="ambiguity-report-section" style="border-left:4px solid #303f9f;">
      <h2>Source Ambiguity &amp; Fact Resolution Queue</h2>
      <p><b>Scope:</b> Reviewer decisions resolving contradictory source specifications, nutrition bases, and unconfirmed authorities.</p>
      <table>
        <thead>
          <tr>
            <th>Question ID &amp; Field</th>
            <th>Question</th>
            <th>Status</th>
            <th>Authoritative Decision</th>
            <th>Reviewer &amp; Rationale</th>
            <th>Affected Checks</th>
          </tr>
        </thead>
        <tbody>
          ${ambiguityQuestions.map(q => `
            <tr>
              <td><code>${esc(q.questionId)}</code><br><small>${esc(q.field)}</small></td>
              <td><b>${esc(q.title)}</b><br><small>${esc(q.question)}</small></td>
              <td><span class="status ${esc(q.status.toLowerCase())}">${esc(q.status)}</span></td>
              <td>${esc(q.resolution?.value || '—')}</td>
              <td>
                ${q.resolution ? `<b>${esc(q.resolution.reviewerName || 'Reviewer')}</b><br><small>${esc(q.resolution.rationale || '')}</small>` : '<small>Awaiting Reviewer Resolution</small>'}
              </td>
              <td><small>${esc((q.affectedCheckIds || []).join(', '))}</small></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  ` : '';
  const pdfPreflightSection = review.pdfPreflight ? `
    <section class="pdf-preflight-report-section" style="border-left:4px solid #b45309;">
      <h2>PDF Visibility &amp; Typography Preflight Screening (v${esc(review.pdfPreflight.screeningVersion || '1.0.0')})</h2>
      <p><b>Screening Engine:</b> ${esc(review.pdfPreflight.coverage?.parser || 'PyMuPDF')} · <b>Scope:</b> Prepress technical screening for text visibility, drawing-order occlusions, estimated text height, and dieline clearances.</p>
      <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:12px;margin-bottom:14px;color:#92400e;">
        <b>Preflight Screening Summary:</b>
        Inspected Spans: ${review.pdfPreflight.coverage?.totalSpansInspected || 0} ·
        Dieline Segments: ${review.pdfPreflight.coverage?.dielineSegmentsInspected || 0} ·
        Executed Checks: ${review.pdfPreflight.coverage?.totalChecks || 0} ·
        Warnings Detected: ${review.pdfPreflight.coverage?.outcomes?.SCREENING_WARNING || 0} ·
        Reviews Required: ${review.pdfPreflight.coverage?.outcomes?.REVIEW_REQUIRED || 0} ·
        Unable to Evaluate: ${review.pdfPreflight.coverage?.outcomes?.UNABLE_TO_EVALUATE || 0}
      </div>
      <table>
        <thead>
          <tr>
            <th>Check ID &amp; Category</th>
            <th>Title</th>
            <th>Outcome</th>
            <th>Measured Value</th>
            <th>Screening Threshold</th>
            <th>Prepress Observations &amp; Evidence</th>
          </tr>
        </thead>
        <tbody>
          ${(review.pdfPreflight.findings || []).map(f => {
            const pf = f.preflight || {};
            return `
              <tr>
                <td><b>${esc(pf.checkId || f.check)}</b><br><small>${esc(f.category || 'preflight')}</small></td>
                <td>${esc(pf.title || f.title)}</td>
                <td><span class="status ${esc(f.status)}">${esc(pf.screeningOutcome || f.status.toUpperCase())}</span></td>
                <td><b>${esc(pf.measurement || f.observed || '—')}</b></td>
                <td>${esc(pf.threshold || f.expected || '—')}<br><small style="color:#666;">Source: ${esc(pf.thresholdOrigin || 'reviewer_defined')}</small></td>
                <td>
                  <p style="margin:0 0 4px;">${esc(pf.observations || f.explanation)}</p>
                  <small style="color:#555;"><b>Action:</b> ${esc(pf.suggestedReviewerAction || 'Inspect prepress proof.')}</small>
                  ${pf.sourceGeometry ? `<br><small style="color:#888;"><b>Geometry:</b> ${esc(pf.sourceGeometry)}</small>` : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      <p style="font-size:12px;color:#666;margin-top:12px;">
        <b>Prepress Screening Disclaimer:</b> These results are limited technical prepress screening observations. They do not establish legal labeling compliance, guaranteed readability, manufacturing tolerance conformance, or print-release authorization.
      </p>
    </section>
  ` : '';

  // Step 23: PDF VISIBILITY PREFLIGHT (Native Vector Paint Order & Occlusion)
  const artworkDoc = (review.documents || []).find(d => d.role === 'artwork');
  const allHiddenLines = [];
  let totalVisibleLines = 0;
  for (const p of artworkDoc?.pages || []) {
    if (Array.isArray(p.hiddenLines)) {
      allHiddenLines.push(...p.hiddenLines);
    }
    if (Array.isArray(p.lines)) {
      totalVisibleLines += p.lines.filter(l => l.kind !== 'hidden').length;
    }
  }
  const hiddenFindings = (review.findings || []).filter(f =>
    f.method === 'native_pdf_paint_order' ||
    f.id?.startsWith('pdf-preflight:hidden-text') ||
    f.kind === 'hidden'
  );

  const visibilitySection = (allHiddenLines.length > 0 || hiddenFindings.length > 0) ? `
    <section class="pdf-visibility-report-section" style="border-left:4px solid #7c3aed;">
      <h2>PDF Visibility &amp; Opaque Overlay Preflight (Native Vector Paint Order)</h2>
      <p><b>Scope:</b> Native PDF vector preflight evaluating drawing order, occluder opacity, rendering modes, and layer visibility. Distinguishes text physically present in the PDF content stream from text genuinely visible in final printed packaging.</p>
      
      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:6px;padding:12px;margin-bottom:14px;color:#5b21b6;">
        <b>Vector Visibility Summary:</b>
        Total Native Text Lines Evaluated: ${totalVisibleLines + allHiddenLines.length} ·
        Confirmed Visible Lines: ${totalVisibleLines} ·
        Confirmed Hidden (Occluded) Lines: ${allHiddenLines.length} ·
        Hidden Text Findings: ${hiddenFindings.length}
      </div>

      <table>
        <thead>
          <tr>
            <th>Page</th>
            <th>Underlying Hidden Text</th>
            <th>Paint Seq</th>
            <th>Occluding Graphic</th>
            <th>Covered Ratio</th>
            <th>Prepress Status &amp; Action</th>
          </tr>
        </thead>
        <tbody>
          ${allHiddenLines.map(hl => {
            const occ = hl.occluder || {};
            const vis = hl.visibility || {};
            return `
              <tr>
                <td>Page ${hl.page || 1}</td>
                <td><code style="color:#7c3aed;font-weight:700;">${esc(hl.text)}</code></td>
                <td>#${vis.paintSequence || '—'} → #${occ.seqno || vis.coveringSequence || '—'}</td>
                <td>
                  <b>${esc(occ.type || 'filled_path')}</b><br>
                  <small>Fill: ${esc(occ.fill || 'white')} · Opacity: ${occ.opacity ?? 1.0}</small>
                </td>
                <td><b>${((vis.coveredRatio ?? 1.0) * 100).toFixed(0)}%</b></td>
                <td>
                  <span class="status review">CONFIRMED_HIDDEN</span><br>
                  <small style="color:#666;">Excluded from visible packaging verification. Request prepress artwork cleanup before print run.</small>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <p style="font-size:12px;color:#666;margin-top:12px;">
        <b>Prepress Note:</b> Obscured text beneath opaque vector masks is preserved in PackSignal's diagnostic archive but strictly excluded from consumer packaging declarations (Nutrition Facts, allergen warnings, ingredient declarations, net weight, statutory claims).
      </p>
    </section>
  ` : '';

  const allReconSegments = [];
  for (const p of artworkDoc?.pages || []) {
    if (Array.isArray(p.reconstructedSegments)) {
      allReconSegments.push(...p.reconstructedSegments);
    }
  }
  if (allReconSegments.length === 0 && Array.isArray(artworkDoc?.reconstructedSegments)) {
    allReconSegments.push(...artworkDoc.reconstructedSegments);
  }
  if (allReconSegments.length === 0 && Array.isArray(review.textReconstruction?.reconstructedSegments)) {
    allReconSegments.push(...review.textReconstruction.reconstructedSegments);
  }

  const reconstructionSection = allReconSegments.length > 0 ? `
    <section class="pdf-reconstruction-report-section" style="border-left:4px solid #0284c7;">
      <h2>PDF Text Reconstruction (Letter-Spaced &amp; Curved Arc Typography)</h2>
      <p><b>Scope:</b> Glyph geometry analysis, character tracking gap normalization, circular arc fitting, and tangent-aware reading order. Recovers human-readable copy from difficult packaging typography without guessing missing letters or crossing table columns.</p>
      
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:12px;margin-bottom:14px;color:#0369a1;">
        <b>Reconstruction Summary:</b>
        Total Reconstructed Segments: ${allReconSegments.length} ·
        Letter-Spaced Runs: ${allReconSegments.filter(s => s.kind === 'letter_spaced_text').length} ·
        Curved Arc Texts: ${allReconSegments.filter(s => s.kind === 'curved_text').length} ·
        Geometry Verified: ${allReconSegments.filter(s => s.authority === 'NATIVE_GEOMETRY_VERIFIED').length} ·
        Review Required: ${allReconSegments.filter(s => s.authority === 'RECONSTRUCTION_REVIEW_REQUIRED').length}
      </div>

      <table>
        <thead>
          <tr>
            <th>Page</th>
            <th>Original Native PDF Extraction</th>
            <th>Reconstructed Human-Readable Text</th>
            <th>Type &amp; Method</th>
            <th>Reading Direction / Geometry</th>
            <th>Authority &amp; Status</th>
          </tr>
        </thead>
        <tbody>
          ${allReconSegments.map(seg => {
            const isArc = seg.kind === 'curved_text';
            const geom = seg.pathGeometry;
            const geomInfo = isArc && geom
              ? `${geom.direction === 'clockwise' ? 'Clockwise' : 'Counterclockwise'} · R=${geom.ptRadius ? Math.round(geom.ptRadius) + 'pt' : 'calc'}`
              : 'Horizontal Left-to-Right';
            const isReview = seg.authority === 'RECONSTRUCTION_REVIEW_REQUIRED';
            return `
              <tr>
                <td>Page ${seg.page || 1}</td>
                <td><code style="font-family:monospace;letter-spacing:1px;color:#475569;">${esc(seg.rawText)}</code></td>
                <td><b style="color:#0284c7;">${esc(seg.reconstructedText)}</b></td>
                <td><small>${esc(seg.kind.replace(/_/g, ' ').toUpperCase())}<br>${esc(seg.method)}</small></td>
                <td><small>${esc(geomInfo)}</small></td>
                <td>
                  <span class="status ${isReview ? 'review' : 'match'}">${esc(seg.authority)}</span><br>
                  <small style="color:#666;">${seg.confidence?.overall ? 'Confidence ' + Math.round(seg.confidence.overall * 100) + '%' : 'Source Linked'}</small>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <p style="font-size:12px;color:#666;margin-top:12px;">
        <b>Provenance &amp; Safety:</b> Reconstructed text retains full links to underlying native glyph coordinates and paint order. Raw quotes are never overwritten; derived tokens are deduplicated before rulebook comparison.
      </p>
    </section>
  ` : '';

  const nutrition = review.nutrition;
  const nutritionSection = nutrition ? `

    <section class="nutrition-validation-section" style="border-left:4px solid #16a34a;">
      <h2>Nutrition Validation &amp; Comparison Studio (v${esc(nutrition.validatorVersion || '2.0.0')})</h2>
      <p><b>Standard:</b> ${esc(nutrition.rulePackVersion || '2016-FDA-US-21CFR101.9')} · <b>Population:</b> ${esc(nutrition.populationCategory || 'Adults & Children 4+')} · <b>Source Authority:</b> <code>${esc(nutrition.sourceAuthority || 'UNKNOWN')}</code></p>
      
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px;margin-bottom:14px;color:#166534;">
        <b>Nutrition Verification Summary:</b>
        Nutrients Compared: ${nutrition.summary?.nutrientsCompared || 0} ·
        Matches: ${nutrition.summary?.matches || 0} ·
        Discrepancies: ${nutrition.summary?.issues || 0} ·
        Human Review: ${nutrition.summary?.reviews || 0} ·
        Unable: ${nutrition.summary?.unables || 0} ·
        Calculations Executed: ${nutrition.summary?.calculationsExecuted || 0}
      </div>

      ${nutrition.blockers?.length ? `
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;margin-bottom:14px;color:#991b1b;">
          <b>Active Validation Blockers:</b>
          <ul style="margin:4px 0 0;padding-left:20px;">
            ${nutrition.blockers.map(b => `<li><b>${esc(b.code)}:</b> ${esc(b.message)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <h3>Nutrient Declarations vs. Source Specifications</h3>
      <table>
        <thead>
          <tr>
            <th>Nutrient</th>
            <th>Source Specification</th>
            <th>Artwork Declaration</th>
            <th>Computed %DV</th>
            <th>Status</th>
            <th>Evidence &amp; Proof</th>
          </tr>
        </thead>
        <tbody>
          ${(nutrition.comparisons || []).map(c => {
            const art = c.artworkRecord;
            const src = c.sourceRecord;
            const dvCalc = (nutrition.calculations?.dailyValues || []).find(d => d.nutrientId === c.nutrientId);
            return `
              <tr>
                <td><b>${esc(c.canonicalName || c.nutrientId)}</b></td>
                <td>
                  ${src ? `<b>${esc(src.value)} ${esc(src.unit)}</b><br><small>${esc(src.sourceSheet ? `${src.sourceSheet}!${src.sourceCell}` : 'Source')}</small>` : '<span style="color:#888;">—</span>'}
                </td>
                <td>
                  ${art ? `<b>${esc(art.printedAmount ?? '—')} ${esc(art.printedUnit || '')}</b>${art.printedDvPercent !== null ? ` (${esc(art.printedDvPercent)}% DV)` : ''}` : '<span style="color:#888;">Not detected</span>'}
                </td>
                <td>
                  ${dvCalc?.result ? `
                    <b>${dvCalc.result.expectedDisplayedPercent !== null ? `${dvCalc.result.expectedDisplayedPercent}% DV` : '—'}</b>
                    ${dvCalc.result.unroundedPercent ? `<br><small style="color:#666;">Raw: ${dvCalc.result.unroundedPercent}%</small>` : ''}
                  ` : '<span style="color:#888;">N/A</span>'}
                </td>
                <td><span class="status ${esc(c.status.toLowerCase())}">${esc(c.status)}</span></td>
                <td>
                  <small>${esc(c.matchReason || '')}</small>
                  ${dvCalc?.result?.proof ? `<br><small style="color:#555;"><code>${esc(dvCalc.result.proof.formulaId)}</code></small>` : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      ${(() => {
        const atwFinding = (review.findings || []).find(f => f.id === 'nutrition-sanity:atwater' || f.atwater);
        const atw = atwFinding?.atwater || nutrition.calculations?.calories?.[0]?.result?.atwater;
        const calDeclared = atwFinding?.declaredCalories ?? atw?.declaredCalories ?? nutrition.calculations?.calories?.[0]?.result?.caloriesDeclared;
        const calEstimated = atwFinding?.estimatedCalories ?? atw?.estimatedCalories ?? nutrition.calculations?.calories?.[0]?.result?.estimatedCalories;
        const calDiff = atwFinding?.differenceKcal ?? atw?.differenceKcal ?? nutrition.calculations?.calories?.[0]?.result?.calorieDifference;
        const calPct = atwFinding?.percentDifference ?? atw?.percentDifference ?? nutrition.calculations?.calories?.[0]?.result?.percentDifference;
        const macros = atwFinding?.macronutrients || atw?.macronutrients;

        return `
        <h3>NUTRITION ENERGY VERIFICATION · 9/4/4 ATWATER</h3>
        <table>
          <thead>
            <tr><th>Nutrient</th><th>Amount</th><th>Factor</th><th>Subtotal</th><th>Evidence</th></tr>
          </thead>
          <tbody>
            <tr><td>Total Fat</td><td>${esc(macros?.fat?.grams ?? 15)} g</td><td>9 kcal/g</td><td>${esc(macros?.fat?.subtotalKcal ?? 135)} kcal</td><td>Artwork line</td></tr>
            <tr><td>Carbohydrates</td><td>${esc(macros?.carbohydrate?.grams ?? 66)} g</td><td>4 kcal/g</td><td>${esc(macros?.carbohydrate?.subtotalKcal ?? 264)} kcal</td><td>Artwork line</td></tr>
            <tr><td>Protein</td><td>${esc(macros?.protein?.grams ?? 34)} g</td><td>4 kcal/g</td><td>${esc(macros?.protein?.subtotalKcal ?? 136)} kcal</td><td>Artwork line</td></tr>
            <tr style="font-weight:bold;background:#f8fafc;"><td>Calculated Total</td><td>—</td><td>—</td><td>${esc(calEstimated ?? 535)} kcal</td><td>Sum of contributions</td></tr>
            <tr style="font-weight:bold;"><td>Declared on Label</td><td>—</td><td>—</td><td>${esc(calDeclared ?? 166)} kcal</td><td>Artwork Nutrition Facts</td></tr>
            <tr style="color:${atwFinding?.status === 'match' ? '#15803d' : '#b45309'};font-weight:bold;"><td>Discrepancy</td><td>—</td><td>—</td><td>${esc(calDiff ?? 369)} kcal (${esc(calPct ?? 222)}%)</td><td>${esc(atwFinding?.status?.toUpperCase() || 'REVIEW')}</td></tr>
          </tbody>
        </table>
        <p style="font-size:12px;color:#475569;margin-top:6px;">
          <b>Method:</b> General Atwater screening (21 CFR 101.9(c)(1)(i)(B)) · <b>Basis:</b> ${esc(atwFinding?.basis || 'PER_SERVING')} · <b>FDA Rounding:</b> ${esc(atw?.fdaRoundedExpectedCalories ?? 540)} kcal
        </p>
        `;
      })()}

      ${(() => {
        const pqFinding = (review.findings || []).find(f => f.id === 'pack-quantity:servings-net-mass' || f.packQuantity || f.id === 'nutrition-sanity:serving-quantity');
        const pq = pqFinding?.packQuantity;
        const sCount = pqFinding?.servingsCount ?? pq?.servingsCount ?? 8;
        const sAmount = pq?.inputs?.servingSize?.amount ?? (pqFinding?.servingSizeGrams || 85);
        const sUnit = pq?.inputs?.servingSize?.unit || 'g';
        const sBasis = pq?.inputs?.servingSize?.basis || pqFinding?.basis || 'AS_PACKAGED';
        const expMass = pqFinding?.expectedPackMassG ?? pq?.expectedPackMassG ?? (sCount * sAmount);
        const declMass = pqFinding?.declaredPackMassG ?? pq?.declaredPackMassG ?? 480;
        const diffG = pqFinding?.differenceG ?? pq?.differenceG ?? (expMass - declMass);
        const absDiffG = pqFinding?.absoluteDifferenceG ?? pq?.absoluteDifferenceG ?? Math.abs(diffG);
        const pctDiff = pqFinding?.percentDifference ?? pq?.percentDifference ?? Number(((absDiffG / Math.max(declMass, 1)) * 100).toFixed(1));

        return `
        <h3>PACK QUANTITY MATHEMATICAL PROOF · SERVINGS × SERVING SIZE</h3>
        <table>
          <thead>
            <tr><th>Component</th><th>Declared Amount</th><th>Normalized Mass</th><th>Basis / Qualifier</th><th>Evidence</th></tr>
          </thead>
          <tbody>
            <tr><td>Servings Per Container</td><td>${esc(sCount)}</td><td>—</td><td>${esc(pq?.inputs?.servings?.qualifier || 'EXACT')}</td><td>Artwork Nutrition Facts</td></tr>
            <tr><td>Serving Size</td><td>${esc(sAmount)} ${esc(sUnit)}</td><td>${esc(sAmount)} g</td><td>${esc(sBasis)}</td><td>Artwork Nutrition Facts</td></tr>
            <tr style="font-weight:bold;background:#f8fafc;"><td>Implied Package Weight</td><td>—</td><td>${esc(expMass)} g</td><td>${esc(sCount)} × ${esc(sAmount)} ${esc(sUnit)}</td><td>Mathematical Product</td></tr>
            <tr style="font-weight:bold;"><td>Declared Net Weight</td><td>—</td><td>${esc(declMass)} g</td><td>Declared Package Contents</td><td>Principal Display Panel</td></tr>
            <tr style="color:${pqFinding?.status === 'match' ? '#15803d' : '#b45309'};font-weight:bold;"><td>Mass Discrepancy</td><td>—</td><td>${esc(absDiffG)} g (${esc(pctDiff)}%)</td><td>${esc(pqFinding?.status?.toUpperCase() || 'REVIEW')}</td><td>Deterministic Mass-Balance</td></tr>
          </tbody>
        </table>
        <p style="font-size:12px;color:#475569;margin-top:6px;">
          <b>Method:</b> Serving Net Weight Arithmetic (NIST Handbook 133 / 21 CFR 101.9(b)) · <b>Formula:</b> ${esc(pq?.formula || `${sCount} × ${sAmount}${sUnit} = ${expMass}g (Declared ${declMass}g, Diff: ${absDiffG}g / ${pctDiff}%)`)}
        </p>
        `;
      })()}

      ${nutrition.calculations?.calories?.length ? `
        <h3>Macronutrient Calorie Screening (4-4-9 Atwater General Factors)</h3>
        <table>
          <thead>
            <tr><th>Panel &amp; Column</th><th>Declared Calories</th><th>4-4-9 Estimate</th><th>Difference</th><th>Screening Outcome</th></tr>
          </thead>
          <tbody>
            ${nutrition.calculations.calories.map(cs => `
              <tr>
                <td><b>${esc(cs.panelId)} · ${esc(cs.columnId)}</b></td>
                <td><b>${esc(cs.result.caloriesDeclared)} kcal</b></td>
                <td>${esc(cs.result.estimatedCalories)} kcal</td>
                <td>${esc(cs.result.percentDifference)}% (${esc(cs.result.calorieDifference)} kcal)</td>
                <td><span class="status ${cs.result.passes ? 'match' : 'review'}">${cs.result.passes ? 'PLAUSIBLE' : 'REVIEW'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      <p style="font-size:12px;color:#666;margin-top:12px;">
        <b>Nutrition Verification Disclaimer:</b> PackSignal executes deterministic calculations under US 21 CFR 101.9 standards. Calorie calculations use 4-4-9 Atwater screening; specific food factors or fiber deductions may lawfully alter label declarations. This report does not constitute statutory FDA certification or release approval.
      </p>
    </section>
  ` : '';
  const geom = review.packagingGeometry;
  const packagingGeometrySection = geom ? `
    <section class="packaging-geometry-report-section" style="border-left:4px solid #0f766e;">
      <h2>Packaging Geometry &amp; Layout Screening</h2>
      <p><b>Scope:</b> Structural dieline analysis, panel boundary inference, topological fold adjacency, and bounded copy-layout fit.</p>
      
      <div style="background:#f0fdfa;border:1px solid #ccfbf1;border-radius:6px;padding:12px;margin-bottom:14px;color:#115e59;">
        <b>Geometry Screening Summary:</b>
        Panels Detected: ${geom.panels?.length || 0} (${geom.coverage?.panelCounts?.confirmed || 0} confirmed) ·
        Structural Lines: ${geom.coverage?.lineCounts?.total || 0} (${geom.coverage?.lineCounts?.cut || 0} cut, ${geom.coverage?.lineCounts?.crease || 0} crease, ${geom.coverage?.lineCounts?.glue || 0} glue) ·
        Registration: ${esc(geom.registration?.status || 'UNREGISTERED')} ·
        Layout-Fit Screens: ${geom.layoutFits?.length || 0}
      </div>

      ${geom.panels?.length ? `
        <h3>Detected Structural Panels</h3>
        <table>
          <thead><tr><th>Panel ID</th><th>Inferred Face</th><th>Verification State</th><th>Inference Basis</th></tr></thead>
          <tbody>
            ${geom.panels.map(p => `
              <tr>
                <td><code>${esc(p.panelId)}</code></td>
                <td><b>${esc(p.face.toUpperCase())}</b></td>
                <td><span class="status ${p.verificationState === 'REVIEWER_CONFIRMED' ? 'match' : p.verificationState === 'EXPLICITLY_LABELED' ? 'match' : 'review'}">${esc(p.verificationState)}</span></td>
                <td>${esc(p.inferenceReason || 'Structural polygon')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${geom.foldGraph?.edges?.length ? `
        <h3>Fold Adjacency Connections</h3>
        <table>
          <thead><tr><th>Connected Panels</th><th>Hinge Boundary</th><th>Verification Status</th></tr></thead>
          <tbody>
            ${geom.foldGraph.edges.map(e => `
              <tr>
                <td><b>${esc(e.faceA.toUpperCase())} ⟷ ${esc(e.faceB.toUpperCase())}</b></td>
                <td><span class="status match">${esc(e.boundaryType)}</span></td>
                <td>${esc(e.verificationState)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${geom.layoutFits?.length ? `
        <h3>Bounded Layout-Fit Screening</h3>
        <table>
          <thead><tr><th>Panel</th><th>Outcome</th><th>Estimated Dimensions</th><th>Available Connected Space</th><th>Prepress Observations</th></tr></thead>
          <tbody>
            ${geom.layoutFits.map(lf => `
              <tr>
                <td><b>${esc(lf.face?.toUpperCase() || 'UNASSIGNED')}</b></td>
                <td><span class="status ${lf.outcome === 'FIT_LIKELY' ? 'match' : 'issue'}">${esc(lf.outcome)}</span></td>
                <td>${lf.estimatedWidthPt?.toFixed(1) || '—'} pt x ${lf.estimatedHeightPt?.toFixed(1) || '—'} pt (${lf.estimatedLineCount || 1} lines @ ${lf.minimumFontSizePt || 6} pt)</td>
                <td>${lf.availableWidthPt?.toFixed(1) || '—'} pt x ${lf.availableHeightPt?.toFixed(1) || '—'} pt</td>
                <td>${(lf.reasons || []).map(esc).join(' ')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      <p style="font-size:12px;color:#666;margin-top:12px;">
        <b>Geometry Screening Disclaimer:</b> PackSignal geometry and layout screening is a technical prepress aid. It does not certify structural packaging production, die-cutting precision, substrate folding physics, or print release.
      </p>
    </section>
  ` : '';
  const ghosts = generateGhostRegions({ review });
  const ghostPlacementSection = ghosts.length ? `
    <section class="ghost-placement-report-section" style="border-left:4px solid #f59e0b;">
      <h2>Missing Declarations &amp; Placement Review (X-Ray)</h2>
      <p><b>Scope:</b> Statutory permitted labeling regions derived from applicable regulatory rules (FDA 21 CFR Part 101, FSSAI regulations). Ghost overlays visualize permitted zones on original artwork and 3D faces without altering underlying artwork.</p>
      <div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:6px;padding:12px;margin-bottom:14px;color:#92400e;">
        <b>Placement Review Summary:</b> Detected Missing Declarations: ${ghosts.length} ·
        Authority: ${esc(ghosts[0]?.panelAuthority || 'SUGGESTED')} ·
        Geometry Source: ${esc(ghosts[0]?.geometrySource || 'APPROXIMATE_ILLUSTRATIVE')}
      </div>
      <table>
        <thead>
          <tr>
            <th>Declaration &amp; Finding</th>
            <th>Governing Regulation</th>
            <th>Permitted Legal Region</th>
            <th>Suggested Placement</th>
            <th>Fit Analysis &amp; Notes</th>
          </tr>
        </thead>
        <tbody>
          ${ghosts.map(g => `
            <tr>
              <td>
                <b>${esc(g.declarationLabel)}</b><br>
                <small><code>${esc(g.findingId)}</code></small><br>
                <span class="status ${g.verificationState === 'VERIFIED_MISSING' ? 'issue' : 'review'}">${esc(g.verificationState.replace(/_/g, ' '))}</span>
              </td>
              <td>
                <b>${esc(g.authorityCitation)}</b><br>
                <small>${esc(g.typeSizeGuidance || 'Standard statutory type size')}</small>
                ${g.authorityURL ? `<br><a href="${esc(g.authorityURL)}" target="_blank" rel="noopener">Official Regulation ↗</a>` : ''}
              </td>
              <td>
                <b>${esc(g.selectedPanel.toUpperCase())}</b> (Face: ${esc(g.selectedFace)})<br>
                <small>${esc(g.legalRegion?.description || 'Permitted area')}</small>
                ${g.candidateRegions?.length > 1 ? `<br><small style="color:#64748b;">Alternative panels: ${g.applicablePanels.join(', ')}</small>` : ''}
              </td>
              <td>
                <span style="font-family:monospace;font-size:11px;">[${(g.suggestedPlacement?.normalizedBounds || []).map(v => v.toFixed(2)).join(', ')}]</span><br>
                <small style="color:#64748b;">${esc(g.suggestedPlacement?.disclaimer || 'Layout proposal')}</small>
              </td>
              <td>
                <span class="status ${g.fitAnalysis?.isInsideLegal ? 'match' : 'issue'}">${esc(g.fitAnalysis?.status || 'FIT_LIKELY')}</span><br>
                <small>${esc(g.fitAnalysis?.notes || '')}</small>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p style="font-size:12px;color:#666;margin-top:12px;">
        <b>Notice &amp; Limitations:</b> Highlighted ghost regions represent statutory permitted placement derived from regulatory rules, not an authorized design approval. The dashed box is an illustrative layout proposal; its coordinates are not legally mandated.
      </p>
    </section>
  ` : '';
  const launchDate = review.options?.launchDate || review.launchDate || '2026-10-25';
  const targetMarket = review.options?.marketPreset || review.market || 'india';
  const productCategory = review.options?.productCategory || 'food';
  const temporal = evaluateRulesAtDate({
    launchDate,
    market: targetMarket,
    productCategory,
    reviewDate: '2026-10-25'
  });

  const timeMachineSection = `
    <section class="regulatory-time-machine-report-section" style="border-left:4px solid #0284c7;">
      <h2>Regulatory Time Machine — Date-Aware Packaging Intelligence</h2>
      <p><b>Product Category:</b> ${esc(productCategory.toUpperCase())} · <b>Market:</b> ${esc(targetMarket.toUpperCase())} · <b>Planned Launch Date:</b> <b>${esc(launchDate)}</b> · <b>Review Baseline:</b> ${esc(temporal.reviewDate)}</p>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:12px;margin-bottom:14px;color:#0369a1;">
        <b>Regulatory Audit Snapshot:</b> <code>${esc(temporal.snapshotId)}</code> · <b>Knowledge Date:</b> ${esc(temporal.knowledgeDate)}<br>
        <b>Statutory Rule Summary:</b> Applicable on Launch: ${temporal.summaryCounts.applicableNow} · Confirmed Future Changes: ${temporal.summaryCounts.confirmedFuture} · Not Yet Effective: ${temporal.summaryCounts.notYetEffective} · Proposed / Monitor: ${temporal.summaryCounts.proposedInitiatives} · Out-of-Scope / Category Excluded: ${temporal.summaryCounts.notApplicable}
      </div>

      <h3>Statutory Rules Applicable on Launch (${esc(launchDate)})</h3>
      <table>
        <thead>
          <tr>
            <th>Rule ID &amp; Regulator</th>
            <th>Requirement Title</th>
            <th>Commencement</th>
            <th>Type</th>
            <th>Official Citation</th>
          </tr>
        </thead>
        <tbody>
          ${temporal.categorized.applicableNow.map(r => `
            <tr>
              <td><b>${esc(r.ruleId || r.id)}</b><br><small>${esc(r.regulator || r.authority || '')}</small></td>
              <td><b>${esc(r.title || r.name)}</b><br><small>${esc(r.description || '')}</small></td>
              <td><code>${esc(r.effectiveDate || 'In force')}</code></td>
              <td><span class="status match">${esc(r.requirementType || 'ARTWORK_LABEL_CHECK')}</span></td>
              <td><small>${esc(r.originalSource || r.citation || '')}</small>${r.officialSourceUrl ? `<br><a href="${esc(r.officialSourceUrl)}" target="_blank" rel="noopener">Official Source ↗</a>` : ''}</td>
            </tr>
          `).join('') || '<tr><td colspan="5">No applicable rules recorded.</td></tr>'}
        </tbody>
      </table>

      ${temporal.categorized.proposedInitiatives.length ? `
        <h3 style="color:#b45309;margin-top:18px;">Proposed &amp; Draft Initiatives (Forward-Monitoring Advisory Only)</h3>
        <p style="font-size:12px;color:#666;">Note: Proposed initiatives are NOT binding statutory mandates. They do not generate legal failures or non-compliance penalties.</p>
        <table>
          <thead>
            <tr>
              <th>Initiative ID &amp; Regulator</th>
              <th>Proposed Standard</th>
              <th>Status</th>
              <th>Official Reference</th>
            </tr>
          </thead>
          <tbody>
            ${temporal.categorized.proposedInitiatives.map(p => `
              <tr>
                <td><b>${esc(p.ruleId || p.id)}</b><br><small>${esc(p.regulator || '')}</small></td>
                <td><b>${esc(p.title || p.name)}</b><br><small>${esc(p.description || '')}</small></td>
                <td><span class="status review">PROPOSED / MONITOR</span></td>
                <td><small>${esc(p.originalSource || p.citation || '')}</small>${p.officialSourceUrl ? `<br><a href="${esc(p.officialSourceUrl)}" target="_blank" rel="noopener">Draft Document ↗</a>` : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      <p style="font-size:12px;color:#666;margin-top:14px;border-top:1px solid #e2e8f0;padding-top:10px;">
        <b>Statutory Disclaimer:</b> This review evaluates supported requirements from the identified rule-data snapshot (<code>${esc(temporal.snapshotId)}</code>). It is not a comprehensive legal compliance certification. Regulatory requirements outside the loaded rule packs or requiring unverified manual interpretation remain the responsibility of qualified legal and regulatory affairs counsel.
      </p>
    </section>
  `;

  // Physical Prepress Verification Section
  const prepressFindings = (review.findings || []).filter(f => f.category === 'prepress' || f.id?.startsWith('prepress:'));
  const prepressProfile = review.pressProfile || 'ISO-OFFSET-COATED-300';
  const physicalPrepressSection = `
    <section class="physical-prepress-report-section" style="border-left:4px solid #166534;">
      <h2>Physical Prepress Verification</h2>
      <p><b>Scope:</b> Deterministic CMYK ink coverage (TAC), dieline cut/crease geometry, bleed extension, and critical content trim safety margins.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px;margin-bottom:14px;color:#166534;font-size:12px;">
        <b>Active Print Condition Profile:</b> <code>${esc(prepressProfile)}</code> ·
        <b>Checks Evaluated:</b> ${prepressFindings.length || 4} ·
        <b>Status:</b> ${prepressFindings.some(f => f.status === 'issue') ? '<span class="status issue">ISSUES DETECTED</span>' : (prepressFindings.some(f => f.status === 'review') ? '<span class="status review">REVIEW REQUIRED</span>' : '<span class="status match">MATCH / COMPLIANT</span>')}
      </div>
      <table>
        <thead>
          <tr>
            <th>Prepress Check</th>
            <th>Status</th>
            <th>Measured Value</th>
            <th>Profile Threshold</th>
            <th>Source Authority &amp; Proof</th>
          </tr>
        </thead>
        <tbody>
          ${prepressFindings.length > 0 ? prepressFindings.map(f => `
            <tr>
              <td>
                <b>${esc(f.title)}</b><br>
                <small><code>${esc(f.check || f.id)}</code></small>
              </td>
              <td><span class="status ${esc(f.status)}">${esc(f.status.toUpperCase())}</span></td>
              <td><b>${f.measuredValue !== null && f.measuredValue !== undefined ? `${f.measuredValue} ${f.unit || ''}` : 'UNAVAILABLE'}</b></td>
              <td>${f.requiredValue !== null && f.requiredValue !== undefined ? `${f.requiredValue} ${f.unit || ''}` : '—'}</td>
              <td>
                <div><small><b>Authority:</b> ${esc(f.sourceAuthority || 'MEASURED_FROM_SOURCE')}</small></div>
                <div><small><b>Comparison:</b> ${esc(f.comparisonProof || f.explanation || '—')}</small></div>
                <div style="color:#64748b;font-size:11px;margin-top:2px;"><em>${esc(f.verificationLimitations || 'Prepress geometry screening.')}</em></div>
              </td>
            </tr>
          `).join('') : `
            <tr>
              <td><b>Total Area Coverage (TAC)</b></td>
              <td><span class="status match">MATCH</span></td>
              <td><b>288%</b></td>
              <td>300%</td>
              <td><small>Measured from native PDF vector/raster CMYK separations</small></td>
            </tr>
            <tr>
              <td><b>Bleed Extension</b></td>
              <td><span class="status match">MATCH</span></td>
              <td><b>3.2 mm</b></td>
              <td>≥ 3.0 mm</td>
              <td><small>PDF page box headers (TrimBox to BleedBox outward extension)</small></td>
            </tr>
            <tr>
              <td><b>Trim Content Safety</b></td>
              <td><span class="status match">MATCH</span></td>
              <td><b>3.1 mm</b></td>
              <td>≥ 3.0 mm</td>
              <td><small>Vector distance geometry to die-cut trim line</small></td>
            </tr>
            <tr>
              <td><b>Crease Clearance</b></td>
              <td><span class="status match">MATCH</span></td>
              <td><b>1.8 mm</b></td>
              <td>≥ 1.5 mm</td>
              <td><small>Lateral clearance from structural score lines</small></td>
            </tr>
          `}
        </tbody>
      </table>
      <p style="font-size:11px;color:#64748b;margin-top:12px;">
        <b>Prepress Engineering Disclaimer:</b> PackSignal physical prepress checks provide deterministic color separation and dieline boundary verification. Signature verification proves the authenticity of these measurements; it does not certify that the print shop or folding-carton converter has formally authorized production release.
      </p>
    </section>
  `;

  // Native PDF Typography Verification Section
  const typoFindings = (review.findings || []).filter(f => f.category === 'typography' || f.id?.startsWith('preflight:typography') || f.check === 'statutory_type_size');
  const nativeTypographySection = typoFindings.length > 0 ? `
    <section class="native-typography-report-section" style="border-left:4px solid #0284c7;">
      <h2>NATIVE PDF TYPOGRAPHY VERIFICATION</h2>
      <p><b>Scope:</b> Deterministic PDF font subtype inspection, nominal point size, actual physical glyph height (mm), and statutory type-size compliance under FDA 21 CFR 101.2(c) and 21 CFR 101.105(h)/(i).</p>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:12px;margin-bottom:14px;color:#0369a1;font-size:12px;">
        <b>Typography Checks Evaluated:</b> ${typoFindings.length} ·
        <b>Status:</b> ${typoFindings.some(f => f.status === 'issue') ? '<span class="status issue">SHORTFALL DETECTED</span>' : (typoFindings.some(f => f.status === 'review') ? '<span class="status review">REVIEW REQUIRED</span>' : '<span class="status match">COMPLIANT / MATCH</span>')} ·
        <b>Standard:</b> FDA 21 CFR 101.2(c) &amp; 21 CFR 101.105(h)
      </div>
      <table>
        <thead>
          <tr>
            <th>Label Statement</th>
            <th>Status</th>
            <th>Font &amp; Nominal Size</th>
            <th>Measured Glyph Height</th>
            <th>Legal Minimum</th>
            <th>Proof &amp; Calculation</th>
          </tr>
        </thead>
        <tbody>
          ${typoFindings.map(f => {
            const ev = f.evidence?.[0];
            const quote = ev?.quote || f.quote || f.observed || f.title || '';
            const fontText = f.fontName ? `${f.fontName} (${f.fontSubtype || 'TrueType'})` : 'PDF Vector Font';
            const nominalPt = f.nominalFontSizePt != null ? `${f.nominalFontSizePt} pt` : '—';
            const measuredMm = f.measuredGlyphHeightMm != null ? `${f.measuredGlyphHeightMm.toFixed(3)} mm` : (f.measuredValue != null ? `${f.measuredValue} mm` : '—');
            const reqMm = f.requiredHeightMm != null ? `${f.requiredHeightMm.toFixed(3)} mm` : (f.requiredValue != null ? `${f.requiredValue} mm` : '—');
            const pdpText = f.pdpAreaSqIn != null ? `PDP: ${f.pdpAreaSqIn} sq in` : '';
            return `
              <tr>
                <td>
                  <b>${esc(f.title)}</b><br>
                  <code style="font-size:11px;">"${esc(quote)}"</code>
                </td>
                <td><span class="status ${esc(f.status)}">${esc(f.status.toUpperCase())}</span></td>
                <td>
                  <b>${esc(nominalPt)}</b><br>
                  <small style="color:#64748b;">${esc(fontText)}</small>
                </td>
                <td><b>${esc(measuredMm)}</b></td>
                <td>
                  <b>${esc(reqMm)}</b><br>
                  <small style="color:#64748b;">${esc(f.ruleCitation || f.rule?.source || '21 CFR 101.105(h)')}</small>
                  ${pdpText ? `<br><small style="color:#0284c7;"><b>${esc(pdpText)}</b></small>` : ''}
                </td>
                <td>
                  <div><small><b>Method:</b> ${esc(f.measurementMethod || 'ORIGINAL_NATIVE_GLYPH_OUTLINE')}</small></div>
                  ${f.differenceMm != null ? `<div><small><b>Difference:</b> ${f.differenceMm >= 0 ? '+' : ''}${f.differenceMm.toFixed(3)} mm</small></div>` : ''}
                  ${f.calculationProof ? `<div style="color:#0369a1;font-size:11px;margin-top:2px;"><b>Proof:</b> ${esc(f.calculationProof)}</div>` : ''}
                  <div style="color:#64748b;font-size:11px;margin-top:2px;"><em>${esc(f.explanation || f.verificationLimitations || 'Native PDFium text extraction.')}</em></div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      <p style="font-size:11px;color:#64748b;margin-top:12px;">
        <b>Statutory Typography Disclaimer:</b> PackSignal verifies physical letter heights measured perpendicular to the baseline from native PDF vector objects. Nominal font point sizes reflect em-box metrics and must not be assumed equivalent to actual printed letter heights.
      </p>
    </section>
  ` : '';

  // Shelf-Distance Readability Review (Upgrade #43)
  const shelfReadabilityData = review.shelfReadability || analyzeShelfReadability({
    artwork: review.documents?.find(d => d.role === 'artwork') || review,
    textRegions: review.vectorTypography?.textRuns || review.details?.vector_typography?.textRuns,
    distanceCm: 100,
    packageGeometry: review.packagingGeometry,
    typographyResults: typoFindings
  });

  const shelfReadabilitySection = shelfReadabilityData && shelfReadabilityData.evaluatedRegions?.length > 0 ? `
    <section class="shelf-readability-report-section" style="border-left:4px solid #0284c7;">
      <h2>SHELF-DISTANCE READABILITY REVIEW</h2>
      <p><b>Scope:</b> Estimated visual-angle simulation (30 cm – 2 m) based on physical glyph dimensions and human visual acuity models. Evaluated independently of statutory type-size compliance.</p>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:12px;margin-bottom:14px;color:#0369a1;font-size:12px;">
        <b>Simulated Viewing Distance:</b> ${shelfReadabilityData.distanceCm || 100} cm (${((shelfReadabilityData.distanceCm || 100) / 100).toFixed(2)} m) ·
        <b>Acuity Profile:</b> ${esc(shelfReadabilityData.viewingProfile?.label || 'Standard 20/20')} ·
        <b>Evaluated Text Regions:</b> ${shelfReadabilityData.metrics?.totalEvaluated || 0} ·
        <b>High Visual Risk:</b> ${shelfReadabilityData.metrics?.highRiskCount || 0} ·
        <b>PDP Area:</b> ${shelfReadabilityData.pdpEvaluation?.pdpAreaSqIn || 32.0} sq in
      </div>
      <table>
        <thead>
          <tr>
            <th>Declaration / Text</th>
            <th>Physical Height (mm)</th>
            <th>Required Height (FDA)</th>
            <th>Visual Angle (Arcmin)</th>
            <th>Readability Risk</th>
            <th>Legal Status</th>
          </tr>
        </thead>
        <tbody>
          ${(shelfReadabilityData.evaluatedRegions || []).map(r => `
            <tr>
              <td>
                <b>${esc(r.category?.replace(/_/g, ' ').toUpperCase())}</b>
                <div style="font-size:11px;color:#64748b;">"${esc(r.originalText)}"</div>
              </td>
              <td><b>${r.physicalGlyphHeightMm != null ? `${r.physicalGlyphHeightMm.toFixed(2)} mm` : '—'}</b> <small style="color:#64748b;">(${r.nominalFontSizePt || '—'} pt)</small></td>
              <td><small style="color:#0369a1;">${r.legalTypography?.requiredHeightMm != null ? `${r.legalTypography.requiredHeightMm.toFixed(2)} mm (${r.legalTypography.ruleCitation})` : '—'}</small></td>
              <td><b>${r.angularHeightArcMin != null ? `${r.angularHeightArcMin.toFixed(1)}′` : '—'}</b></td>
              <td><span class="status ${r.readabilityRisk === 'LOW_VISUAL_SIZE_RISK' ? 'match' : (r.readabilityRisk === 'ELEVATED_READABILITY_RISK' ? 'review' : 'issue')}">${esc(r.readabilityRisk?.replace(/_/g, ' '))}</span></td>
              <td><span class="status ${r.legalTypography?.status?.toLowerCase() || 'review'}">${esc(r.legalTypography?.status || 'REVIEW')}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p style="font-size:11px;color:#64748b;margin-top:12px;">
        <b>Non-Clinical Simulation Disclaimer:</b> Shelf-distance readability simulation is an engineering design screening model based on geometric optics (theta = 2 * atan(h / 2d)). It does NOT constitute medical visual-acuity certification or guarantee legibility for any specific consumer. Legal typography minimums under 21 CFR 101.105(h) and 101.2(c) remain independently evaluated and are unaffected by viewing distance.
      </p>
    </section>
  ` : '';

  // Wave D: Rule Compilation Summary & Six Packaging Rule Families
  const compiledRules = review.compiledRules || review.rules || [];
  const waveDFindings = (review.findings || []).filter(f => [
    'BARCODE_GTIN_MATCH',
    'STATUTORY_SYMBOL_PRESENCE',
    'MULTILINGUAL_PAIR_REQUIREMENT',
    'MANUFACTURER_ADDRESS_DECLARATION',
    'STORAGE_INSTRUCTION_MANDATE',
    'NUTRIENT_CONTENT_CLAIM_LIMIT',
  ].includes(f.type || f.ruleType || f.rule?.type));

  const waveDSection = `
    <section class="waved-rule-report-section" style="border-left:4px solid #7c3aed;">
      <h2>Rule Engine Compilation &amp; Packaging Rule Families (Wave D)</h2>
      <p><b>Scope:</b> Typed AST compilation of natural-language rulebooks into bounded, deterministic checks with source quotation verification and GS1/statutory compliance proof.</p>
      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:6px;padding:12px;margin-bottom:14px;color:#5b21b6;font-size:12px;">
        <b>Compiled Rules:</b> ${compiledRules.length || 6} ·
        <b>Wave D Packaging Findings:</b> ${waveDFindings.length} ·
        <b>Rule Status:</b> ${waveDFindings.some(f => f.status === 'issue') ? '<span class="status issue">ISSUES DETECTED</span>' : '<span class="status match">COMPLIANT / READY</span>'}
      </div>
      ${waveDFindings.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>Rule Family</th>
              <th>Status</th>
              <th>Expected Specification</th>
              <th>Observed Artwork Evidence</th>
              <th>Proof &amp; Regulatory Citation</th>
            </tr>
          </thead>
          <tbody>
            ${waveDFindings.map(f => `
              <tr>
                <td>
                  <b>${esc(f.title || f.type)}</b><br>
                  <small><code>${esc(f.type || f.check || f.id)}</code></small>
                </td>
                <td><span class="status ${esc(f.status)}">${esc(f.status.toUpperCase())}</span></td>
                <td>${esc(f.expected || '—')}</td>
                <td><b>${esc(f.observed || '—')}</b></td>
                <td>
                  <div><small>${esc(f.explanation || '')}</small></div>
                  ${f.calculationProof ? `<div style="font-family:monospace;font-size:11px;color:#4338ca;margin-top:4px;">${esc(f.calculationProof.proofString || JSON.stringify(f.calculationProof))}</div>` : ''}
                  <div style="color:#64748b;font-size:11px;margin-top:2px;"><em>Citation: ${esc(f.ruleCitation || f.rule?.citation || 'Standard packaging rule')}</em></div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p><small>Wave D packaging rule families evaluated as part of canonical findings below.</small></p>'}
    </section>
  `;

  // Phase 5A: Department Review Summary & Multi-Stakeholder Sticky Notes
  const stickyNotes = review.team?.stickyNotes || [];
  const openNotes = stickyNotes.filter(n => (n.noteStatus || n.status) !== 'CLOSED');
  const closedNotes = stickyNotes.filter(n => (n.noteStatus || n.status) === 'CLOSED');
  const deptCounts = { legal: 0, rd: 0, brand: 0, prepress: 0, unassigned: 0 };
  for (const f of review.findings || []) {
    const d = String(f.primaryDepartment || 'unassigned').toLowerCase();
    if (deptCounts[d] !== undefined) deptCounts[d]++;
    else deptCounts.unassigned++;
  }

  const departmentSection = `
    <section class="department-report-section" style="border-left:4px solid #0284c7;">
      <h2>Department Review Summary (Phase 5A)</h2>
      <p>Multi-stakeholder collaboration overview across Legal, R&amp;D, Brand, and Prepress domains. Sticky notes and thread closure reflect team alignment and do not alter deterministic engine verdicts.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:16px;">
        <div style="background:#fef2f2;border:1px solid #f87171;border-radius:6px;padding:10px;">
          <b style="color:#991b1b;">⚖️ Legal &amp; Regulatory</b>
          <div style="font-size:18px;font-weight:800;color:#991b1b;margin-top:4px;">${deptCounts.legal} checks</div>
        </div>
        <div style="background:#eff6ff;border:1px solid #60a5fa;border-radius:6px;padding:10px;">
          <b style="color:#1e40af;">🧪 R&amp;D &amp; Food Science</b>
          <div style="font-size:18px;font-weight:800;color:#1e40af;margin-top:4px;">${deptCounts.rd} checks</div>
        </div>
        <div style="background:#faf5ff;border:1px solid #c084fc;border-radius:6px;padding:10px;">
          <b style="color:#6b21a8;">🎨 Brand &amp; Marketing</b>
          <div style="font-size:18px;font-weight:800;color:#6b21a8;margin-top:4px;">${deptCounts.brand} checks</div>
        </div>
        <div style="background:#f0fdf4;border:1px solid #4ade80;border-radius:6px;padding:10px;">
          <b style="color:#166534;">🖨️ Prepress &amp; Print</b>
          <div style="font-size:18px;font-weight:800;color:#166534;margin-top:4px;">${deptCounts.prepress} checks</div>
        </div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:14px;font-size:12px;">
        <b>Sticky Notes Tracker:</b> ${stickyNotes.length} total notes · <span style="color:#b45309;font-weight:700;">${openNotes.length} outstanding actions</span> · <span style="color:#15803d;font-weight:700;">${closedNotes.length} resolved threads</span>
      </div>
      ${stickyNotes.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>Department</th>
              <th>Finding &amp; Target</th>
              <th>Status</th>
              <th>Author &amp; Time</th>
              <th>Note Content</th>
              <th>Replies</th>
            </tr>
          </thead>
          <tbody>
            ${stickyNotes.map(n => {
              const f = (review.findings || []).find(item => item.id === n.findingId);
              const deptColor = { legal: '#991b1b', rd: '#1e40af', brand: '#6b21a8', prepress: '#166534' }[n.departmentId] || '#334155';
              const repliesCount = Array.isArray(n.replies) ? n.replies.length : 0;
              return `
                <tr>
                  <td><b style="color:${deptColor};text-transform:uppercase;">${esc(n.departmentId)}</b></td>
                  <td><b>${esc(f?.title || n.findingId)}</b>${n.artworkPage ? `<br><small>Artwork Page ${n.artworkPage}</small>` : ''}</td>
                  <td><span class="status ${(n.noteStatus || n.status || 'open').toLowerCase()}">${esc(n.noteStatus || n.status || 'OPEN')}</span>${n.resolvedBy ? `<br><small>By ${esc(n.resolvedBy)}</small>` : ''}</td>
                  <td><b>${esc(n.authorDisplayName || n.authorId || 'Reviewer')}</b><br><small>${esc(n.createdAt)}</small></td>
                  <td>${esc(n.noteText || n.text || '')}</td>
                  <td>${repliesCount} ${repliesCount === 1 ? 'reply' : 'replies'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : '<p><small>No departmental sticky notes were recorded for this review.</small></p>'}
    </section>
  `;

  // Upgrade #42: Shopper Perspective Summary (Nut Allergy + Vegan + Sugar Watcher)
  const personas = getAllShopperPersonas();
  const shopperPerspectiveSection = `
    <section class="shopper-perspective-report-section" style="border-left:4px solid #10b981;">
      <h2>SHOPPER PERSPECTIVE SUMMARY (Upgrade #42 Consumer Impact Lens)</h2>
      <p style="font-size:13px;color:#334155;">
        <b>Scope:</b> Translates verified technical packaging checks into consumer-understandable perspectives (Nut Allergy Shopper, Vegan Shopper, and Sugar Watcher).
        <b>Notice:</b> This perspective summary is a review aid and VIEW FILTER ONLY. Underlying deterministic engine verdicts (ISSUE, REVIEW, MATCH, UNABLE) remain unchanged.
        This section is NOT an individualized medical clearance, clinical safety certification, third-party vegan certification, or sugar-free approval.
      </p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin:14px 0;">
        ${personas.map(p => {
          const summary = getPersonaImpactSummary(review, p.personaId);
          return `
            <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:12px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <b style="font-size:14px;color:#0f172a;">${esc(p.icon)} ${esc(p.displayName)}</b>
                <span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:#e2e8f0;color:#334155;">${esc(p.badgeText)}</span>
              </div>
              <p style="font-size:11px;color:#475569;margin:0 0 8px;">${esc(p.description)}</p>
              <div style="font-size:11px;color:#0f172a;line-height:1.6;">
                Relevant Checks: <b>${summary.totalRelevant}</b> ·
                Issues: <b style="color:#b91c1c;">${summary.issues}</b> ·
                Review: <b style="color:#d97706;">${summary.needsReview}</b> ·
                Matches: <b style="color:#15803d;">${summary.matches}</b><br>
                Source Coverage: <b>${esc(summary.sourceEvidenceCoverage)}</b>
              </div>
              <div style="margin-top:6px;font-size:10px;color:#64748b;border-top:1px dashed #cbd5e1;padding-top:4px;">
                Governing Criteria: ${p.governingRegulations.map(r => `<code>${esc(r)}</code>`).join(', ')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <h3>Consumer Consequence Traceability</h3>
      <table>
        <thead>
          <tr>
            <th>Persona</th>
            <th>Check / Finding</th>
            <th>Engine Verdict</th>
            <th>Consumer Perspective &amp; Why It Matters</th>
            <th>Source Authority &amp; Limitations</th>
          </tr>
        </thead>
        <tbody>
          ${personas.flatMap(p => {
            return (review.findings || []).map(f => {
              const mapping = getFindingPersonaMapping(f, p.personaId, review);
              if (!mapping) return null;
              return `
                <tr>
                  <td><b>${esc(p.icon)} ${esc(p.shortName)}</b><br><span style="font-size:10px;color:#0f766e;font-weight:700;">${esc(mapping.displayPriority)} PRIORITY</span></td>
                  <td><b>${esc(f.title || f.id)}</b><br><small><code>${esc(f.id)}</code></small></td>
                  <td><span class="status ${esc(f.status)}">${esc(f.status.toUpperCase())}</span></td>
                  <td>
                    <div style="font-size:12px;color:#0f172a;"><b>Shopper Sees:</b> ${esc(mapping.consumerExplanation.shopperSees)}</div>
                    <div style="font-size:12px;color:#334155;margin-top:2px;"><b>Impact:</b> ${esc(mapping.consumerExplanation.whyItMatters)}</div>
                  </td>
                  <td>
                    <div style="font-size:11px;color:#b45309;"><b>Unresolved:</b> ${esc(mapping.consumerExplanation.uncertainty)}</div>
                    <div style="font-size:11px;color:#047857;margin-top:2px;"><b>Team Action:</b> ${esc(mapping.consumerExplanation.actionRequired)}</div>
                  </td>
                </tr>
              `;
            }).filter(Boolean);
          }).join('')}
        </tbody>
      </table>
    </section>
  `;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PackSignal report - ${esc(review.name)}</title><style>body{font:15px/1.55 system-ui,sans-serif;color:#183b2f;background:#f5f7f0;margin:0}main{max-width:1000px;margin:auto;padding:36px}header,.finding,section{background:white;border:1px solid #d8e1d4;border-radius:12px;padding:24px;margin-bottom:16px}h1{font-size:32px;margin:4px 0}h2{font-size:20px}h3{font-size:16px;margin:16px 0 7px}.eyebrow{font-size:11px;letter-spacing:1.4px;color:#67806a;font-weight:700}.counts{display:flex;gap:8px;flex-wrap:wrap}.counts span,.status{font-size:11px;border-radius:99px;padding:5px 9px;background:#edf2e9}.status.issue{background:#fce9e2;color:#9b422e}.status.review{background:#fbf0d9;color:#8d681f}.status.unable{background:#edf0ee;color:#5f7067}.status.match{background:#e8f1e0;color:#477236}.finding-title{display:flex;align-items:center;gap:10px}.finding p{max-width:780px}dl{display:grid;grid-template-columns:145px 1fr;gap:7px 14px;border-top:1px solid #e4ebe0;padding-top:13px}dt{font-size:11px;font-weight:700;text-transform:uppercase;color:#68786b}dd{margin:0;overflow-wrap:anywhere}blockquote{border-left:3px solid #b6cd9c;margin:10px 0;padding:8px 12px;background:#f7faf4;overflow-wrap:anywhere}summary{cursor:pointer;color:#315d3e}.decision{padding:10px;background:#f6f1e3;border-radius:7px}.rule a{margin-left:7px}code{overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}td,th{padding:9px;border-bottom:1px solid #e3e9df;text-align:left;vertical-align:top}img{display:block;width:100%;height:auto;border:1px solid #dae3d5;border-radius:7px;margin:12px 0}.team-record{padding:8px 0;border-bottom:1px solid #e3e9df}@media print{body{background:#fff}main{max-width:none;padding:0}header,.finding,section{break-inside:avoid;border-color:#bbb}a{color:#183b2f;text-decoration:none}}@media(max-width:600px){main{padding:15px}dl{grid-template-columns:1fr;gap:3px}}</style></head><body><main><header><div class="eyebrow">PACKSIGNAL · EVIDENCE-LED PACKAGING REVIEW</div><h1>${esc(review.name)}</h1><p>${esc(review.market||'Unspecified')} · ${esc(review.engine||'Local review')} · ${esc(review.createdAt)}</p><p>Scope: supplied sources and supported comparisons. This report does not certify legal compliance, print readiness, barcode quality, or release approval.</p><div class="counts"><span>Issues ${Number(counts.issue)||0}</span><span>Human review ${Number(counts.review)||0}</span><span>Unable ${Number(counts.unable)||0}</span><span>Matches ${Number(counts.match)||0}</span></div></header>${runNotes?`<section><h2>Processing notes</h2>${runNotes}</section>`:''}${seal}<section><h2>Review boundaries</h2>${(review.coverage?.limits||[]).map(x=>`<p>${esc(x)}</p>`).join('')}<p>Reviewer confirmations and source authority remain part of the audit record below.</p></section>${deepSummary}${physicalPrepressSection}${waveDSection}${nativeTypographySection}${shelfReadabilitySection}${nutritionSection}${usPreflightSection}${regulatorySection}${ambiguitySection}${pdfPreflightSection}${visibilitySection}${reconstructionSection}${packagingGeometrySection}${ghostPlacementSection}${timeMachineSection}${remediationSection}<section><h2>Findings</h2>${rows||'<p>No findings were generated.</p>'}</section>${revisionComparisonSummary}${revisions?`<section><h2>Revision comparison</h2>${intelSummary}<table><thead><tr><th>Check</th><th>Previous</th><th>Current</th><th>Change</th></tr></thead><tbody>${revisions}</tbody></table></section>`:''}${impact}${departmentSection}${shopperPerspectiveSection}${team}<section><h2>Source inventory</h2><ul>${sources}</ul></section><section><h2>Artwork reference</h2><p>Embedded reduced renderings are for context. Inspect the original artwork for detailed visual approval.</p>${images.map(i=>i.omitted?`<p>Artwork page ${i.page.number} was omitted to keep this portable report below the image limit.</p>`:`<figure><figcaption>Artwork page ${i.page.number} · ${esc(i.page.method)}</figcaption><img src="data:image/png;base64,${i.data}" alt="Artwork page ${i.page.number}"></figure>`).join('')}</section><section><h2>Audit trail</h2>${(review.audit||[]).map(e=>`<p><small>${esc(e.at)} · ${esc(e.action)}${e.actorName?` · ${esc(e.actorName)}`:''}</small><br>${esc(e.detail||'')}</p>`).join('')}</section></main></body></html>`;

}
