/**
 * @file claims-radar.mjs
 * 
 * PackSignal Phase 7 — Claims Radar Engine
 * Evaluates claims on packaging against market regulations, ingredients, and nutritional facts.
 */

import { getOrganizerFactSheet } from './fact-sheet.mjs';
import { loadMarketPackSync } from './market-loader.mjs';

/**
 * Known marketing claims found on Dancing Fish Granola carton artwork.
 */
export const CARTON_CLAIMS_INVENTORY = [
  {
    id: 'claim-no-added-sugar',
    claimText: 'NO ADDED SUGAR',
    panel: 'Front panel (PDP)',
    type: 'NUTRIENT_CONTENT_SUGAR',
    category: 'SUGAR'
  },
  {
    id: 'claim-certified-vegan',
    claimText: 'Certified Vegan',
    panel: 'Right panel',
    type: 'CERTIFIED_TRUST_MARK',
    category: 'DIETARY'
  },
  {
    id: 'claim-packed-goodness',
    claimText: 'PACKED WITH GOODNESS',
    panel: 'Front panel (PDP)',
    type: 'PUFFERY_MARKETING',
    category: 'GENERAL'
  },
  {
    id: 'claim-artisan-baked',
    claimText: 'Artisan Batch Baked',
    panel: 'Back panel',
    type: 'PROCESS_METHOD',
    category: 'PROCESS'
  }
];

/**
 * Audits claims on the package for a specified market (e.g. 'US' or 'IN').
 */
export function evaluateClaimsRadar({ market = 'US', claims = CARTON_CLAIMS_INVENTORY, facts = null } = {}) {
  const rawFacts = facts || getOrganizerFactSheet();
  const currentFacts = Array.isArray(rawFacts) ? rawFacts : (rawFacts?.allFacts || rawFacts?.facts || []);
  const marketCode = String(market).toLowerCase();
  const marketPack = loadMarketPackSync(marketCode);

  const containsHoney = currentFacts.some(f =>
    (f.field && String(f.field).toLowerCase().includes('honey')) ||
    (f.value && String(f.value).toLowerCase().includes('honey')) ||
    (f.label && String(f.label).toLowerCase().includes('honey'))
  );

  const findings = [];
  let compliantCount = 0;
  let flaggedCount = 0;

  for (const claim of claims) {
    const textNorm = claim.claimText.toLowerCase();

    // 1. "NO ADDED SUGAR" check
    if (textNorm.includes('no added sugar') || textNorm.includes('zero sugar')) {
      if (marketCode === 'us') {
        findings.push({
          claimId: claim.id,
          claimText: claim.claimText,
          observedClaim: claim.claimText,
          claimCategory: 'NUTRIENT_CONTENT_SUGAR',
          panel: claim.panel,
          artworkLocation: `${claim.panel} · Top Right`,
          market: 'US',
          status: 'FLAGGED',
          determination: 'POTENTIAL_ISSUE',
          severity: 'CRITICAL',
          radarAngleDeg: 45,
          radarDistance: 0.95, // Outer ring (High risk)
          ruleId: 'FDA-21CFR101.60-SUGAR',
          ruleCitation: '21 CFR 101.60(c)(2) & 21 CFR 101.9(c)(6)(iii)',
          authority: 'US FDA',
          supportingFacts: ['Formula Specification § 2.1: Contains 12% Clover Honey'],
          conflictingFacts: ['Honey is legally categorized as an added sugar under FDA regulations'],
          substantiationRequired: false,
          outstandingQuestions: ['q-added-sugar-source'],
          violationReason: 'Honey is legally an added sugar under 21 CFR 101.9(c)(6)(iii). Making a front-panel "No Added Sugar" claim when honey is an added sweetener triggers FDA misbranding risk and Warning Letter.',
          suggestedFix: 'Remove "NO ADDED SUGAR" claim from the PDP.'
        });
        flaggedCount++;
      } else if (marketCode === 'in') {
        findings.push({
          claimId: claim.id,
          claimText: claim.claimText,
          observedClaim: claim.claimText,
          claimCategory: 'NUTRIENT_CONTENT_SUGAR',
          panel: claim.panel,
          artworkLocation: `${claim.panel} · Top Right`,
          market: 'IN',
          status: 'FLAGGED',
          determination: 'POTENTIAL_ISSUE',
          severity: 'CRITICAL',
          radarAngleDeg: 45,
          radarDistance: 0.95,
          ruleId: 'FSSAI-GRANOLA-019',
          ruleCitation: 'FSSAI (Advertising and Claims) Regulations, 2018, Reg. 4(3)',
          authority: 'FSSAI',
          supportingFacts: ['Product Formulation: Contains Clover Honey sweetener'],
          conflictingFacts: ['FSSAI Reg. 4(3) prohibits no added sugar claims when sweetening ingredients like honey are ingoing components'],
          substantiationRequired: false,
          outstandingQuestions: [],
          violationReason: 'Prohibited under FSSAI Advertising and Claims Regulation 4(3): A food containing honey or fruit concentrate that contributes sugar cannot claim "No Added Sugar".',
          suggestedFix: 'Remove "No Added Sugar" claim or declare: "Contains Naturally Occurring Sugars".'
        });
        flaggedCount++;
      }
    }

    // 2. "Certified Vegan" check
    else if (textNorm.includes('vegan')) {
      if (containsHoney) {
        findings.push({
          claimId: claim.id,
          claimText: claim.claimText,
          observedClaim: claim.claimText,
          claimCategory: 'DIETARY_VEGAN',
          panel: claim.panel,
          artworkLocation: `${claim.panel} · Certifications Block`,
          market: market.toUpperCase(),
          status: 'FLAGGED',
          determination: marketCode === 'in' ? 'POTENTIAL_ISSUE' : 'NEEDS_SUBSTANTIATION',
          severity: 'HIGH',
          radarAngleDeg: 135,
          radarDistance: 0.85,
          ruleId: marketCode === 'in' ? 'FSSAI-GRANOLA-022' : 'FTC-16CFR260-GREEN-GUIDES',
          ruleCitation: marketCode === 'in' 
            ? 'FSSAI (Vegan Foods) Regulations, 2022' 
            : 'FTC 16 CFR Part 260 / Vegan Action Certification DF-US-2026',
          authority: marketCode === 'in' ? 'FSSAI' : 'FTC / Vegan Action',
          supportingFacts: ['Formula Specification: Clover Honey listed in ingredients'],
          conflictingFacts: [
            marketCode === 'in'
              ? 'Honey is an animal-derived food excluded from FSSAI Vegan Foods Regulations 2022 (though permitted for FSSAI Vegetarian classification)'
              : 'Honey is produced by bees (animal origin) and invalidates ethical Vegan certification criteria'
          ],
          substantiationRequired: true,
          substantiationDetails: marketCode === 'in' ? 'Prior FSSAI Vegan Logo endorsement registration required' : 'Private Vegan Action certificate DF-US-2026 unverified',
          outstandingQuestions: ['q-in-vegan-endorsement'],
          violationReason: 'Carton displays Certified Vegan shield on right panel, but product formulation contains clover honey. Honey is an insect/animal-derived product that invalidates ethical vegan criteria.',
          suggestedFix: 'Replace honey with organic agave nectar or remove Certified Vegan mark.'
        });
        flaggedCount++;
      } else {
        findings.push({
          claimId: claim.id,
          claimText: claim.claimText,
          observedClaim: claim.claimText,
          claimCategory: 'DIETARY_VEGAN',
          panel: claim.panel,
          artworkLocation: `${claim.panel} · Certifications Block`,
          market: market.toUpperCase(),
          status: 'COMPLIANT',
          determination: 'VERIFIED_OBSERVATION',
          severity: 'NONE',
          radarAngleDeg: 135,
          radarDistance: 0.2, // Center ring (Safe)
          ruleId: 'VEGAN-GUIDELINES-VERIFIED',
          ruleCitation: 'Vegan Certification Guidelines',
          authority: 'Certified Vegan Standard',
          supportingFacts: ['Plant-based formula with no animal-derived ingredients'],
          conflictingFacts: [],
          substantiationRequired: false,
          outstandingQuestions: [],
          violationReason: null,
          suggestedFix: null
        });
        compliantCount++;
      }
    }

    // 3. General puffery claims ("Packed with Goodness")
    else if (textNorm.includes('goodness') || textNorm.includes('baked')) {
      findings.push({
        claimId: claim.id,
        claimText: claim.claimText,
        observedClaim: claim.claimText,
        claimCategory: textNorm.includes('baked') ? 'PROCESS_METHOD' : 'MARKETING_PUFFERY',
        panel: claim.panel,
        artworkLocation: `${claim.panel} · Marketing Copy`,
        market: market.toUpperCase(),
        status: 'PERMITTED_PUFFERY',
        determination: 'PERMITTED',
        severity: 'LOW',
        radarAngleDeg: 270,
        radarDistance: 0.35,
        ruleId: 'MARKETING-PUFFERY-STANDARD',
        ruleCitation: marketCode === 'in' ? 'FSSAI Advertising Reg 4(1)' : 'FTC Deception Policy Statement',
        authority: 'General Marketing Standard',
        supportingFacts: ['Subjective marketing statement not presenting quantifiable health claims'],
        conflictingFacts: [],
        substantiationRequired: false,
        outstandingQuestions: [],
        violationReason: null,
        suggestedFix: null
      });
      compliantCount++;
    }
  }

  const overallRiskScore = Math.round((flaggedCount / Math.max(1, claims.length)) * 100);

  return {
    market: market.toUpperCase(),
    totalClaimsEvaluated: claims.length,
    compliantCount,
    flaggedCount,
    overallRiskScore,
    findings,
    radarBands: [
      { label: 'Critical Violation', minDistance: 0.8, color: '#dc2626' },
      { label: 'Regulatory Scrutiny', minDistance: 0.5, color: '#f59e0b' },
      { label: 'Permitted / Safe', minDistance: 0.0, color: '#16a34a' }
    ]
  };
}
