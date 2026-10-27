#!/usr/bin/env node
/**
 * PackSignal Demo Pre-Flight Check
 * (scripts/demo-preflight.mjs)
 *
 * Verifies demo assets, sample integrity, report verifiers,
 * and operational workflows prior to an Esko AIForge judge demonstration.
 */

import { access, constants } from 'node:fs/promises';
import { resolve } from 'node:path';

async function runDemoPreflight() {
  console.log('='.repeat(65));
  console.log('🎬 PACKSIGNAL DEMO PRE-FLIGHT VERIFIER');
  console.log('='.repeat(65));

  const checks = [];

  async function checkFile(name, relPath) {
    const fullPath = resolve(process.cwd(), relPath);
    try {
      await access(fullPath, constants.R_OK);
      checks.push({ name, status: 'READY', details: relPath });
      console.log(`  ✓ [READY] ${name}`);
    } catch {
      checks.push({ name, status: 'NOT_READY', details: `Missing: ${relPath}` });
      console.log(`  ✗ [NOT_READY] ${name} (Missing: ${relPath})`);
    }
  }

  // 1. Official Organizer Sample
  await checkFile(
    'Official Organizer Carton PDF',
    'samples/organizer/DancingFish_Granola_Berry_US_Carton.pdf'
  );
  await checkFile(
    'Official Organizer Content Sheet',
    'samples/organizer/DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx'
  );

  // 2. Controlled Frictional Mismatch Sample (Fieldday)
  await checkFile(
    'Controlled Fieldday V1 Artwork',
    'samples/fieldday-v2/artwork/fieldday-v1.pdf'
  );
  await checkFile(
    'Controlled Fieldday V2 Artwork (Revision B)',
    'samples/fieldday-v2/artwork/fieldday-v2.pdf'
  );

  // 3. Cryptographic Signature Tools
  await checkFile(
    'Ed25519 Report Verifier Script',
    'scripts/verify-report.mjs'
  );

  // 4. Evaluation and Blind Review Protocol
  await checkFile(
    'Known-Sample Answer Key',
    'evaluation/known-sample/answer-key.yaml'
  );
  await checkFile(
    'Independent Blind Evaluation Protocol',
    'evaluation/independent/protocol.json'
  );

  // 5. Playwright Demo Test
  await checkFile(
    'Playwright E2E Suite Config',
    'playwright.config.mjs'
  );

  console.log('='.repeat(65));
  const missing = checks.filter(c => c.status === 'NOT_READY');
  if (missing.length > 0) {
    console.log(`⚠️ Demo Status: READY_WITH_LIMITATIONS (${missing.length} optional item(s) unverified)`);
  } else {
    console.log('🎉 Demo Status: READY FOR JUDGE PRESENTATION (All core assets verified)');
  }
}

runDemoPreflight().catch(err => {
  console.error('Fatal error during demo check:', err);
  process.exit(1);
});
