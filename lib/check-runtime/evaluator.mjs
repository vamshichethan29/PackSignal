/**
 * PackSignal Check Evaluator Dispatcher (lib/check-runtime/evaluator.mjs)
 * Executes registered checks against context, enforcing applicability and recording ledger traces.
 */

import { createCheckResult, FINDING_OUTCOMES, EVALUATION_METHODS } from './result.mjs';

export async function executeCheck(checkDef, inputData, context, ledger = null) {
  const checkId = checkDef.checkId;

  // 1. Check applicability requirements
  if (checkDef.applicabilityRequirements?.length > 0) {
    const isApplicable = checkDef.applicabilityRequirements.every(req => {
      if (req.market && req.market !== context.market && req.market !== 'universal') return false;
      if (req.requiresSku && !context.productSku) return false;
      return true;
    });

    if (!isApplicable) {
      const naResult = createCheckResult({
        checkId,
        ruleId: checkDef.ruleId,
        outcome: FINDING_OUTCOMES.UNABLE,
        executionState: 'not_applicable',
        evaluationMethod: checkDef.evaluationMethod,
        explanation: 'Check requirement not applicable to current package market or SKU.',
      });
      if (ledger) ledger.record(naResult, context);
      return naResult;
    }
  }

  // 2. Check source prerequisites
  if (checkDef.requiredSourceStatus === 'confirmed') {
    const hasRequiredDocs = checkDef.inputDocumentRoles.every(role => context.isSourceConfirmed(role));
    if (!hasRequiredDocs) {
      const blockedResult = createCheckResult({
        checkId,
        ruleId: checkDef.ruleId,
        outcome: FINDING_OUTCOMES.REVIEW,
        executionState: 'blocked',
        evaluationMethod: checkDef.evaluationMethod,
        explanation: 'Required source documents are not confirmed or available.',
      });
      if (ledger) ledger.record(blockedResult, context);
      return blockedResult;
    }
  }

  // 3. Execute evaluator safely
  try {
    const rawResult = await checkDef.evaluatorFunction(inputData, context);
    const result = createCheckResult({
      checkId,
      ruleId: checkDef.ruleId,
      outcome: rawResult.outcome || FINDING_OUTCOMES.UNABLE,
      executionState: 'executed',
      evaluationMethod: checkDef.evaluationMethod,
      evaluatorId: rawResult.evaluatorId || 'check_evaluator',
      observedValue: rawResult.observedValue,
      expectedValue: rawResult.expectedValue,
      sourceEvidence: rawResult.sourceEvidence,
      artworkEvidence: rawResult.artworkEvidence,
      explanation: rawResult.explanation || '',
      limitations: rawResult.limitations || '',
      findingKeys: rawResult.findingKeys || checkDef.outputFindingKeys,
      metadata: rawResult.metadata || {},
    });

    if (ledger) ledger.record(result, context);
    return result;
  } catch (err) {
    const errResult = createCheckResult({
      checkId,
      ruleId: checkDef.ruleId,
      outcome: FINDING_OUTCOMES.UNABLE,
      executionState: 'failed',
      evaluationMethod: checkDef.evaluationMethod,
      explanation: `Execution failed: ${err.message}`,
    });
    if (ledger) ledger.record(errResult, context);
    return errResult;
  }
}
