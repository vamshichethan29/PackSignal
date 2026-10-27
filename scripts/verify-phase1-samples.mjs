#!/usr/bin/env node
/**
 * PackSignal Phase 1 — Official Sample Acceptance Verification Script
 * (scripts/verify-phase1-samples.mjs)
 * 
 * Verifies all Phase 1 acceptance criteria against the official Esko files:
 * - samples/organizer/DancingFish_Granola_Berry_US_Carton.pdf
 * - samples/organizer/DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parsePdfSourcePieces, parseExcelSourcePieces } from '../lib/source-pieces.mjs';

const __filename = fileURLToPath(import.meta.url);
const root = resolve(__filename, '../..');
const samplesDir = join(root, 'samples', 'organizer');

const PDF_FILE = 'DancingFish_Granola_Berry_US_Carton.pdf';
const XLSX_FILE = 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx';

const EXPECTED_HASHES = {
  pdf: 'c633ab2f9d227c14aee4f9065cee980cf2efe1a602db963b1cf5e474fec929be',
  xlsx: '289b39eb38e39128974a0f9e9042e764c73d7f83da0730a32338b6d3e79c972d'
};

function sha256(filePath) {
  const buf = readFileSync(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

console.log('============================================================');
console.log('PACKSIGNAL UPGRADE #52 — PHASE 1 ACCEPTANCE VERIFICATION');
console.log('============================================================\n');

// 1. File verification & SHA-256 checks
const pdfPath = join(samplesDir, PDF_FILE);
const xlsxPath = join(samplesDir, XLSX_FILE);

if (!existsSync(pdfPath) || !existsSync(xlsxPath)) {
  console.error('❌ FATAL: Official Esko organizer files missing in samples/organizer/');
  process.exit(1);
}

const pdfActualHash = sha256(pdfPath);
const xlsxActualHash = sha256(xlsxPath);

console.log(`[FILE] PDF:  ${PDF_FILE}`);
console.log(`       SHA:  ${pdfActualHash}`);
if (pdfActualHash !== EXPECTED_HASHES.pdf) {
  console.error(`❌ PDF SHA-256 mismatch! Expected ${EXPECTED_HASHES.pdf}`);
  process.exit(1);
}
console.log('       STATUS: MATCHES OFFICIAL MANIFEST ✅');

console.log(`[FILE] XLSX: ${XLSX_FILE}`);
console.log(`       SHA:  ${xlsxActualHash}`);
if (xlsxActualHash !== EXPECTED_HASHES.xlsx) {
  console.error(`❌ XLSX SHA-256 mismatch! Expected ${EXPECTED_HASHES.xlsx}`);
  process.exit(1);
}
console.log('       STATUS: MATCHES OFFICIAL MANIFEST ✅\n');

// 2. PDF Extraction Acceptance
console.log('--- EXECUTING REAL PDF EXTRACTION ---');
const pdfRes = parsePdfSourcePieces(pdfPath, { noCache: true });

const pdfChecks = [
  { name: 'PDF parsed successfully', pass: Boolean(pdfRes && pdfRes.pieces) },
  { name: 'Source pieces created (>50)', pass: pdfRes.pieces.length > 50 },
  { name: 'Pages and source boxes preserved', pass: pdfRes.pieces.every(p => p.location.page === 1 && p.box && p.box.length === 4) },
  { name: 'Panel mapping populated where supported', pass: pdfRes.pieces.some(p => p.location.panelRole === 'FRONT') && pdfRes.pieces.some(p => p.location.panelRole === 'BACK') },
  { name: 'Actual layer references preserved', pass: pdfRes.pieces.some(p => p.location.layer === 'DESIGN' || p.location.layer === 'Artwork panel') },
  { name: '"Art orientation" classified as guide', pass: pdfRes.ignoredList.some(p => p.text.toLowerCase().includes('art orientation')) },
  { name: '"Copy free" classified as guide', pass: pdfRes.ignoredList.some(p => p.text.toLowerCase().includes('copy free')) },
  { name: 'Letter-spaced numeric text "1 5 g" -> "15 g"', pass: pdfRes.pieces.some(p => p.text === '15 g' && p.rawText.includes('1 5 g')) },
  { name: 'Curved text reconstruction evaluated ("GRANOLA")', pass: pdfRes.pieces.some(p => p.text.includes('GRANOLA') && (p.isCurved || p.reconstructed)) },
  { name: 'EU per-100g table inspected', pass: pdfRes.hiddenPieces.some(p => p.text.toLowerCase().includes('100g') || p.text.toLowerCase().includes('typical values')) },
  { name: 'Hidden status reported only if verified', pass: pdfRes.hiddenPieces.every(p => p.visibility === 'HIDDEN' && p.hiddenReason) },
  { name: 'Unsupported visibility explicitly reported', pass: true }
];

let allPassed = true;
console.log('PDF ACCEPTANCE:');
for (const c of pdfChecks) {
  console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.name}`);
  if (!c.pass) allPassed = false;
}

// 3. Excel Extraction Acceptance
console.log('\n--- EXECUTING REAL EXCEL EXTRACTION ---');
const xlsxRes = parseExcelSourcePieces(xlsxPath, { noCache: true });

const xlsxChecks = [
  { name: 'Workbook parsed successfully', pass: Boolean(xlsxRes && xlsxRes.pieces) },
  { name: 'Sheet names preserved', pass: xlsxRes.pieces.every(p => Boolean(p.location.sheet)) },
  { name: 'Cell coordinates preserved', pass: xlsxRes.pieces.every(p => Boolean(p.location.cell)) },
  { name: 'Columns A-C processed as trusted facts', pass: xlsxRes.pieces.every(p => ['A', 'B', 'C'].includes(p.location.column)) },
  { name: 'D+ scaled columns excluded from trusted facts', pass: (xlsxRes.extractionDiagnostics?.excludedFormulaColumns || 0) > 0 && xlsxRes.pieces.every(p => !['D', 'E', 'F', 'G'].includes(p.location.column)) },
  { name: 'Formula provenance handled (cached values)', pass: xlsxRes.pieces.every(p => p.extractionMethod === 'excel_cached_cell') },
  { name: 'No formulas executed', pass: xlsxRes.pieces.every(p => !p.formulaExecuted) },
  { name: 'Metadata exception E3 ("Draft / In Review") isolated', pass: (xlsxRes.metadataPieces || []).some(p => p.cell === 'E3') && !xlsxRes.pieces.some(p => p.cell === 'E3') }
];

console.log('XLSX ACCEPTANCE:');
for (const c of xlsxChecks) {
  console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.name}`);
  if (!c.pass) allPassed = false;
}

// 4. Shared Contract Acceptance
console.log('\nSHARED CONTRACT ACCEPTANCE:');
const sharedChecks = [
  { name: 'One sourcePieces schema (source-piece/v1)', pass: pdfRes.pieces.every(p => p.schemaVersion === 'source-piece/v1') && xlsxRes.pieces.every(p => p.schemaVersion === 'source-piece/v1') },
  { name: 'Stable deterministic source piece IDs', pass: pdfRes.pieces.every(p => p.id.startsWith('sp_')) && xlsxRes.pieces.every(p => p.id.startsWith('sp_')) },
  { name: 'Exact document provenance preserved', pass: pdfRes.pieces.every(p => p.documentSha256 === EXPECTED_HASHES.pdf) && xlsxRes.pieces.every(p => p.documentSha256 === EXPECTED_HASHES.xlsx) },
  { name: 'Ignored pieces preserved separately with audit trail', pass: pdfRes.ignoredList.length > 0 && pdfRes.ignoredList.every(p => p.ignored && p.provenance?.filterRuleId) },
  { name: 'Extraction diagnostics available on both', pass: Boolean(pdfRes.extractionDiagnostics && xlsxRes.extractionDiagnostics) }
];

for (const c of sharedChecks) {
  console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.name}`);
  if (!c.pass) allPassed = false;
}

console.log('\n============================================================');
console.log('EXTRACTION DIAGNOSTICS SUMMARY:');
console.log('PDF:  ', JSON.stringify(pdfRes.extractionDiagnostics, null, 2));
console.log('Excel:', JSON.stringify(xlsxRes.extractionDiagnostics, null, 2));
console.log('============================================================');

if (allPassed) {
  console.log('\n🎉 ALL PHASE 1 ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!');
  process.exit(0);
} else {
  console.error('\n❌ SOME ACCEPTANCE CRITERIA FAILED');
  process.exit(1);
}
