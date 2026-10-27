/**
 * PackSignal Allergen Declaration Remediation Engine
 * Enforces US FALCPA (21 U.S.C. 343(w)) & FASTER Act (Sesame inclusion),
 * separate "Contains:" statement construction, and strict preservation of allergen disclosures.
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
  'Almond', 'Almonds',
  'Beech nut', 'Brazil nut', 'Butternut',
  'Cashew', 'Cashews',
  'Chestnut', 'Chinquapin', 'Coconut', 'Coconuts',
  'Filbert', 'Hazelnut', 'Hazelnuts',
  'Ginko nut', 'Hickory nut', 'Lichee nut', 'Macadamia nut', 'Macadamia nuts',
  'Pecan', 'Pecans', 'Pine nut', 'Pine nuts', 'Pistachio', 'Pistachios',
  'Shea nut', 'Walnut', 'Walnuts'
];

export const ALLERGEN_REGULATORY_REF = {
  jurisdiction: 'US',
  statute: 'FALCPA 21 U.S.C. 343(w) & FASTER Act 21 U.S.C. 321(qq)(9)',
  citation: '21 CFR 101.4 & FDA Allergen Labeling Guidance (Edition 5, 2023)',
  effectiveStatus: 'IN_FORCE',
  sesameMandatoryDate: '2023-01-01',
};

/**
 * Normalizes allergen names to FDA statutory categories.
 */
export function normalizeAllergenName(rawName) {
  const s = String(rawName || '').trim();
  const lower = s.toLowerCase();

  if (lower.includes('milk') || lower.includes('whey') || lower.includes('casein') || lower.includes('dairy')) return 'Milk';
  if (lower.includes('egg')) return 'Eggs';
  if (lower.includes('peanut')) return 'Peanuts';
  if (lower.includes('wheat') || lower.includes('flour') || lower.includes('semolina')) return 'Wheat';
  if (lower.includes('soy') || lower.includes('edamame')) return 'Soybeans';
  if (lower.includes('sesame') || lower.includes('tahini')) return 'Sesame';
  if (lower.includes('shrimp') || lower.includes('crab') || lower.includes('lobster') || lower.includes('prawn')) {
    return s; // Species specific
  }
  if (lower.includes('salmon') || lower.includes('tuna') || lower.includes('cod') || lower.includes('anchovy')) {
    return s; // Species specific
  }
  for (const nut of TREE_NUT_TYPES) {
    if (lower.includes(nut.toLowerCase())) {
      return nut;
    }
  }
  return s;
}

/**
 * Builds a proposed "Contains" statement from verified allergen sources.
 */
export function proposeContainsStatement(detectedAllergens, options = {}) {
  const { currentArtworkStatement = '', market = 'US' } = options;

  if (!Array.isArray(detectedAllergens) || detectedAllergens.length === 0) {
    return {
      status: 'NEEDS_EVIDENCE',
      blockerReason: 'No verified allergen sources documented. Cannot fabricate an allergen-free statement or omit allergens without testing substantiation.',
      regulatoryRef: ALLERGEN_REGULATORY_REF,
    };
  }

  // Deduplicate and normalize
  const normalized = Array.from(new Set(detectedAllergens.map(normalizeAllergenName))).filter(Boolean);
  normalized.sort((a, b) => a.localeCompare(b));

  const proposedText = `CONTAINS: ${normalized.join(', ')}.`;

  // Compare with current artwork if supplied
  const missingInArtwork = [];
  if (currentArtworkStatement) {
    for (const allergen of normalized) {
      if (!currentArtworkStatement.toLowerCase().includes(allergen.toLowerCase())) {
        missingInArtwork.push(allergen);
      }
    }
  }

  return {
    status: 'PROPOSED_VALIDATED',
    proposedText,
    allergensCount: normalized.length,
    allergens: normalized,
    missingInArtwork,
    regulatoryRef: ALLERGEN_REGULATORY_REF,
    notes: [
      'FDA 21 U.S.C. 343(w) requires separate Contains statements to appear immediately after or adjacent to the ingredient list.',
      'FASTER Act of 2021 made Sesame a major food allergen effective January 1, 2023.',
      'Advisory statements ("May contain") must not be substituted for direct ingredient disclosures.',
    ],
    requiresHumanReview: true,
  };
}

/**
 * Main entry point for remediating an allergen declaration finding.
 */
export function remediateAllergenDeclaration(finding, review = {}) {
  const allergens = [];
  const textToScan = [
    finding.expected,
    ...(finding.evidence || []).map(e => e.quote || ''),
    ...(review.deepVerification?.allergenChecks || []).map(c => c.sourceCategory || c.allergen || ''),
  ].join(' ');

  const matches = textToScan.match(/milk|dairy|egg|eggs|peanut|peanuts|tree nut|almond|almonds|walnut|walnuts|cashew|cashews|wheat|soy|soybeans|fish|crustacean|shrimp|sesame/gi) || [];
  for (const m of matches) {
    allergens.push(normalizeAllergenName(m));
  }

  const unique = Array.from(new Set(allergens));
  if (unique.length === 0) {
    return {
      success: false,
      reason: 'Cannot safely generate an allergen declaration. Approved ingredient and allergen-source information is required.',
      blockers: ['No verified allergen source derivation or formulation facts attached.'],
      requiredEvidence: ['Approved formulation specification with allergen checklist.'],
    };
  }

  unique.sort((a, b) => a.localeCompare(b));
  const proposedText = `CONTAINS: ${unique.join(', ')}.`;

  return {
    success: true,
    proposedText,
    options: [
      {
        id: 'opt-contains',
        label: 'Statutory Contains Statement',
        text: proposedText,
        description: 'Separate statement listing all verified major allergens per FALCPA and FASTER Act.',
      },
    ],
    sourceEvidence: finding.evidence || [],
    ruleEvidence: [ALLERGEN_REGULATORY_REF],
    changes: [`Constructed statutory allergen statement including verified allergen sources: ${unique.join(', ')}`],
    reason: 'Formulation allergen facts documented. Prepared evidence-backed statutory Contains statement for human review.',
    blockers: [],
    requiredEvidence: [],
  };
}
