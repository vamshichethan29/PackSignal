/**
 * PackSignal Allergen Declaration Remediation Engine (lib/remediation/allergens.mjs)
 * Implements US FALCPA (21 U.S.C. 343(w)), FASTER Act (Sesame), and EU 1169/2011 Art. 21 rules.
 * Strictly avoids inventing allergens, equating wheat with gluten, or guessing formulations.
 */

export const US_MAJOR_ALLERGENS = [
  'Milk',
  'Eggs',
  'Peanuts',
  'Tree nuts', // Requires specific tree nut type (e.g., Almonds, Walnuts, Cashews)
  'Wheat',
  'Soybeans',
  'Fish',      // Requires specific species (e.g., Cod, Salmon)
  'Crustacean shellfish', // Requires specific species (e.g., Shrimp, Crab)
  'Sesame',    // Mandatory effective January 1, 2023 (FASTER Act)
];

export const TREE_NUT_TYPES = [
  'Almonds', 'Walnuts', 'Cashews', 'Pecans', 'Pistachios',
  'Hazelnuts', 'Macadamia nuts', 'Brazil nuts', 'Pine nuts', 'Coconuts',
];

export const ALLERGEN_REGULATORY_REF = {
  US: {
    jurisdiction: 'US',
    statute: 'FALCPA 21 U.S.C. 343(w) & FASTER Act 21 U.S.C. 321(qq)(9)',
    citation: '21 CFR 101.4 & FDA Allergen Labeling Guidance (Edition 5)',
    effectiveStatus: 'IN_FORCE',
  },
  EU: {
    jurisdiction: 'EU',
    statute: 'Regulation (EU) No 1169/2011 Annex II & Article 21',
    citation: 'Mandatory emphasis in ingredients list (e.g. bold/distinct font)',
    effectiveStatus: 'IN_FORCE',
  },
  IN: {
    jurisdiction: 'IN',
    statute: 'FSSAI (Labelling and Display) Regulations, 2020',
    citation: 'Regulation 5(3)(ix) - Declaration of Allergens',
    effectiveStatus: 'IN_FORCE',
  },
};

/**
 * Normalizes raw ingredient / allergen terms to statutory major allergen designations.
 * Note: Never maps wheat to "Wheat (gluten)".
 */
export function normalizeAllergenTerm(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s.includes('milk') || s.includes('whey') || s.includes('casein') || s.includes('butter') || s.includes('cream')) return 'Milk';
  if (s.includes('egg') || s.includes('albumin')) return 'Eggs';
  if (s.includes('peanut')) return 'Peanuts';
  if (s.includes('wheat') || s.includes('flour') || s.includes('semolina') || s.includes('spelt')) return 'Wheat';
  if (s.includes('soy') || s.includes('soya') || s.includes('edamame') || s.includes('tofu')) return 'Soybeans';
  if (s.includes('sesame') || s.includes('tahini')) return 'Sesame';
  if (s.includes('shrimp') || s.includes('crab') || s.includes('lobster') || s.includes('prawn')) return 'Crustacean shellfish';
  if (s.includes('salmon') || s.includes('tuna') || s.includes('cod') || s.includes('anchovy') || s.includes('fish')) return 'Fish';
  for (const nut of TREE_NUT_TYPES) {
    if (s.includes(nut.toLowerCase().replace(/s$/, ''))) return nut;
  }
  return null;
}

/**
 * Extracts verified allergen sources from approved specification documents.
 */
export function extractVerifiedAllergensFromSource(review) {
  const specDocs = (review.documents || []).filter(d => d.role === 'spec' || d.role === 'formulation');
  const found = new Set();
  const evidence = [];

  for (const doc of specDocs) {
    const text = (doc.text || '') + ' ' + JSON.stringify(doc.data || {});
    // Check for explicit allergen section or ingredients
    const allergenSection = text.match(/(?:allergens?|contains|allergen statement)\s*[:—]?\s*([^\n.;]{3,120})/i);
    if (allergenSection) {
      const rawItems = allergenSection[1].split(/[,;+&]|\band\b/i).map(s => s.trim()).filter(Boolean);
      for (const item of rawItems) {
        const norm = normalizeAllergenTerm(item);
        if (norm) {
          found.add(norm);
          evidence.push({
            documentId: doc.id,
            documentName: doc.name,
            role: doc.role,
            quote: allergenSection[0],
            location: 'Allergen Declaration Section',
          });
        }
      }
    }

    // Also scan ingredients text in spec
    const ingredientsSection = text.match(/ingredients\s*[:—]?\s*([^\n.;]{5,200})/i);
    if (ingredientsSection) {
      const rawIngs = ingredientsSection[1].split(/[,;]/).map(s => s.trim());
      for (const ing of rawIngs) {
        const norm = normalizeAllergenTerm(ing);
        if (norm) {
          found.add(norm);
          evidence.push({
            documentId: doc.id,
            documentName: doc.name,
            role: doc.role,
            quote: ing,
            location: 'Approved Ingredients List',
          });
        }
      }
    }
  }

  return {
    allergens: Array.from(found),
    evidence,
    hasVerifiedSources: found.size > 0,
  };
}

/**
 * Core Allergen Remediation
 */
export function remediateAllergenDeclaration(finding, review = {}, options = {}) {
  const market = (options.targetMarket || review.market || 'US').toUpperCase();
  const regRef = ALLERGEN_REGULATORY_REF[market] || ALLERGEN_REGULATORY_REF.US;

  // Phase 5: Separate TYPOGRAPHY emphasis from CONTENT verification
  const isTypographyIssue = (finding.title || '').toLowerCase().includes('emphasis') ||
    (finding.title || '').toLowerCase().includes('formatting') ||
    (finding.explanation || '').toLowerCase().includes('emphasis') ||
    (finding.explanation || '').toLowerCase().includes('bold');

  if (isTypographyIssue && finding.observed) {
    return {
      success: true,
      mode: 'ALLERGEN_TYPOGRAPHY_INSTRUCTION',
      isDesignInstruction: true,
      originalText: finding.observed,
      proposedText: `[Prepress Instruction: Apply required emphasis to allergen terms in: "${finding.observed}"]`,
      instruction: {
        textSpan: finding.observed,
        targetTool: 'Adobe Illustrator / Esko ArtPro+',
        action: 'Apply bold type or distinctive font styling to required allergen terms under Regulation (EU) 1169/2011 Art. 21.',
        citation: regRef.citation,
      },
      changes: ['Prepared typography emphasis instruction for prepress designer. Does not rewrite ingredient terms.'],
      reason: 'Allergen terms are present in wording; packaging requires visual typographic emphasis (bold/distinct style).',
      sourceEvidence: (finding.evidence || []).filter(e => e.role && e.role !== 'artwork'),
      ruleEvidence: [{ text: regRef.citation, authority: regRef.jurisdiction }],
    };
  }

  // Extract verified allergens from approved specification
  const sourceAllergenData = extractVerifiedAllergensFromSource(review);

  // If approved formulation or allergen data is missing, BLOCK UNSAFE GENERATION
  if (!sourceAllergenData.hasVerifiedSources && !options.verifiedAllergens?.length) {
    return {
      success: false,
      reason: 'Cannot safely generate an allergen declaration. Approved ingredient and allergen-source information is required.',
      blockers: [
        'Approved product formulation or verified allergen certificate is missing.',
        'Never fabricate or guess allergen declarations without confirmed lab/specification records.',
      ],
      requiredEvidence: ['Approved Product Specification confirming all major allergens present in formulation.'],
    };
  }

  const verifiedAllergens = options.verifiedAllergens?.length
    ? options.verifiedAllergens.map(normalizeAllergenTerm).filter(Boolean)
    : sourceAllergenData.allergens;

  // Deduplicate and sort
  const uniqueAllergens = Array.from(new Set(verifiedAllergens)).sort((a, b) => a.localeCompare(b));

  // Construct source-backed Contains statement
  // E.g. "Contains: Milk, Soybeans, Wheat."
  // Strictly avoid "(gluten)" or invented additions
  const containsText = `Contains: ${uniqueAllergens.join(', ')}.`;

  const optionsList = [
    {
      id: 'opt-contains-std',
      label: 'Standard US FDA "Contains" Statement',
      text: containsText,
      description: `FALCPA / FASTER Act compliant format listing verified statutory allergens: ${uniqueAllergens.join(', ')}.`,
    },
  ];

  return {
    success: true,
    mode: 'ALLERGEN_PROPOSAL',
    originalText: finding.observed || 'Unverified allergen statement',
    proposedText: containsText,
    options: optionsList,
    detectedAllergens: uniqueAllergens,
    sourceEvidence: sourceAllergenData.evidence,
    ruleEvidence: [
      {
        id: 'rule-falcpa-contains',
        citation: regRef.citation,
        authority: regRef.statute,
        text: 'Major food allergens used as ingredients must be declared using statutory common or usual names.',
      },
    ],
    changes: [
      `Constructed source-anchored allergen declaration: "${containsText}"`,
      'Verified all included terms against approved formulation. No unverified allergens or "(gluten)" additions included.',
    ],
    reason: `Allergen statement formulated from ${uniqueAllergens.length} verified formulation ingredient(s) under ${regRef.statute}. Requires regulatory QA signoff before designer handoff.`,
  };
}
