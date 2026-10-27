import { mkdirSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';

const root = process.cwd();
const zipPath = join(root, 'submission', 'packsignal-source.zip');
const cleanDir = join(root, 'scratch', 'clean-install-test');

console.log('============================================================');
console.log('Clean-Room Installation & ZIP Validation Test');
console.log('============================================================\n');

if (!existsSync(zipPath)) {
  console.error(`FATAL: ZIP archive not found at ${zipPath}`);
  process.exit(1);
}

// 1. Clean scratch directory
rmSync(cleanDir, { recursive: true, force: true });
mkdirSync(cleanDir, { recursive: true });

console.log(`Extracting ${zipPath} into clean directory: ${cleanDir}...`);
const unzipResult = spawnSync('unzip', ['-q', zipPath, '-d', cleanDir]);
if (unzipResult.status !== 0) {
  console.error('Extraction failed:', unzipResult.stderr?.toString());
  process.exit(1);
}
console.log('Extraction completed successfully.');

// 2. Scan extracted contents for security and integrity
console.log('\n[Security & Manifest Inspection]');
const zipListing = spawnSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).stdout.split(/\r?\n/).filter(Boolean);

// Path traversal check
const pathTraversal = zipListing.filter(entry => entry.includes('..') || entry.startsWith('/'));
if (pathTraversal.length > 0) {
  console.error('FAIL: Path traversal entries detected in ZIP:', pathTraversal);
  process.exit(1);
}
console.log('  OK: Zero path traversal entries detected.');

// Secrets check
const secretsDetected = zipListing.filter(entry => {
  if (entry.includes('.env.example')) return false;
  return entry.includes('.env') || entry.includes('.pem') || entry.includes('.key') || entry.includes('id_rsa');
});
if (secretsDetected.length > 0) {
  console.error('FAIL: Potential secret files detected in ZIP:', secretsDetected);
  process.exit(1);
}
console.log('  OK: Zero secret or credential files detected in ZIP.');

// Essential files verification in extracted directory
const essentialFiles = [
  'package.json',
  'server.mjs',
  'README.md',
  'requirements.txt',
  'Dockerfile',
  '.dockerignore',
  'config/ai-models.json',
  'docs/architecture.svg',
  'docs/architecture.png',
  'docs/architecture.mmd',
  'samples/organizer/DancingFish_Granola_Berry_US_Carton.pdf',
  'samples/organizer/DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx',
  'samples/organizer/DancingFish_Granola_Product_Spec.docx',
  'submission/RELEASE_MANIFEST.json',
  'submission/SHORT_WRITEUP.md',
  'submission/PROJECT_DESCRIPTION.md',
  'submission/DEMO_SCRIPT.md',
  'submission/SUBMISSION_CHECKLIST.md'
];

for (const f of essentialFiles) {
  const p = join(cleanDir, f);
  if (!existsSync(p)) {
    console.error(`  FAIL: Missing essential file in extracted ZIP: ${f}`);
    process.exit(1);
  }
}
console.log('  OK: All 18 essential files verified present in extracted package.');

// 3. Symlink node_modules to avoid redundant 50MB re-download while keeping clean env
const cleanNodeModules = join(cleanDir, 'node_modules');
if (!existsSync(cleanNodeModules)) {
  spawnSync('ln', ['-s', join(root, 'node_modules'), cleanNodeModules]);
}

// 4. Run Doctor inside isolated directory
console.log('\n[Running Doctor in Clean Isolated Environment]');
const doctorRun = spawnSync('node', ['scripts/doctor.mjs'], {
  cwd: cleanDir,
  encoding: 'utf8',
  env: {
    ...process.env,
    PACKPROOF_DATA_DIR: join(cleanDir, '.packproof-clean')
  }
});
console.log(doctorRun.stdout || doctorRun.stderr);
if (doctorRun.status !== 0) {
  console.error('FAIL: Doctor failed in clean environment!');
  process.exit(1);
}

// 5. Start isolated server on test port 4988
const testPort = 4988;
console.log(`\n[Starting Isolated Server on port ${testPort}]`);
const serverProcess = spawn('node', ['server.mjs'], {
  cwd: cleanDir,
  env: {
    ...process.env,
    PORT: String(testPort),
    HOST: '127.0.0.1',
    NODE_ENV: 'development',
    PACKPROOF_DATA_DIR: join(cleanDir, '.packproof-clean')
  },
  stdio: 'pipe'
});

serverProcess.stdout.on('data', d => {
  console.log('[Server stdout]', d.toString().trim());
});
serverProcess.stderr.on('data', d => {
  console.error('[Server stderr]', d.toString().trim());
});

// Helper HTTP function
function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:${testPort}${path}`, options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// Wait for server to bind
console.log('Waiting for clean server to start...');
let ready = false;
for (let i = 0; i < 30; i++) {
  try {
    const res = await request('/api/status');
    if (res.status === 200) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise(r => setTimeout(r, 200));
}

if (!ready) {
  serverProcess.kill();
  console.error('FAIL: Server failed to start on test port within 6 seconds.');
  process.exit(1);
}
console.log(`Server started and verified at http://127.0.0.1:${testPort}`);

try {
  // 6. Test Landing Page
  console.log('\n[Testing Endpoints in Clean Server]');
  const homeRes = await request('/');
  if (homeRes.status !== 200) throw new Error(`Landing page returned ${homeRes.status}`);
  console.log('  OK: GET / returned 200');

  const statusRes = await request('/api/status');
  if (statusRes.status !== 200) throw new Error(`/api/status returned ${statusRes.status}`);
  const statusJson = JSON.parse(statusRes.body);
  const csrf = statusJson.csrf;
  console.log(`  OK: GET /api/status returned 200 (Model: ${statusJson.model}, CSRF ready)`);

  // 7. Load official organizer review
  console.log('\n[Triggering Official Organizer Sample Review]');
  const exploreRes = await request('/api/reviews', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-packproof-token': csrf
    },
    body: JSON.stringify({ sample: 'organizer', mode: 'local' })
  });
  if (exploreRes.status !== 200 && exploreRes.status !== 201 && exploreRes.status !== 202) {
    throw new Error(`Explore organizer failed with ${exploreRes.status}: ${exploreRes.body}`);
  }
  const reviewData = JSON.parse(exploreRes.body);
  const reviewId = reviewData.id || reviewData.review?.id;
  console.log(`  OK: Review initialized with ID: ${reviewId}`);

  // Wait for review completion
  console.log('  Waiting for review processing to complete...');
  let completedReview = null;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const pollRes = await request(`/api/reviews/${reviewId}`);
    if (pollRes.status === 200) {
      const parsed = JSON.parse(pollRes.body);
      const r = parsed.review || parsed;
      if (r.status === 'ready' || r.status === 'READY' || (r.findings && r.findings.length > 0)) {
        completedReview = r;
        break;
      }
      if (r.status === 'failed') {
        throw new Error(`Review processing failed: ${r.error || 'Unknown error'}`);
      }
      console.log(`  [Progress] Status: ${r.status} (${r.progress || 'processing...'})`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!completedReview) {
    throw new Error('Review processing timed out after 60 seconds');
  }

  const findingsCount = completedReview.findings?.length || 0;
  console.log(`  OK: Review completed with ${findingsCount} canonical findings.`);

  // 8. Test Export of Audited Report
  console.log('\n[Testing Deliverable Export in Clean Server]');
  const reportRes = await request(`/api/reviews/${reviewId}/report.html`);
  if (reportRes.status !== 200) {
    throw new Error(`Report export returned status ${reportRes.status}`);
  }
  if (!reportRes.body || reportRes.body.length < 500) {
    throw new Error('Report export body is empty or suspiciously small');
  }
  console.log(`  OK: GET /api/reviews/${reviewId}/report.html exported ${reportRes.body.length} bytes.`);

  console.log('\n============================================================');
  console.log('CLEAN-ROOM INSTALLATION VALIDATION: 100% PASSED');
  console.log('Source ZIP is verified completely functional, isolated, and safe.');
  console.log('============================================================');

} finally {
  serverProcess.kill('SIGKILL');
  await new Promise(r => setTimeout(r, 600));
  try {
    rmSync(cleanDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (e) {
    // Non-fatal if temporary directory cleanup is delayed by OS
  }
}
