/**
 * PackSignal Case Matcher & Outcome Classifier (lib/evaluation/case-matcher.mjs)
 * Phase 8: Strict evaluation matcher ensuring findings match specific planted defect fields,
 * rules, and evidence citations rather than crediting any arbitrary finding.
 */

import { OUTCOME_CATEGORIES, EXPECTED_OUTCOMES } from './case-schema.mjs';

/**
 * Matches an engine/model review outcome against the case evaluation objective.
 *
 * @param {Object} evalCase - Ground truth case
 * @param {Object} reviewResult - Result of analysis ({ findings, status, errors })
 * @returns {Object} Classified outcome with category, matched finding, and diagnostics
 */
export function matchCaseOutcome(evalCase, reviewResult) {
  if (!evalCase || evalCase.validationStatus === 'INVALID_FIXTURE') {
    return {
      classification: OUTCOME_CATEGORIES.INVALID_FIXTURE,
      matched: false,
      finding: null,
      reason: 'Fixture rejected during pre-evaluation validation',
    };
  }

  if (!reviewResult) {
    return {
      classification: OUTCOME_CATEGORIES.NOT_EXECUTED,
      matched: false,
      finding: null,
      reason: 'Review execution produced no result object',
    };
  }

  if (reviewResult.error || reviewResult.timeout) {
    const classification = reviewResult.timeout
      ? OUTCOME_CATEGORIES.TIMEOUT
      : reviewResult.parserError
      ? OUTCOME_CATEGORIES.PARSER_FAILURE
      : OUTCOME_CATEGORIES.MODEL_FAILURE;

    return {
      classification,
      matched: false,
      finding: null,
      reason: reviewResult.error?.message || reviewResult.error || 'Execution failure',
    };
  }

  const findings = reviewResult.findings || [];
  const expectedField = evalCase.expectedField;
  const expectedOutcome = evalCase.expectedOutcome; // 'issue' | 'match' | 'review' | 'unable'

  // Look for findings specifically addressing the target rule or field
  const relevantFindings = findings.filter(f => {
    if (!f) return false;
    const ruleMatch = f.rule?.id === evalCase.expectedRuleId || f.rule?.id?.includes(evalCase.caseId);
    const fieldMatch = f.field === expectedField || f.rule?.field === expectedField;
    return ruleMatch || fieldMatch;
  });

  // Pick the best candidate finding
  const candidate = relevantFindings[0] || findings[0] || null;
  const actualStatus = candidate?.status || (findings.length === 0 ? 'match' : 'unknown');

  // Case Type 1: Expected DEFECT ('issue')
  if (expectedOutcome === EXPECTED_OUTCOMES.ISSUE) {
    if (actualStatus === 'issue') {
      // Confirm the finding is for the expected field, not an unrelated field
      const fieldMatched = candidate?.field === expectedField || candidate?.rule?.field === expectedField || candidate?.rule?.id === evalCase.expectedRuleId;
      if (fieldMatched) {
        // Evidence verification: check quote/observed text
        const hasEvidence = Boolean(candidate?.observed || candidate?.explanation || candidate?.locations?.length);
        if (!hasEvidence) {
          return {
            classification: OUTCOME_CATEGORIES.EVIDENCE_FAILURE,
            matched: false,
            finding: candidate,
            reason: 'Issue was flagged on target field but lacked supporting artwork evidence or citation',
          };
        }
        return {
          classification: OUTCOME_CATEGORIES.CORRECT_DETECTION,
          matched: true,
          finding: candidate,
          reason: `Correctly detected planted defect in ${expectedField}: ${candidate.explanation || candidate.observed}`,
        };
      } else {
        // Flagged an issue, but for an unrelated field
        return {
          classification: OUTCOME_CATEGORIES.WRONG_ERROR_TYPE,
          matched: false,
          finding: candidate,
          reason: `Engine flagged an issue, but on field "${candidate?.field}" instead of expected defect field "${expectedField}"`,
        };
      }
    }

    if (actualStatus === 'review' || actualStatus === 'unable') {
      return {
        classification: OUTCOME_CATEGORIES.INCORRECT_ABSTENTION,
        matched: false,
        finding: candidate,
        reason: `Defect in ${expectedField} was not detected; engine incorrectly abstained with status "${actualStatus}"`,
      };
    }

    return {
      classification: OUTCOME_CATEGORIES.MISSED_DEFECT,
      matched: false,
      finding: candidate,
      reason: `Missed planted defect: engine reported "${actualStatus}" instead of "issue" for ${expectedField}`,
    };
  }

  // Case Type 2: Expected CLEAN CONTROL ('match')
  if (expectedOutcome === EXPECTED_OUTCOMES.MATCH) {
    if (actualStatus === 'match') {
      return {
        classification: OUTCOME_CATEGORIES.TRUE_NEGATIVE,
        matched: true,
        finding: candidate,
        reason: `Clean control verified without discrepancy: ${expectedField} matches specification`,
      };
    }

    if (actualStatus === 'issue') {
      return {
        classification: OUTCOME_CATEGORIES.FALSE_POSITIVE,
        matched: false,
        finding: candidate,
        reason: `False Alarm: Clean packaging was falsely flagged with defect on ${candidate?.field || expectedField}: ${candidate?.explanation || ''}`,
      };
    }

    return {
      classification: OUTCOME_CATEGORIES.MISSED_DEFECT,
      matched: false,
      finding: candidate,
      reason: `Expected clean match but got "${actualStatus}"`,
    };
  }

  // Case Type 3: Expected AMBIGUOUS / UNVERIFIED ABSTENTION ('review' | 'unable')
  if (expectedOutcome === EXPECTED_OUTCOMES.REVIEW || expectedOutcome === EXPECTED_OUTCOMES.UNABLE) {
    if (actualStatus === expectedOutcome) {
      return {
        classification: OUTCOME_CATEGORIES.CORRECT_ABSTENTION,
        matched: true,
        finding: candidate,
        reason: `Correctly abstained on uncertain/ambiguous input with status "${actualStatus}"`,
      };
    }

    if (actualStatus === 'issue') {
      return {
        classification: OUTCOME_CATEGORIES.FALSE_POSITIVE,
        matched: false,
        finding: candidate,
        reason: `Ambiguous/unverified content was aggressively flagged as a hard defect instead of routing to review`,
      };
    }

    return {
      classification: OUTCOME_CATEGORIES.INCORRECT_ABSTENTION,
      matched: false,
      finding: candidate,
      reason: `Expected abstention "${expectedOutcome}" but got "${actualStatus}"`,
    };
  }

  return {
    classification: OUTCOME_CATEGORIES.WRONG_ERROR_TYPE,
    matched: false,
    finding: candidate,
    reason: `Unhandled expected outcome: ${expectedOutcome}`,
  };
}
