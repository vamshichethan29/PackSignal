/**
 * PackSignal Bounded Rule Compiler (lib/rules/rule-compiler.mjs)
 * Implements Wave D: Advanced Deterministic Rule Compiler with Explicit Registry,
 * Typed AST Schema, Safe Compiler Dispatch, and Six Packaging Rule Families:
 * 1. BARCODE_GTIN_MATCH
 * 2. STATUTORY_SYMBOL_PRESENCE
 * 3. MULTILINGUAL_PAIR_REQUIREMENT
 * 4. MANUFACTURER_ADDRESS_DECLARATION
 * 5. STORAGE_INSTRUCTION_MANDATE
 * 6. NUTRIENT_CONTENT_CLAIM_LIMIT
 *
 * Safeguard: Never executes arbitrary model code, dynamic eval, or unapproved scripts.
 */

import { hasValidGtinCheckDigit, canonicalGtin } from '../gtin.mjs';

export const COMPILE_STATUS = Object.freeze({
  COMPILED_SUPPORTED: 'COMPILED_SUPPORTED',
  COMPILED_NEEDS_PARAMETERS: 'COMPILED_NEEDS_PARAMETERS',
  UNVERIFIED_SOURCE: 'UNVERIFIED_SOURCE',
  APPLICABILITY_UNRESOLVED: 'APPLICABILITY_UNRESOLVED',
  UNSUPPORTED: 'UNSUPPORTED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  REJECTED_INVALID: 'REJECTED_INVALID',
});

export const SUPPORTED_RULE_TYPES = Object.freeze([
  'REQUIRED_TEXT',
  'FORBIDDEN_TEXT',
  'EXACT_COPY',
  'QUANTITY_EQUIVALENCE',
  'NUMERIC_MINIMUM',
  'NUMERIC_MAXIMUM',
  'REQUIRED_FIELD',
  'NUTRIENT_DV',
  'FONT_SIZE_SCREEN',
  'PANEL_PLACEMENT',
  'CLAIM_REGISTER_LOOKUP',
  'MANUAL_REVIEW',
  // Six packaging rule families (Wave D)
  'BARCODE_GTIN_MATCH',
  'STATUTORY_SYMBOL_PRESENCE',
  'MULTILINGUAL_PAIR_REQUIREMENT',
  'MANUFACTURER_ADDRESS_DECLARATION',
  'STORAGE_INSTRUCTION_MANDATE',
  'NUTRIENT_CONTENT_CLAIM_LIMIT',
  // Backwards compatibility aliases
  'REQUIRED_EXACT_TEXT',
  'FORBIDDEN_EXACT_TEXT',
  'FONT_MINIMUM',
  'INGREDIENT_COMPARISON',
  'ALLERGEN_DECLARATION',
]);

/**
 * Normalizes rule text: handles multiline paragraphs, wrapped PDF lines, and Unicode quotes.
 */
export function normalizeRuleProse(raw) {
  return String(raw || '')
    .normalize('NFKC')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Explicit registry for safe compiler dispatch.
 */
export const RULE_REGISTRY = {
  // --- Six Wave D Packaging Rule Families ---

  BARCODE_GTIN_MATCH: {
    type: 'BARCODE_GTIN_MATCH',
    defaultReviewDomain: 'prepress',
    supportedParameters: ['expectedGtin', 'expectedSourceId', 'symbology', 'requireCheckDigit'],
    requiredEvidence: ['artwork_barcode', 'spec_gtin'],
    recognizer: (text, lower, metadata) => {
      // Must not match if future revision or non-binding proposal
      if (/\b(?:barcode|gtin|ean|upc)\b/i.test(lower) && /\b(?:match|approved|master|sku|retail pack|code|identifier|specification)\b/i.test(lower)) {
        return {
          matched: true,
          candidateType: 'BARCODE_GTIN_MATCH',
          matchedText: text,
          reason: 'Text specifies barcode identifier match against approved SKU/master GTIN.',
        };
      }
      return { matched: false };
    },
    parser: (candidate, metadata) => {
      const text = candidate.matchedText;
      const lower = text.toLowerCase();
      const inlineGtin = text.match(/\b(\d{8}|\d{12}|\d{13}|\d{14})\b/)?.[1] || null;

      let symbology = 'EAN-13';
      if (/upc-?a/i.test(lower)) symbology = 'UPC-A';
      else if (/upc-?e/i.test(lower)) symbology = 'UPC-E';
      else if (/ean-?8|gtin-?8/i.test(lower)) symbology = 'EAN-8';
      else if (/gtin-?14|itf-?14/i.test(lower)) symbology = 'GTIN-14';
      else if (/gtin-?12/i.test(lower)) symbology = 'GTIN-12';
      else if (/gs1\s*datamatrix/i.test(lower)) symbology = 'GS1 DataMatrix';
      else if (/gs1-?128/i.test(lower)) symbology = 'GS1-128';

      return {
        expectedGtin: inlineGtin || metadata.expectedGtin || null,
        expectedSourceId: metadata.sourceDocumentId || null,
        symbology,
        requireCheckDigit: true,
      };
    },
    validator: (parameters, metadata) => {
      const errors = [];
      const warnings = [];
      if (parameters.expectedGtin) {
        if (!hasValidGtinCheckDigit(parameters.expectedGtin)) {
          errors.push(`Inline expected GTIN "${parameters.expectedGtin}" fails GS1 Mod-10 check digit algorithm.`);
        }
      } else {
        warnings.push('Expected GTIN not found inline in rule text; will resolve from approved specification facts at runtime.');
      }
      return {
        valid: errors.length === 0,
        errors,
        warnings,
        compileStatus: errors.length > 0
          ? COMPILE_STATUS.REJECTED_INVALID
          : (parameters.expectedGtin ? COMPILE_STATUS.COMPILED_SUPPORTED : COMPILE_STATUS.COMPILED_NEEDS_PARAMETERS),
      };
    },
    evaluatorId: 'barcode_identifier_match',
  },

  STATUTORY_SYMBOL_PRESENCE: {
    type: 'STATUTORY_SYMBOL_PRESENCE',
    defaultReviewDomain: 'legal',
    supportedParameters: ['symbolId', 'category', 'jurisdiction', 'requiredShape', 'requiredColor', 'requiredPanelRoles', 'minimumDimensions'],
    requiredEvidence: ['symbol_geometry', 'visual_symbol_evidence', 'certificate_doc'],
    recognizer: (text, lower, metadata) => {
      if (/\b(?:vegetarian|non-vegetarian|non-veg|veg mark|green dot|brown triangle|statutory symbol|fssai symbol)\b/i.test(lower) &&
          /\b(?:symbol|mark|logo|display|prescribed|mandatory|required|bear)\b/i.test(lower)) {
        return {
          matched: true,
          candidateType: 'STATUTORY_SYMBOL_PRESENCE',
          matchedText: text,
          reason: 'Text specifies mandatory statutory symbol presence (e.g. FSSAI vegetarian/non-vegetarian mark).',
        };
      }
      return { matched: false };
    },
    parser: (candidate, metadata) => {
      const text = candidate.matchedText;
      const lower = text.toLowerCase();
      const isNonVeg = /\b(?:non-vegetarian|non-veg|brown triangle)\b/i.test(lower);
      const isVoluntary = /\b(?:voluntary|certification|organic|halal|kosher|fair trade)\b/i.test(lower);

      return {
        symbolId: isNonVeg ? 'FSSAI_NONVEG' : 'FSSAI_VEGETARIAN',
        symbolName: isNonVeg ? 'FSSAI Non-Vegetarian Mark' : 'FSSAI Vegetarian Mark',
        category: isVoluntary ? 'VOLUNTARY_MARK' : 'STATUTORY_SYMBOL',
        symbolType: isVoluntary ? 'VOLUNTARY_CERTIFICATION' : 'STATUTORY_SYMBOL',
        jurisdiction: 'IN',
        requiredShape: isNonVeg ? 'triangle_in_square' : 'circle_in_square',
        requiredColor: isNonVeg ? 'brown' : 'green',
        requiredPanelRoles: ['pdp', 'front'],
        minimumDimensions: null,
      };
    },
    validator: (parameters, metadata) => {
      return {
        valid: true,
        errors: [],
        warnings: [],
        compileStatus: COMPILE_STATUS.COMPILED_SUPPORTED,
      };
    },
    evaluatorId: 'symbol_presence_checker',
  },

  MULTILINGUAL_PAIR_REQUIREMENT: {
    type: 'MULTILINGUAL_PAIR_REQUIREMENT',
    defaultReviewDomain: 'legal',
    supportedParameters: ['languages', 'requiredFields', 'jurisdiction', 'exemptions', 'translationAuthority', 'semanticEquivalenceRequired'],
    requiredEvidence: ['artwork_text', 'approved_glossary_pair'],
    recognizer: (text, lower, metadata) => {
      if (/\b(?:bilingual|multilingual|english and french|french translation|parallel language)\b/i.test(lower) &&
          /\b(?:required|mandatory|packaging|label|common name|ingredients|retail pack)\b/i.test(lower)) {
        return {
          matched: true,
          candidateType: 'MULTILINGUAL_PAIR_REQUIREMENT',
          matchedText: text,
          reason: 'Text specifies bilingual / multilingual parallel labeling requirement (e.g. Canadian English/French).',
        };
      }
      return { matched: false };
    },
    parser: (candidate, metadata) => {
      const text = candidate.matchedText;
      const lower = text.toLowerCase();
      const fields = [];
      if (/common\s*name/i.test(lower)) fields.push('common_name');
      if (/ingredient/i.test(lower)) fields.push('ingredients');
      if (/net\s*quantity|net\s*wt/i.test(lower)) fields.push('net_quantity');
      if (!fields.length) fields.push('common_name', 'ingredients');

      const isExempt = /\b(?:exempt|exemption|single-language market|local product exemption)\b/i.test(lower);

      return {
        languages: ['en', 'fr'],
        primaryLanguage: 'English',
        secondaryLanguage: 'French',
        requiredFields: fields,
        jurisdiction: 'CA',
        exemptions: isExempt ? ['local_statute_exemption'] : [],
        exemptionStatus: isExempt ? 'EXEMPT' : 'ACTIVE',
        translationAuthority: 'approved glossary',
        semanticEquivalenceRequired: true,
        primaryPhrase: metadata.primaryPhrase || null,
        secondaryPhrase: metadata.secondaryPhrase || null,
      };
    },
    validator: (parameters, metadata) => {
      return {
        valid: true,
        errors: [],
        warnings: [],
        compileStatus: COMPILE_STATUS.COMPILED_SUPPORTED,
      };
    },
    evaluatorId: 'multilingual_field_checker',
  },

  MANUFACTURER_ADDRESS_DECLARATION: {
    type: 'MANUFACTURER_ADDRESS_DECLARATION',
    defaultReviewDomain: 'legal',
    supportedParameters: ['requiredEntityRole', 'approvedEntitySourceId', 'requiredFields', 'allowedPanelRoles', 'ruleJurisdiction', 'permittedExceptions'],
    requiredEvidence: ['artwork_text', 'approved_business_fact'],
    recognizer: (text, lower, metadata) => {
      if (/\b(?:manufactured by|distributed by|produced for|packer|manufacturer|distributor|business declaration|21 cfr 101\.5)\b/i.test(lower) &&
          /\b(?:address|name and address|city|state|zip|postal|place of business|declaration)\b/i.test(lower)) {
        return {
          matched: true,
          candidateType: 'MANUFACTURER_ADDRESS_DECLARATION',
          matchedText: text,
          reason: 'Text specifies manufacturer / distributor business address declaration under 21 CFR 101.5.',
        };
      }
      return { matched: false };
    },
    parser: (candidate, metadata) => {
      const text = candidate.matchedText;
      const lower = text.toLowerCase();
      const isDistributor = /\bdistributor|distributed by|produced for|packed for\b/i.test(lower);
      const directoryExemption = /\b(?:telephone directory|city directory|directory exception|directory listing)\b/i.test(lower);

      return {
        requiredEntityRole: isDistributor ? 'distributor' : 'manufacturer_or_distributor',
        approvedEntitySourceId: metadata.sourceDocumentId || null,
        requiredFields: ['name', 'city', 'state', 'postal_code'],
        allowedPanelRoles: ['information_panel', 'pdp', 'back'],
        ruleJurisdiction: 'US',
        permittedExceptions: ['telephone_directory_street_omission'],
        telephoneDirectoryExemption: directoryExemption,
      };
    },
    validator: (parameters, metadata) => {
      return {
        valid: true,
        errors: [],
        warnings: [],
        compileStatus: COMPILE_STATUS.COMPILED_SUPPORTED,
      };
    },
    evaluatorId: 'business_declaration_checker',
  },

  STORAGE_INSTRUCTION_MANDATE: {
    type: 'STORAGE_INSTRUCTION_MANDATE',
    defaultReviewDomain: 'rd',
    supportedParameters: ['requiredStatement', 'equivalentPhrases', 'condition', 'storageState', 'requiredPanelRoles', 'sourceFieldId', 'semanticTolerance'],
    requiredEvidence: ['artwork_text', 'specification_storage_regime'],
    recognizer: (text, lower, metadata) => {
      if (/\b(?:refrigerate|keep refrigerated|keep frozen|frozen until use|store below|store in a cool|dry place|storage condition|storage instruction)\b/i.test(lower) &&
          /\b(?:must|shall|required|keep|store|condition|instruction|after opening)\b/i.test(lower)) {
        return {
          matched: true,
          candidateType: 'STORAGE_INSTRUCTION_MANDATE',
          matchedText: text,
          reason: 'Text specifies packaging storage or thermal regime handling condition.',
        };
      }
      return { matched: false };
    },
    parser: (candidate, metadata) => {
      const text = candidate.matchedText;
      const lower = text.toLowerCase();
      let stmt = 'Refrigerate after opening.';
      let cond = 'after_opening';
      let storageState = 'REFRIGERATED';
      let equivs = ['keep refrigerated after opening', 'refrigerate once opened', 'keep refrigerated'];

      if (/below\s*(\d+)\s*°?\s*c/i.test(lower)) {
        const deg = lower.match(/below\s*(\d+)\s*°?\s*c/i)[1];
        stmt = `Store below ${deg}°C.`;
        cond = 'temperature';
        storageState = 'REFRIGERATED';
        equivs = [`keep below ${deg}°c`, `store under ${deg}°c`, `below ${deg} c`];
      } else if (/keep\s*frozen|store\s*frozen|-18\s*°?c/i.test(lower)) {
        stmt = 'Keep frozen until use.';
        cond = 'freezing';
        storageState = 'FROZEN';
        equivs = ['store frozen', 'keep frozen', 'keep frozen until use'];
      } else if (/cool[,\s]+dry\s*place|ambient/i.test(lower)) {
        stmt = 'Store in a cool, dry place.';
        cond = 'dry_storage';
        storageState = 'DRY';
        equivs = ['keep in a cool dry place', 'store in dry place', 'store in a cool, dry place'];
      }

      return {
        requiredStatement: stmt,
        requiredWording: stmt,
        equivalentPhrases: equivs,
        condition: cond,
        storageState,
        requiredPanelRoles: [],
        sourceFieldId: 'storage_instructions',
        semanticTolerance: 'exact_or_approved',
      };
    },
    validator: (parameters, metadata) => {
      return {
        valid: true,
        errors: [],
        warnings: [],
        compileStatus: COMPILE_STATUS.COMPILED_SUPPORTED,
      };
    },
    evaluatorId: 'storage_instruction_checker',
  },

  NUTRIENT_CONTENT_CLAIM_LIMIT: {
    type: 'NUTRIENT_CONTENT_CLAIM_LIMIT',
    defaultReviewDomain: 'legal',
    supportedParameters: ['claimId', 'claimType', 'nutrient', 'unit', 'threshold', 'comparator', 'measurementBasis', 'jurisdiction', 'productCategory'],
    requiredEvidence: ['nutrition_facts_panel', 'racc_reference', 'sodium_quantity'],
    recognizer: (text, lower, metadata) => {
      if (/\b(?:low sodium|sodium free|very low sodium|reduced sodium|low fat|fat free|sugar free)\b/i.test(lower)) {
        return {
          matched: true,
          candidateType: 'NUTRIENT_CONTENT_CLAIM_LIMIT',
          matchedText: text,
          reason: 'Text specifies quantitative nutrient content claim ceiling under 21 CFR 101.61 or related profiles.',
        };
      }
      return { matched: false };
    },
    parser: (candidate, metadata) => {
      const text = candidate.matchedText;
      const lower = text.toLowerCase();
      let claimId = 'US_LOW_SODIUM';
      let claimType = 'LOW_SODIUM';
      let nutrient = 'sodium';
      let unit = 'mg';
      let threshold = 140;
      let measurementBasis = 'RACC';

      if (/sodium free/i.test(lower)) {
        claimId = 'US_SODIUM_FREE';
        claimType = 'SODIUM_FREE';
        threshold = 5;
      } else if (/very low sodium/i.test(lower)) {
        claimId = 'US_VERY_LOW_SODIUM';
        claimType = 'VERY_LOW_SODIUM';
        threshold = 35;
      } else if (/low fat/i.test(lower)) {
        claimId = 'US_LOW_FAT';
        claimType = 'LOW_FAT';
        nutrient = 'fat';
        unit = 'g';
        threshold = 3;
      } else if (/fat free/i.test(lower)) {
        claimId = 'US_FAT_FREE';
        claimType = 'FAT_FREE';
        nutrient = 'fat';
        unit = 'g';
        threshold = 0.5;
      } else if (/sugar free/i.test(lower)) {
        claimId = 'US_SUGAR_FREE';
        claimType = 'SUGAR_FREE';
        nutrient = 'sugars';
        unit = 'g';
        threshold = 0.5;
      }

      if (/per 50\s*g|small racc/i.test(lower)) {
        measurementBasis = '50g';
      } else if (/meal product|main dish|per 100\s*g/i.test(lower)) {
        measurementBasis = '100g';
      }

      return {
        claimId,
        claimType,
        nutrient,
        unit,
        threshold,
        comparator: 'LTE',
        measurementBasis,
        additionalConditions: [],
        jurisdiction: 'US',
        productCategory: 'food',
        verifiedSourceId: metadata.sourceDocumentId || null,
      };
    },
    validator: (parameters, metadata) => {
      return {
        valid: true,
        errors: [],
        warnings: [],
        compileStatus: COMPILE_STATUS.COMPILED_SUPPORTED,
      };
    },
    evaluatorId: 'nutrient_claim_checker',
  },

  // --- Baseline 11 Rule Types ---

  REQUIRED_EXACT_TEXT: {
    type: 'REQUIRED_EXACT_TEXT',
    defaultReviewDomain: 'brand',
    supportedParameters: ['phrase'],
    requiredEvidence: ['artwork_text'],
    recognizer: (text, lower) => {
      const match = text.match(/\b(?:must|shall|required to)\s+(?:contain|declare|state|print|read)\s+["'“]([^"'”]+)["'”]/i);
      return match ? { matched: true, candidateType: 'REQUIRED_EXACT_TEXT', matchedText: text, phrase: match[1] } : { matched: false };
    },
    parser: candidate => ({ phrase: candidate.phrase, requiredText: candidate.phrase }),
    validator: params => ({ valid: Boolean(params.phrase), compileStatus: COMPILE_STATUS.COMPILED_SUPPORTED }),
    evaluatorId: 'exact_phrase_checker',
  },

  FORBIDDEN_EXACT_TEXT: {
    type: 'FORBIDDEN_EXACT_TEXT',
    defaultReviewDomain: 'legal',
    supportedParameters: ['phrase'],
    requiredEvidence: ['artwork_text'],
    recognizer: (text, lower) => {
      const match = text.match(/\b(?:must not|do not|cannot|never|prohibited from)\s+(?:contain|declare|print|say|use)\s+["'“]([^"'”]+)["'”]/i);
      return match ? { matched: true, candidateType: 'FORBIDDEN_EXACT_TEXT', matchedText: text, phrase: match[1] } : { matched: false };
    },
    parser: candidate => ({ phrase: candidate.phrase, forbiddenText: candidate.phrase }),
    validator: params => ({ valid: Boolean(params.phrase), compileStatus: COMPILE_STATUS.COMPILED_SUPPORTED }),
    evaluatorId: 'forbidden_phrase_checker',
  },

  NUMERIC_MINIMUM: {
    type: 'NUMERIC_MINIMUM',
    defaultReviewDomain: 'regulatory',
    supportedParameters: ['threshold', 'unit'],
    requiredEvidence: ['numeric_fact'],
    recognizer: (text, lower) => {
      const match = text.match(/\b(?:minimum|at least|no less than|greater than)\s+(\d+(?:\.\d+)?)\s*([a-z%]+)?/i);
      return match ? { matched: true, candidateType: 'NUMERIC_MINIMUM', matchedText: text, threshold: Number(match[1]), unit: match[2] || '' } : { matched: false };
    },
    parser: candidate => ({ threshold: candidate.threshold, unit: candidate.unit }),
    validator: params => ({ valid: Number.isFinite(params.threshold), compileStatus: COMPILE_STATUS.COMPILED_SUPPORTED }),
    evaluatorId: 'numeric_threshold_checker',
  },

  NUMERIC_MAXIMUM: {
    type: 'NUMERIC_MAXIMUM',
    defaultReviewDomain: 'regulatory',
    supportedParameters: ['threshold', 'unit'],
    requiredEvidence: ['numeric_fact'],
    recognizer: (text, lower) => {
      const match = text.match(/\b(?:maximum|at most|no more than|less than|not exceed)\s+(\d+(?:\.\d+)?)\s*([a-z%]+)?/i);
      return match ? { matched: true, candidateType: 'NUMERIC_MAXIMUM', matchedText: text, threshold: Number(match[1]), unit: match[2] || '' } : { matched: false };
    },
    parser: candidate => ({ threshold: candidate.threshold, unit: candidate.unit }),
    validator: params => ({ valid: Number.isFinite(params.threshold), compileStatus: COMPILE_STATUS.COMPILED_SUPPORTED }),
    evaluatorId: 'numeric_threshold_checker',
  },

  QUANTITY_EQUIVALENCE: {
    type: 'QUANTITY_EQUIVALENCE',
    defaultReviewDomain: 'regulatory',
    supportedParameters: ['field'],
    requiredEvidence: ['specification_net_quantity', 'artwork_net_quantity'],
    recognizer: (text, lower) => {
      const match = /net\s*quantity|net\s*weight|package\s*size|contents/i.test(lower) && /match|equivalent|dual/i.test(lower);
      return match ? { matched: true, candidateType: 'QUANTITY_EQUIVALENCE', matchedText: text } : { matched: false };
    },
    parser: () => ({ field: 'net_quantity' }),
    validator: () => ({ valid: true, compileStatus: COMPILE_STATUS.COMPILED_SUPPORTED }),
    evaluatorId: 'quantity_equivalence_checker',
  },

  INGREDIENT_COMPARISON: {
    type: 'INGREDIENT_COMPARISON',
    defaultReviewDomain: 'regulatory',
    supportedParameters: ['field'],
    requiredEvidence: ['formulation_ingredients', 'artwork_ingredients'],
    recognizer: (text, lower) => {
      const match = /ingredient/i.test(lower) && /order|descending|predominance|match|formulation/i.test(lower);
      return match ? { matched: true, candidateType: 'INGREDIENT_COMPARISON', matchedText: text } : { matched: false };
    },
    parser: () => ({ field: 'ingredients' }),
    validator: () => ({ valid: true, compileStatus: COMPILE_STATUS.COMPILED_SUPPORTED }),
    evaluatorId: 'ingredient_declaration_checker',
  },

  ALLERGEN_DECLARATION: {
    type: 'ALLERGEN_DECLARATION',
    defaultReviewDomain: 'regulatory',
    supportedParameters: ['field'],
    requiredEvidence: ['formulation_allergens', 'artwork_allergen_statement'],
    recognizer: (text, lower) => {
      const match = /allergen|falcpa|faster\s*act|contains\s*statement/i.test(lower);
      return match ? { matched: true, candidateType: 'ALLERGEN_DECLARATION', matchedText: text } : { matched: false };
    },
    parser: () => ({ field: 'allergens' }),
    validator: () => ({ valid: true, compileStatus: COMPILE_STATUS.COMPILED_SUPPORTED }),
    evaluatorId: 'allergen_disclosure_checker',
  },

  NUTRIENT_DV: {
    type: 'NUTRIENT_DV',
    defaultReviewDomain: 'regulatory',
    supportedParameters: ['field'],
    requiredEvidence: ['nutrition_dv_table'],
    recognizer: (text, lower) => {
      const match = /%?\s*(?:daily\s*value|dv|rda)/i.test(lower);
      return match ? { matched: true, candidateType: 'NUTRIENT_DV', matchedText: text } : { matched: false };
    },
    parser: () => ({ field: 'nutrition' }),
    validator: () => ({ valid: true, compileStatus: COMPILE_STATUS.COMPILED_SUPPORTED }),
    evaluatorId: 'daily_value_arithmetic_checker',
  },

  PANEL_PLACEMENT: {
    type: 'PANEL_PLACEMENT',
    defaultReviewDomain: 'prepress',
    supportedParameters: ['panel'],
    requiredEvidence: ['dieline_panels', 'artwork_zone'],
    recognizer: (text, lower) => {
      const match = text.match(/\b(?:on the|placed on|located on)\s+(front|back|pdp|principal display panel|top|bottom|side|left|right)\s+panel/i);
      return match ? { matched: true, candidateType: 'PANEL_PLACEMENT', matchedText: text, panel: match[1].toLowerCase() } : { matched: false };
    },
    parser: candidate => ({ panel: candidate.panel }),
    validator: params => ({ valid: Boolean(params.panel), compileStatus: COMPILE_STATUS.COMPILED_SUPPORTED }),
    evaluatorId: 'panel_geometry_checker',
  },

  FONT_MINIMUM: {
    type: 'FONT_MINIMUM',
    defaultReviewDomain: 'prepress',
    supportedParameters: ['minPt'],
    requiredEvidence: ['vector_font_inspection'],
    recognizer: (text, lower) => {
      const match = text.match(/(\d+(?:\.\d+)?)\s*(?:pt|point|mm|inch)\s*(?:font|type|minimum|size)/i);
      return match ? { matched: true, candidateType: 'FONT_MINIMUM', matchedText: text, minPt: Number(match[1]) } : { matched: false };
    },
    parser: candidate => ({ minPt: candidate.minPt }),
    validator: params => ({ valid: Number.isFinite(params.minPt), compileStatus: COMPILE_STATUS.COMPILED_SUPPORTED }),
    evaluatorId: 'typography_inspector',
  },

  CLAIM_REGISTER_LOOKUP: {
    type: 'CLAIM_REGISTER_LOOKUP',
    defaultReviewDomain: 'legal',
    supportedParameters: ['register'],
    requiredEvidence: ['claim_register_database'],
    recognizer: (text, lower) => {
      const match = /claim|certification|registered claim|tagline/i.test(lower) && /register|allowed|approved|substantiat/i.test(lower);
      return match ? { matched: true, candidateType: 'CLAIM_REGISTER_LOOKUP', matchedText: text } : { matched: false };
    },
    parser: () => ({ register: 'claims' }),
    validator: () => ({ valid: true, compileStatus: COMPILE_STATUS.COMPILED_SUPPORTED }),
    evaluatorId: 'claim_register_checker',
  },

  REQUIRED_FIELD: {
    type: 'REQUIRED_FIELD',
    defaultReviewDomain: 'regulatory',
    supportedParameters: ['field'],
    requiredEvidence: ['artwork_copy'],
    recognizer: (text, lower) => {
      const match = text.match(/\b(?:mandatory|required)\s+(?:field|declaration|element)\s+([a-z0-9_]+)/i);
      return match ? { matched: true, candidateType: 'REQUIRED_FIELD', matchedText: text, field: match[1].toLowerCase() } : { matched: false };
    },
    parser: candidate => ({ field: candidate.field }),
    validator: params => ({ valid: Boolean(params.field), compileStatus: COMPILE_STATUS.COMPILED_SUPPORTED }),
    evaluatorId: 'field_presence_checker',
  },
};

/**
 * Attempts to compile a natural-language requirement into a typed executable check.
 * Strictly adheres to Phase D1 AST schema and Phase D2 safe registry dispatch.
 */
export function compileRuleRequirement(ruleInput, metadata = {}) {
  let ruleId = metadata.id || metadata.ruleId || `rule_${Date.now()}`;
  let sourceDocId = metadata.sourceDocumentId || metadata.documentId || null;
  let sourceDocHash = metadata.sourceDocumentHash || metadata.documentHash || null;
  let sourceLocation = metadata.sourceLocation || null;
  let sourceQuotation = '';
  let quotationVerified = Boolean(metadata.quotationVerified);
  let ruleAuthority = metadata.ruleAuthority || metadata.authority || 'COMPANY_SPEC';
  let authorizationStatus = metadata.authorizationStatus || 'PROPOSED';
  let legalStatus = metadata.legalStatus || 'STATUTORY';
  let jurisdiction = metadata.jurisdiction || 'US';
  let productCategory = metadata.productCategory || 'food';
  let effectiveDate = metadata.effectiveDate || null;
  let rawText = '';

  if (typeof ruleInput === 'object' && ruleInput !== null) {
    ruleId = ruleInput.id || ruleInput.ruleId || ruleId;
    sourceDocId = ruleInput.sourceDocumentId || ruleInput.documentId || sourceDocId;
    sourceDocHash = ruleInput.sourceDocumentHash || ruleInput.documentHash || sourceDocHash;
    sourceLocation = ruleInput.sourceLocation || sourceLocation;
    sourceQuotation = ruleInput.sourceQuotation || ruleInput.originalQuote || ruleInput.quote || '';
    quotationVerified = ruleInput.quotationVerified !== undefined ? ruleInput.quotationVerified : quotationVerified;
    ruleAuthority = ruleInput.ruleAuthority || ruleAuthority;
    authorizationStatus = ruleInput.authorizationStatus || authorizationStatus;
    legalStatus = ruleInput.legalStatus || legalStatus;
    jurisdiction = ruleInput.jurisdiction || jurisdiction;
    productCategory = ruleInput.productCategory || productCategory;
    effectiveDate = ruleInput.effectiveDate || effectiveDate;

    // If already typed structured rule
    const declaredType = ruleInput.type ||
      ruleInput.checkType ||
      (ruleInput.symbolType || ruleInput.symbolName ? 'STATUTORY_SYMBOL_PRESENCE' : null) ||
      (ruleInput.primaryLanguage || ruleInput.languages ? 'MULTILINGUAL_PAIR_REQUIREMENT' : null) ||
      (ruleInput.claimType ? 'NUTRIENT_CONTENT_CLAIM_LIMIT' : null) ||
      (ruleInput.storageState ? 'STORAGE_INSTRUCTION_MANDATE' : null);
    if (declaredType && SUPPORTED_RULE_TYPES.includes(declaredType)) {
      const reg = RULE_REGISTRY[declaredType];
      return {
        ...ruleInput,
        ruleId,
        ruleType: declaredType,
        type: declaredType,
        sourceDocumentId: sourceDocId,
        sourceDocumentHash: sourceDocHash,
        sourceLocation,
        sourceQuotation: sourceQuotation || ruleInput.text || '',
        quotationVerified,
        ruleAuthority,
        authorizationStatus,
        legalStatus,
        jurisdiction,
        productCategory,
        effectiveDate,
        applicability: ruleInput.applicability || 'APPLICABLE',
        parameters: ruleInput.parameters || {},
        evaluatorId: ruleInput.evaluatorId || ruleInput.evaluator || reg?.evaluatorId || 'typed_evaluator',
        evaluator: ruleInput.evaluator || reg?.evaluatorId || 'typed_evaluator',
        compileStatus: declaredType === 'MANUAL_REVIEW' ? COMPILE_STATUS.MANUAL_REVIEW : COMPILE_STATUS.COMPILED_SUPPORTED,
        compileDiagnostics: [],
        limitations: ruleInput.limitations || [],
        isCompiled: declaredType !== 'MANUAL_REVIEW',
        targetField: ruleInput.targetField || ruleInput.parameters?.field,
        targetPhrase: ruleInput.parameters?.requiredText || ruleInput.parameters?.phrase,
      };
    }

    metadata = { ...ruleInput, ...metadata };
    rawText = ruleInput.ruleText || ruleInput.requirement || ruleInput.naturalText || ruleInput.text || '';
    sourceQuotation = sourceQuotation || rawText;
  } else {
    rawText = String(ruleInput || '');
    sourceQuotation = rawText;
  }

  const cleanText = normalizeRuleProse(rawText);
  const lower = cleanText.toLowerCase();

  // Safety Gate 1: Non-binding proposals, future considerations, or under review
  if (/\b(?:under review|will be considered|future revision|proposed amendment|voluntary guideline|non-binding|draft recommendation|is under review)\b/i.test(lower)) {
    return {
      ruleId,
      ruleType: 'MANUAL_REVIEW',
      type: 'MANUAL_REVIEW',
      sourceDocumentId: sourceDocId,
      sourceDocumentHash: sourceDocHash,
      sourceLocation,
      sourceQuotation,
      quotationVerified,
      ruleAuthority,
      authorizationStatus: 'PROPOSED',
      legalStatus: 'UNCONFIRMED',
      jurisdiction,
      productCategory,
      effectiveDate,
      applicability: 'UNDETERMINED',
      parameters: {},
      evaluatorId: 'human_manual_review',
      evaluator: 'human_manual_review',
      compileStatus: COMPILE_STATUS.MANUAL_REVIEW,
      compileDiagnostics: ['Rule text expresses proposed or future policy, not an active binding legal mandate.'],
      limitations: ['Non-binding or unratified proposed rule; execution deferred to manual human review.'],
      isCompiled: false,
      status: 'PROPOSED_NONBINDING',
      reason: 'Rule text is a non-binding proposal or under future revision. Execution deferred to manual review.',
      explanation: 'The requirement expresses proposed or future policy, not an active binding legal mandate.',
    };
  }

  // Safety Gate 2: Explicit exemptions, negative instructions, voluntary permissions
  if (/\b(?:do not require|not required to bear|not required to display|exempt from displaying|optional to include|may be used if certified|organic logo may be used if certified)\b/i.test(lower)) {
    return {
      ruleId,
      ruleType: 'MANUAL_REVIEW',
      type: 'MANUAL_REVIEW',
      sourceDocumentId: sourceDocId,
      sourceDocumentHash: sourceDocHash,
      sourceLocation,
      sourceQuotation,
      quotationVerified,
      ruleAuthority,
      authorizationStatus,
      legalStatus: 'VOLUNTARY',
      jurisdiction,
      productCategory,
      effectiveDate,
      applicability: 'NOT_APPLICABLE',
      parameters: {},
      evaluatorId: 'human_manual_review',
      evaluator: 'human_manual_review',
      compileStatus: COMPILE_STATUS.MANUAL_REVIEW,
      compileDiagnostics: ['Requirement describes an exemption or voluntary condition. Cannot execute as a mandatory violation check.'],
      limitations: ['Exemption or permissive rule requires human interpretation.'],
      isCompiled: false,
      status: 'EXEMPTION_OR_VOLUNTARY',
      reason: 'Requirement specifies an exemption or voluntary permission rather than an unconditional mandate.',
      explanation: 'Text describes an exemption or optional permissive condition. Cannot execute as a mandatory violation check.',
    };
  }

  // Registry Dispatch: Evaluate candidate rules safely
  // Ordered by precision: 6 Wave D packaging families first, then baseline regex patterns
  const candidateOrder = [
    'BARCODE_GTIN_MATCH',
    'STATUTORY_SYMBOL_PRESENCE',
    'MULTILINGUAL_PAIR_REQUIREMENT',
    'MANUFACTURER_ADDRESS_DECLARATION',
    'STORAGE_INSTRUCTION_MANDATE',
    'NUTRIENT_CONTENT_CLAIM_LIMIT',
    'FORBIDDEN_EXACT_TEXT',
    'REQUIRED_EXACT_TEXT',
    'NUMERIC_MINIMUM',
    'NUMERIC_MAXIMUM',
    'QUANTITY_EQUIVALENCE',
    'INGREDIENT_COMPARISON',
    'ALLERGEN_DECLARATION',
    'NUTRIENT_DV',
    'PANEL_PLACEMENT',
    'FONT_MINIMUM',
    'CLAIM_REGISTER_LOOKUP',
    'REQUIRED_FIELD',
  ];

  for (const type of candidateOrder) {
    const entry = RULE_REGISTRY[type];
    if (!entry) continue;

    const rec = entry.recognizer(cleanText, lower, metadata);
    if (rec.matched) {
      const parsedParams = entry.parser(rec, metadata);
      const val = entry.validator(parsedParams, metadata);

      const ast = {
        ruleId,
        ruleType: entry.type,
        type: entry.type,
        sourceDocumentId: sourceDocId,
        sourceDocumentHash: sourceDocHash,
        sourceLocation,
        sourceQuotation,
        quotationVerified,
        ruleAuthority,
        authorizationStatus,
        legalStatus,
        jurisdiction,
        productCategory,
        effectiveDate,
        applicability: 'APPLICABLE',
        parameters: parsedParams,
        evaluatorId: entry.evaluatorId,
        evaluator: entry.evaluatorId,
        compileStatus: val.compileStatus || COMPILE_STATUS.COMPILED_SUPPORTED,
        compileDiagnostics: (val.errors || []).concat(val.warnings || []),
        limitations: [],
        isCompiled: val.compileStatus === COMPILE_STATUS.COMPILED_SUPPORTED,
        defaultReviewDomain: entry.defaultReviewDomain,

        // Backwards compatibility convenience properties
        targetField: parsedParams.field || parsedParams.targetField,
        targetPhrase: parsedParams.phrase || parsedParams.requiredText,
        threshold: parsedParams.threshold,
        unit: parsedParams.unit,
        minPt: parsedParams.minPt,
        symbolName: parsedParams.symbolName,
        symbolType: parsedParams.symbolType,
        primaryLanguage: parsedParams.primaryLanguage,
        secondaryLanguage: parsedParams.secondaryLanguage,
        primaryPhrase: parsedParams.primaryPhrase,
        secondaryPhrase: parsedParams.secondaryPhrase,
        storageState: parsedParams.storageState,
        requiredWording: parsedParams.requiredWording,
        claimType: parsedParams.claimType,
        nutrient: parsedParams.nutrient,
      };

      return ast;
    }
  }

  // Uncompiled Fallback -> Safe Manual Review
  return {
    ruleId,
    ruleType: 'MANUAL_REVIEW',
    type: 'MANUAL_REVIEW',
    sourceDocumentId: sourceDocId,
    sourceDocumentHash: sourceDocHash,
    sourceLocation,
    sourceQuotation,
    quotationVerified,
    ruleAuthority,
    authorizationStatus: 'PROPOSED',
    legalStatus: 'UNCONFIRMED',
    jurisdiction,
    productCategory,
    effectiveDate,
    applicability: 'NEEDS_REVIEW',
    parameters: {},
    evaluatorId: 'human_manual_review',
    evaluator: 'human_manual_review',
    compileStatus: COMPILE_STATUS.MANUAL_REVIEW,
    compileDiagnostics: ['Natural language requirement is prose or advisory; cannot safely compile into a deterministic evaluator without human interpretation.'],
    limitations: ['Prose rule requires human expert evaluation.'],
    isCompiled: false,
    status: 'UNCOMPILED_REQUIREMENT',
    reason: 'UNCOMPILED — HUMAN REVIEW REQUIRED. Manual human review required: Natural language requirement is prose or advisory; cannot be compiled safely into a supported typed evaluator without authorized human interpretation.',
    explanation: 'Natural language requirement is prose or advisory; cannot be compiled safely into a supported typed evaluator without authorized human interpretation.',
  };
}

export const compilePackagingRule = compileRuleRequirement;
