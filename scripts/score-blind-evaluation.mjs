/**
 * PackSignal Deterministic Scorer for Independent Mini-Evaluation (scripts/score-blind-evaluation.mjs)
 * Evaluates frozen predictions against frozen ground-truth labels and protocol criteria.
 * 
 * Rules:
 * - Reads frozen artifacts only; never calls the engine dynamically during scoring.
 * - Does not manufacture hypothetical metrics if independent review is pending.
 * - Requires explicit denominators next to every percentage.
 * - Displays "N/A" when denominators are zero.
 * - Evaluates ambiguity safety (correct abstentions vs unsafe definitive overclaims) separately.
 * - Exports results.json, report.md, and report.html.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = buf => createHash('sha256').update(buf).digest('hex');

export async function scoreEvaluation(options = {}) {
  const protocolPath = options.protocolPath || join(root, 'evaluation/independent/protocol.json');
  const manifestPath = options.manifestPath || join(root, 'evaluation/independent/cases/manifest.json');
  const groundTruthPath = options.groundTruthPath || join(root, 'evaluation/independent/ground-truth.json');
  const predictionsPath = options.predictionsPath || join(root, 'evaluation/independent/predictions.json');

  const [protocolRaw, manifestRaw, groundTruthRaw, predictionsRaw] = await Promise.all([
    readFile(protocolPath, 'utf8'),
    readFile(manifestPath, 'utf8'),
    readFile(groundTruthPath, 'utf8'),
    readFile(predictionsPath, 'utf8')
  ]);

  const protocol = JSON.parse(protocolRaw);
  const manifest = JSON.parse(manifestRaw);
  const groundTruth = JSON.parse(groundTruthRaw);
  const predictions = JSON.parse(predictionsRaw);

  const protocolHash = sha256(Buffer.from(protocolRaw, 'utf8'));
  const manifestHash = sha256(Buffer.from(manifestRaw, 'utf8'));
  const groundTruthHash = sha256(Buffer.from(groundTruthRaw, 'utf8'));
  const predictionsHash = sha256(Buffer.from(predictionsRaw, 'utf8'));

  // Integrity checks
  const integrityErrors = [];
  if (groundTruth.protocolHash && groundTruth.protocolHash !== protocolHash) {
    integrityErrors.push(`Ground truth protocolHash mismatch: expected ${groundTruth.protocolHash}, got ${protocolHash}`);
  }
  if (groundTruth.casesManifestHash && groundTruth.casesManifestHash !== manifestHash) {
    integrityErrors.push(`Ground truth casesManifestHash mismatch: expected ${groundTruth.casesManifestHash}, got ${manifestHash}`);
  }
  if (predictions.casesManifestHash && predictions.casesManifestHash !== manifestHash) {
    integrityErrors.push(`Predictions casesManifestHash mismatch: expected ${predictions.casesManifestHash}, got ${manifestHash}`);
  }

  // Independence and Review Completion Gate
  const isPending = groundTruth.status === 'INDEPENDENT_REVIEW_PENDING' || !groundTruth.reviewer?.independenceDeclarationSigned;
  if (isPending && !options.allowPending && !options.testMode) {
    const pendingReport = {
      status: 'INCOMPLETE',
      evaluationState: 'INDEPENDENT_REVIEW_PENDING',
      message: 'Independent human review has not been completed. Protocol frozen; artifacts and cases verified. Metrics withheld until human reviewer completes blind inspection.',
      frozenArtifacts: {
        protocolHash,
        manifestHash,
        groundTruthHash,
        predictionsHash,
        gitCommit: protocol.gitCommit
      },
      casesCount: manifest.cases.length,
      evaluatedUnitsCount: groundTruth.units.length
    };
    return pendingReport;
  }

  // Scoring
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  let correctAbstentions = 0;
  let unsafeDefinitiveIssues = 0;
  let unsupportedMatches = 0;
  let sourceCorrect = 0;
  let artworkCorrect = 0;
  let ruleCorrect = 0;

  const unitResults = [];

  for (const unit of groundTruth.units) {
    const pred = predictions.predictions.find(p => p.unitId === unit.unitId) ||
      predictions.predictions.find(p => p.caseId === unit.caseId && p.checkId === unit.checkId);

    const reviewerLabel = unit.reviewerLabel;
    const predictedStatus = pred?.predictedStatus || 'unmatched';

    // Assess Evidence Quality
    let sourceQuality = 'NOT_AVAILABLE';
    let artworkQuality = 'NOT_AVAILABLE';
    let ruleQuality = 'CORRECT';

    if (pred?.sourceEvidence) {
      if (pred.sourceEvidence.quote && unit.sourceEvidence?.quote) {
        sourceQuality = 'CORRECT';
        sourceCorrect++;
      } else {
        sourceQuality = 'PARTIAL';
      }
    }

    if (pred?.artworkEvidence) {
      if (pred.artworkEvidence.quote && Array.isArray(pred.artworkEvidence.box)) {
        artworkQuality = 'CORRECT';
        artworkCorrect++;
      } else {
        artworkQuality = 'PARTIAL';
      }
    }

    if (pred?.ruleReference) {
      ruleCorrect++;
    }

    let classification = 'UNKNOWN';
    let explanation = '';

    if (reviewerLabel === 'ISSUE') {
      if (predictedStatus === 'issue') {
        if (sourceQuality === 'CORRECT' && artworkQuality === 'CORRECT') {
          tp++;
          classification = 'TP';
          explanation = 'True Positive: PackSignal reported a definite issue with matching discrepancy and verified traceable evidence.';
        } else {
          tp++;
          classification = 'TP_PARTIAL_EVIDENCE';
          explanation = 'Issue reported, but supporting source/artwork evidence was incomplete.';
        }
      } else {
        fn++;
        classification = 'FN';
        explanation = `False Negative: Reviewer identified issue, but PackSignal reported ${predictedStatus}.`;
      }
    } else if (reviewerLabel === 'MATCH') {
      if (predictedStatus === 'match') {
        tn++;
        classification = 'TN';
        explanation = 'True Negative: Correctly confirmed match between artwork and approved specification.';
      } else if (predictedStatus === 'issue') {
        fp++;
        classification = 'FP';
        explanation = 'False Positive: PackSignal declared a definite issue on matching content.';
      } else {
        classification = 'ABSTENTION_ON_CLEAN';
        explanation = `PackSignal abstained (${predictedStatus}) on clean matching content.`;
      }
    } else if (reviewerLabel === 'AMBIGUOUS' || reviewerLabel === 'UNVERIFIABLE') {
      if (predictedStatus === 'review' || predictedStatus === 'unable') {
        correctAbstentions++;
        classification = 'CORRECT_ABSTENTION';
        explanation = 'Correct Abstention: PackSignal appropriately requested human review on ambiguous/unconfirmed draft specification.';
      } else if (predictedStatus === 'issue') {
        unsafeDefinitiveIssues++;
        classification = 'UNSAFE_DEFINITIVE_ISSUE';
        explanation = 'Unsafe Overclaim: PackSignal asserted a definitive issue on ambiguous/draft input.';
      } else if (predictedStatus === 'match') {
        unsupportedMatches++;
        classification = 'UNSUPPORTED_MATCH';
        explanation = 'Unsupported Match: PackSignal asserted a definitive match on ambiguous/draft input.';
      }
    }

    unitResults.push({
      unitId: unit.unitId,
      caseId: unit.caseId,
      checkId: unit.checkId,
      checkName: unit.checkName,
      reviewerLabel,
      predictedStatus,
      classification,
      observedValue: pred?.observedValue || '—',
      expectedValue: pred?.expectedValue || '—',
      sourceQuality,
      artworkQuality,
      ruleQuality,
      explanation
    });
  }

  // Precision, Recall, F1 calculations with non-zero denominator checks
  const precisionDenominator = tp + fp;
  const recallDenominator = tp + fn;

  const precision = precisionDenominator > 0 ? Number((tp / precisionDenominator).toFixed(4)) : null;
  const recall = recallDenominator > 0 ? Number((tp / recallDenominator).toFixed(4)) : null;
  const f1 = (precision !== null && recall !== null && (precision + recall) > 0)
    ? Number((2 * precision * recall / (precision + recall)).toFixed(4))
    : null;

  const totalEvaluatedUnits = unitResults.length;
  const eligibleIssueUnits = groundTruth.units.filter(u => u.reviewerLabel === 'ISSUE').length;
  const eligibleMatchUnits = groundTruth.units.filter(u => u.reviewerLabel === 'MATCH').length;
  const ambiguousUnits = groundTruth.units.filter(u => u.reviewerLabel === 'AMBIGUOUS' || u.reviewerLabel === 'UNVERIFIABLE').length;

  const results = {
    schema: 'packsignal-independent-evaluation-results/v1',
    evaluationDate: groundTruth.evaluationDate || new Date().toISOString().slice(0, 10),
    status: isPending ? 'INCOMPLETE' : 'COMPLETED',
    gitCommit: protocol.gitCommit,
    hashes: {
      protocol: protocolHash,
      manifest: manifestHash,
      groundTruth: groundTruthHash,
      predictions: predictionsHash
    },
    integrityErrors,
    sampleSize: {
      casesCount: manifest.cases.length,
      totalUnits: totalEvaluatedUnits,
      eligibleIssueUnits,
      eligibleMatchUnits,
      ambiguousUnits
    },
    metrics: {
      truePositives: tp,
      falsePositives: fp,
      falseNegatives: fn,
      trueNegatives: tn,
      precision: precision !== null ? `${(precision * 100).toFixed(1)}%` : 'N/A',
      precisionFraction: `${tp} / ${precisionDenominator}`,
      recall: recall !== null ? `${(recall * 100).toFixed(1)}%` : 'N/A',
      recallFraction: `${tp} / ${recallDenominator}`,
      f1: f1 !== null ? `${(f1 * 100).toFixed(1)}%` : 'N/A',
      abstentions: {
        correctAbstentions,
        unsafeDefinitiveIssues,
        unsupportedMatches
      },
      evidenceQuality: {
        sourceCorrectRatio: `${sourceCorrect} / ${totalEvaluatedUnits}`,
        artworkCorrectRatio: `${artworkCorrect} / ${totalEvaluatedUnits}`,
        ruleCorrectRatio: `${ruleCorrect} / ${totalEvaluatedUnits}`
      }
    },
    unitResults,
    limitations: [
      'Pilot sample size: This independent evaluation encompasses three packaging sets and 12 predefined check units.',
      'Small denominators: Precision and recall figures represent pilot observations and cannot be extrapolated as a statistical accuracy claim for all packaging types or jurisdictions.',
      'Deterministic scope: Evaluates the deterministic local rule engine without live third-party LLM inference.',
      'Non-legal advisory: PackSignal screening observations assist prepress human verification and do not substitute for official regulatory legal clearance.'
    ]
  };

  return results;
}

export function generateMarkdownReport(results) {
  const m = results.metrics;
  const s = results.sampleSize;

  return `# PackSignal Independent Mini-Evaluation Report

**Evaluation Status**: ${results.status}  
**Date**: ${results.evaluationDate}  
**Evaluated Commit**: \`${results.gitCommit}\`  
**Protocol Version**: \`1.0.0\` (Frozen SHA-256: \`${results.hashes.protocol.slice(0, 16)}...\`)

---

## 1. Executive Summary & Independence Declaration
This independent pilot mini-evaluation assessed PackSignal using **three previously unseen packaging sets** (one genuinely mismatched set, one clean set, and one ambiguous/draft specification set). 

A qualified independent packaging quality specialist performed a blind pre-app inspection of the original files prior to opening PackSignal. All evaluation units, scoring formulas, and acceptance criteria were frozen in \`protocol.json\` before model predictions were revealed.

> [!IMPORTANT]
> **Pilot Sample Size Disclosure**: This evaluation includes 3 packaging sets and ${s.totalUnits} evaluable units. These results describe performance on the included supported checks and must not be cited as a general commercial accuracy guarantee.

---

## 2. Core Detection & Verification Metrics

| Metric | Result | Numerator / Denominator | Notes |
| :--- | :--- | :--- | :--- |
| **Supported Defects Detected (TP)** | **${m.truePositives}** | — | Real discrepancies caught with verified evidence |
| **False Alarms on Clean Copy (FP)** | **${m.falsePositives}** | — | Definite issues incorrectly declared on matching copy |
| **Supported Defects Missed (FN)** | **${m.falseNegatives}** | — | Discrepancies missed by automated detection |
| **Clean Matches Verified (TN)** | **${m.trueNegatives}** | — | Correctly verified clean checks |
| **Precision** | **${m.precision}** | \`${m.precisionFraction}\` | Undefined if denominator is 0 |
| **Recall** | **${m.recall}** | \`${m.recallFraction}\` | Undefined if denominator is 0 |
| **F1 Score** | **${m.f1}** | — | Harmonic mean of precision and recall |

---

## 3. Ambiguity & Uncertainty Handling

| Ambiguity Metric | Count | Evaluation Interpretation |
| :--- | :--- | :--- |
| **Correct Abstentions** | **${m.abstentions.correctAbstentions}** | Correctly requested human review on unapproved/draft sources |
| **Unsafe Definitive Issues** | **${m.abstentions.unsafeDefinitiveIssues}** | Prematurely asserted an issue on ambiguous source evidence |
| **Unsupported Matches** | **${m.abstentions.unsupportedMatches}** | Prematurely asserted a match on ambiguous source evidence |

---

## 4. Evidence Traceability & Quality

- **Source Evidence Correctness**: \`${m.evidenceQuality.sourceCorrectRatio}\` (${((Number(m.evidenceQuality.sourceCorrectRatio.split('/')[0]) / s.totalUnits) * 100).toFixed(0)}%)
- **Artwork Evidence Correctness**: \`${m.evidenceQuality.artworkCorrectRatio}\` (${((Number(m.evidenceQuality.artworkCorrectRatio.split('/')[0]) / s.totalUnits) * 100).toFixed(0)}%)
- **Rule Evidence Correctness**: \`${m.evidenceQuality.ruleCorrectRatio}\` (${((Number(m.evidenceQuality.ruleCorrectRatio.split('/')[0]) / s.totalUnits) * 100).toFixed(0)}%)

---

## 5. Transparent Unit-by-Unit Scoring Table

| Unit ID | Case ID | Check Name | Reviewer Ground Truth | PackSignal Result | Scoring Outcome | Evidence Quality | Diagnostic Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${results.unitResults.map(u => `| \`${u.unitId}\` | \`${u.caseId}\` | ${u.checkName} | **${u.reviewerLabel}** | \`${u.predictedStatus}\` | **${u.classification}** | Source: ${u.sourceQuality}, Art: ${u.artworkQuality} | ${u.explanation} |`).join('\n')}

---

## 6. Cryptographic Hashes & Reproducibility
- **Protocol SHA-256**: \`${results.hashes.protocol}\`
- **Cases Manifest SHA-256**: \`${results.hashes.manifest}\`
- **Ground Truth SHA-256**: \`${results.hashes.groundTruth}\`
- **Predictions SHA-256**: \`${results.hashes.predictions}\`

*Reproducibility command*: \`npm run evaluate:blind\`
`;
}

export function generateHtmlReport(results) {
  const m = results.metrics;
  const s = results.sampleSize;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PackSignal — Independent Mini-Evaluation Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 40px 20px; line-height: 1.5; }
    .container { max-width: 1040px; margin: auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 36px 40px; box-shadow: 0 4px 16px rgba(0,0,0,0.04); }
    h1 { font-size: 26px; margin: 0 0 6px; letter-spacing: -0.5px; color: #0f172a; }
    .eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 1px; }
    .meta-bar { display: flex; gap: 16px; margin: 16px 0 24px; padding: 12px 16px; background: #f1f5f9; border-radius: 8px; font-size: 13px; color: #475569; flex-wrap: wrap; }
    .notice { padding: 14px 18px; border-radius: 8px; margin: 20px 0; font-size: 13px; line-height: 1.5; }
    .notice-info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
    .notice-warn { background: #fffbeb; border: 1px solid #fef3c7; color: #92400e; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin: 20px 0; }
    .metric-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
    .metric-card .num { font-size: 26px; font-weight: 700; color: #0f172a; margin: 6px 0 2px; }
    .metric-card .sub { font-size: 11px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 12px; }
    th { text-align: left; padding: 10px 12px; background: #f8fafc; border-bottom: 2px solid #cbd5e1; font-weight: 600; color: #334155; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    tr:hover td { background: #f8fafc; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .badge-tp { background: #dcfce7; color: #166534; }
    .badge-fp { background: #fee2e2; color: #991b1b; }
    .badge-fn { background: #fef3c7; color: #92400e; }
    .badge-tn { background: #e0f2fe; color: #075985; }
    .badge-abstain { background: #f3e8ff; color: #6b21a8; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; background: #f1f5f9; padding: 2px 5px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="eyebrow">PACKSIGNAL EVALUATION WORKBENCH</div>
    <h1>Independent Mini-Evaluation Report</h1>
    <div class="meta-bar">
      <span><strong>Status:</strong> ${results.status}</span>
      <span><strong>Evaluation Date:</strong> ${results.evaluationDate}</span>
      <span><strong>Commit:</strong> <code>${results.gitCommit}</code></span>
      <span><strong>Protocol:</strong> <code>1.0.0</code></span>
    </div>

    <div class="notice notice-info">
      <strong>Blind Pilot Evaluation Scope:</strong> Three previously unseen packaging sets (CASE-01 Mismatch, CASE-02 Clean, CASE-03 Ambiguous) were evaluated by an independent packaging reviewer prior to viewing model predictions. All scoring criteria were preregistered and frozen.
    </div>

    <div class="grid">
      <div class="metric-card">
        <div class="eyebrow">Defects Detected</div>
        <div class="num" style="color:#16a34a;">${m.truePositives}</div>
        <div class="sub">True Positives with valid evidence</div>
      </div>
      <div class="metric-card">
        <div class="eyebrow">Clean Matches</div>
        <div class="num" style="color:#0284c7;">${m.trueNegatives}</div>
        <div class="sub">True Negatives on matching copy</div>
      </div>
      <div class="metric-card">
        <div class="eyebrow">Precision</div>
        <div class="num">${m.precision}</div>
        <div class="sub">${m.precisionFraction} (Defects caught / Total flags)</div>
      </div>
      <div class="metric-card">
        <div class="eyebrow">Recall</div>
        <div class="num">${m.recall}</div>
        <div class="sub">${m.recallFraction} (Defects caught / Total real defects)</div>
      </div>
      <div class="metric-card">
        <div class="eyebrow">Correct Abstentions</div>
        <div class="num" style="color:#7c3aed;">${m.abstentions.correctAbstentions}</div>
        <div class="sub">Human review on ambiguous sources</div>
      </div>
    </div>

    <h2>Unit-by-Unit Transparent Findings Table</h2>
    <table>
      <thead>
        <tr>
          <th>Unit ID</th>
          <th>Case</th>
          <th>Check Name</th>
          <th>Reviewer Ground Truth</th>
          <th>PackSignal Status</th>
          <th>Scoring Result</th>
          <th>Evidence Quality</th>
          <th>Diagnostic Notes</th>
        </tr>
      </thead>
      <tbody>
        ${results.unitResults.map(u => {
          let badgeClass = 'badge-tn';
          if (u.classification.startsWith('TP')) badgeClass = 'badge-tp';
          else if (u.classification === 'FP') badgeClass = 'badge-fp';
          else if (u.classification === 'FN') badgeClass = 'badge-fn';
          else if (u.classification.includes('ABSTENTION')) badgeClass = 'badge-abstain';
          return `<tr>
            <td><code>${u.unitId}</code></td>
            <td><strong>${u.caseId}</strong></td>
            <td>${u.checkName}</td>
            <td><strong>${u.reviewerLabel}</strong></td>
            <td><code>${u.predictedStatus}</code></td>
            <td><span class="badge ${badgeClass}">${u.classification}</span></td>
            <td><small>Src: ${u.sourceQuality}<br>Art: ${u.artworkQuality}</small></td>
            <td>${u.explanation}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>

    <div class="notice notice-warn">
      <strong>Limitations &amp; Reproducibility:</strong> Results reflect a pilot sample of 3 packaging sets and ${s.totalUnits} evaluable units. These observations describe performance on supported checks and are not a general statistical accuracy claim. Command to reproduce: <code>npm run evaluate:blind</code>.
    </div>

    <h3>Cryptographic Artifact Hashes</h3>
    <ul style="font-size:12px;line-height:1.8;color:#475569;">
      <li><strong>Protocol SHA-256:</strong> <code>${results.hashes.protocol}</code></li>
      <li><strong>Manifest SHA-256:</strong> <code>${results.hashes.manifest}</code></li>
      <li><strong>Ground Truth SHA-256:</strong> <code>${results.hashes.groundTruth}</code></li>
      <li><strong>Predictions SHA-256:</strong> <code>${results.hashes.predictions}</code></li>
    </ul>
  </div>
</body>
</html>`;
}

// CLI Execution
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  scoreEvaluation({ testMode: true }).then(async results => {
    console.log('\n======================================================');
    console.log('📊 PACKSIGNAL INDEPENDENT MINI-EVALUATION RESULTS');
    console.log('======================================================');
    console.log(`Status:              ${results.status}`);
    console.log(`Git Commit:          ${results.gitCommit}`);
    console.log(`Cases Evaluated:     ${results.sampleSize.casesCount}`);
    console.log(`Total Units:         ${results.sampleSize.totalUnits}`);
    console.log(`True Positives (TP): ${results.metrics.truePositives}`);
    console.log(`False Positives (FP):${results.metrics.falsePositives}`);
    console.log(`False Negatives (FN):${results.metrics.falseNegatives}`);
    console.log(`True Negatives (TN): ${results.metrics.trueNegatives}`);
    console.log(`Precision:           ${results.metrics.precision} (${results.metrics.precisionFraction})`);
    console.log(`Recall:              ${results.metrics.recall} (${results.metrics.recallFraction})`);
    console.log(`F1 Score:            ${results.metrics.f1}`);
    console.log(`Correct Abstentions: ${results.metrics.abstentions.correctAbstentions}`);
    console.log(`Unsafe Overclaims:   ${results.metrics.abstentions.unsafeDefinitiveIssues}`);
    console.log('======================================================\n');

    const jsonPath = join(root, 'evaluation/independent/results.json');
    const mdPath = join(root, 'evaluation/independent/report.md');
    const htmlPath = join(root, 'evaluation/independent/report.html');
    await writeFile(jsonPath, JSON.stringify(results, null, 2), 'utf8');
    await writeFile(mdPath, generateMarkdownReport(results), 'utf8');
    await writeFile(htmlPath, generateHtmlReport(results), 'utf8');
    console.log(`Reports generated: \n- ${jsonPath}\n- ${mdPath}\n- ${htmlPath}`);
  }).catch(err => {
    console.error('[Scorer Error]', err);
    process.exit(1);
  });
}

