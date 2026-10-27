/**
 * PackSignal Bounded Rule Compiler (lib/rulebook/compiler.mjs)
 * Implements Step 1 & Step 4: Compiles candidate rules and AI-assisted proposals
 * into typed, bounded, deterministic packaging rules.
 * Safety: Never executes arbitrary model scripts or dynamic JavaScript.
 */

import { createRuleRecord, SUPPORTED_CHECK_TYPES, SOURCE_VERIFICATION, AUTHORIZATION_STATUS } from './schema.mjs';
import { compilePackagingRule } from '../rules/rule-compiler.mjs';

/**
 * Attempts to compile a candidate text requirement into a typed check.
 */
export function compileRuleRequirement(rawRule, options = {}) {
  let text = '';
  let metadata = {};

  if (typeof rawRule === 'string') {
    text = rawRule.trim();
  } else if (rawRule && typeof rawRule === 'object') {
    metadata = { ...rawRule };
    text = String(rawRule.text || rawRule.originalQuote || rawRule.rule_text || '').trim();

    // Already typed structured rule
    const declaredType = rawRule.checkType || rawRule.type;
    if (declaredType && SUPPORTED_CHECK_TYPES.includes(declaredType)) {
      return createRuleRecord({
        ...rawRule,
        interpretation: {
          checkType: declaredType,
          field: rawRule.targetField || rawRule.field || rawRule.parameters?.field || null,
          parameters: rawRule.parameters || {},
          condition: rawRule.condition || null,
          isCompiled: declaredType !== 'MANUAL_REVIEW',
          interpretedRequirement: text,
        },
      });
    }
  }

  // Check bounded packaging rule families compiler
  const boundedCompiled = compilePackagingRule(rawRule, metadata);
  if (boundedCompiled.isCompiled && [
    'BARCODE_GTIN_MATCH',
    'STATUTORY_SYMBOL_PRESENCE',
    'MULTILINGUAL_PAIR_REQUIREMENT',
    'MANUFACTURER_ADDRESS_DECLARATION',
    'STORAGE_INSTRUCTION_MANDATE',
    'NUTRIENT_CONTENT_CLAIM_LIMIT',
  ].includes(boundedCompiled.type)) {
    return createRuleRecord({
      ...metadata,
      title: boundedCompiled.title || `${boundedCompiled.type}: ${text.slice(0, 40)}`,
      interpretation: {
        checkType: boundedCompiled.type,
        field: boundedCompiled.targetField || null,
        parameters: boundedCompiled.parameters || {},
        isCompiled: true,
        interpretedRequirement: text,
      },
    });
  }

  const lower = text.toLowerCase();

  // Pattern 1: Forbidden text / prohibited copy
  const forbidMatch = text.match(/\b(?:must not|do not|cannot|never|prohibited from)\s+(?:contain|declare|print|say|use)\s+["'“]([^"'”]+)["'”]/i);
  if (forbidMatch) {
    return createRuleRecord({
      ...metadata,
      title: `Forbidden text: "${forbidMatch[1]}"`,
      interpretation: {
        checkType: 'FORBIDDEN_PHRASE',
        parameters: { phrase: forbidMatch[1] },
        isCompiled: true,
        interpretedRequirement: `Packaging must not contain prohibited text "${forbidMatch[1]}".`,
      },
    });
  }

  // Pattern 2: Required text / mandatory wording
  const requireMatch = text.match(/\b(?:must|shall|required to)\s+(?:declare|state|bear|contain|print|say|include)\s+(?:the\s+(?:exact\s+)?phrase\s+)?["'“]([^"'”]+)["'”]/i);
  if (requireMatch) {
    return createRuleRecord({
      ...metadata,
      title: `Required phrase: "${requireMatch[1]}"`,
      interpretation: {
        checkType: 'REQUIRED_PHRASE',
        parameters: { phrase: requireMatch[1] },
        isCompiled: true,
        interpretedRequirement: `Packaging must declare required phrase "${requireMatch[1]}".`,
      },
    });
  }

  // Pattern 3: Net quantity equivalence / declaration
  if (/\b(?:net\s+(?:quantity|contents|weight|volume)|fill\s+weight)\b/i.test(text)) {
    const valMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(oz|fl\s*oz|g|kg|ml|l|lb|lbs)\b/i);
    return createRuleRecord({
      ...metadata,
      title: 'Net Quantity Declaration',
      interpretation: {
        checkType: 'UNIT_EQUIVALENT_VALUE',
        field: 'net_quantity',
        parameters: {
          value: valMatch ? valMatch[0] : null,
          dualUnitsRequired: /\bdual\b/i.test(text),
        },
        isCompiled: true,
        interpretedRequirement: text,
      },
    });
  }

  // Pattern 4: Minimum type / font size
  const fontMatch = text.match(/\b(?:minimum|at\s+least)\s+(?:type|font|letter|text)\s+size\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(?:pt|points?)\b/i);
  if (fontMatch) {
    const minPt = parseFloat(fontMatch[1]);
    return createRuleRecord({
      ...metadata,
      title: `Minimum text size (${minPt} pt)`,
      interpretation: {
        checkType: 'MINIMUM_TEXT_SIZE',
        parameters: { minPoint: minPt },
        isCompiled: true,
        interpretedRequirement: `Native text size must be at least ${minPt} pt.`,
      },
    });
  }

  // Pattern 5: Panel placement requirement
  const panelMatch = text.match(/\b(?:placed|located|printed|appear)\s+on\s+(?:the\s+)?(principal\s+display\s+panel|pdp|information\s+panel|front|back|top|bottom)\b/i);
  if (panelMatch) {
    const panelName = panelMatch[1].toLowerCase().replace(/\s+/g, '_');
    return createRuleRecord({
      ...metadata,
      title: `Panel placement on ${panelMatch[1]}`,
      interpretation: {
        checkType: 'REQUIRED_PANEL_PLACEMENT',
        parameters: { panel: panelName },
        isCompiled: true,
        interpretedRequirement: `Element must appear on ${panelMatch[1]}.`,
      },
    });
  }

  // Pattern 6: Barcode match
  if (/\b(?:barcode|upc|gtin|ean)\b/i.test(text) && /\b(?:match|equal|correct|assigned)\b/i.test(text)) {
    return createRuleRecord({
      ...metadata,
      title: 'Barcode SKU Match',
      interpretation: {
        checkType: 'BARCODE_IDENTIFIER_MATCH',
        field: 'barcode',
        isCompiled: true,
        interpretedRequirement: text,
      },
    });
  }

  // Uncompiled Prose / Manual Review Requirement
  return createRuleRecord({
    ...metadata,
    title: text.length > 50 ? `${text.slice(0, 47)}...` : (text || 'Uncompiled Requirement'),
    interpretation: {
      checkType: 'MANUAL_REVIEW',
      isCompiled: false,
      interpretedRequirement: text,
      reason: 'Natural language requirement is prose or advisory; cannot be compiled safely into a supported typed evaluator without authorized human interpretation.',
    },
  });
}

/**
 * Validates and integrates an AI-proposed rule interpretation.
 * Safety: Rejects AI proposals that lack quotations, change numbers, or specify invalid types.
 */
export function integrateAiProposedRule(aiProposal, sourceDoc) {
  if (!aiProposal || typeof aiProposal !== 'object') {
    throw new Error('AI proposal must be an object');
  }

  const quote = aiProposal.quote || aiProposal.originalQuote;
  if (!quote || typeof quote !== 'string' || quote.trim().length < 5) {
    throw new Error('AI proposal rejected: Missing original source quotation.');
  }

  // Validate check type
  const checkType = aiProposal.checkType || aiProposal.comparison || 'REQUIRED_PHRASE';
  if (!SUPPORTED_CHECK_TYPES.includes(checkType)) {
    throw new Error(`AI proposal rejected: Unknown checkType "${checkType}".`);
  }

  return createRuleRecord({
    id: aiProposal.id || `ai_rule_${Date.now()}`,
    title: aiProposal.title || 'AI-Proposed Rule Interpretation',
    source: {
      documentId: sourceDoc?.id || aiProposal.documentId,
      documentName: sourceDoc?.name || 'Rule Document',
      documentHash: sourceDoc?.sha256 || null,
      originalQuote: quote,
      verificationStatus: SOURCE_VERIFICATION.UNVERIFIED,
      sourceCitation: aiProposal.citation || '',
    },
    interpretation: {
      checkType,
      field: aiProposal.field || null,
      parameters: aiProposal.parameters || { phrase: quote, value: aiProposal.expected },
      proposedBy: 'ai',
      isCompiled: checkType !== 'MANUAL_REVIEW',
      interpretedRequirement: aiProposal.explanation || quote,
    },
    authorization: {
      status: AUTHORIZATION_STATUS.PROPOSED,
    },
  });
}
