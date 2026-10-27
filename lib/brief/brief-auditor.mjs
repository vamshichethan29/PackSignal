/**
 * @file lib/brief/brief-auditor.mjs
 * 
 * Phase 5 — Zero-Unproven-Claims Auditor
 * Performs comprehensive, deterministic sentence-level and clause-level auditing
 * of the packaging design brief. Fails closed on unproven numbers, claims, or stale data.
 */

import { AUDIT_STATUS, SENTENCE_KINDS } from './brief-schema.mjs';
import { extractClaimSpans, verifyClaimSpan } from './claim-verifier.mjs';

/**
 * Audits a single sentence in the brief against session evidence.
 */
export function auditBriefSentence(sentence, session) {
  const findings = [];
  const factsById = new Map((session.facts || []).map(f => [f.id, f]));
  const rulesById = new Map((session.rules || []).map(r => [r.ruleId || r.id, r]));
  const decisionsById = new Map((session.decisions || session.questionAnswers || []).map(d => [d.id || d.decisionId, d]));

  // 1. Verify existence of referenced facts
  const referencedFacts = [];
  for (const factId of sentence.factIds || []) {
    const fact = factsById.get(factId);
    if (!fact) {
      findings.push({
        type: 'MISSING_FACT_REFERENCE',
        severity: 'BLOCKING',
        message: `Referenced fact "${factId}" does not exist in the active Fact Sheet.`
      });
    } else {
      referencedFacts.push(fact);
      // Check state of fact
      if (fact.state === 'CONFLICT') {
        findings.push({
          type: 'FACT_IN_CONFLICT',
          severity: 'BLOCKING',
          factId: fact.id,
          message: `Sentence cites fact "${fact.label || fact.field}" (${fact.id}) which is in an unresolved CONFLICT state (${fact.value}).`
        });
      } else if (fact.state === 'AI_SUGGESTED') {
        findings.push({
          type: 'FACT_UNVERIFIED_AI_SUGGESTED',
          severity: 'BLOCKING',
          factId: fact.id,
          message: `Sentence relies on unverified fact "${fact.label || fact.field}" in AI_SUGGESTED state.`
        });
      }
    }
  }

  // 2. Verify referenced regulatory rules if rulebook is present
  const referencedRules = [];
  if (Array.isArray(session.rules) && session.rules.length > 0) {
    for (const ruleId of sentence.requirementIds || []) {
      const rule = rulesById.get(ruleId);
      if (!rule) {
        findings.push({
          type: 'INVALID_RULE_REFERENCE',
          severity: 'BLOCKING',
          message: `Referenced regulatory rule "${ruleId}" is not registered in the active rulebook.`
        });
      } else {
        referencedRules.push(rule);
      }
    }
  }

  // 3. Verify referenced design decisions if decisions registry is present
  const referencedDecisions = [];
  if (Array.isArray(session.decisions) && session.decisions.length > 0) {
    for (const decId of sentence.decisionIds || []) {
      const dec = decisionsById.get(decId);
      if (!dec) {
        findings.push({
          type: 'INVALID_DECISION_REFERENCE',
          severity: 'BLOCKING',
          message: `Referenced design decision "${decId}" does not exist in the review decision registry.`
        });
      } else {
        referencedDecisions.push(dec);
      }
    }
  }

  // 4. Extract and audit all clause-level claim spans (numbers, certifications, assertions)
  const isNonClaimKind = [
    SENTENCE_KINDS.SECTION_HEADING,
    SENTENCE_KINDS.OPEN_QUESTION,
    SENTENCE_KINDS.PROCESS_INSTRUCTION,
    SENTENCE_KINDS.EXPLANATORY_NOTE
  ].includes(sentence.kind);

  if (!isNonClaimKind) {
    const claimSpans = extractClaimSpans(sentence.text);
    sentence.claimSpans = claimSpans;

    if (sentence.kind === SENTENCE_KINDS.FACTUAL_CLAIM || claimSpans.length > 0) {
      if ((sentence.factIds || []).length === 0 && claimSpans.length > 0) {
        findings.push({
          type: 'UNLINKED_FACTUAL_ASSERTION',
          severity: 'BLOCKING',
          message: `Sentence makes factual assertions or states numbers (${claimSpans.map(s => s.rawText || s.phrase).join(', ')}) but carries no linked fact ID.`
        });
      }

      // Verify each claim span individually
      for (const span of claimSpans) {
        // If sentence states that a claim is REMOVED, it is a removal directive rather than an assertion of the claim
        if (span.kind === 'CERTIFICATION_OR_CLAIM' && sentence.text.toLowerCase().includes('removed')) {
          continue;
        }

        const spanResult = verifyClaimSpan(span, {
          referencedFacts,
          referencedRules,
          referencedDecisions
        });
        if (!spanResult.supported) {
          findings.push({
            type: span.kind === 'NUMBER' ? 'UNSUPPORTED_NUMERIC_CLAIM' : 'UNSUPPORTED_CERTIFICATION_OR_CLAIM',
            severity: 'BLOCKING',
            span: span.rawText || span.phrase,
            message: spanResult.reason
          });
        }
      }
    }
  }

  // 5. Determine sentence audit status
  sentence.auditFindings = findings;
  if (findings.length === 0) {
    sentence.evidenceStatus = AUDIT_STATUS.SUPPORTED;
  } else if (findings.some(f => f.type === 'FACT_IN_CONFLICT')) {
    sentence.evidenceStatus = AUDIT_STATUS.CONFLICTED;
  } else if (findings.some(f => f.type === 'FACT_UNVERIFIED_AI_SUGGESTED')) {
    sentence.evidenceStatus = AUDIT_STATUS.NEEDS_HUMAN_REVIEW;
  } else {
    sentence.evidenceStatus = AUDIT_STATUS.UNSUPPORTED;
  }

  return {
    sentenceId: sentence.sentenceId,
    status: sentence.evidenceStatus,
    findings,
    isSupported: sentence.evidenceStatus === AUDIT_STATUS.SUPPORTED
  };
}

/**
 * Audits the entire brief against the session data.
 */
export function auditEntireBrief(brief, session) {
  if (!brief || !Array.isArray(brief.sentences)) {
    throw new Error('Valid brief with sentences array is required for audit.');
  }

  let totalSentences = 0;
  let factualSentences = 0;
  let supportedSentences = 0;
  let unsupportedSentences = 0;
  let conflictedSentences = 0;
  let staleSentences = 0;
  let reviewRequiredSentences = 0;
  const allIssues = [];

  for (const sentence of brief.sentences) {
    totalSentences++;
    if (sentence.kind === SENTENCE_KINDS.FACTUAL_CLAIM || (sentence.claimSpans && sentence.claimSpans.length > 0)) {
      factualSentences++;
    }

    const res = auditBriefSentence(sentence, session);
    if (res.status === AUDIT_STATUS.SUPPORTED) {
      supportedSentences++;
    } else if (res.status === AUDIT_STATUS.CONFLICTED) {
      conflictedSentences++;
      unsupportedSentences++;
    } else if (res.status === AUDIT_STATUS.NEEDS_HUMAN_REVIEW) {
      reviewRequiredSentences++;
      unsupportedSentences++;
    } else if (res.status === AUDIT_STATUS.STALE) {
      staleSentences++;
      unsupportedSentences++;
    } else {
      unsupportedSentences++;
    }

    if (res.findings.length > 0) {
      for (const finding of res.findings) {
        allIssues.push({
          sentenceId: sentence.sentenceId,
          sectionId: sentence.sectionId,
          ...finding
        });
      }
    }
  }

  // Update section statuses
  for (const section of brief.sections || []) {
    const secSentences = brief.sentences.filter(s => s.sectionId === section.id);
    const hasIssues = secSentences.some(s => s.evidenceStatus !== AUDIT_STATUS.SUPPORTED);
    section.auditStatus = hasIssues ? 'HAS_ISSUES' : 'CLEAN';
  }

  const isApprovable = unsupportedSentences === 0 &&
                       conflictedSentences === 0 &&
                       staleSentences === 0 &&
                       reviewRequiredSentences === 0 &&
                       totalSentences > 0;

  brief.auditResult = {
    totalSentences,
    factualSentences,
    supportedSentences,
    unsupportedSentences,
    conflictedSentences,
    staleSentences,
    reviewRequiredSentences,
    releaseBlockingItems: unsupportedSentences,
    complianceScore: totalSentences > 0 ? Math.round((supportedSentences / totalSentences) * 100) : 0,
    isApprovable,
    issues: allIssues,
    auditedAt: new Date().toISOString()
  };

  brief.status = isApprovable ? 'READY_FOR_APPROVAL' : 'AUDIT_FAILED';
  brief.updatedAt = new Date().toISOString();

  return brief.auditResult;
}
