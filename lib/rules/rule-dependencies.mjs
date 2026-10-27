/**
 * PackSignal Question & Rule Dependency Graph (lib/rules/rule-dependencies.mjs)
 * 
 * Maps questions to blocked regulatory requirements and downstream checks.
 * Manages controlled reevaluation without falsely turning reviewer opinions into approved source files.
 */

export class RuleDependencyGraph {
  constructor() {
    this.questionToBlockedRules = new Map();
    this.ruleToBlockingQuestions = new Map();
    this.resolvedAnswers = new Map();
  }

  /**
   * Registers a question and its blocked rule IDs.
   */
  registerQuestion(questionId, blockedRuleIds = []) {
    this.questionToBlockedRules.set(questionId, [...blockedRuleIds]);
    for (const rId of blockedRuleIds) {
      if (!this.ruleToBlockingQuestions.has(rId)) {
        this.ruleToBlockingQuestions.set(rId, new Set());
      }
      this.ruleToBlockingQuestions.get(rId).add(questionId);
    }
  }

  /**
   * Checks whether a rule is blocked by any unresolved questions.
   */
  isRuleBlocked(ruleId) {
    const questions = this.ruleToBlockingQuestions.get(ruleId);
    if (!questions || questions.size === 0) return false;
    for (const qId of questions) {
      if (!this.resolvedAnswers.has(qId)) return true;
    }
    return false;
  }

  /**
   * Returns list of unresolved questions blocking a rule.
   */
  getBlockersForRule(ruleId) {
    const questions = this.ruleToBlockingQuestions.get(ruleId);
    if (!questions) return [];
    return Array.from(questions).filter(qId => !this.resolvedAnswers.has(qId));
  }

  /**
   * Records a reviewer answer for a question.
   * NOTE: Preserves source authority; does NOT falsely approve underlying lab data.
   */
  resolveQuestion(questionId, answer, reviewerDetails = {}) {
    this.resolvedAnswers.set(questionId, {
      answer,
      reviewerId: reviewerDetails.reviewerId || 'QA_Reviewer',
      timestamp: new Date().toISOString(),
      sourceAuthorityRemainsUnverified: true
    });

    const affectedRules = this.questionToBlockedRules.get(questionId) || [];
    return {
      questionId,
      resolved: true,
      affectedRules,
      unblockedRules: affectedRules.filter(rId => !this.isRuleBlocked(rId))
    };
  }
}
