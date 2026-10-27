/**
 * PackSignal Ambiguity Resolution Engine — Question Builder
 * (lib/ambiguity/question-builder.mjs)
 */

import { buildCanonicalQuestionId, hashId } from './deduplication.mjs';
import { calculateQuestionPriority } from './priority.mjs';
import { QUESTION_TYPES, QUESTION_STATUS, QUESTION_TYPE_METADATA } from './question-types.mjs';

/**
 * Builds a standardized Ambiguity Question object.
 */
export function buildQuestion({
  reviewId,
  sku = 'default',
  type,
  field,
  title,
  question,
  reason,
  sourceCandidates = [],
  affectedFactFields = [],
  affectedRuleIds = [],
  affectedCheckIds = [],
  affectedFindingKeys = [],
  sourceDependencyHash = '',
  existingResolution = null,
  history = [],
  status = QUESTION_STATUS.OPEN,
  isMandatory = false,
  createdAt,
  updatedAt,
}) {
  const meta = QUESTION_TYPE_METADATA[type] || {};
  const questionId = buildCanonicalQuestionId({ reviewId, sku, type, field, sourceDependencyHash });
  const priorityInfo = calculateQuestionPriority({
    type,
    affectedCheckIds,
    affectedRuleIds,
    isMandatory,
  });

  return {
    questionId,
    reviewId,
    sku,
    type,
    field,
    title: title || meta.label || 'Unresolved Source Ambiguity',
    question,
    reason: reason || meta.description || '',
    status: existingResolution ? QUESTION_STATUS.RESOLVED : status,
    priority: priorityInfo.priority,
    priorityScore: priorityInfo.score,
    priorityReasons: priorityInfo.reasons,
    sourceCandidates,
    allowedAnswerTypes: meta.allowedAnswerTypes || ['SELECT_CANDIDATE', 'REQUEST_EVIDENCE'],
    affectedFactFields: [...new Set(affectedFactFields)],
    affectedRuleIds: [...new Set(affectedRuleIds)],
    affectedCheckIds: [...new Set(affectedCheckIds)],
    affectedFindingKeys: [...new Set(affectedFindingKeys)],
    resolution: existingResolution || null,
    history: history || [],
    sourceDependencyHash,
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: updatedAt || new Date().toISOString(),
  };
}
