/**
 * PackSignal Rulebook Extractor (lib/rulebook/extractor.mjs)
 * Wave 1C: Rulebook document ingestion, typed extraction, and quotation verification.
 */

import { verifyRuleQuotation } from './quote-verifier.mjs';
import { validateRuleCandidate, SUPPORTED_CHECK_TYPES, createRuleRecord, buildStableRuleId, SOURCE_VERIFICATION, AUTHORIZATION_STATUS } from './schema.mjs';
import { createRulebookRule, RULE_APPROVAL_STATUSES } from '../contracts/review-contract.mjs';

export function extractRequirementsFromDocument(doc, packageContext = {}) {
  if (!doc) return [];

  // 1. Structured JSON rulebook
  if (doc.data?.rules && Array.isArray(doc.data.rules)) {
    return doc.data.rules.map(r => createRuleRecord({
      id: r.id || buildStableRuleId(r.rule_text || r.title, doc.name),
      title: r.title || 'Structured Rule',
      checkType: r.checkType || 'UNIT_EQUIVALENT_VALUE',
      parameters: r.parameters || {},
      source: {
        documentId: doc.id,
        documentName: doc.name,
        documentHash: doc.sha256 || null,
        originalQuote: r.rule_text || r.originalQuote || '',
        verificationStatus: SOURCE_VERIFICATION.VERIFIED,
      },
      interpretation: {
        checkType: r.checkType || 'UNIT_EQUIVALENT_VALUE',
        parameters: r.parameters || {},
        isCompiled: r.checkType !== 'MANUAL_REVIEW' && r.checkType !== 'UNSUPPORTED',
        interpretedRequirement: r.rule_text || '',
      },
      authorization: {
        status: r.approved ? AUTHORIZATION_STATUS.APPROVED : AUTHORIZATION_STATUS.PROPOSED,
        authorizedBy: r.approvedBy || null,
      },
    }));
  }

  // 2. Line-structured document (DOCX, TXT, or line-indexed PDF)
  if (doc.lines && Array.isArray(doc.lines)) {
    const candidates = [];
    for (const l of doc.lines) {
      const lineText = (l.text || '').trim();
      if (!lineText) continue;
      if (lineText.match(/(?:must|shall|require|prohibit|forbidden|declare|include|state|bear|distributor|allergen|storage|21\s*CFR|FSSAI)/i)) {
        candidates.push(createRuleRecord({
          id: buildStableRuleId(lineText, doc.name, l.heading || ''),
          title: l.heading ? `${l.heading}: ${lineText.slice(0, 40)}` : lineText.slice(0, 50),
          source: {
            documentId: doc.id,
            documentName: doc.name,
            documentHash: doc.sha256 || null,
            originalQuote: lineText,
            verificationStatus: SOURCE_VERIFICATION.VERIFIED,
            sourceCitation: l.heading || doc.name,
            line: l.line,
            page: l.page || null,
            section: l.heading || null,
          },
          interpretation: {
            checkType: lineText.match(/forbidden|prohibit|not allow/i) ? 'FORBIDDEN_PHRASE' : 'REQUIRED_PHRASE',
            parameters: { phrase: lineText },
            interpretedRequirement: lineText,
            isCompiled: true,
          },
          authorization: {
            status: AUTHORIZATION_STATUS.PROPOSED,
          },
        }));
      }
    }
    if (candidates.length > 0) return candidates;
  }

  // 3. Page-structured document (PDF)
  if (doc.pages && Array.isArray(doc.pages)) {
    const candidates = [];
    for (const p of doc.pages) {
      const pageText = (p.text || '').trim();
      if (!pageText) continue;
      const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (line.match(/(?:must|shall|require|prohibit|forbidden|declare|include|state|bear|storage|allergen|21\s*CFR|FSSAI)/i)) {
          candidates.push(createRuleRecord({
            id: buildStableRuleId(line, doc.name),
            title: line.slice(0, 50),
            source: {
              documentId: doc.id,
              documentName: doc.name,
              documentHash: doc.sha256 || null,
              originalQuote: line,
              verificationStatus: SOURCE_VERIFICATION.VERIFIED,
              sourceCitation: doc.name,
              page: p.number || p.page || null,
            },
            interpretation: {
              checkType: line.match(/forbidden|prohibit|not allow/i) ? 'FORBIDDEN_PHRASE' : 'REQUIRED_PHRASE',
              parameters: { phrase: line },
              interpretedRequirement: line,
              isCompiled: true,
            },
            authorization: {
              status: AUTHORIZATION_STATUS.PROPOSED,
            },
          }));
        }
      }
    }
    if (candidates.length > 0) return candidates;
  }

  // 4. Raw text document
  const text = doc.text || '';
  if (!text) return [];

  const candidates = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.match(/(?:21\s*CFR|FSSAI|mandatory|shall|must|require|prohibit|forbidden|declare|include|state|bear)/i) && line.length > 10) {
      candidates.push(createRuleRecord({
        id: buildStableRuleId(line, doc.name),
        title: line.slice(0, 50),
        source: {
          documentId: doc.id,
          documentName: doc.name,
          documentHash: doc.sha256 || null,
          originalQuote: line,
          verificationStatus: SOURCE_VERIFICATION.VERIFIED,
          sourceCitation: line.slice(0, 40),
        },
        interpretation: {
          checkType: line.match(/forbidden|prohibit|not allow/i) ? 'FORBIDDEN_PHRASE' : 'REQUIRED_PHRASE',
          parameters: { phrase: line },
          interpretedRequirement: line,
          isCompiled: true,
        },
        authorization: {
          status: AUTHORIZATION_STATUS.PROPOSED,
        },
      }));
    }
  }
  return candidates;
}

export async function processRulebookExtraction({
  documentId = 'doc-rulebook',
  sourceText,
  sourceHash,
  aiProposerFn = null,
}) {
  if (!sourceText) {
    throw new Error('sourceText is required for rulebook extraction');
  }

  // 1. Obtain candidate rules (via AI proposer function or fallback heuristic)
  let rawCandidates = [];
  if (typeof aiProposerFn === 'function') {
    rawCandidates = await aiProposerFn(sourceText);
  } else {
    // Deterministic heuristic: scan for standard statutory patterns (e.g. 21 CFR §101, FSSAI)
    const match = sourceText.match(/(?:21\s*CFR\s*§?\s*101\.\d+|FSSAI\s*Packaging\s*Reg)/i);
    if (match) {
      rawCandidates.push({
        ruleId: 'RULE-HEURISTIC-1',
        citation: match[0],
        exactQuotation: sourceText.slice(0, 150).trim(),
        section: 'General Labeling Requirements',
        checkType: 'REQUIRED_PHRASE',
      });
    }
  }

  const verifiedRules = [];

  for (const cand of rawCandidates) {
    try {
      validateRuleCandidate(cand);
    } catch {
      continue;
    }

    const verification = verifyRuleQuotation({
      candidateQuote: cand.exactQuotation,
      sourceDocumentText: sourceText,
    });

    const checkType = SUPPORTED_CHECK_TYPES.includes(cand.checkType) ? cand.checkType : 'UNSUPPORTED';

    const ruleRecord = createRulebookRule({
      ruleId: cand.ruleId,
      title: cand.title || `Requirement: ${cand.citation || cand.ruleId}`,
      originalQuote: cand.exactQuotation,
      sourceDocumentId: documentId,
      sourceHash: sourceHash || '0'.repeat(64),
      sourceLocation: cand.section || cand.citation || 'Unspecified',
      quoteVerification: verification.verified ? 'verified' : 'unverified',
      approvalStatus: RULE_APPROVAL_STATUSES.PROPOSED, // Stays proposed until reviewer signs off
      applicability: cand.applicability || 'US_FOOD_LABELING',
      checkType,
      evaluatorId: checkType === 'UNSUPPORTED' ? 'none' : 'typed_rule_evaluator',
      executionStatus: 'PENDING',
    });

    verifiedRules.push(ruleRecord);
  }

  return verifiedRules;
}
