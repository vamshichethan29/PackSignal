/**
 * PackSignal Ambiguity Resolution Engine — Deduplication & Key Stability
 * (lib/ambiguity/deduplication.mjs)
 */

import { createHash } from 'node:crypto';

export function hashId(str) {
  return createHash('sha256').update(String(str)).digest('hex').slice(0, 14);
}

/**
 * Builds a deterministic canonical key for a question.
 * @param {object} params
 * @param {string} params.reviewId
 * @param {string} params.sku
 * @param {string} params.type
 * @param {string} params.field
 * @param {string} [params.sourceDependencyHash='']
 * @returns {string} Stable canonical question ID
 */
export function buildCanonicalQuestionId({ reviewId, sku = 'default', type, field, sourceDependencyHash = '' }) {
  const normField = String(field || '').toLowerCase().trim();
  const normType = String(type || '').toUpperCase().trim();
  const normSku = String(sku || 'default').toLowerCase().trim();
  const rawKey = `amb:${reviewId}:${normSku}:${normType}:${normField}:${sourceDependencyHash}`;
  return `amb-${hashId(rawKey)}`;
}

/**
 * Deduplicates questions and merges affected check/rule arrays for identical dependencies.
 * @param {object[]} questions
 * @returns {object[]} Deduplicated question list
 */
export function deduplicateQuestions(questions = []) {
  const byKey = new Map();

  for (const q of questions) {
    const key = q.questionId || buildCanonicalQuestionId(q);
    if (!byKey.has(key)) {
      byKey.set(key, { ...q, questionId: key });
      continue;
    }

    const existing = byKey.get(key);
    // Merge affected checks
    existing.affectedCheckIds = [...new Set([...(existing.affectedCheckIds || []), ...(q.affectedCheckIds || [])])];
    existing.affectedRuleIds = [...new Set([...(existing.affectedRuleIds || []), ...(q.affectedRuleIds || [])])];
    existing.affectedFactFields = [...new Set([...(existing.affectedFactFields || []), ...(q.affectedFactFields || [])])];
    existing.affectedFindingKeys = [...new Set([...(existing.affectedFindingKeys || []), ...(q.affectedFindingKeys || [])])];

    // Merge source candidates if unique
    if (q.sourceCandidates?.length) {
      const existingCandIds = new Set((existing.sourceCandidates || []).map(c => c.candidateId));
      for (const cand of q.sourceCandidates) {
        if (!existingCandIds.has(cand.candidateId)) {
          existing.sourceCandidates.push(cand);
          existingCandIds.add(cand.candidateId);
        }
      }
    }
  }

  return [...byKey.values()];
}
