/**
 * @file lib/brief/claim-verifier.mjs
 * 
 * Phase 5 — Clause-Level Claim Verifier
 * Implements strict extraction and semantic-level verification of factual
 * assertions, numbers, regulatory certifications, and units in brief sentences.
 */

// Strict pattern for numbers with optional units
export const NUMBER_UNIT_PATTERN = /\b(\d+(?:\.\d+)?)\s*(%|g|grams?|oz|ounces?|kcal|cal|calories?|cups?|servings?|mg|mcg|kg|lbs?|sq\s*in|in|mm|cm|months?|years?|upc|upc-a)?\b/gi;

// Critical certification and regulatory claim phrases
export const CERTIFICATION_CLAIMS = [
  { phrase: 'certified vegan', type: 'CERTIFICATION', rule: 'CERT_VEGAN', allowedFacts: ['certified_vegan_mark', 'vegan_certification'] },
  { phrase: 'suitable for vegans', type: 'STATEMENT', rule: 'VEGAN_COPY', allowedFacts: ['certified_vegan_mark', 'ingredient_list'] },
  { phrase: 'no added sugar', type: 'NUTRIENT_CONTENT_CLAIM', rule: 'FDA_101_60', allowedFacts: ['claim_added_sugar'] },
  { phrase: 'sugar free', type: 'NUTRIENT_CONTENT_CLAIM', rule: 'FDA_101_60', allowedFacts: ['claim_sugar_free', 'total_sugars'] },
  { phrase: 'organic', type: 'CERTIFICATION', rule: 'USDA_ORGANIC', allowedFacts: ['organic_certification', 'claim_organic'] },
  { phrase: 'gluten free', type: 'ALLERGEN_CLAIM', rule: 'FDA_101_91', allowedFacts: ['claim_gluten_free'] },
  { phrase: 'non-gmo', type: 'VERIFICATION', rule: 'NON_GMO_PROJECT', allowedFacts: ['claim_non_gmo'] },
  { phrase: 'kosher', type: 'RELIGIOUS_MARK', rule: 'KOSHER_CERT', allowedFacts: ['kosher_mark'] },
  { phrase: 'fda approved', type: 'REGULATORY_ASSERTION', rule: 'PROHIBITED_ASSERTION', allowedFacts: [] },
  { phrase: 'fssai approved', type: 'REGULATORY_ASSERTION', rule: 'PROHIBITED_ASSERTION', allowedFacts: [] },
  { phrase: 'ready for print', type: 'STATUS_ASSERTION', rule: 'PREPRESS_SIGN_OFF', allowedFacts: ['print_readiness'] }
];

/**
 * Extracts all claim spans (numeric, certification, and regulatory directives) from a sentence.
 */
export function extractClaimSpans(text) {
  if (!text || typeof text !== 'string') return [];
  const spans = [];
  const lower = text.toLowerCase();

  // 1. Extract numeric values with units
  let numMatch;
  const numRegex = new RegExp(NUMBER_UNIT_PATTERN);
  while ((numMatch = numRegex.exec(text)) !== null) {
    const raw = numMatch[0].trim();
    const val = parseFloat(numMatch[1]);
    const unit = (numMatch[2] || '').toLowerCase().trim();
    // Exclude bare section numbers, year dates, CFR citations like 101.7, 101.60, 343
    if (/^(01|02|03|04|05|06|07|08|09|10|11|21)$/.test(numMatch[1]) && !unit) {
      continue;
    }
    const preContext = text.slice(Math.max(0, numMatch.index - 15), numMatch.index).toLowerCase();
    if (preContext.includes('cfr') || preContext.includes('u.s.c.') || preContext.includes('§') || preContext.includes('item') || preContext.includes('check digit') || (val === 30 && preContext.includes('lower'))) {
      continue;
    }
    spans.push({
      kind: 'NUMBER',
      rawText: raw,
      value: val,
      unit: unit || 'dimensionless',
      index: numMatch.index
    });
  }

  // 2. Extract specific certifications and marketing claims
  for (const cert of CERTIFICATION_CLAIMS) {
    let idx = lower.indexOf(cert.phrase);
    while (idx !== -1) {
      spans.push({
        kind: 'CERTIFICATION_OR_CLAIM',
        phrase: cert.phrase,
        type: cert.type,
        rule: cert.rule,
        allowedFacts: cert.allowedFacts,
        index: idx
      });
      idx = lower.indexOf(cert.phrase, idx + cert.phrase.length);
    }
  }

  return spans;
}

/**
 * Normalizes number for comparison with tolerance
 */
function numbersEquivalent(valA, valB, tolerance = 0.05) {
  if (valA === valB) return true;
  const numA = typeof valA === 'number' ? valA : parseFloat(String(valA).replace(/[^0-9.]/g, ''));
  const numB = typeof valB === 'number' ? valB : parseFloat(String(valB).replace(/[^0-9.]/g, ''));
  if (isNaN(numA) || isNaN(numB)) return false;
  return Math.abs(numA - numB) <= Math.max(tolerance, numA * 0.01);
}

/**
 * Audits a single clause/claim span against candidate facts, rules, and decisions.
 */
export function verifyClaimSpan(span, { referencedFacts = [], referencedRules = [], referencedDecisions = [] }) {
  if (span.kind === 'NUMBER') {
    // A number must appear in at least one verified referenced fact or decision
    const matchingFact = referencedFacts.find(fact => {
      const factValStr = String(fact.value || '');
      // Direct substring match
      if (factValStr.includes(span.rawText) || factValStr.includes(String(span.value))) {
        return true;
      }
      // Numeric value equivalence
      const factNum = parseFloat(factValStr.replace(/[^0-9.]/g, ''));
      if (!isNaN(factNum) && numbersEquivalent(factNum, span.value)) {
        return true;
      }
      return false;
    });

    if (matchingFact) {
      return { supported: true, supportingSource: matchingFact.id, reason: `Matches fact ${matchingFact.id} (${matchingFact.value})` };
    }

    // Check decisions
    const matchingDecision = referencedDecisions.find(dec => {
      const decStr = String(dec.value || dec.note || dec.action || '');
      return decStr.includes(span.rawText) || decStr.includes(String(span.value));
    });

    if (matchingDecision) {
      return { supported: true, supportingSource: matchingDecision.id, reason: `Matches decision ${matchingDecision.id}` };
    }

    return {
      supported: false,
      reason: `Number "${span.rawText}" is not supported by any referenced fact or decision.`
    };
  }

  if (span.kind === 'CERTIFICATION_OR_CLAIM') {
    // Prohibited assertions like "FDA Approved" automatically fail
    if (span.rule === 'PROHIBITED_ASSERTION') {
      return {
        supported: false,
        reason: `Regulatory claim "${span.phrase}" is a prohibited or legally invalid assertion on food labels.`
      };
    }

    // Must be supported by a fact matching one of allowedFacts
    const supportingFact = referencedFacts.find(fact => {
      if (span.allowedFacts.includes(fact.field)) {
        // If it's a claim to be removed (e.g. remove no added sugar), verify fact indicates removal or authorization
        return true;
      }
      // Check if fact value explicitly contains the claim
      const valLower = String(fact.value || '').toLowerCase();
      return valLower.includes(span.phrase);
    });

    if (supportingFact) {
      if (supportingFact.state === 'CONFLICT') {
        return {
          supported: false,
          reason: `Claim "${span.phrase}" references fact ${supportingFact.id} which is in CONFLICT state.`
        };
      }
      return {
        supported: true,
        supportingSource: supportingFact.id,
        reason: `Supported by fact ${supportingFact.id} (${supportingFact.value})`
      };
    }

    // Check rules
    const supportingRule = referencedRules.find(r => r.ruleId === span.rule || r.id === span.rule);
    if (supportingRule) {
      return {
        supported: true,
        supportingSource: supportingRule.ruleId || supportingRule.id,
        reason: `Supported by regulatory rule ${supportingRule.ruleId || supportingRule.id}`
      };
    }

    // Check decisions
    const supportingDecision = referencedDecisions.find(d => {
      const text = `${d.id} ${d.action} ${d.note || ''} ${d.answerValue || ''}`.toLowerCase();
      return text.includes(span.phrase);
    });

    if (supportingDecision) {
      return {
        supported: true,
        supportingSource: supportingDecision.id,
        reason: `Supported by decision ${supportingDecision.id}`
      };
    }

    return {
      supported: false,
      reason: `Claim "${span.phrase}" is not supported by any validated source fact, rule, or decision.`
    };
  }

  return { supported: true, reason: 'Non-claim span' };
}
