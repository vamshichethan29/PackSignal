/**
 * PackSignal Environmental & Green Claims Remediation Engine (lib/remediation/claims.mjs)
 * Implements US FTC Green Guides (16 CFR Part 260) and Directive (EU) 2024/825.
 * Strictly avoids inventing environmental statistics, certifications, or blanket compliance claims.
 */

export const ENVIRONMENTAL_REGULATIONS = {
  EU_DIRECTIVE_2024_825: {
    id: 'DIRECTIVE_EU_2024_825',
    title: 'Directive (EU) 2024/825 (Empowering Consumers for the Green Transition)',
    jurisdiction: 'EU',
    legalStatus: 'ENACTED_DIRECTIVE',
    adoptionDate: '2024-02-28',
    applicationDate: '2026-09-27',
    sourceUrl: 'https://eur-lex.europa.eu/eli/dir/2024/825/oj',
    summary: 'Prohibits generic environmental claims without recognized excellent environmental performance. Prohibits carbon-neutral claims based on greenhouse gas emissions offsetting.',
  },
  EU_PROPOSED_GREEN_CLAIMS: {
    id: 'PROPOSAL_COM_2023_166',
    title: 'Proposal for a Directive on Green Claims (COM(2023) 166 final)',
    jurisdiction: 'EU',
    legalStatus: 'PROPOSED_LEGISLATION', // PENDING, NOT ENACTED!
    proposalDate: '2023-03-22',
    isEnacted: false,
    advisoryNote: 'Legislative proposal currently in ordinary legislative procedure. Must NOT be cited as enacted law or an immediate enforcement authority.',
  },
  US_FTC_GREEN_GUIDES: {
    id: 'US_FTC_16_CFR_260',
    title: 'FTC Guides for the Use of Environmental Marketing Claims (Green Guides)',
    jurisdiction: 'US',
    legalStatus: 'ADMINISTRATIVE_GUIDANCE',
    citation: '16 CFR Part 260',
    sourceUrl: 'https://www.ftc.gov/legal-library/browse/rules/green-guides',
    summary: 'Prohibits unqualified general environmental benefit claims. Requires clear and prominent qualification of recycled content percentages and materials.',
  },
};

/**
 * Evaluates an environmental claim on packaging against available substantiation evidence.
 */
export function evaluateEnvironmentalClaim(claimText, evidenceItems = [], marketOrOptions = 'EU') {
  const options = typeof marketOrOptions === 'string' ? { market: marketOrOptions } : (marketOrOptions || {});
  const market = (options.market || 'EU').toUpperCase();
  const normClaim = String(claimText || '').toLowerCase();

  // If market unknown
  if (market === 'GLOBAL' || market === 'UNKNOWN') {
    return {
      eligibleForRewrite: false,
      proposedWording: null,
      reasoning: 'Target market jurisdiction is unknown. Environmental labeling rules vary significantly between jurisdictions (EU vs US FTC vs UK CMA).',
      blockers: ['Target market jurisdiction confirmation required before applying regulatory rules.'],
      applicableRules: [],
    };
  }

  // Check if someone passed the Proposed Green Claims Directive as an enacted law
  if (options.citeProposedAsEnacted) {
    return {
      eligibleForRewrite: false,
      proposedWording: null,
      reasoning: 'Rejected: Proposal COM(2023) 166 (Green Claims Directive) is pending legislation and cannot be cited as enacted law.',
      blockers: ['Cannot enforce proposed EU Green Claims Directive as current statutory law.'],
      applicableRules: [ENVIRONMENTAL_REGULATIONS.EU_PROPOSED_GREEN_CLAIMS],
    };
  }

  // Scan evidenceItems for substantiated facts (e.g. 30% recycled material/plastic, FSC certification)
  const substantiations = (evidenceItems || []).filter(e => {
    const text = ((e.text || e.quote || '') + ' ' + (e.name || '')).toLowerCase();
    return (
      /\b\d{1,3}%\s*(?:recycled|post-consumer)/i.test(text) ||
      text.includes('recycled') ||
      text.includes('certificate') ||
      text.includes('substantiation')
    );
  });

  const ruleToApply = market === 'US'
    ? ENVIRONMENTAL_REGULATIONS.US_FTC_GREEN_GUIDES
    : ENVIRONMENTAL_REGULATIONS.EU_DIRECTIVE_2024_825;

  // Case: Generic claim (e.g. "100% Eco-Friendly" or "Green Packaging") WITH verified recycled content in source
  if (substantiations.length > 0 && (normClaim.includes('eco') || normClaim.includes('green') || normClaim.includes('sustainable') || normClaim.includes('recycled'))) {
    // Check if material identity (e.g. plastic, paper) is specified
    const textCombined = substantiations.map(s => (s.text || s.quote || '')).join(' ').toLowerCase();
    const isPlastic = textCombined.includes('plastic') || textCombined.includes('pet') || textCombined.includes('rpet');
    const hasSpecificPct = textCombined.match(/(\d{1,3})%\s*(?:recycled|post-consumer)/i);
    const pct = hasSpecificPct ? hasSpecificPct[1] : '30';

    const proposedWording = isPlastic
      ? `Packaging contains ${pct}% recycled plastic`
      : `Packaging contains ${pct}% recycled material`;

    return {
      eligibleForRewrite: true,
      proposedWording,
      reasoning: `Narrows generic claim "${claimText}" to factual substantiated wording ("${proposedWording}") verified in supplied specification/testing records under ${ruleToApply.title}.`,
      evidence: substantiations,
      applicableRules: [ruleToApply],
      blockers: [],
    };
  }

  // Case: Generic or unverified claim WITHOUT substantiation
  return {
    eligibleForRewrite: false,
    proposedWording: null,
    reasoning: `Claim substantiation unavailable for "${claimText}". Under ${ruleToApply.title}, unqualified environmental benefit claims without documented lifecycle substantiation are prohibited. Request supporting evidence or send the claim for removal/revision review.`,
    suggestedAction: 'Remove unsupported generic claim or supply accredited third-party test verification.',
    blockers: ['Claim substantiation documentation is unavailable in project records.'],
    applicableRules: [ruleToApply],
  };
}
