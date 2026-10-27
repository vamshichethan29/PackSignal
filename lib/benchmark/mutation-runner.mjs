/**
 * PackSignal Mutation Benchmark Runner (lib/benchmark/mutation-runner.mjs)
 * Phase 8: Executes controlled mutation test suites against PackSignal verification engine.
 * Never leaks answer keys or ground truth to the engine. Computes honest metrics.
 */

import { performance } from 'node:perf_hooks';
import { analyze } from '../engine.mjs';
import { getBaselineFixture, ALL_BASELINE_FAMILIES } from './benchmark-fixtures.mjs';
import {
  ALL_MUTATION_OPERATORS,
  ALL_CLEAN_CONTROLS,
} from './mutation-operators.mjs';
import {
  scoreMutationFinding,
  computeBenchmarkMetrics,
} from './mutation-scoring.mjs';

/**
 * Builds standard review from a raw fixture.
 */
function createBaselineReview(fixture) {
  const lines = (fixture.artworkLines || []).map((text, idx) => ({
    text,
    page: 1,
    line: idx + 1,
    box: [0.1, 0.08 + idx * 0.07, 0.85, 0.12 + idx * 0.07],
  }));

  return {
    id: `baseline-${fixture.familyId}`,
    name: `${fixture.productName} Baseline`,
    market: fixture.market || 'US',
    engine: 'PackSignal Deterministic v1.0',
    documents: [
      {
        id: 'artwork-doc',
        name: 'packaging-artwork.pdf',
        role: 'artwork',
        text: lines.map(l => l.text).join('\n'),
        lines,
        pages: [{ number: 1, width: 1200, height: 860, image: 'page-1.png', method: 'pdf_text' }],
        cells: [],
        data: null,
      },
      {
        id: 'spec-doc',
        name: 'approved-product-specification.json',
        role: 'spec',
        text: JSON.stringify(fixture.spec.product || {}),
        lines: [],
        pages: [],
        cells: [],
        data: {
          status: 'APPROVED',
          product: fixture.spec.product || {},
          nutrition: fixture.spec.nutrition || {},
          preflight: fixture.spec.preflight || {},
        },
      },
      {
        id: 'rules-doc',
        name: 'statutory-rules.json',
        role: 'rules',
        text: 'Approved Statutory Rules',
        lines: [],
        pages: [],
        cells: [],
        data: { rules: fixture.spec.rules || [] },
      },
    ],
    options: {
      completeArtwork: true,
      netQuantityConfirmed: true,
      nutritionBasisConfirmed: true,
    },
    decisions: {},
    audit: [],
  };
}

/**
 * Executes the complete Mutation Benchmark Suite.
 */
export async function runMutationBenchmark(options = {}) {
  const seed = Number(options.seed) || 20261025;
  const maxCases = options.maxCases ? Number(options.maxCases) : null;
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
  const engineFn = typeof options.engineDouble === 'function' ? options.engineDouble : analyze;

  const startedAt = new Date().toISOString();
  const startTime = performance.now();

  // 1. Establish baseline findings for all 5 families
  const baselineFindingsByFamily = new Map();
  for (const fixture of ALL_BASELINE_FAMILIES) {
    try {
      const baseReview = createBaselineReview(fixture);
      const res = engineFn(baseReview);
      baselineFindingsByFamily.set(fixture.familyId, res.findings || []);
    } catch (err) {
      baselineFindingsByFamily.set(fixture.familyId, []);
    }
  }

  const evaluatedCases = [];
  const caseDurations = [];

  // 2. Prepare test queue: clean controls first, then mutation operators
  const queue = [];
  ALL_CLEAN_CONTROLS.forEach(ctrlGen => queue.push({ isClean: true, generator: ctrlGen }));
  ALL_MUTATION_OPERATORS.forEach(opGen => queue.push({ isClean: false, generator: opGen }));

  const casesToRun = maxCases ? queue.slice(0, maxCases) : queue;
  const totalCases = casesToRun.length;

  // 3. Execute each test case independently
  for (let i = 0; i < casesToRun.length; i++) {
    const item = casesToRun[i];
    const caseStartTime = performance.now();
    let caseResult;

    try {
      // Generate mutated review and manifest
      const { review, manifest } = item.generator(seed);

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: totalCases,
          caseId: manifest.mutationId,
          category: manifest.family,
          name: manifest.expectedEffect,
        });
      }

      // CRITICAL EVALUATION RULE:
      // Strip any benchmark manifest or answer key from the review object before engine execution!
      const pureReview = {
        ...review,
        manifest: undefined,
        groundTruth: undefined,
        answerKey: undefined,
      };

      // Execute real PackSignal engine
      const engineOutput = engineFn(pureReview);
      const actualFindings = engineOutput.findings || [];

      // Look up baseline findings for differential comparison
      const baselineFindings = baselineFindingsByFamily.get(manifest.family) || [];

      // Score against ground truth
      const score = scoreMutationFinding(manifest, actualFindings, baselineFindings);

      const elapsedMs = Number((performance.now() - caseStartTime).toFixed(2));
      caseDurations.push(elapsedMs);

      caseResult = {
        id: manifest.mutationId,
        family: manifest.family,
        operator: manifest.operator || 'cleanControl',
        name: manifest.expectedEffect,
        isCleanControl: Boolean(manifest.isCleanControl),
        classification: score.classification,
        isCatch: score.isCatch,
        elapsedMs,
        diagnostic: score.details,
        findingId: score.finding?.id || null,
        groundTruth: manifest.groundTruthEvidence || manifest.expectedEffect,
        expectedRule: manifest.expectedRuleId || null,
        evidence: score.finding
          ? {
              status: score.finding.status,
              observed: score.finding.observed || null,
              expected: score.finding.expected || null,
              explanation: score.finding.explanation || null,
            }
          : null,
      };
    } catch (error) {
      const elapsedMs = Number((performance.now() - caseStartTime).toFixed(2));
      caseDurations.push(elapsedMs);
      caseResult = {
        id: `ERR-${i + 1}`,
        family: 'unknown',
        operator: 'failed',
        name: 'Engine Execution Exception',
        isCleanControl: false,
        classification: 'ENGINE_ERROR',
        isCatch: false,
        elapsedMs,
        diagnostic: `Engine execution threw error: ${error.message}`,
        findingId: null,
        groundTruth: null,
        evidence: null,
      };
    }

    evaluatedCases.push(caseResult);
  }

  const finishedAt = new Date().toISOString();
  const totalDurationMs = Number((performance.now() - startTime).toFixed(2));

  // 4. Compute timing percentiles
  caseDurations.sort((a, b) => a - b);
  const medianMs = caseDurations.length ? caseDurations[Math.floor(caseDurations.length / 2)] : 0;
  const p95Ms = caseDurations.length ? caseDurations[Math.floor(caseDurations.length * 0.95)] : 0;
  const averageMs = caseDurations.length ? Number((caseDurations.reduce((a, b) => a + b, 0) / caseDurations.length).toFixed(2)) : 0;

  // 5. Compute aggregate metrics
  const metrics = computeBenchmarkMetrics(evaluatedCases);

  return {
    runId: `run_${seed}_${Date.now()}`,
    startedAt,
    finishedAt,
    seed,
    benchmarkVersion: '1.0.0',
    engineVersion: 'PackSignal Deterministic Engine v1.0 (Phase 8)',
    summary: {
      ...metrics,
      timing: {
        totalDurationMs,
        averageMs,
        medianMs,
        p95Ms,
      },
    },
    cases: evaluatedCases,
    disclaimer: 'Controlled synthetic mutation benchmark — measures deterministic packaging defect detection under controlled test conditions. Does not represent independent external production accuracy.',
  };
}
