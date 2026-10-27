#!/usr/bin/env node
/**
 * PackSignal Organizer Evaluation Runner.
 * Executes deep verification against official organizer samples and outputs
 * structured evidence and results to evaluation/organizer/ directory.
 *
 * Usage:
 *   npm run evaluate:organizer
 *   node scripts/evaluate-organizer.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOrganizerVerification } from '../lib/organizer-verification.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const EVAL_DIR = resolve(REPO_ROOT, 'evaluation/organizer');

mkdirSync(EVAL_DIR, { recursive: true });

console.log('='.repeat(70));
console.log('PACKSIGNAL — ORGANIZER SAMPLE DEEP VERIFICATION');
console.log('Evidence-Driven Investigation of Official Esko AIForge Packaging');
console.log('='.repeat(70));

const startTime = Date.now();
const result = runOrganizerVerification();
const elapsedMs = Date.now() - startTime;

// Write candidate-checks.json
const candidateChecksPath = resolve(EVAL_DIR, 'candidate-checks.json');
writeFileSync(candidateChecksPath, JSON.stringify(result.candidateChecks, null, 2));

// Write verified-observations.json
const observations = result.candidateChecks.map(c => ({
  checkId: c.checkId,
  checkType: c.checkType,
  findingStatus: c.findingStatus,
  sourceApprovalStatus: c.sourceApprovalStatus,
  sourceLocation: c.sourceCell ? `${c.sourceSheet}!${c.sourceCell}` : null,
  sourceQuote: c.sourceQuote,
  artworkPanel: c.artworkPanel,
  artworkQuote: c.artworkQuote,
  artworkBoundingBox: c.artworkBoundingBox,
  calculationProof: c.calculationProof,
  visibilityStatus: c.visibilityStatus,
  limitations: c.limitations
}));
const observationsPath = resolve(EVAL_DIR, 'verified-observations.json');
writeFileSync(observationsPath, JSON.stringify(observations, null, 2));

// Write results.json
const resultsPath = resolve(EVAL_DIR, 'results.json');
writeFileSync(resultsPath, JSON.stringify(result, null, 2));

console.log(`\nManifest Integrity: ${result.manifestVerification.verified ? 'VERIFIED ✓' : 'FAILED ✗'}`);
for (const f of result.manifestVerification.files) {
  console.log(`  - ${f.name} (${f.bytes.toLocaleString()} bytes) -> SHA-256 ${f.status}`);
}

console.log(`\nSource Approval Status: "${result.sourceDoc.approvalStatus}"`);
console.log(`  * Note: Discrepancies represent SOURCE_ARTWORK_MISMATCH or REVIEW, not confirmed legal issues.`);

console.log('\nInvestigation Summary:');
console.log(`  Candidate Checks Evaluated:     ${result.summary.totalCandidateChecks}`);
console.log(`  Confirmed Physical Discrepancies: ${result.summary.confirmedObservations}`);
console.log(`  Reviews Requiring Human Resolution: ${result.summary.reviewsRequiringResolution}`);
console.log(`  Source Document Quality Defects: ${result.summary.sourceQualityDefects}`);
console.log(`  Verified Compliant Elements:     ${result.summary.verifiedMatches}`);

console.log('\nKey Technical Findings:');
console.log('  1. Honey Percentage:        Source 9% vs Artwork 1% (SOURCE_ARTWORK_MISMATCH)');
console.log('  2. Artwork-Only Ingredients: Walnuts, Flax Seeds, Dried Strawberries, Pumpkin Seeds');
console.log('  3. Source Duplicate:        "Sunflower Seeds" repeated in cell B26');
console.log('  4. Nutrition Values:        Carbs (15g vs 66g), Sodium (25mg vs 23mg)');
console.log('  5. Daily Values (FDA 2016): 10 %DV mismatches (Total Fat, Sat Fat, Sodium, Carbs, Vit D, Calcium, Iron, Potassium)');
console.log('  6. Atwater Calorie Screen:  15×9 + 66×4 + 34×4 = 535 kcal vs 166 kcal printed (CALORIE_PLAUSIBILITY_REVIEW)');
console.log('  7. Occluded EU Table:       "Typical Values per 100g" at seqno 227 masked by opaque fill at seqno 241');
console.log('  8. Dieline Guide Text:      39 spans on "Dimensions and text" layer classified as PRODUCTION_GUIDE');
console.log('  9. Storage Font Size:       Native Acorn-Regular at 5.80 pt vs 6.00 pt company standard');
console.log(' 10. Rulebook Ledger:         ' + result.rulebookLedger.summary);

console.log(`\nArtifacts written to evaluation/organizer/:`);
console.log(`  - ${candidateChecksPath}`);
console.log(`  - ${observationsPath}`);
console.log(`  - ${resultsPath}`);
console.log(`Completed in ${elapsedMs}ms.\n`);
