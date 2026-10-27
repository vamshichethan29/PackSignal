/**
 * PackSignal Rule Execution Ledger (lib/rulebook/execution-ledger.mjs)
 * Implements Step 11: Immutable execution records tracing every rule considered in a review.
 * Proves whether an actual deterministic evaluator ran, or why execution was deferred/blocked.
 */

import { randomUUID } from 'node:crypto';
import { EXECUTION_STATUS, FINDING_RESULT, EVALUATION_METHOD } from './schema.mjs';

export class RuleExecutionLedger {
  constructor(reviewId = 'review-active') {
    this.reviewId = reviewId;
    this.records = [];
  }

  /**
   * Records an execution event for a rule.
   */
  record({
    rule,
    evaluatorId = null,
    evaluatorVersion = '1.0.0',
    evaluationMethod = EVALUATION_METHOD.DETERMINISTIC,
    executionStatus = EXECUTION_STATUS.NOT_APPLIED,
    result = null,
    observed = null,
    expected = null,
    explanation = '',
    inputFactIds = [],
    inputDocumentHashes = [],
    findingIds = [],
    blockers = [],
    limitations = [],
    startedAt = new Date().toISOString(),
    completedAt = new Date().toISOString(),
  }) {
    const executionId = `exec_${randomUUID().slice(0, 10)}`;
    const record = {
      executionId,
      reviewId: this.reviewId,
      ruleId: rule.id,
      ruleTitle: rule.title,
      ruleVersion: rule.version || 1,
      sourceDocumentId: rule.source?.documentId || null,
      sourceDocumentHash: rule.source?.documentHash || null,
      evaluatorId: evaluatorId || rule.execution?.evaluatorId || 'none',
      evaluatorVersion,
      evaluationMethod,
      executionStatus,
      result: result || rule.execution?.result || FINDING_RESULT.UNABLE,
      observed: observed || rule.execution?.observed || null,
      expected: expected || rule.execution?.expected || null,
      explanation: explanation || rule.execution?.explanation || '',
      inputFactIds,
      inputDocumentHashes,
      findingIds,
      blockers: blockers.length > 0 ? blockers : (rule.execution?.blockers || []),
      limitations: limitations.length > 0 ? limitations : (rule.execution?.limitations || []),
      startedAt,
      completedAt,
    };

    this.records.push(record);
    return record;
  }

  /**
   * Returns all recorded executions.
   */
  getRecords() {
    return [...this.records];
  }

  /**
   * Finds execution record for a specific rule.
   */
  getRecordForRule(ruleId) {
    return this.records.find(r => r.ruleId === ruleId) || null;
  }
}
