/**
 * PackSignal Benchmark Store & Run History (lib/evaluation/benchmark-store.mjs)
 * Phase 8: Persists versioned evaluation results, manages execution audit trail,
 * and performs paired case-level differential comparisons between runs.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RESULTS_DIR = path.resolve('evaluation/results');
const HISTORY_FILE = path.join(RESULTS_DIR, 'history.json');

/**
 * Ensures results directory and history log exist.
 */
function ensureStorage() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2));
  }
}

/**
 * Saves a completed evaluation run and records it in history.
 *
 * @param {Object} runResult
 * @param {Object} [meta]
 * @returns {string} File path of persisted run artifact
 */
export function persistEvaluationRun(runResult, meta = {}) {
  ensureStorage();

  const runId = runResult.runId || `run-${Date.now().toString(36)}`;
  const artifactPath = path.join(RESULTS_DIR, `${runId}.json`);
  const serialized = JSON.stringify(runResult, null, 2);
  const artifactHash = crypto.createHash('sha256').update(serialized).digest('hex');

  fs.writeFileSync(artifactPath, serialized);

  const entry = {
    runId,
    timestamp: runResult.timestamp || new Date().toISOString(),
    suiteVersion: runResult.suiteVersion || '1.0.0-freeze',
    modelId: runResult.modelId || 'deterministic-local-engine',
    mode: runResult.mode || 'deterministic',
    totalCases: runResult.totalCases || 0,
    caughtHeadline: runResult.scoreboard?.headline || '',
    caughtX: runResult.scoreboard?.caughtX ?? 0,
    attemptedY: runResult.scoreboard?.attemptedY ?? 0,
    precision: runResult.scoreboard?.precision || 'N/A',
    recall: runResult.scoreboard?.recall || 'N/A',
    f1Score: runResult.scoreboard?.f1Score || 'N/A',
    avgLatencyMs: runResult.avgLatencyMs || 0,
    missesCount: runResult.missesCount || 0,
    artifactHash,
    gitCommit: meta.gitCommit || 'head',
    seed: meta.seed || 42,
  };

  const history = getRunHistory();
  history.unshift(entry);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, 50), null, 2));

  return artifactPath;
}

/**
 * Returns all recorded evaluation run entries.
 * @returns {Array<Object>} Run history entries
 */
export function getRunHistory() {
  ensureStorage();
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Loads a specific run artifact by runId.
 * @param {string} runId
 * @returns {Object|null}
 */
export function getRunArtifact(runId) {
  ensureStorage();
  const filePath = path.join(RESULTS_DIR, `${runId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Compares two evaluation runs and computes differential metrics and regressions.
 *
 * @param {string|Object} runA - Base/Previous run or runId
 * @param {string|Object} runB - Target/Current run or runId
 * @returns {Object} Comparison report
 */
export function compareEvaluationRuns(runA, runB) {
  const artifactA = typeof runA === 'string' ? getRunArtifact(runA) : runA;
  const artifactB = typeof runB === 'string' ? getRunArtifact(runB) : runB;

  if (!artifactA || !artifactB) {
    throw new Error('Both run artifacts must be loaded to perform comparison');
  }

  const outcomesA = new Map((artifactA.outcomes || []).map(o => [o.caseId, o]));
  const outcomesB = new Map((artifactB.outcomes || []).map(o => [o.caseId, o]));

  const sharedCaseIds = [...outcomesA.keys()].filter(id => outcomesB.has(id));
  const newlyFixed = [];
  const regressions = [];

  for (const caseId of sharedCaseIds) {
    const a = outcomesA.get(caseId);
    const b = outcomesB.get(caseId);

    if (!a.pass && b.pass) {
      newlyFixed.push({ caseId, name: b.name, prevStatus: a.actual, currStatus: b.actual });
    } else if (a.pass && !b.pass) {
      regressions.push({ caseId, name: b.name, prevStatus: a.actual, currStatus: b.actual, reason: b.diagnostic });
    }
  }

  return {
    runAId: artifactA.runId,
    runBId: artifactB.runId,
    sharedCasesCount: sharedCaseIds.length,
    newlyFixedCount: newlyFixed.length,
    newlyFixed,
    regressionsCount: regressions.length,
    regressions,
    deltas: {
      detectionRateDelta: (artifactB.scoreboard?.detectionRate || 0) - (artifactA.scoreboard?.detectionRate || 0),
      caughtDelta: (artifactB.scoreboard?.caughtX || 0) - (artifactA.scoreboard?.caughtX || 0),
      avgLatencyDeltaMs: (artifactB.avgLatencyMs || 0) - (artifactA.avgLatencyMs || 0),
      missesDelta: (artifactB.missesCount || 0) - (artifactA.missesCount || 0),
    },
    comparability: sharedCaseIds.length > 0 ? 'COMPARABLE' : 'DIFFERING_SUITES',
  };
}
