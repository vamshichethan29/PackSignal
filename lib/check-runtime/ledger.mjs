/**
 * PackSignal Check Execution Ledger (lib/check-runtime/ledger.mjs)
 * Records executed, blocked, and not_applicable states for all checks.
 */

export class CheckExecutionLedger {
  constructor() {
    this.entries = [];
  }

  record(checkResult, context = {}) {
    const entry = {
      checkId: checkResult.checkId,
      ruleId: checkResult.ruleId,
      outcome: checkResult.outcome,
      executionState: checkResult.executionState,
      evaluationMethod: checkResult.evaluationMethod,
      evaluatorId: checkResult.evaluatorId,
      sourceHashes: context.sourceHashes || {},
      factIds: context.factIds || [],
      completedAt: checkResult.completedAt || new Date().toISOString(),
      explanation: checkResult.explanation,
      hasSourceEvidence: Boolean(checkResult.sourceEvidence),
      hasArtworkEvidence: Boolean(checkResult.artworkEvidence),
    };
    this.entries.push(entry);
    return entry;
  }

  getByCheckId(checkId) {
    return this.entries.filter(e => e.checkId === checkId);
  }

  summary() {
    return {
      totalExecuted: this.entries.filter(e => e.executionState === 'executed').length,
      totalBlocked: this.entries.filter(e => e.executionState === 'blocked').length,
      totalNotApplicable: this.entries.filter(e => e.executionState === 'not_applicable').length,
      byOutcome: {
        issue: this.entries.filter(e => e.outcome === 'issue').length,
        match: this.entries.filter(e => e.outcome === 'match').length,
        review: this.entries.filter(e => e.outcome === 'review').length,
        unable: this.entries.filter(e => e.outcome === 'unable').length,
      },
    };
  }
}
