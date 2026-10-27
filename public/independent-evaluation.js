/**
 * PackSignal Independent Evaluation View (public/independent-evaluation.js)
 * Displays blind reviewer findings vs frozen PackSignal predictions for the 3 unseen cases.
 */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function independentEvaluationView(results = null) {
  // If results not passed, provide default presentation from frozen findings
  const data = results || {
    status: 'COMPLETED',
    evaluationDate: '2026-10-24',
    gitCommit: 'cd3db9dc2b19422667e8be7f2c87c70d145d6191',
    sampleSize: { casesCount: 3, totalUnits: 12, eligibleIssueUnits: 3, eligibleMatchUnits: 8, ambiguousUnits: 1 },
    metrics: {
      truePositives: 1,
      falsePositives: 2,
      falseNegatives: 2,
      trueNegatives: 5,
      precision: '33.3%',
      precisionFraction: '1 / 3',
      recall: '33.3%',
      recallFraction: '1 / 3',
      f1: '33.3%',
      abstentions: { correctAbstentions: 1, unsafeDefinitiveIssues: 0, unsupportedMatches: 0 },
      evidenceQuality: { sourceCorrectRatio: '9 / 12', artworkCorrectRatio: '8 / 12', ruleCorrectRatio: '12 / 12' }
    },
    unitResults: [
      { unitId: 'U-01-01', caseId: 'CASE-01', checkName: 'Net Quantity Equivalence', reviewerLabel: 'ISSUE', predictedStatus: 'issue', classification: 'TP', sourceQuality: 'CORRECT', artworkQuality: 'CORRECT', explanation: 'Detected real net quantity discrepancy (10 oz printed vs 12 oz spec).' },
      { unitId: 'U-01-02', caseId: 'CASE-01', checkName: 'Sodium %DV', reviewerLabel: 'ISSUE', predictedStatus: 'unable', classification: 'FN', sourceQuality: 'NOT_AVAILABLE', artworkQuality: 'NOT_AVAILABLE', explanation: 'Missed by automated detection; reported unable.' },
      { unitId: 'U-01-03', caseId: 'CASE-01', checkName: 'Calories Sanity', reviewerLabel: 'ISSUE', predictedStatus: 'unable', classification: 'FN', sourceQuality: 'NOT_AVAILABLE', artworkQuality: 'NOT_AVAILABLE', explanation: 'Missed by automated detection; reported unable.' },
      { unitId: 'U-01-04', caseId: 'CASE-01', checkName: 'Ingredients List Wording', reviewerLabel: 'MATCH', predictedStatus: 'match', classification: 'TN', sourceQuality: 'CORRECT', artworkQuality: 'CORRECT', explanation: 'Verified match on approved ingredients wording.' },
      { unitId: 'U-01-05', caseId: 'CASE-01', checkName: 'Manufacturer Address', reviewerLabel: 'MATCH', predictedStatus: 'match', classification: 'TN', sourceQuality: 'CORRECT', artworkQuality: 'CORRECT', explanation: 'Verified match on distributor address.' },
      { unitId: 'U-02-01', caseId: 'CASE-02', checkName: 'Net Quantity Equivalence', reviewerLabel: 'MATCH', predictedStatus: 'match', classification: 'TN', sourceQuality: 'CORRECT', artworkQuality: 'CORRECT', explanation: 'Clean case: exact match on net volume 16 FL OZ (473 mL).' },
      { unitId: 'U-02-02', caseId: 'CASE-02', checkName: 'Ingredients List Wording', reviewerLabel: 'MATCH', predictedStatus: 'match', classification: 'TN', sourceQuality: 'CORRECT', artworkQuality: 'CORRECT', explanation: 'Clean case: exact match on pasteurized orange juice.' },
      { unitId: 'U-02-03', caseId: 'CASE-02', checkName: 'Manufacturer Address', reviewerLabel: 'MATCH', predictedStatus: 'match', classification: 'TN', sourceQuality: 'CORRECT', artworkQuality: 'CORRECT', explanation: 'Clean case: exact match on bottler address.' },
      { unitId: 'U-02-04', caseId: 'CASE-02', checkName: 'Nutrition Facts Presence', reviewerLabel: 'MATCH', predictedStatus: 'unable', classification: 'ABSTENTION_ON_CLEAN', sourceQuality: 'NOT_AVAILABLE', artworkQuality: 'NOT_AVAILABLE', explanation: 'Abstained on clean nutrition facts table.' },
      { unitId: 'U-03-01', caseId: 'CASE-03', checkName: 'Nutrition Basis Authority', reviewerLabel: 'AMBIGUOUS', predictedStatus: 'review', classification: 'CORRECT_ABSTENTION', sourceQuality: 'CORRECT', artworkQuality: 'NOT_AVAILABLE', explanation: 'Correct abstention: requested human review on conflicting draft columns.' },
      { unitId: 'U-03-02', caseId: 'CASE-03', checkName: 'Net Quantity Equivalence', reviewerLabel: 'MATCH', predictedStatus: 'issue', classification: 'FP', sourceQuality: 'CORRECT', artworkQuality: 'CORRECT', explanation: 'False alarm on draft specification formatting.' },
      { unitId: 'U-03-03', caseId: 'CASE-03', checkName: 'Ingredients List Wording', reviewerLabel: 'MATCH', predictedStatus: 'issue', classification: 'FP', sourceQuality: 'CORRECT', artworkQuality: 'CORRECT', explanation: 'False alarm on draft specification formatting.' }
    ]
  };

  const m = data.metrics;
  const s = data.sampleSize;

  return `
    <section class="independent-eval-view" style="display:flex;flex-direction:column;gap:20px;color:#1e293b;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:22px 26px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#64748b;text-transform:uppercase;">
              BLIND PILOT STUDY · 3 UNSEEN PACKAGING SETS
            </div>
            <h2 style="font-size:24px;margin:4px 0 6px;color:#0f172a;">Independent Mini-Evaluation</h2>
            <p style="margin:0;font-size:13px;color:#64748b;">
              Blind reviewer findings vs. frozen PackSignal predictions.
            </p>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:99px;background:#dcfce7;color:#166534;">
              STATUS: ${esc(data.status)}
            </span>
            <span style="font-size:12px;color:#64748b;">Commit: <code>${esc(data.gitCommit?.slice(0, 8))}</code></span>
          </div>
        </div>

        <div style="margin-top:16px;padding:12px 16px;background:#f8fafc;border-left:4px solid #3b82f6;border-radius:4px;font-size:12px;line-height:1.5;color:#334155;">
          <strong>Protocol Integrity:</strong> An independent reviewer inspected original PDF artwork and Excel specs before viewing PackSignal outputs. All scoring formulas and 12 evaluation units were frozen prior to prediction revelation.
        </div>
      </div>

      <!-- Metrics Grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
          <small style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Defects Detected</small>
          <div style="font-size:26px;font-weight:700;color:#16a34a;margin:4px 0;">${m.truePositives}</div>
          <small style="color:#64748b;font-size:11px;">True Positives (Traceable)</small>
        </div>

        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
          <small style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Clean Matches</small>
          <div style="font-size:26px;font-weight:700;color:#0284c7;margin:4px 0;">${m.trueNegatives}</div>
          <small style="color:#64748b;font-size:11px;">True Negatives (Verified)</small>
        </div>

        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
          <small style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Precision</small>
          <div style="font-size:26px;font-weight:700;color:#0f172a;margin:4px 0;">${m.precision}</div>
          <small style="color:#64748b;font-size:11px;">Fraction: <code>${esc(m.precisionFraction)}</code></small>
        </div>

        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
          <small style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Recall</small>
          <div style="font-size:26px;font-weight:700;color:#0f172a;margin:4px 0;">${m.recall}</div>
          <small style="color:#64748b;font-size:11px;">Fraction: <code>${esc(m.recallFraction)}</code></small>
        </div>

        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
          <small style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Correct Abstentions</small>
          <div style="font-size:26px;font-weight:700;color:#7c3aed;margin:4px 0;">${m.abstentions.correctAbstentions}</div>
          <small style="color:#64748b;font-size:11px;">Human review requested</small>
        </div>
      </div>

      <!-- Three Unseen Cases Overview -->
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;">
        <h3 style="margin:0 0 14px;font-size:16px;color:#0f172a;">Three Previously Unseen Packaging Sets</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;">
          <div style="border:1px solid #cbd5e1;border-radius:8px;padding:14px;background:#f8fafc;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="color:#0f172a;">CASE-01</strong>
              <span style="font-size:10px;background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:99px;font-weight:700;">MISMATCH</span>
            </div>
            <div style="font-size:13px;font-weight:600;margin:6px 0 2px;">SunRidge Mountain Trail Mix</div>
            <p style="font-size:11px;color:#64748b;margin:0;">Discrepancies in net quantity (10 oz printed vs 12 oz approved), sodium, and calories.</p>
          </div>

          <div style="border:1px solid #cbd5e1;border-radius:8px;padding:14px;background:#f8fafc;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="color:#0f172a;">CASE-02</strong>
              <span style="font-size:10px;background:#e0f2fe;color:#075985;padding:2px 8px;border-radius:99px;font-weight:700;">CLEAN</span>
            </div>
            <div style="font-size:13px;font-weight:600;margin:6px 0 2px;">Verdant Grove Orange Juice</div>
            <p style="font-size:11px;color:#64748b;margin:0;">100% agreement on net volume 16 FL OZ (473 mL), ingredients, and business address.</p>
          </div>

          <div style="border:1px solid #cbd5e1;border-radius:8px;padding:14px;background:#f8fafc;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="color:#0f172a;">CASE-03</strong>
              <span style="font-size:10px;background:#f3e8ff;color:#6b21a8;padding:2px 8px;border-radius:99px;font-weight:700;">AMBIGUOUS</span>
            </div>
            <div style="font-size:13px;font-weight:600;margin:6px 0 2px;">Harvest Hearth Rolled Oats</div>
            <p style="font-size:11px;color:#64748b;margin:0;">Draft spec with conflicting nutrition columns (40g dry vs 100g prepared); properly routed to human review.</p>
          </div>
        </div>
      </div>

      <!-- Unit Findings Table -->
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;overflow-x:auto;">
        <h3 style="margin:0 0 14px;font-size:16px;color:#0f172a;">Transparent Case-by-Case Findings Table</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;text-align:left;">
          <thead>
            <tr style="border-bottom:2px solid #cbd5e1;color:#475569;">
              <th style="padding:8px 10px;">Unit</th>
              <th style="padding:8px 10px;">Case</th>
              <th style="padding:8px 10px;">Check Name</th>
              <th style="padding:8px 10px;">Reviewer Ground Truth</th>
              <th style="padding:8px 10px;">PackSignal Status</th>
              <th style="padding:8px 10px;">Outcome</th>
              <th style="padding:8px 10px;">Evidence Quality</th>
              <th style="padding:8px 10px;">Diagnostic Notes</th>
            </tr>
          </thead>
          <tbody>
            ${data.unitResults.map(u => {
              let bg = '#f8fafc', badgeBg = '#e2e8f0', badgeColor = '#334155';
              if (u.classification === 'TP') { badgeBg = '#dcfce7'; badgeColor = '#166534'; }
              else if (u.classification === 'FP') { badgeBg = '#fee2e2'; badgeColor = '#991b1b'; }
              else if (u.classification === 'FN') { badgeBg = '#fef3c7'; badgeColor = '#92400e'; }
              else if (u.classification === 'TN') { badgeBg = '#e0f2fe'; badgeColor = '#075985'; }
              else if (u.classification === 'CORRECT_ABSTENTION') { badgeBg = '#f3e8ff'; badgeColor = '#6b21a8'; }
              return `
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:8px 10px;"><code>${esc(u.unitId)}</code></td>
                  <td style="padding:8px 10px;"><strong>${esc(u.caseId)}</strong></td>
                  <td style="padding:8px 10px;">${esc(u.checkName)}</td>
                  <td style="padding:8px 10px;"><strong>${esc(u.reviewerLabel)}</strong></td>
                  <td style="padding:8px 10px;"><code>${esc(u.predictedStatus)}</code></td>
                  <td style="padding:8px 10px;"><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;background:${badgeBg};color:${badgeColor};">${esc(u.classification)}</span></td>
                  <td style="padding:8px 10px;"><small>Src: ${esc(u.sourceQuality)}<br>Art: ${esc(u.artworkQuality)}</small></td>
                  <td style="padding:8px 10px;color:#475569;">${esc(u.explanation)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Limitations & Artifact Downloads -->
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;font-size:12px;color:#475569;line-height:1.6;">
        <h4 style="margin:0 0 8px;font-size:14px;color:#0f172a;">Pilot Sample Limitations &amp; Artifact Verification</h4>
        <p style="margin:0 0 12px;">
          This pilot evaluated 3 selected packaging sets and 12 predefined check instances. These results describe performance on the supported checks and are not representative of all global food packaging or regulatory jurisdictions.
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <a href="/evaluation/independent/report.html" target="_blank" class="secondary" style="font-size:11px;padding:5px 12px;text-decoration:none;">📄 View Full HTML Report ↗</a>
          <a href="/evaluation/independent/results.json" target="_blank" class="secondary" style="font-size:11px;padding:5px 12px;text-decoration:none;">📋 Download Results JSON ↓</a>
          <a href="/evaluation/independent/protocol.json" target="_blank" class="secondary" style="font-size:11px;padding:5px 12px;text-decoration:none;">🔒 Frozen Protocol ↓</a>
          <a href="/evaluation/independent/reviewer-worksheet.md" target="_blank" class="secondary" style="font-size:11px;padding:5px 12px;text-decoration:none;">📝 Reviewer Worksheet ↓</a>
        </div>
      </div>
    </section>
  `;
}
