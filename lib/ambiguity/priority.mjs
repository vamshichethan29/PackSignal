/**
 * PackSignal Ambiguity Resolution Engine — Priority Calculation
 * (lib/ambiguity/priority.mjs)
 */

import { QUESTION_PRIORITY, QUESTION_TYPES } from './question-types.mjs';

/**
 * Computes deterministic question priority with transparent justification factors.
 * @param {object} params
 * @param {string} params.type - Question type from QUESTION_TYPES
 * @param {string[]} params.affectedCheckIds - Checks blocked by this question
 * @param {string[]} params.affectedRuleIds - Rules blocked
 * @param {boolean} params.isMandatory - Whether statutory mandatory check
 * @returns {{ priority: string, score: number, reasons: string[] }}
 */
export function calculateQuestionPriority({ type, affectedCheckIds = [], affectedRuleIds = [], isMandatory = false }) {
  let score = 0;
  const reasons = [];

  // Base score from question type
  switch (type) {
    case QUESTION_TYPES.NUTRITION_BASIS:
      score += 40;
      reasons.push('Nutrition basis blocks mandatory Daily Value and Calorie arithmetic');
      break;
    case QUESTION_TYPES.FACT_CONFLICT:
      score += 35;
      reasons.push('Contradictory source specifications prevent definitive comparison');
      break;
    case QUESTION_TYPES.SOURCE_AUTHORITY:
      score += 30;
      reasons.push('Unconfirmed source authority blocks release sign-off');
      break;
    case QUESTION_TYPES.MISSING_REQUIRED_FACT:
      score += 25;
      reasons.push('Mandatory regulatory specification missing from sources');
      break;
    case QUESTION_TYPES.SKU_VARIANT_AMBIGUITY:
      score += 20;
      reasons.push('Multi-SKU catalog carryover risk detected');
      break;
    case QUESTION_TYPES.RULE_APPLICABILITY:
      score += 15;
      reasons.push('Regulatory rule applicability requires reviewer confirmation');
      break;
    case QUESTION_TYPES.CLAIM_SUBSTANTIATION:
      score += 10;
      reasons.push('Marketing claim substantiation requires evidence verification');
      break;
    case QUESTION_TYPES.ARTWORK_COVERAGE:
      score += 15;
      reasons.push('Artwork visual coverage needs manual confirmation');
      break;
    default:
      score += 10;
  }

  // Weight by number of blocked checks
  const checkCount = affectedCheckIds.length;
  if (checkCount > 0) {
    const checkWeight = Math.min(checkCount * 10, 40);
    score += checkWeight;
    reasons.push(`Directly blocks ${checkCount} downstream verification check${checkCount === 1 ? '' : 's'}`);
  }

  // Mandatory statutory weight
  if (isMandatory || affectedRuleIds.some(r => /21\s*CFR|FALCPA|FASTER/i.test(r))) {
    score += 20;
    reasons.push('Statutory FDA / FALCPA / FASTER Act compliance requirement');
  }

  let priority = QUESTION_PRIORITY.LOW;
  if (score >= 60) {
    priority = QUESTION_PRIORITY.HIGH;
  } else if (score >= 35) {
    priority = QUESTION_PRIORITY.MEDIUM;
  }

  return { priority, score, reasons };
}
