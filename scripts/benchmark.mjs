#!/usr/bin/env node
import { performance } from 'node:perf_hooks';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

import { loadMarketRulePack } from '../lib/rulesets/loader.mjs';
import { compileRuleRequirement } from '../lib/rules/rule-compiler.mjs';
import { CheckRegistry } from '../lib/check-runtime/registry.mjs';
import { CheckExecutionContext } from '../lib/check-runtime/context.mjs';
import { executeCheck } from '../lib/check-runtime/evaluator.mjs';
import { compareRevisions } from '../lib/engine.mjs';
import { sealReview, verifyReviewSeal } from '../lib/audit-signature.mjs';
import { createHtmlReport } from '../lib/html-report.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-benchmark-'));

console.log('='.repeat(70));
console.log(' PackSignal Performance & Resource Benchmark (Phase 19)');
console.log('='.repeat(70));

const results = {
  timestamp: new Date().toISOString(),
  system: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  },
  metrics: {},
  memory: {},
};

try {
  // 1. PDF Extraction Benchmark
  const samplePdf = join(root, 'samples/organizer/DancingFish_Granola_Berry_US_Carton.pdf');
  if (existsSync(samplePdf)) {
    process.stdout.write('1. Benchmarking PDF Extraction & Native Text Parsing... ');
    const t0 = performance.now();
    const child = spawn('python3', [join(root, 'lib/extract.py')], {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const payload = JSON.stringify({
      path: samplePdf,
      role: 'artwork',
      outdir: tempDir,
      id: 'bench-pdf',
      name: 'carton.pdf',
    });
    child.stdin.write(payload);
    child.stdin.end();

    let outJson = '';
    let errJson = '';
    child.stdout.on('data', d => { outJson += d; });
    child.stderr.on('data', d => { errJson += d; });

    await new Promise((resolve, reject) => {
      child.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`extract.py exited ${code}: ${errJson || outJson}`));
      });
      child.on('error', reject);
    });
    const t1 = performance.now();
    results.metrics.pdfExtractionMs = Number((t1 - t0).toFixed(2));
    console.log(`${results.metrics.pdfExtractionMs} ms`);
  } else {
    console.log('1. PDF Extraction: Skipped (Sample PDF not found)');
    results.metrics.pdfExtractionMs = null;
  }

  // 2. Ruleset Loading & Compilation Benchmark
  process.stdout.write('2. Benchmarking US FDA Ruleset Loading & Compilation... ');
  const t0_rules = performance.now();
  const rulePack = await loadMarketRulePack('us');
  let compiledCount = 0;
  for (const rule of rulePack.rules) {
    const compiled = compileRuleRequirement(rule);
    if (compiled.isCompiled) compiledCount++;
  }
  const t1_rules = performance.now();
  results.metrics.rulesetLoadAndCompileMs = Number((t1_rules - t0_rules).toFixed(2));
  results.metrics.rulesCompiledCount = compiledCount;
  results.metrics.rulesTotalCount = rulePack.rules.length;
  console.log(`${results.metrics.rulesetLoadAndCompileMs} ms (${compiledCount}/${rulePack.rules.length} compiled)`);

  // 3. Check Runtime & Execution Ledger Benchmark
  process.stdout.write('3. Benchmarking Check Runtime & Execution Ledger (1,000 checks)... ');
  const t0_runtime = performance.now();
  const registry = new CheckRegistry();
  const checkDef = {
    checkId: 'BENCH-001',
    description: 'Bench Net Quantity Check',
    checkVersion: '1.0.0',
    jurisdiction: 'us-fda',
    inputFactFields: ['netQuantity'],
    outputFindingKeys: ['bench-net-quantity'],
    inputDocumentRoles: [],
    evaluatorFunction: (inputs, ctx) => ({
      status: inputs.netQuantity ? 'match' : 'issue',
      expected: 'Declared quantity',
      observed: inputs.netQuantity || null,
      explanation: 'Quantity evaluated in benchmark',
    }),
  };
  registry.register(checkDef);
  const execCtx = new CheckExecutionContext({
    artworkSha256: 'a'.repeat(64),
    sourceHashes: { 'sheet-1': 'b'.repeat(64) },
    facts: { netQuantity: { value: '12 oz (340g)' } },
  });
  for (let i = 0; i < 1000; i++) {
    await executeCheck(checkDef, { netQuantity: '12 oz (340g)' }, execCtx);
  }
  const t1_runtime = performance.now();
  results.metrics.ledger1000ChecksMs = Number((t1_runtime - t0_runtime).toFixed(2));
  console.log(`${results.metrics.ledger1000ChecksMs} ms (${(results.metrics.ledger1000ChecksMs / 1000).toFixed(4)} ms/check)`);

  // 4. Revision Comparison Benchmark
  process.stdout.write('4. Benchmarking Semantic Revision Comparison (50 findings)... ');
  const t0_rev = performance.now();
  const revA = {
    findings: Array.from({ length: 50 }, (_, i) => ({
      id: `FIND-${i}`,
      title: `Finding #${i} title`,
      status: i % 2 === 0 ? 'issue' : 'match',
      expected: '10g sugar',
      observed: `${i}g sugar`,
    })),
  };
  const revB = {
    findings: Array.from({ length: 50 }, (_, i) => ({
      id: `FIND-${i}`,
      title: `Finding #${i} title`,
      status: 'match',
      expected: '10g sugar',
      observed: '10g sugar',
    })),
  };
  const revResult = compareRevisions(revA, revB);
  const t1_rev = performance.now();
  results.metrics.revisionComparison50Ms = Number((t1_rev - t0_rev).toFixed(2));
  results.metrics.revisionResolvedCount = revResult.changes.filter(c => c.change.includes('resolved') || c.change.includes('cleared')).length;
  console.log(`${results.metrics.revisionComparison50Ms} ms`);

  // 5. Ed25519 Review Sealing & Verification Benchmark
  process.stdout.write('5. Benchmarking Ed25519 Review Sealing & Cryptographic Verification... ');
  const t0_sign = performance.now();
  const sampleReview = {
    id: 'bench-review-001',
    createdAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    name: 'Dancing Fish Granola Benchmark',
    documents: [
      { id: 'art-1', role: 'artwork', name: 'carton.pdf', sha256: 'c'.repeat(64) },
      { id: 'spec-1', role: 'spec', name: 'spec.xlsx', sha256: 'd'.repeat(64) },
    ],
    findings: [
      {
        id: 'chk-1',
        status: 'issue',
        title: 'Honey % Misdeclared',
        expected: '12%',
        observed: '10%',
        evidence: [{ documentId: 'art-1', quote: '10% Honey', page: 1 }],
      },
    ],
    decisions: {},
  };
  const signature = await sealReview(sampleReview, tempDir);
  sampleReview.signature = signature;
  const t1_sign = performance.now();
  const verifyResult = await verifyReviewSeal(sampleReview, tempDir);
  const t2_sign = performance.now();
  results.metrics.ed25519SignMs = Number((t1_sign - t0_sign).toFixed(2));
  results.metrics.ed25519VerifyMs = Number((t2_sign - t1_sign).toFixed(2));
  results.metrics.signatureValid = verifyResult.valid;
  console.log(`Sign: ${results.metrics.ed25519SignMs} ms | Verify: ${results.metrics.ed25519VerifyMs} ms (Valid: ${verifyResult.valid})`);

  // 6. HTML Audit Report Generation Benchmark
  process.stdout.write('6. Benchmarking HTML Audit Report Generation... ');
  const t0_html = performance.now();
  const html = await createHtmlReport(sampleReview, tempDir);
  const t1_html = performance.now();
  results.metrics.htmlReportGenerationMs = Number((t1_html - t0_html).toFixed(2));
  results.metrics.htmlReportSizeBytes = Buffer.byteLength(html, 'utf8');
  console.log(`${results.metrics.htmlReportGenerationMs} ms (${(results.metrics.htmlReportSizeBytes / 1024).toFixed(1)} KB)`);

  // 7. Memory Usage
  const mem = process.memoryUsage();
  results.memory = {
    rssMb: Number((mem.rss / 1024 / 1024).toFixed(2)),
    heapTotalMb: Number((mem.heapTotal / 1024 / 1024).toFixed(2)),
    heapUsedMb: Number((mem.heapUsed / 1024 / 1024).toFixed(2)),
    externalMb: Number((mem.external / 1024 / 1024).toFixed(2)),
  };

  console.log('-'.repeat(70));
  console.log(`Peak Memory: RSS: ${results.memory.rssMb} MB | Heap: ${results.memory.heapUsedMb} MB / ${results.memory.heapTotalMb} MB`);
  console.log('-'.repeat(70));

  // Save results
  await mkdir(join(root, 'output'), { recursive: true });
  await writeFile(join(root, 'output/benchmark-results.json'), JSON.stringify(results, null, 2), 'utf8');
  console.log('Benchmark metrics successfully recorded in output/benchmark-results.json\n');
} finally {
  await rm(tempDir, { recursive: true, force: true }).catch(() => {});
}
