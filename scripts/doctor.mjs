import { existsSync, writeFileSync, unlinkSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
let issuesFound = 0;

console.log('============================================================');
console.log('PackSignal Environment & Runtime Diagnostic Check (doctor)');
console.log('============================================================\n');

// 1. Node.js Version Check (>= 24)
const nodeMajor = Number(process.versions.node.split('.')[0]);
const nodeStatus = nodeMajor >= 24 ? 'OK' : 'FAIL';
console.log(`[Node.js] Version: ${process.version} ... ${nodeStatus}`);
if (nodeStatus !== 'OK') {
  console.error('  -> Node.js 24+ is required. Please upgrade Node.js (e.g. nvm use 24).');
  issuesFound++;
}

// 2. Python & Document Libraries Check
const bundled = join(process.env.HOME || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3');
const localVenv = join(root, '.venv', 'bin', 'python');
let python = process.env.PACKPROOF_PYTHON || (existsSync(localVenv) ? localVenv : (existsSync(bundled) ? bundled : 'python3'));

console.log(`[Python] Executable: ${python}`);
const pyCheck = spawnSync(python, [
  '-c',
  'import sys, pypdfium2, openpyxl, PIL, reportlab, docx; print(f"Python {sys.version.split()[0]} with pypdfium2, openpyxl, PIL, reportlab, python-docx ready.")'
], {
  encoding: 'utf8',
  env: {
    ...process.env,
    PYTHONPATH: [join(root, '.packproof', 'python-deps'), process.env.PYTHONPATH].filter(Boolean).join(':')
  }
});

if (pyCheck.status === 0 && pyCheck.stdout) {
  console.log(`  OK: ${pyCheck.stdout.trim()}`);
} else {
  console.error('  FAIL: Required Python libraries missing or Python failed to execute.');
  if (pyCheck.stderr) console.error('  Details:', pyCheck.stderr.trim());
  console.error('  -> Remediation:');
  console.error('     1. python3 -m venv .venv');
  console.error('     2. .venv/bin/pip install -r requirements.txt');
  console.error('     3. Set PACKPROOF_PYTHON=.venv/bin/python in .env.local (or export PACKPROOF_PYTHON)');
  issuesFound++;
}

// 3. Official Sample Files Check
const requiredSamples = [
  'samples/organizer/DancingFish_Granola_Berry_US_Carton.pdf',
  'samples/organizer/DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx',
  'samples/organizer/DancingFish_Granola_Product_Spec.docx'
];

console.log('\n[Sample Documents]');
for (const sample of requiredSamples) {
  const full = join(root, sample);
  const exists = existsSync(full);
  console.log(`  ${exists ? 'OK' : 'MISSING'}: ${sample}`);
  if (!exists) {
    console.error(`  -> Missing official sample: ${sample}`);
    issuesFound++;
  }
}

// 4. Critical Web & Runtime Assets
const criticalAssets = [
  'public/index.html',
  'public/app.js',
  'public/styles.css',
  'public/three-bundle.js',
  'lib/engine.mjs',
  'lib/extract.py',
  'docs/architecture.svg',
  'docs/architecture.png'
];

console.log('\n[Critical Runtime Assets]');
for (const asset of criticalAssets) {
  const full = join(root, asset);
  const exists = existsSync(full);
  console.log(`  ${exists ? 'OK' : 'MISSING'}: ${asset}`);
  if (!exists) {
    console.error(`  -> Missing critical asset: ${asset}`);
    issuesFound++;
  }
}

// 5. Model Configuration Syntax
console.log('\n[AI Model Configuration]');
const modelConfigFile = join(root, 'config', 'ai-models.json');
if (existsSync(modelConfigFile)) {
  try {
    const configData = JSON.parse(readFileSync(modelConfigFile, 'utf8'));
    if (configData.defaultModel && Array.isArray(configData.fallbackModels)) {
      console.log(`  OK: Valid config (${configData.displayName || configData.defaultModel})`);
      console.log(`  Freeze Status: ${configData.featureFreezeStatus || 'FROZEN'} (Default: ${configData.defaultModel})`);
    } else {
      console.error('  FAIL: config/ai-models.json missing required fields.');
      issuesFound++;
    }
  } catch (err) {
    console.error(`  FAIL: config/ai-models.json syntax error: ${err.message}`);
    issuesFound++;
  }
} else {
  console.error('  MISSING: config/ai-models.json');
  issuesFound++;
}

// 6. Writable Storage Check
console.log('\n[Storage & Cache Permissions]');
const storageDir = resolve(process.env.PACKPROOF_DATA_DIR || join(root, '.packproof'));
try {
  mkdirSync(join(storageDir, 'reviews'), { recursive: true });
  mkdirSync(join(storageDir, 'cache'), { recursive: true });
  const testFile = join(storageDir, 'cache', `.doctor-write-test-${Date.now()}.tmp`);
  writeFileSync(testFile, 'test', 'utf8');
  unlinkSync(testFile);
  console.log(`  OK: Storage directory writable (${storageDir})`);
} catch (err) {
  console.error(`  FAIL: Cannot write to storage path ${storageDir}: ${err.message}`);
  issuesFound++;
}

// 7. Server Settings
console.log('\n[Server Settings & Port]');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
console.log(`  Configured URL: http://${host}:${port}`);
console.log(`  Node Environment: ${process.env.NODE_ENV || 'development'}`);

// 8. Credentials Note
console.log('\n[AI Credentials]');
if (process.env.GEMINI_API_KEY) {
  console.log('  GEMINI_API_KEY detected in environment. Optional multimodal AI enabled.');
} else {
  console.log('  No GEMINI_API_KEY detected. Local deterministic mode fully operational.');
  console.log('  (No API key needed for local compliance checks, preflight, or synthetic evaluation)');
}

console.log('\n============================================================');
if (issuesFound === 0) {
  console.log('Doctor summary: ALL CHECKS PASSED. PackSignal is ready.');
  console.log('Start the server: npm run dev (or npm start)');
  console.log('============================================================');
  process.exitCode = 0;
} else {
  console.error(`Doctor summary: ${issuesFound} check(s) failed. Review recommendations above.`);
  console.log('============================================================');
  process.exitCode = 1;
}
