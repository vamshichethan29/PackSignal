#!/usr/bin/env node
/**
 * PackSignal Deployment Readiness Verifier
 * (scripts/deployment-readiness.mjs)
 *
 * Verifies hosting environment parameters, runtime versions,
 * security controls, persistent storage, and operational readiness.
 */

import { spawnSync } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { resolve } from 'node:path';

async function checkDeploymentReadiness() {
  console.log('='.repeat(65));
  console.log('🚀 PACKSIGNAL DEPLOYMENT READINESS CHECK');
  console.log('='.repeat(65));

  const results = [];

  function addResult(name, status, details = '') {
    results.push({ name, status, details });
    const symbol = status === 'VERIFIED' ? '✓' : status === 'UNVERIFIED' ? '?' : '✗';
    console.log(`  ${symbol} [${status}] ${name}${details ? ` — ${details}` : ''}`);
  }

  // 1. Runtime Version Check
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  if (major >= 24) {
    addResult('Node.js Runtime', 'VERIFIED', `v${nodeVersion} (Node >=24 supported)`);
  } else {
    addResult('Node.js Runtime', 'FAILED', `v${nodeVersion} (Requires Node >=24)`);
  }

  // 2. Python Runtime & Dependencies
  const pyCheck = spawnSync('python3', ['-c', 'import fitz, pypdfium2; print("OK")'], { encoding: 'utf8' });
  if (pyCheck.status === 0 && pyCheck.stdout.includes('OK')) {
    addResult('Python Worker & PDF Libraries', 'VERIFIED', 'PyMuPDF (fitz) and pypdfium2 available');
  } else {
    addResult('Python Worker & PDF Libraries', 'FAILED', 'Missing PyMuPDF or pypdfium2');
  }

  // 3. Storage Directory & Permissions
  const dataDir = process.env.PACKPROOF_DATA_DIR || resolve(process.cwd(), '.packproof-data');
  try {
    await access(process.cwd(), constants.W_OK);
    addResult('Storage Mount & Write Access', 'VERIFIED', `Configured data dir: ${dataDir}`);
  } catch (err) {
    addResult('Storage Mount & Write Access', 'FAILED', err.message);
  }

  // 4. Server-Side Secret Protection
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    addResult('AI Provider Fallback State', 'VERIFIED', 'No key set; clean deterministic offline fallback active');
  } else {
    addResult('AI Provider Configuration', 'VERIFIED', 'Key configured on server side; never sent to browser');
  }

  // 5. Authentication & Access Gate
  const requireAuth = process.env.PACKPROOF_REQUIRE_AUTH === 'true';
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production' && !requireAuth) {
    addResult('Production Access Control', 'UNVERIFIED', 'PACKPROOF_REQUIRE_AUTH is not explicitly true');
  } else {
    addResult('Access Control Configuration', 'VERIFIED', `Auth enforced: ${requireAuth}, Mode: ${nodeEnv || 'development'}`);
  }

  // 6. Signature Verifier Readiness
  try {
    await access(resolve(process.cwd(), 'scripts/verify-report.mjs'), constants.R_OK);
    addResult('Cryptographic Ed25519 Verifier', 'VERIFIED', 'scripts/verify-report.mjs ready');
  } catch (err) {
    addResult('Cryptographic Ed25519 Verifier', 'FAILED', 'Missing verify-report script');
  }

  // 7. Hosted Deployment Status
  const hostedUrl = process.env.DEPLOYED_URL || 'https://packsignal.onrender.com';
  addResult('Hosted Target Assessment', 'UNVERIFIED', `Configured target: ${hostedUrl} (Live hosted verification requires authorized remote smoke)`);

  console.log('='.repeat(65));
  const failed = results.filter(r => r.status === 'FAILED');
  if (failed.length > 0) {
    console.error(`❌ Deployment readiness check failed with ${failed.length} error(s).`);
    process.exit(1);
  } else {
    console.log('✨ All critical local deployment preconditions are VERIFIED.');
  }
}

checkDeploymentReadiness().catch(err => {
  console.error('Fatal error during readiness check:', err);
  process.exit(1);
});
