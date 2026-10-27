/**
 * PackSignal Advanced Rulebook Engine — Master Module (lib/rulebook/index.mjs)
 * Implements Step 1, 10, 11, 12: Complete execution pipeline connecting
 * document extraction, quotation verification, typed compilation, human authorization,
 * deterministic execution, and coverage tracking.
 */

import {
  createRuleRecord,
  validateRuleRecord,
  buildStableRuleId,
  SUPPORTED_CHECK_TYPES,
  SOURCE_VERIFICATION,
  AUTHORIZATION_STATUS,
  LEGAL_STATUS,
  APPLICABILITY_STATUS,
  EVALUATION_METHOD,
  EXECUTION_STATUS,
  FINDING_RESULT,
} from './schema.mjs';

import { verifyRuleQuotation } from './quote-verifier.mjs';
import { extractRequirementsFromDocument } from './extractor.mjs';
import { compileRuleRequirement, integrateAiProposedRule } from './compiler.mjs';
import { executeEvaluator, EVALUATOR_REGISTRY } from './evaluators.mjs';
import { evaluateRuleApplicability } from './applicability.mjs';
import {
  isRuleExecutable,
  transitionRuleAuthorization,
  invalidateStaleAuthorization,
  computeRuleInterpretationHash,
} from './lifecycle.mjs';
import { RuleExecutionLedger } from './execution-ledger.mjs';
import { buildRuleCoverageLedger } from './coverage.mjs';

export {
  // Schema & Constants
  SUPPORTED_CHECK_TYPES,
  SOURCE_VERIFICATION,
  AUTHORIZATION_STATUS,
  LEGAL_STATUS,
  APPLICABILITY_STATUS,
  EVALUATION_METHOD,
  EXECUTION_STATUS,
  FINDING_RESULT,
  createRuleRecord,
  validateRuleRecord,
  buildStableRuleId,

  // Functions
  verifyRuleQuotation,
  extractRequirementsFromDocument,
  compileRuleRequirement,
  integrateAiProposedRule,
  executeEvaluator,
  EVALUATOR_REGISTRY,
  evaluateRuleApplicability,
  isRuleExecutable,
  transitionRuleAuthorization,
  invalidateStaleAuthorization,
  computeRuleInterpretationHash,
  RuleExecutionLedger,
  buildRuleCoverageLedger,
};

/**
 * High-Level Rulebook Engine Processor:
 * Ingests rule documents, verifies source quotes, checks applicability,
 * executes authorized deterministic checks, and returns findings, execution ledger,
 * and coverage ledger.
 */
export function processRulebookEngine({
  documents = [],
  rawRules = [],
  packageContext = {},
  existingDecisions = {},
  reviewId = 'active-review',
}) {
  const ledger = new RuleExecutionLedger(reviewId);
  const consideredRules = [];
  const findings = [];

  // Step 1: Ingest from documents with role === 'rules'
  const ruleDocs = documents.filter(d => d.role === 'rules');
  for (const doc of ruleDocs) {
    const extracted = extractRequirementsFromDocument(doc, packageContext);
    for (const r of extracted) {
      consideredRules.push(r);
    }
  }

  // Also include any explicitly supplied raw rules
  for (const r of rawRules) {
    if (!consideredRules.some(cr => cr.id === r.id)) {
      consideredRules.push(typeof r === 'object' ? createRuleRecord(r) : compileRuleRequirement(r));
    }
  }

  // Step 2: Verification, Authorization, Applicability, and Execution
  for (const rule of consideredRules) {
    const sourceDoc = documents.find(d => d.id === rule.source?.documentId) || ruleDocs[0] || documents.find(d => d.role === 'spec');

    // Quotation verification
    if (sourceDoc) {
      const qv = verifyRuleQuotation({ rule, sourceDocument: sourceDoc });
      rule.source.verificationStatus = qv.status;
      rule.source.verificationReason = qv.reason;
      if (qv.verified) {
        rule.source.location = qv.location || rule.source.location;
        rule.source.page = qv.page ?? rule.source.page;
        rule.source.line = qv.line ?? rule.source.line;
      }
    }

    // Apply any saved reviewer authorization decision
    if (existingDecisions[rule.id]) {
      const dec = existingDecisions[rule.id];
      rule.authorization.status = dec.decision || dec.status;
      rule.authorization.authorizedBy = dec.actorName || dec.authorizedBy;
      rule.authorization.authorizedAt = dec.at || dec.authorizedAt;
      rule.authorization.decisionReason = dec.reason || '';
    }

    // Check applicability
    const app = evaluateRuleApplicability(rule, packageContext);
    rule.applicability = {
      ...rule.applicability,
      status: app.status,
      reason: app.reason,
    };

    // Check if eligible to execute
    const executable = isRuleExecutable(rule);

    if (!app.isApplicable) {
      rule.execution.status = EXECUTION_STATUS.NOT_APPLICABLE;
      rule.execution.explanation = app.reason;
      ledger.record({
        rule,
        executionStatus: EXECUTION_STATUS.NOT_APPLICABLE,
        result: FINDING_RESULT.UNABLE,
        explanation: app.reason,
      });
      continue;
    }

    if (!executable) {
      const blockers = [];
      if (rule.source?.verificationStatus !== SOURCE_VERIFICATION.VERIFIED) {
        blockers.push(`Quotation not verified (${rule.source?.verificationStatus || 'unverified'}).`);
      }
      if (rule.authorization?.status !== AUTHORIZATION_STATUS.APPROVED) {
        blockers.push(`Rule interpretation not approved by human reviewer (status: ${rule.authorization?.status || 'proposed'}).`);
      }

      rule.execution.status = EXECUTION_STATUS.NOT_APPLIED;
      rule.execution.blockers = blockers;
      rule.execution.explanation = blockers.join(' ');

      ledger.record({
        rule,
        executionStatus: EXECUTION_STATUS.NOT_APPLIED,
        result: FINDING_RESULT.UNABLE,
        explanation: blockers.join(' '),
        blockers,
      });
      continue;
    }

    // Compile check if not already compiled
    const checkType = rule.interpretation?.checkType || 'REQUIRED_PHRASE';
    const evalResult = executeEvaluator(checkType, rule, packageContext);

    rule.execution = {
      ...rule.execution,
      status: evalResult.result === FINDING_RESULT.BLOCKED ? EXECUTION_STATUS.BLOCKED : EXECUTION_STATUS.APPLIED,
      evaluatorId: evalResult.evaluatorId,
      evaluatorVersion: evalResult.evaluatorVersion || '1.0.0',
      evaluationMethod: evalResult.method || EVALUATION_METHOD.DETERMINISTIC,
      executedAt: new Date().toISOString(),
      result: evalResult.result,
      observed: evalResult.observed || null,
      expected: evalResult.expected || null,
      explanation: evalResult.explanation || '',
      blockers: evalResult.blockers || [],
      limitations: evalResult.limitations || [],
    };

    // If check generated a finding, add it
    const findingId = `finding_${rule.id}`;
    rule.execution.findingIds = [findingId];

    findings.push({
      id: findingId,
      key: `rule:${rule.id}`,
      title: rule.title,
      status: evalResult.result,
      expected: evalResult.expected || '',
      observed: evalResult.observed || '',
      explanation: evalResult.explanation,
      rule: {
        id: rule.id,
        text: rule.source?.originalQuote || rule.text,
        sourceURL: rule.source?.sourceUrl || null,
        citation: rule.source?.sourceCitation || null,
      },
      evidence: [
        rule.source?.documentId ? {
          documentId: rule.source.documentId,
          role: rule.source.documentRole || 'rules',
          name: rule.source.documentName,
          quote: rule.source.originalQuote,
          location: rule.source.location || 'Rulebook',
          page: rule.source.page,
        } : null,
      ].filter(Boolean),
      severity: evalResult.result === FINDING_RESULT.ISSUE ? 'major' : 'minor',
      method: evalResult.method,
    });

    ledger.record({
      rule,
      evaluatorId: evalResult.evaluatorId,
      evaluatorVersion: evalResult.evaluatorVersion,
      evaluationMethod: evalResult.method,
      executionStatus: rule.execution.status,
      result: evalResult.result,
      observed: evalResult.observed,
      expected: evalResult.expected,
      explanation: evalResult.explanation,
      findingIds: [findingId],
      blockers: evalResult.blockers || [],
      limitations: evalResult.limitations || [],
    });
  }

  const coverageLedger = buildRuleCoverageLedger(consideredRules, ledger);

  return {
    rules: consideredRules,
    findings,
    executionLedger: ledger.getRecords(),
    coverageLedger,
  };
}
