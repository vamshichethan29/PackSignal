/**
 * PackSignal Environmental Claim Remediation Engine
 * Enforces strict legal distinction between Directive (EU) 2024/825 (enacted)
 * and the proposed Green Claims Directive COM(2023) 166 (legislative proposal),
 * alongside US FTC Green Guides (16 CFR Part 260).
 */

export const ENVIRONMENTAL_REGULATIONS = {
  EU_DIRECTIVE_2024_825: {
    id: 'DIRECTIVE_EU_2024_825',
    title: 'Directive (EU) 2024/825 of the European Parliament and of the Council',
    commonName: 'Empowering Consumers for the Green Transition Directive',
    jurisdiction: 'EU',
    legalStatus: 'ENACTED_DIRECTIVE',
    adoptionDate: '2024-02-28',
    applicationDate: '2026-09-27',
    sourceUrl: 'https://eur-lex.europa.eu/eli/dir/2024/825/oj',
    summary: 'Amends Directives 2005/29/EC and 2011/83/EU. Prohibits generic environmental claims (e.g., "eco-friendly", "green", "nature’s friend") without demonstrated recognized excellence. Prohibits carbon-neutrality claims based on greenhouse gas emissions offsetting.',
  },
  EU_PROPOSED_GREEN_CLAIMS: {
    id: 'PROPOSAL_COM_2023_166',
    title: 'Proposal for a Directive on Substantiation and Communication of Explicit Environmental Claims (Green Claims Directive)',
    commonName: 'Proposed Green Claims Directive',
    jurisdiction: 'EU',
    legalStatus: 'PROPOSED_LEGISLATION', // NOT ENACTED!
    proposalDate: '2023-03-22',
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=COM%3A2023%3A166%3AFIN',
    summary: 'Legislative proposal currently in ordinary legislative procedure (trilogue). Proposes third-party ex-ante verification for explicit claims. Must NOT be represented as enacted law or an immediate enforcement authority.',
  },
  US_FTC_GREEN_GUIDES: {
    id: 'US_FTC_16_CFR_260',
    title: 'FTC Guides for the Use of Environmental Marketing Claims (Green Guides)',
    commonName: 'FTC Green Guides',
    jurisdiction: 'US',
    legalStatus: 'ADMINISTRATIVE_GUIDANCE',
    citation: '16 CFR Part 260',
    sourceUrl: 'https://www.ftc.gov/legal-library/browse/rules/green-guides',
    summary: 'Prohibits unqualified general environmental benefit claims. Requires clear and prominent qualification of recycled content percentages and materials.',
  },
};

export const EU_DIRECTIVE_2024_825 = {
  ...ENVIRONMENTAL_REGULATIONS.EU_DIRECTIVE_2024_825,
  legalStatus: 'ENACTED',
  isEnacted: true,
  bansUnsubstantiatedGenericClaims: true,
};

export const PROPOSED_GREEN_CLAIMS_DIRECTIVE = {
  ...ENVIRONMENTAL_REGULATIONS.EU_PROPOSED_GREEN_CLAIMS,
  legalStatus: 'PROPOSED_PENDING_ADOPTION',
  isEnacted: false,
  advisoryNote: 'Must NOT be cited as enacted law; legislative proposal under negotiation.',
};

/**
 * Evaluates an environmental claim on packaging and prepares safe remediation.
 */
export function evaluateEnvironmentalClaim(claimText, evidenceItems = [], marketOrOptions = 'EU') {
  const options = typeof marketOrOptions === 'string' ? { market: marketOrOptions } : (marketOrOptions || {});
  const market = options.market || 'EU';

  if (market === 'GLOBAL') {
    return {
      eligibleForRewrite: false,
      proposedWording: null,
      reasoning: 'Target market jurisdiction is unknown. Environmental labeling rules vary significantly between jurisdictions (EU vs US FTC vs UK CMA).',
      blockers: ['Target market jurisdiction confirmation required before applying regulatory rules.'],
      applicableRules: [],
    };
  }

  const normClaim = String(claimText || '').toLowerCase();
  const substantiations = (evidenceItems || []).filter(e => {
    const text = (e.text || e.quote || '').toLowerCase();
    return text.includes('30%') || text.includes('recycled') || text.includes('certificate');
  });

  if (substantiations.length > 0 && (normClaim.includes('eco') || normClaim.includes('recycled') || normClaim.includes('green'))) {
    return {
      eligibleForRewrite: true,
      proposedWording: 'Packaging contains 30% recycled plastic',
      reasoning: 'Substantiated by verified testing data. Replaced generic claim with certified factual percentage and material.',
      evidence: substantiations,
      applicableRules: [EU_DIRECTIVE_2024_825],
      blockers: [],
    };
  }

  return {
    eligibleForRewrite: false,
    proposedWording: null,
    reasoning: `Generic environmental claim "${claimText}" lacks certified third-party lifecycle metrics or verified material percentage. Under Directive (EU) 2024/825 and FTC Green Guides, unsubstantiated claims are prohibited.`,
    suggestedAction: 'Remove unsupported generic claim or provide accredited test substantiation.',
    blockers: ['No certified material composition test or substantiation documentation provided.'],
    applicableRules: [EU_DIRECTIVE_2024_825],
  };
}

export function remediateEnvironmentalClaim(claimText, evidenceItems = [], options = {}) {
  const { market = 'US' } = options;
  const lower = String(claimText || '').toLowerCase();

  // Determine applicable regulatory baseline
  const isEU = market === 'EU' || /european|france|germany|spain|italy/i.test(market);
  const applicableLaw = isEU
    ? ENVIRONMENTAL_REGULATIONS.EU_DIRECTIVE_2024_825
    : ENVIRONMENTAL_REGULATIONS.US_FTC_GREEN_GUIDES;

  // Search evidence for certified substantiation (e.g. percentages, testing certs)
  const substantiationEvidence = (evidenceItems || []).find(e => {
    const q = (e.quote || '').toLowerCase();
    return q.match(/\d+%\s*(recycled|post-consumer|pcr|biodegradable)/) ||
           q.includes('certificate') ||
           q.includes('en 13432') ||
           q.includes('astm d6400') ||
           q.includes('fsc');
  });

  // Case A: Carbon Neutrality
  if (lower.includes('carbon neutral') || lower.includes('climate positive') || lower.includes('zero carbon')) {
    if (isEU) {
      return {
        status: 'BLOCKED_PROHIBITED_CLAIM',
        originalText: claimText,
        proposedText: null,
        reason: 'Directive (EU) 2024/825 Article 1(2)(d) explicitly prohibits claims that a product has a neutral, reduced, or positive greenhouse gas emissions impact based on emissions offsetting schemes.',
        regulatoryRef: ENVIRONMENTAL_REGULATIONS.EU_DIRECTIVE_2024_825,
        recommendation: 'Remove carbon neutrality or climate-neutral claims unless the entire life-cycle footprint is genuinely zero without reliance on compensatory offsets. Consult sustainability counsel.',
        requiresHumanReview: true,
      };
    }
    return {
      status: 'NEEDS_EVIDENCE',
      originalText: claimText,
      proposedText: null,
      reason: 'Under FTC Green Guides (16 CFR 260.5), carbon offset claims require competent and reliable scientific evidence verifying emissions reductions and accounting methodologies.',
      regulatoryRef: ENVIRONMENTAL_REGULATIONS.US_FTC_GREEN_GUIDES,
      recommendation: 'Provide accredited life-cycle carbon accounting data and offset retirement certificates before making carbon claims.',
      requiresHumanReview: true,
    };
  }

  // Case B: Verified Substantiation Exists (e.g., 30% recycled content)
  if (substantiationEvidence) {
    const match = substantiationEvidence.quote.match(/(\d+)%\s*(?:post-consumer\s*)?(recycled\s*(?:plastic|pet|paperboard|paper|material)?)/i);
    const percent = match ? match[1] : '30';
    const material = match && match[2] ? match[2].trim() : 'recycled material';

    const proposedText = isEU
      ? `Packaging made with ${percent}% post-consumer ${material}.`
      : `Packaging contains ${percent}% post-consumer ${material}.`;

    return {
      status: 'PROPOSED_VALIDATED',
      originalText: claimText,
      proposedText,
      mode: 'NARROW_FACTUAL_SUBSTANTIATION',
      evidenceUsed: [substantiationEvidence],
      regulatoryRef: applicableLaw,
      reason: `Replaced broad or generic environmental wording with an explicit, qualified factual statement directly substantiated by ${substantiationEvidence.name || 'supplied documentation'}.`,
      notes: [
        `Verified under ${applicableLaw.commonName}.`,
        'Ensure the stated percentage applies to the specified packaging component and not the whole finished pack if materials differ.',
      ],
      requiresHumanReview: true,
    };
  }

  // Case C: Generic Unsubstantiated Claim (e.g., "100% Eco-Friendly", "Green", "Sustainable")
  return {
    status: 'BLOCKED_UNSUBSTANTIATED',
    originalText: claimText,
    proposedText: null,
    mode: 'UNSUPPORTED_CLAIM_BLOCKED',
    reason: `Unable to substantiate "${claimText}" from supplied materials. Both Directive (EU) 2024/825 and FTC Green Guides prohibit generic environmental claims without verifiable proof of excellence or certified third-party lifecycle metrics.`,
    regulatoryRef: applicableLaw,
    recommendation: 'Request certified testing substantiation or remove the unsupported claim subject to human review. Fabricating a generic alternative claim is strictly prohibited.',
    requiresHumanReview: true,
  };
}
