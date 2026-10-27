/**
 * PackSignal Smart Question Builder (lib/questions/question-builder.mjs)
 * 
 * Synthesizes actionable reviewer questions from:
 * - Sourced value conflicts (Honey 1% vs 9%)
 * - Semantic conflicts (No Added Sugar vs sweeteners, Vegan claim vs honey)
 * - Allergen advisory overlaps
 * - Ambiguous nutrition measurement bases
 * - Serving-size arithmetic discrepancies
 * - Design asset decisions
 */

export function buildCandidateQuestions(params) {
  const {
    facts = [],
    conflicts = [],
    evaluations = [],
    marketPack = {},
    designAssets = []
  } = params;

  const candidates = [];
  const templates = marketPack.referenceData?.questionTemplates || [];
  const templateMap = new Map(templates.map(t => [t.triggerId, t]));

  // 1. Conflict-Driven Questions
  for (const c of conflicts) {
    if (c.field?.includes('honey') || c.conflictId?.includes('HONEY')) {
      const tmpl = templateMap.get('CONFLICT_HONEY_PERCENTAGE');
      candidates.push({
        questionId: 'Q-HONEY-PERCENTAGE',
        triggerId: 'CONFLICT_HONEY_PERCENTAGE',
        title: tmpl?.title || 'Which ingredient formulation is approved for the next artwork revision?',
        question: tmpl?.question || 'Artwork declares Honey (1%) while specification sheet states Honey (9%). Which recipe percentage is authoritative for production?',
        reason: 'Honey percentage conflict between specification and artwork directly blocks QUID compliance and recipe substantiation.',
        impact: 'High: Blocks QUID ingredient declaration and recipe substantiation.',
        affectedRules: ['US-INGR-001', 'US-CLAIM-001'],
        affectedFacts: c.factIds || [],
        responsibleDepartment: 'R&D / Formulations',
        priorityBase: 92,
        answerType: 'CHOICE',
        answerOptions: ['1% (Artwork formulation)', '9% (Specification formula)', 'Other approved revision'],
        resolutionEffect: 'Unblocks ingredient QUID declaration and recipe validation.'
      });
    }

    if (c.field?.includes('carbohydrate') || c.conflictId?.includes('CARBOHYDRATE')) {
      const tmpl = templateMap.get('AMBIGUOUS_NUTRITION_BASIS');
      candidates.push({
        questionId: 'Q-NUTRITION-BASIS',
        triggerId: 'AMBIGUOUS_NUTRITION_BASIS',
        title: tmpl?.title || 'Can R&D confirm the calculation basis for the Nutrition Facts values?',
        question: tmpl?.question || 'Nutrient declarations appear to mix per-serving (85g) and per-100g amounts. Can R&D confirm the authoritative analytical basis?',
        reason: 'Mismatched nutritional measurement basis blocks valid % Daily Value calculations and Atwater energy plausibility screening.',
        impact: 'High: Affects all statutory Nutrition Facts % Daily Value calculations.',
        affectedRules: ['US-NUTR-004', 'US-NUTR-005', 'US-NUTR-009'],
        affectedFacts: c.factIds || [],
        responsibleDepartment: 'R&D / Formulations',
        priorityBase: 90,
        answerType: 'CHOICE',
        answerOptions: ['Per 85g Serving', 'Per 100g Analytical Basis', 'Dual Column Declaration'],
        resolutionEffect: 'Unblocks nutrition cross-checks and calorie plausibility evaluation.'
      });
    }

    if (c.conflictId?.includes('INGREDIENT-LIST') || c.conflictType === 'INGREDIENT_LIST_DIFF') {
      candidates.push({
        questionId: 'Q-INGREDIENT-ADDITIONS',
        triggerId: 'INGREDIENT_LIST_DIFF',
        title: 'Confirm authorization of printed ingredient list additions',
        question: 'Artwork declares ingredients (e.g. Walnuts, Flax Seeds) not listed in the specification sheet. Are these authorized additions to the product formula?',
        reason: 'Discrepancy between printed ingredients and specification formulation sheet.',
        impact: 'Critical: Packaging must accurately declare all recipe ingredients and allergens.',
        affectedRules: ['US-INGR-001', 'US-ALLERG-001'],
        affectedFacts: c.factIds || [],
        responsibleDepartment: 'R&D / Formulations',
        priorityBase: 88,
        answerType: 'CHOICE',
        answerOptions: ['Additions are authorized in current recipe', 'Specification sheet is correct; revise artwork', 'Reconcile with production formula'],
        resolutionEffect: 'Ensures printed label accurately reflects production formula.'
      });
    }
  }

  // 2. Evaluation-Driven Questions (Rule Issues and Needs Review)
  for (const ev of evaluations) {
    if (ev.status === 'ISSUE' && ev.ruleId === 'US-CLAIM-001') {
      const tmpl = templateMap.get('NO_ADDED_SUGAR_WITH_SWEETENERS');
      candidates.push({
        questionId: 'Q-NO-ADDED-SUGAR',
        triggerId: 'NO_ADDED_SUGAR_WITH_SWEETENERS',
        title: tmpl?.title || 'Does the approved formula support the "No Added Sugar" marketing claim?',
        question: tmpl?.question || 'Packaging claims "No Added Sugar", but ingredients include Honey, Coconut Sugar, and Crystallized Ginger (cane sugar). Does Legal approve this claim?',
        reason: 'Under 21 CFR 101.60(c)(2), foods containing added sugars or sugar-containing ingredients cannot claim "No Added Sugar".',
        impact: 'Critical: Direct regulatory violation risking warning letters or misbranding.',
        affectedRules: ['US-CLAIM-001'],
        affectedFacts: [],
        responsibleDepartment: 'Regulatory & Legal',
        priorityBase: 94,
        answerType: 'CHOICE',
        answerOptions: ['Remove "No Added Sugar" claim', 'Reformulate to remove added sweeteners', 'Retain with statutory disclaimer'],
        resolutionEffect: 'Removes regulatory misbranding exposure.'
      });
    }

    if (ev.status === 'NEEDS_REVIEW' && ev.ruleId === 'US-ALLERG-003') {
      const tmpl = templateMap.get('ALLERGEN_ADVISORY_OVERLAP');
      candidates.push({
        questionId: 'Q-ALLERGEN-ADVISORY',
        triggerId: 'ALLERGEN_ADVISORY_OVERLAP',
        title: tmpl?.title || 'Can Legal confirm the tree-nut ingredient and precautionary allergen wording?',
        question: tmpl?.question || 'Almonds and pecans are intentional recipe ingredients, but also appear in the "May Contain" advisory statement. Can Legal verify if this advisory wording should be corrected?',
        reason: 'Listing intentional recipe ingredients in a "May Contain" statement creates consumer confusion and contradicts FDA allergen labeling guidance.',
        impact: 'High: Consumer safety communication and compliance with FDA allergen guidance.',
        affectedRules: ['US-ALLERG-002', 'US-ALLERG-003'],
        affectedFacts: [],
        responsibleDepartment: 'Regulatory & Legal',
        priorityBase: 86,
        answerType: 'CHOICE',
        answerOptions: ['Remove intentional nuts from advisory statement', 'Retain current wording per QA risk assessment'],
        resolutionEffect: 'Aligns packaging copy with FDA allergen advisory best practices.'
      });
    }

    if (ev.status === 'ISSUE' && ev.ruleId === 'US-NUTR-003') {
      const tmpl = templateMap.get('SERVING_ARITHMETIC_INCONSISTENCY');
      candidates.push({
        questionId: 'Q-SERVING-ARITHMETIC',
        triggerId: 'SERVING_ARITHMETIC_INCONSISTENCY',
        title: tmpl?.title || 'Can the product owner confirm the approved serving size and servings per container?',
        question: tmpl?.question || 'The panel declares 8 servings at 85g per serving (totalling 680g), but the package net weight is 480g. Which value represents the verified product packaging?',
        reason: 'Arithmetic inconsistency between serving size, serving count, and package net weight violates 21 CFR 101.9(b).',
        impact: 'High: Package net quantity and serving table must be mathematically consistent.',
        affectedRules: ['US-NUTR-003'],
        affectedFacts: [],
        responsibleDepartment: 'Prepress & Packaging',
        priorityBase: 84,
        answerType: 'CHOICE',
        answerOptions: ['Adjust serving size to match net weight', 'Adjust servings per container to 5.6', 'Retain 480g / 8 servings with R&D justification'],
        resolutionEffect: 'Resolves package mass balance consistency.'
      });
    }
  }

  // 3. Dietary Claim Semantic Questions
  const veganFact = facts.find(f => /vegan/i.test(f.value));
  const honeyFact = facts.find(f => /honey/i.test(f.field) || /honey/i.test(f.value));
  if (veganFact && honeyFact) {
    const tmpl = templateMap.get('VEGAN_CLAIM_WITH_HONEY');
    candidates.push({
      questionId: 'Q-VEGAN-HONEY',
      triggerId: 'VEGAN_CLAIM_WITH_HONEY',
      title: tmpl?.title || 'Can Brand confirm whether the vegan claim is authorized and adequately substantiated?',
      question: tmpl?.question || 'The artwork declares "Suitable for Vegans" but also declares Honey as an ingredient. Does Brand authorize this dietary claim for the US market?',
      reason: 'Honey is an animal-derived ingredient; unqualified vegan claims on honey-containing products face regulatory challenge and consumer objection.',
      impact: 'Medium: Brand trust and dietary claim substantiation.',
      affectedRules: ['US-CLAIM-001'],
      affectedFacts: [veganFact.factId, honeyFact.factId],
      responsibleDepartment: 'Brand & Marketing',
      priorityBase: 82,
      answerType: 'CHOICE',
      answerOptions: ['Authorize claim with honey disclosure', 'Remove "Suitable for Vegans" wording', 'Replace honey with plant syrup'],
      resolutionEffect: 'Clarifies brand claim policy regarding honey.'
    });
  }

  // 4. Design Asset Decision Question
  if (designAssets.length > 0) {
    candidates.push({
      questionId: 'Q-DESIGN-ASSET-DECISIONS',
      triggerId: 'DESIGN_ASSET_DECISION',
      title: 'Which existing brand design elements must remain unchanged in the next revision?',
      question: `Review the ${designAssets.length} detected design assets (logos, colors, tagline) and indicate whether each should be KEPT, CHANGED, ADDED, or REMOVED in the creative brief.`,
      reason: 'Directly establishes the visual brand requirements for the next packaging artwork revision.',
      impact: 'High: Shapes creative brief deliverables for agency designers.',
      affectedRules: [],
      affectedFacts: [],
      responsibleDepartment: 'Brand & Marketing',
      priorityBase: 78,
      answerType: 'CHOICE',
      answerOptions: ['KEEP', 'CHANGE', 'ADD', 'REMOVE'],
      resolutionEffect: 'Populates creative brief design requirements.'
    });
  }

  return candidates;
}
