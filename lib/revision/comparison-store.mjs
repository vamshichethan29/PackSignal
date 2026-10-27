/**
 * PackSignal Comparison Store (lib/revision/comparison-store.mjs)
 * Manages immutable revision comparison snapshots, multi-version timelines,
 * and reviewer change acknowledgments.
 */

import { createHash } from 'node:crypto';

// In-memory persistent map (backed by review records)
const comparisonCache = new Map();

export function generateComparisonId(revAId, revBId) {
  const hash = createHash('sha256').update(`${revAId}:::${revBId}:::${Date.now()}`).digest('hex').slice(0, 16);
  return `cmp-${hash}`;
}

export function saveComparison(comparison) {
  if (!comparison?.comparisonId) return null;
  comparisonCache.set(comparison.comparisonId, structuredClone(comparison));
  return comparison;
}

export function getComparison(comparisonId) {
  return comparisonCache.get(comparisonId) || null;
}

export function listComparisonsForReview(reviewId) {
  const matches = [];
  for (const cmp of comparisonCache.values()) {
    if (cmp.revisionA?.reviewId === reviewId || cmp.revisionB?.reviewId === reviewId) {
      matches.push(cmp);
    }
  }
  return matches;
}

export function recordChangeAcknowledgment(comparisonId, changeId, decision, note, reviewer) {
  const cmp = comparisonCache.get(comparisonId);
  if (!cmp) return null;

  cmp.acknowledgments ||= {};
  cmp.acknowledgments[changeId] = {
    changeId,
    decision,
    note: note ? note.trim() : '',
    reviewer: reviewer || 'reviewer',
    timestamp: new Date().toISOString(),
  };

  const chg = cmp.changes?.find(c => c.id === changeId);
  if (chg) {
    chg.acknowledgment = cmp.acknowledgments[changeId];
  }

  return cmp.acknowledgments[changeId];
}
