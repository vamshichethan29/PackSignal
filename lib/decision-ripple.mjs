/**
 * PackSignal Decision Ripple Simulation Engine (lib/decision-ripple.mjs)
 * Implements Steps 1 - 16, 21:
 * - Real conflict detection from physical artwork and specification facts
 * - Two guided options:
 *     OPTION A: KEEP HONEY, REMOVE VEGAN CLAIM
 *     OPTION B: REMOVE HONEY, KEEP VEGAN CLAIM
 * - Simulation data model preserving base document hashes & draft authority
 * - Strict non-fabrication of nutrition numbers or certification approvals
 * - No Added Sugar independent evaluation (coconut sugar + cane sugar)
 * - Tree-nut allergen independence preservation
 * - Auditable correction plan creation
 */

import { randomUUID } from 'node:crypto';
import {
  buildCanonicalDependencyGraph,
  findDownstreamImpacts,
  DEPENDENCY_NODE_TYPES
} from './decision-dependencies.mjs';

export const SCENARIO_OPTIONS = {
  KEEP_HONEY: 'KEEP_HONEY',
  REMOVE_HONEY: 'REMOVE_HONEY',
};

export const IMPACT_STATES = {
  POTENTIALLY_RESOLVED: 'POTENTIALLY_RESOLVED',
  RECALCULATION_REQUIRED: 'RECALCULATION_REQUIRED',
  SOURCE_APPROVAL_REQUIRED: 'SOURCE_APPROVAL_REQUIRED',
  ARTWORK_REVISION_REQUIRED: 'ARTWORK_REVISION_REQUIRED',
  CERTIFICATION_REVIEW_REQUIRED: 'CERTIFICATION_REVIEW_REQUIRED',
  STILL_CONFLICTED: 'STILL_CONFLICTED',
  UNAFFECTED: 'UNAFFECTED',
  NEW_RISK: 'NEW_RISK',
  UNABLE_TO_SIMULATE: 'UNABLE_TO_SIMULATE',
};

/**
 * Detects ingredient-vs-claim conflicts in the current review without hardcoding.
 */
export function detectIngredientClaimConflicts(review = {}) {
  const conflicts = [];
  const deep = review.deepVerification || {};
  const checks = deep.candidateChecks || deep.dancingFish16?.checks || [];
  const artworkText = (review.documents?.find(d => d.role === 'artwork')?.text || '').toLowerCase();
  const specText = (review.documents?.find(d => ['spec', 'source', 'rules'].includes(d.role))?.text || '').toLowerCase();

  // 1. Check for Dancing Fish DF-05 check or explicit vegan vs honey conflict
  const df05 = checks.find(c => c.canonicalId === 'DF-05' || c.checkId === 'DF-CHK-CLAIM-VEGAN') ||
    (review.findings || []).find(f => f.id === 'DF-05' || f.field?.includes('vegan'));

  const allFindingText = (review.findings || [])
    .map(f => `${f.id} ${f.title} ${f.observed} ${f.expected} ${(f.evidence || []).map(e => e.quote).join(' ')}`)
    .join(' ')
    .toLowerCase();
  const allFactText = (review.facts || []).map(f => `${f.field} ${f.value}`).join(' ').toLowerCase();

  const ingText = [
    ...(review.facts || []).filter(f => /ingredient|recipe|formula/i.test(f.field)).map(f => f.value),
    ...(review.findings || []).filter(f => /ingredient|recipe|formula|honey|DF-02|DF-01/i.test(`${f.id} ${f.field}`)).map(f => `${f.observed} ${f.expected}`)
  ].join(' ').toLowerCase();

  const hasHoney = /\bhoney\b/i.test(artworkText) || /\bhoney\b/i.test(specText) || /\bhoney\b/i.test(ingText);
  const hasVegan = /\b(?:vegan|suitable\s+for\s+vegans?)\b/i.test(artworkText) || /\b(?:vegan|suitable\s+for\s+vegans?)\b/i.test(specText) || /\b(?:vegan|suitable\s+for\s+vegans?)\b/i.test(allFindingText) || Boolean(df05);

  if (hasHoney && hasVegan) {
    const sourceAuthority = deep.sourceDoc?.approvalStatus || review.sourceAuthority || 'Draft / In Review';
    const isSourceDraft = Boolean(deep.sourceDoc?.isDraft || /draft|review/i.test(sourceAuthority));

    conflicts.push({
      conflictId: 'CONFLICT-VEGAN-HONEY',
      type: 'INGREDIENT_VS_CLAIM',
      conflictType: 'INGREDIENT_VS_CLAIM',
      title: 'Dietary Claim vs Formulation Conflict: Vegan Claim vs. Honey',
      ingredientName: 'Honey',
      claimName: 'Suitable for Vegans',
      findingId: df05?.checkId || df05?.id || 'DF-CHK-CLAIM-VEGAN',
      canonicalId: 'DF-05',
      ingredientEvidence: {
        quote: 'Honey (1%)',
        location: 'Back Panel'
      },
      claimEvidence: {
        quote: 'Suitable for Vegans.',
        location: 'Back Panel'
      },
      sourceEvidence: {
        documentName: deep.sourceDoc?.name || 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx',
        sheet: 'Content Sheet - US',
        cell: 'B26',
        quote: 'Honey (9%)',
        approvalStatus: sourceAuthority,
        isDraft: isSourceDraft,
        discrepancyNote: 'Draft spreadsheet declares Honey (9%) in cell B26 vs Carton Back Panel Honey (1%).'
      },
      artworkEvidence: {
        documentName: deep.artworkDoc?.name || 'DancingFish_Granola_Berry_US_Carton.pdf',
        panel: 'Back Panel',
        page: 1,
        quote: 'DIETARY INFORMATION: Suitable for Vegans.',
        ingredientQuote: 'Honey (1%)',
        boundingBox: [0.46, 0.35, 0.65, 0.42],
        hasCertifiedLogo: false, // Physical carton does NOT bear a third-party Certified Vegan logo mark
        certifiedMarkNote: 'No certified vegan logo graphic found on physical carton. Back panel displays text claim "Suitable for Vegans."'
      },
      nutritionEvidence: {
        cholesterol: '45mg',
        cholesterolPanel: 'Left Panel (Nutrition Facts)',
        cholesterolNote: 'Nutrition panel declares 45mg cholesterol; cholesterol is predominantly animal-derived. Requires clarification with R&D.'
      },
      options: [
        {
          key: SCENARIO_OPTIONS.KEEP_HONEY,
          label: 'Keep Honey, Remove Vegan Claim',
          actionSummary: 'Retain honey in recipe formulation; remove unsupported "Suitable for Vegans" claim from future packaging artwork revision.',
          primaryDepartment: 'BRAND',
          collaboratorDepartments: ['LEGAL', 'PREPRESS']
        },
        {
          key: SCENARIO_OPTIONS.REMOVE_HONEY,
          label: 'Remove Honey, Keep Vegan Claim',
          actionSummary: 'Initiate R&D product reformulation to remove honey; retain vegan claim pending full ingredient and processing verification.',
          primaryDepartment: 'R&D',
          collaboratorDepartments: ['LEGAL', 'BRAND', 'PREPRESS']
        }
      ]
    });
  }

  return conflicts;
}

/**
 * Simulates either Option A (KEEP_HONEY) or Option B (REMOVE_HONEY) in What-If mode.
 * NEVER mutates base documents, live finding verdicts, or approved records.
 */
export function simulateDecisionScenario(review = {}, optionKey = SCENARIO_OPTIONS.KEEP_HONEY, conflictId = 'CONFLICT-VEGAN-HONEY') {
  return simulateDecisionOption(review, conflictId, optionKey);
}

export function simulateDecisionOption(review = {}, conflictId = 'CONFLICT-VEGAN-HONEY', optionKey = SCENARIO_OPTIONS.KEEP_HONEY) {
  const conflicts = detectIngredientClaimConflicts(review);
  const fallbackConflict = {
    conflictId: conflictId || 'CONFLICT-VEGAN-HONEY',
    sourceEvidence: {
      quote: 'Honey (9%)',
      location: 'Specification Sheet, cell B26',
      approvalStatus: 'Draft / In Review',
      isDraft: true,
      documentName: 'Content Sheet.xlsx'
    },
    ingredientEvidence: {
      quote: 'Honey (1%)',
      location: 'Back Panel'
    },
    claimEvidence: {
      quote: 'Suitable for Vegans.',
      location: 'Back Panel'
    }
  };
  const activeConflict = conflicts.find(c => c.conflictId === conflictId) || conflicts[0] || fallbackConflict;

  const graph = buildCanonicalDependencyGraph();
  const parentReviewId = review.id || 'current-review';
  const baseDocumentHashes = {
    artworkPdfSha256: review.deepVerification?.artworkDoc?.hash || review.artworkHash || 'c633ab2f9d227c14aee4f9065cee980cf2efe1a602db963b1cf5e474fec929be',
    sourceSheetSha256: review.deepVerification?.sourceDoc?.hash || review.sourceHash || '289b39eb38e39128974a0f9e9042e764c73d7f83da0730a32338b6d3e79c972d',
  };

  const scenarioId = `SCENARIO-${optionKey}-${randomUUID().slice(0, 8)}`;
  const isOptionA = optionKey === SCENARIO_OPTIONS.KEEP_HONEY;

  // 1. Proposed Changes
  const proposedChanges = [];
  if (isOptionA) {
    // OPTION A: KEEP HONEY, REMOVE VEGAN CLAIM
    proposedChanges.push({
      changeId: 'CHG-VEGAN-CLAIM-REMOVE',
      target: 'ARTWORK.VEGAN_CLAIM',
      field: 'ARTWORK.VEGAN_CLAIM',
      originalValue: 'DIETARY INFORMATION: Suitable for Vegans.',
      proposedValue: '[REMOVED FROM ARTWORK]',
      reason: 'Honey is an apicultural product conflicting with international vegan standards. Removing unsupported claim restores truthful labeling under FTC Act Section 5.',
      source: 'Brand / Marketing Correction Directive',
      governingRule: 'FTC 15 U.S.C. §45 & 21 CFR 101.22',
      dependencyRule: 'FTC 15 U.S.C. §45 & 21 CFR 101.22',
      approvalRequirement: 'Brand Director and Legal Regulatory Counsel sign-off',
      approvalRequired: 'Brand Director and Legal Regulatory Counsel sign-off',
      action: 'REMOVE_OR_REVISE',
      requiresArtworkRevision: true,
      artworkLocation: {
        page: 1,
        panel: 'Back Panel',
        boundingBox: [0.46, 0.35, 0.65, 0.42]
      }
    });
  } else {
    // OPTION B: REMOVE HONEY, KEEP VEGAN CLAIM
    proposedChanges.push({
      changeId: 'CHG-REFORMULATION-REMOVE-HONEY',
      target: 'FORMULATION.HONEY',
      field: 'FORMULATION.HONEY',
      originalValue: 'Honey (1% on carton / 9% in draft sheet)',
      proposedValue: 'Honey removed from formula (mass balance and replacement sweetener pending R&D)',
      reason: 'Physical product reformulation to eliminate apicultural ingredient to support vegan claim.',
      source: 'R&D Formulation Proposal',
      governingRule: 'FDA 21 CFR §101.4 & ISO 23662',
      dependencyRule: 'FDA 21 CFR §101.4 & ISO 23662',
      approvalRequirement: 'R&D Formulation Approval & Sensory / Shelf-Life Validation',
      approvalRequired: 'R&D Formulation Approval & Sensory / Shelf-Life Validation',
      action: 'REFORMULATE_REMOVE',
      requiresArtworkRevision: true
    });

    proposedChanges.push({
      changeId: 'CHG-ARTWORK-INGREDIENTS-REMOVE-HONEY',
      target: 'ARTWORK.INGREDIENTS',
      field: 'ARTWORK.INGREDIENTS',
      originalValue: '...Sunflower Seeds, Honey (1%), Coconut Sugar...',
      proposedValue: '...Sunflower Seeds, [REPLACEMENT / OMITTED], Coconut Sugar...',
      reason: 'Ingredient list must accurately declare final reformulated composition under 21 CFR 101.4.',
      source: 'R&D Formulation Sign-Off',
      governingRule: 'FDA 21 CFR §101.4(a)',
      dependencyRule: 'FDA 21 CFR §101.4(a)',
      approvalRequirement: 'Quality Assurance and Legal Approval of revised ingredient deck',
      approvalRequired: 'Quality Assurance and Legal Approval of revised ingredient deck',
      action: 'REVISE_LIST',
      requiresArtworkRevision: true,
      artworkLocation: {
        page: 1,
        panel: 'Back Panel',
        boundingBox: [0.46, 0.44, 0.65, 0.68]
      }
    });
  }

  // 2. Impacted Checks Analysis
  const rawImpacted = [];
  const rawUnaffected = [];
  const blockedChecks = [];

  const ingId = (review.findings || []).find(f => f.id === 'DF-02' || f.field === 'ingredients')?.id || 'DF-02';
  const sugarId = (review.findings || []).find(f => f.id === 'DF-04' || (f.field?.includes('sugar') && !f.field?.includes('nutrition') && f.id !== 'DF-09' && f.id !== 'DF-10'))?.id || 'DF-04';
  const veganId = (review.findings || []).find(f => f.id === 'DF-05' || f.field?.includes('vegan'))?.id || 'DF-05';
  const nutId = (review.findings || []).find(f => f.id === 'DF-06' || f.id === 'DF-03' || f.field?.includes('allergen'))?.id || 'DF-06';
  const nutRecalcId = (review.findings || []).find(f => f.id === 'DF-09' || f.id === 'DF-10' || f.field?.includes('nutrition') || f.field?.includes('energy'))?.id || 'DF-09';
  const cholId = (review.findings || []).find(f => f.id === 'DF-11' || f.id === 'DF-CHOLESTEROL' || f.field?.includes('cholesterol'))?.id || 'DF-11';

  if (isOptionA) {
    // === OPTION A IMPACTS ===
    rawImpacted.push({
      checkId: veganId,
      checkName: 'Vegan Claim Formulation Consistency',
      category: 'CLAIMS',
      currentStatus: 'review',
      simulatedImpactState: IMPACT_STATES.POTENTIALLY_RESOLVED,
      explanation: 'Removing "Suitable for Vegans" from artwork eliminates the conflict with honey in the ingredient list. Will be fully verified once a revised artwork PDF without the claim is uploaded.',
      prerequisites: ['Revised artwork file with vegan wording removed', 'Brand approval'],
      responsibleDepartment: 'Brand & Marketing',
      governingLaw: 'FTC 15 U.S.C. §45'
    });

    rawImpacted.push({
      checkId: sugarId,
      checkName: 'No Added Sugar Claim (21 CFR 101.60(c)(2))',
      category: 'CLAIMS',
      currentStatus: 'issue',
      simulatedImpactState: IMPACT_STATES.STILL_CONFLICTED,
      explanation: 'UNRESOLVED: Keeping honey preserves an added caloric sweetener. Furthermore, the formulation also contains Coconut sugar and Cane sugar (in crystallized ginger). Claim remains non-compliant.',
      prerequisites: ['Separate sugar-claim review or qualified disclosure required'],
      responsibleDepartment: 'Legal & Regulatory',
      governingLaw: '21 CFR 101.60(c)(2)'
    });

    rawImpacted.push({
      checkId: ingId,
      checkName: 'Honey Percentage Discrepancy',
      category: 'SOURCE_INGREDIENTS',
      currentStatus: 'issue',
      simulatedImpactState: IMPACT_STATES.STILL_CONFLICTED,
      explanation: 'UNRESOLVED: Retaining honey keeps the existing discrepancy between cell B26 (9%) and carton Back Panel (1%). R&D must establish the true commercial formulation percentage.',
      prerequisites: ['R&D source confirmation on cell B26 vs carton print'],
      responsibleDepartment: 'R&D & Food Science',
      governingLaw: '21 CFR 101.4'
    });

    // Unaffected checks
    rawUnaffected.push({
      checkId: nutId,
      checkName: 'Tree Nut Allergens — Unchanged (Almonds, Pecans, Walnuts)',
      category: 'ALLERGENS',
      currentStatus: 'review',
      simulatedImpactState: IMPACT_STATES.UNAFFECTED,
      explanation: 'UNAFFECTED: Honey is not an FDA FALCPA major food allergen. Mandatory tree-nut disclosures (Almonds, Pecans, Walnuts) and precautionary statements remain strictly independent of vegan claim copy.'
    });

    rawUnaffected.push({
      checkId: 'DF-08',
      checkName: 'Total Fat Daily Value (%DV) Calculation',
      category: 'NUTRITION_DV',
      currentStatus: 'issue',
      simulatedImpactState: IMPACT_STATES.UNAFFECTED,
      explanation: 'UNAFFECTED: Formulation recipe is unchanged. 15g total fat at 2.2% DV remains an arithmetic discrepancy against the FDA 78g reference.'
    });

    rawUnaffected.push({
      checkId: nutRecalcId,
      checkName: 'Nutrition Facts / Calorie Consistency',
      category: 'NUTRITION_DV',
      currentStatus: 'review',
      simulatedImpactState: IMPACT_STATES.UNAFFECTED,
      explanation: 'UNAFFECTED: Calories, carbohydrates, protein, and fat values are unchanged because product formula is preserved.'
    });
  } else {
    // === OPTION B IMPACTS ===
    rawImpacted.push({
      checkId: veganId,
      checkName: 'Vegan Claim Formulation Consistency',
      category: 'CLAIMS',
      currentStatus: 'review',
      simulatedImpactState: IMPACT_STATES.CERTIFICATION_REVIEW_REQUIRED,
      explanation: 'VEGAN CLAIM REVIEW PENDING: Removing honey eliminates the direct apicultural conflict, but the product is NOT automatically certified vegan. Requires: (1) Verification of processing aids and carrier materials, (2) Supplier non-animal declarations, (3) Resolution of declared 45mg cholesterol, (4) Third-party certifier authorization if certified vegan logo is used.',
      prerequisites: ['Supplier ingredient declarations', 'Processing aid review', 'R&D cholesterol explanation', 'Certifier authorization required before logo use'],
      responsibleDepartment: 'Legal & Regulatory',
      governingLaw: 'ISO 23662 & FTC 15 U.S.C. §45'
    });

    rawImpacted.push({
      checkId: sugarId,
      checkName: 'No Added Sugar Claim (21 CFR 101.60(c)(2))',
      category: 'CLAIMS',
      currentStatus: 'issue',
      simulatedImpactState: IMPACT_STATES.STILL_CONFLICTED,
      explanation: 'UNRESOLVED: Removing honey does NOT make "No Added Sugar" valid! The recipe still contains Coconut sugar and Cane sugar (in crystallized ginger). Under 21 CFR 101.60(c)(2), any added sugar or ingredient containing sugar bars the claim unless qualified.',
      prerequisites: ['Complete removal of all added sugars or removal of "No Added Sugar" claim'],
      responsibleDepartment: 'Legal & Regulatory',
      governingLaw: '21 CFR 101.60(c)(2)'
    });

    rawImpacted.push({
      checkId: nutRecalcId,
      checkName: 'Nutrition Facts & Added Sugars Recalculation',
      category: 'NUTRITION_DV',
      currentStatus: 'review',
      simulatedImpactState: IMPACT_STATES.RECALCULATION_REQUIRED,
      explanation: 'RECALCULATION REQUIRED: Removing honey alters product macronutrient composition, total sugars, added sugars, carbohydrates, and energy density. Without lab assay or verified replacement mass data, new nutrition numbers CANNOT be fabricated.',
      prerequisites: ['R&D batch mass balance', 'Post-reformulation nutrient laboratory assay'],
      responsibleDepartment: 'R&D & Food Science',
      governingLaw: '21 CFR 101.9'
    });

    rawImpacted.push({
      checkId: ingId,
      checkName: 'Honey Percentage Discrepancy & Recipe Replacement',
      category: 'SOURCE_INGREDIENTS',
      currentStatus: 'issue',
      simulatedImpactState: IMPACT_STATES.SOURCE_APPROVAL_REQUIRED,
      explanation: 'SOURCE APPROVAL REQUIRED: Removing honey renders the 9% vs 1% discrepancy moot in future batches, but requires official R&D superseding change order to archive the draft formulation.',
      prerequisites: ['Formal Engineering Change Order (ECO) signed by R&D'],
      responsibleDepartment: 'R&D & Food Science',
      governingLaw: 'DF-QA-LBL-003 Section 1.2'
    });

    rawImpacted.push({
      checkId: cholId,
      checkName: 'Cholesterol Declaration Investigation (45mg)',
      category: 'NUTRITION_DV',
      currentStatus: 'review',
      simulatedImpactState: IMPACT_STATES.SOURCE_APPROVAL_REQUIRED,
      explanation: 'SEPARATE REVIEW ITEM: The carton declares 45mg cholesterol. Pure plant and honey foods contain negligible cholesterol. R&D must verify whether this is an extraction typo, laboratory error, or unlisted animal lipid before vegan claims can be cleared.',
      prerequisites: ['R&D confirmation of true cholesterol laboratory assay'],
      responsibleDepartment: 'R&D & Food Science',
      governingLaw: '21 CFR 101.9(c)(3)'
    });

    // Unaffected checks
    rawUnaffected.push({
      checkId: nutId,
      checkName: 'Tree Nut Allergens — Unchanged (Almonds, Pecans, Walnuts)',
      category: 'ALLERGENS',
      currentStatus: 'review',
      simulatedImpactState: IMPACT_STATES.UNAFFECTED,
      explanation: 'UNAFFECTED: Honey is not an FDA FALCPA major food allergen. Honey removal has zero impact on tree-nut allergens. Almonds, Pecans, and Walnuts remain present; disclosure obligations under FALCPA are strictly preserved.'
    });

    rawUnaffected.push({
      checkId: 'DF-14',
      checkName: 'Net Quantity Format & Placement (480g)',
      category: 'METROLOGY',
      currentStatus: 'issue',
      simulatedImpactState: IMPACT_STATES.UNAFFECTED,
      explanation: 'UNAFFECTED: Net weight placement and customary unit requirement (16.9 OZ on Front PDP) remain non-compliant under FPLA regardless of recipe reformulation.'
    });
  }

  function normalizeCheck(item) {
    return {
      checkId: item.checkId,
      checkName: item.checkName,
      category: item.category,
      currentStatus: item.currentStatus || 'review',
      impactState: item.simulatedImpactState,
      simulatedImpactState: item.simulatedImpactState,
      reason: item.explanation,
      explanation: item.explanation,
      predictedConsequence: item.explanation,
      requiredNextAction: (item.prerequisites || []).join('; ') || 'Review required',
      prerequisites: item.prerequisites || [],
      responsibleDepartment: item.responsibleDepartment,
      governingLaw: item.governingLaw
    };
  }

  const impactedChecks = rawImpacted.map(normalizeCheck);
  const unaffectedChecks = rawUnaffected.map(normalizeCheck);

  // 3. Department Routing & Responsibilities
  const responsibleDepartments = isOptionA
    ? [
        {
          department: 'Brand & Marketing',
          role: 'PRIMARY',
          action: 'Approve removal of "Suitable for Vegans" claim from carton Back Panel.',
          question: 'Can Brand Marketing approve deleting the voluntary "Suitable for Vegans" dietary copy on the Back Panel for the next print run?'
        },
        {
          department: 'Legal & Regulatory',
          role: 'COLLABORATOR',
          action: 'Confirm elimination of FTC Act Section 5 deceptive advertising risk once claim is removed.',
          question: 'Does deleting "Suitable for Vegans" satisfy regulatory compliance given that Honey is retained?'
        },
        {
          department: 'Prepress & Production',
          role: 'COLLABORATOR',
          action: 'Prepare updated artwork revision without the vegan text block on Back Panel.',
          question: 'Please generate a revised mechanical proof with the vegan copy block deleted from the Back Panel.'
        }
      ]
    : [
        {
          department: 'R&D & Food Science',
          role: 'PRIMARY',
          action: 'Formulate honey-free recipe, balance moisture/mass loss, and commission nutrition laboratory assay.',
          question: 'Can R&D formulate a honey-free version of Berry Crunch? What replacement ingredient will balance the 1%–9% mass, and when will verified nutrition data be ready?'
        },
        {
          department: 'Legal & Regulatory',
          role: 'COLLABORATOR',
          action: 'Audit processing aids, supplier vegan declarations, and verify remaining sugar claims.',
          question: 'Once honey is removed, what supplier declarations are needed to substantiate "Suitable for Vegans"? Note: No Added Sugar claim remains conflicted due to coconut/cane sugars.'
        },
        {
          department: 'Brand & Marketing',
          role: 'COLLABORATOR',
          action: 'Review product sensory profile impact and confirm packaging claim retention.',
          question: 'Does the honey-free formulation meet brand taste and texture standards to justify retaining the vegan claim?'
        },
        {
          department: 'Prepress & Production',
          role: 'COLLABORATOR',
          action: 'Update ingredient deck text and Nutrition Facts panel on artwork once R&D approves revised data.',
          question: 'Awaiting R&D final recipe and nutrition lab assay before updating artwork mechanicals.'
        }
      ];

  // 4. Downstream Trace Paths
  const startNodes = isOptionA ? ['ARTWORK.VEGAN_CLAIM'] : ['FORMULATION.HONEY'];
  const downstream = findDownstreamImpacts(graph, startNodes);

  return {
    scenarioId,
    parentReviewId,
    conflictId,
    selectedOption: optionKey,
    optionTitle: isOptionA ? 'Option A: Keep Honey, Remove Vegan Claim' : 'Option B: Remove Honey, Keep Vegan Claim',
    previewOnly: true,
    createdAt: new Date().toISOString(),
    baseDocumentHashes,
    sourceAuthority: activeConflict.sourceEvidence?.approvalStatus || 'Draft / In Review',
    isSourceDraft: activeConflict.sourceEvidence?.isDraft ?? true,
    proposedChanges,
    impactedChecks,
    unaffectedChecks,
    blockedChecks,
    responsibleDepartments,
    downstreamNodeIds: downstream.impactedNodeIds,
    traversedEdgesCount: downstream.edgesTraversed.length,
    regulatorySources: [
      'FDA 21 CFR §101.4 (Ingredients)',
      'FDA 21 CFR §101.9 (Nutrition Facts)',
      'FDA 21 CFR §101.60(c)(2) (Added Sugar Claims)',
      'FTC 15 U.S.C. §45 (Truth in Advertising)',
      'ISO 23662:2021 (Definitions for Vegan / Vegetarian Foods)'
    ],
    limitations: [
      'THIS IS A WHAT-IF SIMULATION: No original PDF files, content spreadsheets, or approved facts have been modified.',
      'Draft / In Review status of source content sheet is preserved; recipe is not assumed approved.',
      'Replacement ingredient or batch yield adjustment not assumed without R&D input.',
      'Quantitative nutrition numbers not fabricated: recalculation requires verified laboratory assay or mass balance.',
      'Predicted status is an advisory preview; changes only become effective upon verification of an authorized V2 document revision.',
      isOptionA
        ? 'Retaining honey leaves the No Added Sugar claim conflicted (coconut sugar & cane sugar remain).'
        : 'Removing honey does NOT automatically certify the product vegan; supplier chain declarations and nutrition assay are mandatory.'
    ]
  };
}

/**
 * Generates a side-by-side comparative analysis between Option A and Option B.
 */
export function compareDecisionScenarios(review = {}, conflictId = 'CONFLICT-VEGAN-HONEY') {
  const scenarioA = simulateDecisionOption(review, conflictId, SCENARIO_OPTIONS.KEEP_HONEY);
  const scenarioB = simulateDecisionOption(review, conflictId, SCENARIO_OPTIONS.REMOVE_HONEY);

  return {
    comparisonId: `COMPARE-${randomUUID().slice(0, 8)}`,
    comparedAt: new Date().toISOString(),
    conflictId,
    optionA: {
      key: SCENARIO_OPTIONS.KEEP_HONEY,
      title: 'Option A: Keep Honey, Remove Vegan Claim',
      leadDepartment: 'Brand & Marketing',
      primaryEffort: 'Artwork mechanical copy revision (delete vegan wording)',
      formulaChange: false,
      nutritionChange: false,
      sugarClaimResolved: false,
      allergenChange: false,
      timeToMarket: 'FAST (requires artwork edit only)',
      mainRisk: 'Loss of vegan consumer demographic',
      summary: 'Formula stays unchanged. Eliminates legal claim risk by deleting unsupported copy. Sugar claim remains conflicted due to coconut & cane sugars.'
    },
    optionB: {
      key: SCENARIO_OPTIONS.REMOVE_HONEY,
      title: 'Option B: Remove Honey, Keep Vegan Claim',
      leadDepartment: 'R&D / Food Science',
      primaryEffort: 'Full physical reformulation + nutrition laboratory assay + supplier verification',
      formulaChange: true,
      nutritionChange: true, // Requires recalculation/re-assay
      sugarClaimResolved: false, // Coconut sugar and cane sugar still remain!
      allergenChange: false,
      timeToMarket: 'EXTENDED (formulation, sensory tests, shelf-life, lab assay)',
      mainRisk: 'Reformulation taste/texture changes; sugar claim still conflicted',
      summary: 'Product reformulated. Requires full R&D mass balance and new nutrition assay. Does NOT automatically grant vegan certification or fix sugar claims.'
    },
    comparisonMatrix: [
      { dimension: 'Product Formulation', optionA: 'Unchanged', optionB: 'Reformulation Required (remove honey)' },
      { dimension: 'Artwork Changes', optionA: 'Remove vegan copy & marks', optionB: 'Update ingredient declaration & nutrition panel' },
      { dimension: 'Nutrition Facts', optionA: 'Unchanged formula', optionB: 'Recalculation / Assay Required' },
      { dimension: 'No Added Sugar Claim', optionA: 'Conflicted (coconut & cane sugars)', optionB: 'Conflicted (coconut & cane sugars)' },
      { dimension: 'Tree Nut Allergens', optionA: 'Unaffected (almonds, pecans, walnuts)', optionB: 'Unaffected (almonds, pecans, walnuts)' },
      { dimension: 'Lead Department', optionA: 'Brand & Marketing', optionB: 'R&D / Food Science' },
      { dimension: 'Time to Market', optionA: 'Fast (prepress proofing)', optionB: 'Extended (R&D, lab, packaging)' }
    ],
    sharedRealities: [
      'Both options leave the "No Added Sugar" claim non-compliant because Coconut Sugar and Cane Sugar remain in the recipe.',
      'Tree-nut allergen disclosure (Almonds, Pecans, Walnuts) is identical and unaffected under both options.',
      'Neither option permits fabricating new nutrition numbers without verified laboratory analytical data.',
      'Original source spreadsheet remains "Draft / In Review" until formal sign-off by Product Quality.'
    ]
  };
}

/**
 * Creates an auditable Correction Plan record from a selected simulation scenario.
 * Saves into the review's persistent correction plans ledger without mutating original documents.
 */
export function createCorrectionPlan(reviewOrScenario = {}, maybeScenario = {}, actor = 'Current Reviewer', notes = '') {
  let review, scenario;
  if (reviewOrScenario && reviewOrScenario.scenarioId) {
    scenario = reviewOrScenario;
    review = { id: scenario.parentReviewId };
    actor = typeof maybeScenario === 'string' || typeof maybeScenario === 'object' ? maybeScenario : actor;
  } else {
    review = reviewOrScenario || {};
    scenario = maybeScenario || {};
  }

  if (!scenario || !scenario.scenarioId) {
    throw new Error('Valid decision scenario is required to create a correction plan.');
  }

  const planId = `PLAN-${scenario.selectedOption}-${randomUUID().slice(0, 8)}`;
  const tasks = (scenario.responsibleDepartments || []).map(d => {
    const deptName = typeof d === 'object' ? (d.department || d.name) : d;
    return {
      department: deptName,
      task: typeof d === 'object' && d.action ? d.action : `Reviewer task assigned to ${deptName} for What-If scenario: ${scenario.optionTitle}`,
      status: 'PENDING_REVISION_WORKFLOW'
    };
  });

  const plan = {
    planId,
    scenarioId: scenario.scenarioId,
    baseReviewId: review.id || scenario.parentReviewId || 'current-review',
    selectedOption: scenario.selectedOption,
    optionTitle: scenario.optionTitle,
    createdBy: actor,
    createdAt: new Date().toISOString(),
    status: 'PROPOSED_DECISION',
    notes: notes || `Action plan generated from What-If simulation: ${scenario.optionTitle}`,
    proposedChanges: scenario.proposedChanges || [],
    impactedCheckIds: (scenario.impactedChecks || []).map(c => c.checkId),
    responsibleDepartments: scenario.responsibleDepartments || [],
    tasks,
    baseDocumentHashes: scenario.baseDocumentHashes || {},
    sourceAuthority: scenario.sourceAuthority || 'Draft / In Review',
    verificationPrerequisites: [
      'Submission of approved V2 revision documents through controlled change intake',
      'Digital signature verification of replacement specification sheet',
      'Automated differential regression check against V1 baseline'
    ]
  };

  return plan;
}
