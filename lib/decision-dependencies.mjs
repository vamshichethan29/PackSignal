/**
 * PackSignal Decision Ripple Dependency Graph Engine (lib/decision-dependencies.mjs)
 * Implements Step 12: Canonical Impact & Dependency Graph.
 *
 * Models directed relationships between:
 * - Formulation inputs (honey, coconut sugar, cane sugar, batch mass)
 * - Artwork declarations (ingredients, claims, added sugars label)
 * - Nutrition calculations (calories, sugars, carbohydrates, cholesterol)
 * - Allergen disclosures (tree nuts)
 * - Certifications (vegan)
 * - Review workflows (R&D, Legal, Brand, Prepress)
 *
 * Every edge carries: type, reason, evaluator, requiredInputs, sourceRule, limitations.
 * Strictly avoids fake causality or circular loops.
 */

export const DEPENDENCY_NODE_TYPES = {
  FORMULATION: 'FORMULATION',
  ARTWORK: 'ARTWORK',
  NUTRITION: 'NUTRITION',
  ALLERGEN: 'ALLERGEN',
  CERTIFICATION: 'CERTIFICATION',
  REVIEW: 'REVIEW',
};

export const DEPENDENCY_EDGE_TYPES = {
  DIRECT_INPUT: 'DIRECT_INPUT',
  MATHEMATICAL: 'MATHEMATICAL',
  SUBSTANTIATION: 'SUBSTANTIATION',
  LABELING_DISCLOSURE: 'LABELING_DISCLOSURE',
  REGULATORY_REVIEW: 'REGULATORY_REVIEW',
  PRODUCTION_TASK: 'PRODUCTION_TASK',
};

/**
 * Builds the canonical directed dependency graph for packaging compliance.
 */
export function buildCanonicalDependencyGraph() {
  const nodes = new Map([
    // Formulation Nodes
    ['FORMULATION.HONEY', {
      id: 'FORMULATION.HONEY',
      label: 'Honey Ingredient',
      category: DEPENDENCY_NODE_TYPES.FORMULATION,
      description: 'Honey presence and concentration in recipe formulation.',
      currentAuthority: 'DRAFT',
      unresolvedDiscrepancy: '9% (content sheet B26) vs 1% (carton Back Panel)',
    }],
    ['FORMULATION.COCONUT_SUGAR', {
      id: 'FORMULATION.COCONUT_SUGAR',
      label: 'Coconut Sugar',
      category: DEPENDENCY_NODE_TYPES.FORMULATION,
      description: 'Caloric sweetener ingredient in recipe.',
      currentAuthority: 'DRAFT',
    }],
    ['FORMULATION.CANE_SUGAR', {
      id: 'FORMULATION.CANE_SUGAR',
      label: 'Cane Sugar (in Ginger)',
      category: DEPENDENCY_NODE_TYPES.FORMULATION,
      description: 'Added sugar component of crystallized ginger.',
      currentAuthority: 'DRAFT',
    }],
    ['FORMULATION.TOTAL_BATCH_MASS', {
      id: 'FORMULATION.TOTAL_BATCH_MASS',
      label: 'Batch Yield & Mass Balance',
      category: DEPENDENCY_NODE_TYPES.FORMULATION,
      description: 'Total formulation mass before and after baking/drying.',
      currentAuthority: 'DRAFT',
    }],

    // Artwork Declarations
    ['ARTWORK.INGREDIENTS', {
      id: 'ARTWORK.INGREDIENTS',
      label: 'Ingredient List (Carton Back)',
      category: DEPENDENCY_NODE_TYPES.ARTWORK,
      description: 'Mandatory ingredient declaration under 21 CFR 101.4.',
      panel: 'Back',
      boundingBox: [0.46, 0.44, 0.65, 0.68],
    }],
    ['ARTWORK.VEGAN_CLAIM', {
      id: 'ARTWORK.VEGAN_CLAIM',
      label: 'Suitable for Vegans Claim',
      category: DEPENDENCY_NODE_TYPES.ARTWORK,
      description: 'Voluntary dietary marketing statement on Back Panel.',
      panel: 'Back',
      quote: 'DIETARY INFORMATION: Suitable for Vegans.',
      boundingBox: [0.46, 0.35, 0.65, 0.42],
    }],
    ['ARTWORK.NO_ADDED_SUGAR_CLAIM', {
      id: 'ARTWORK.NO_ADDED_SUGAR_CLAIM',
      label: 'No Added Sugar Claim',
      category: DEPENDENCY_NODE_TYPES.ARTWORK,
      description: 'Voluntary nutrient content claim under 21 CFR 101.60(c)(2).',
      panel: 'Top Flap',
      quote: 'NO ADDED SUGAR',
    }],
    ['ARTWORK.ADDED_SUGARS_LABEL', {
      id: 'ARTWORK.ADDED_SUGARS_LABEL',
      label: '0g Added Sugars Declaration',
      category: DEPENDENCY_NODE_TYPES.ARTWORK,
      description: 'Quantitative line in Nutrition Facts under 21 CFR 101.9(c)(6)(iii).',
      panel: 'Left',
      quote: 'Incl. 0g Added Sugars',
    }],

    // Nutrition Values
    ['NUTRITION.CALORIES', {
      id: 'NUTRITION.CALORIES',
      label: 'Calories (Energy)',
      category: DEPENDENCY_NODE_TYPES.NUTRITION,
      description: 'Declared energy content per serving.',
      panel: 'Left',
      currentValue: '166 kcal',
    }],
    ['NUTRITION.TOTAL_SUGARS', {
      id: 'NUTRITION.TOTAL_SUGARS',
      label: 'Total Sugars',
      category: DEPENDENCY_NODE_TYPES.NUTRITION,
      description: 'Declared mono- and disaccharides per serving.',
      panel: 'Left',
    }],
    ['NUTRITION.ADDED_SUGARS', {
      id: 'NUTRITION.ADDED_SUGARS',
      label: 'Added Sugars (Nutrient)',
      category: DEPENDENCY_NODE_TYPES.NUTRITION,
      description: 'Sugars added during processing per 21 CFR 101.9.',
      panel: 'Left',
    }],
    ['NUTRITION.CARBOHYDRATES', {
      id: 'NUTRITION.CARBOHYDRATES',
      label: 'Total Carbohydrate',
      category: DEPENDENCY_NODE_TYPES.NUTRITION,
      description: 'Total carbohydrates per serving.',
      panel: 'Left',
      currentValue: '66g',
    }],
    ['NUTRITION.CHOLESTEROL', {
      id: 'NUTRITION.CHOLESTEROL',
      label: 'Cholesterol Declaration',
      category: DEPENDENCY_NODE_TYPES.NUTRITION,
      description: 'Declared 45mg cholesterol on Nutrition Facts panel.',
      panel: 'Left',
      currentValue: '45mg',
      note: 'Investigate source typo vs genuine animal lipid.',
    }],

    // Allergen Disclosures
    ['ALLERGENS.TREE_NUTS', {
      id: 'ALLERGENS.TREE_NUTS',
      label: 'Tree Nut Allergen Disclosure',
      category: DEPENDENCY_NODE_TYPES.ALLERGEN,
      description: 'Major food allergen disclosure under FALCPA (Almonds, Pecans, Walnuts).',
      panel: 'Back',
      currentStatus: 'Mandatory in ingredient list; voluntary May Contain advisory.',
    }],

    // Certifications
    ['CERTIFICATION.VEGAN', {
      id: 'CERTIFICATION.VEGAN',
      label: 'Third-Party Vegan Certification',
      category: DEPENDENCY_NODE_TYPES.CERTIFICATION,
      description: 'Formal certification mark or standard review (e.g. Vegan Society / vegan.org).',
      authority: 'Third-Party Certification Body',
    }],

    // Department Review Workflows
    ['REVIEW.RND', {
      id: 'REVIEW.RND',
      label: 'R&D / Food Science',
      category: DEPENDENCY_NODE_TYPES.REVIEW,
      department: 'R&D',
      responsibilities: 'Formulation, mass balance, ingredient percentages, lab nutrition assays.',
    }],
    ['REVIEW.LEGAL', {
      id: 'REVIEW.LEGAL',
      label: 'Legal & Regulatory',
      category: DEPENDENCY_NODE_TYPES.REVIEW,
      department: 'LEGAL',
      responsibilities: 'Claim substantiation (21 CFR 101.60), FALCPA compliance, FTC truth in advertising.',
    }],
    ['REVIEW.BRAND', {
      id: 'REVIEW.BRAND',
      label: 'Brand & Marketing',
      category: DEPENDENCY_NODE_TYPES.REVIEW,
      department: 'BRAND',
      responsibilities: 'Consumer messaging, package claims copy, certification logo licensing.',
    }],
    ['REVIEW.PREPRESS', {
      id: 'REVIEW.PREPRESS',
      label: 'Prepress & Production',
      category: DEPENDENCY_NODE_TYPES.REVIEW,
      department: 'PREPRESS',
      responsibilities: 'Artwork file revision, plate generation, layer separation.',
    }],
  ]);

  // Directed edges modeling deterministic legal, physical, and organizational causality
  const edges = [
    // 1. Honey -> Ingredients list
    {
      from: 'FORMULATION.HONEY',
      to: 'ARTWORK.INGREDIENTS',
      type: DEPENDENCY_EDGE_TYPES.LABELING_DISCLOSURE,
      reason: 'Mandatory declaration of ingredients in descending order of predominance under 21 CFR 101.4(a).',
      evaluator: 'ingredient_list_diff',
      requiredInputs: ['formula_composition', 'predominance_order'],
      sourceRule: 'FDA 21 CFR §101.4',
    },
    // 2. Honey -> Vegan Claim
    {
      from: 'FORMULATION.HONEY',
      to: 'ARTWORK.VEGAN_CLAIM',
      type: DEPENDENCY_EDGE_TYPES.SUBSTANTIATION,
      reason: 'Honey is an insect/bee-derived product excluded under international vegan definitions (ISO 23662, Vegan Society).',
      evaluator: 'vegan_criteria_screener',
      requiredInputs: ['honey_presence'],
      sourceRule: 'FTC 15 U.S.C. §45 & ISO 23662',
    },
    // 3. Honey -> Added Sugars Assessment
    {
      from: 'FORMULATION.HONEY',
      to: 'ARTWORK.NO_ADDED_SUGAR_CLAIM',
      type: DEPENDENCY_EDGE_TYPES.SUBSTANTIATION,
      reason: 'Honey is an added caloric sweetener. Under 21 CFR 101.60(c)(2), products with added sugars cannot bear "No Added Sugar" claims unless qualified.',
      evaluator: 'sugar_claim_screener',
      requiredInputs: ['sweetener_ingredients'],
      sourceRule: 'FDA 21 CFR §101.60(c)(2)',
    },
    // 4. Honey -> 0g Added Sugars Declaration
    {
      from: 'FORMULATION.HONEY',
      to: 'ARTWORK.ADDED_SUGARS_LABEL',
      type: DEPENDENCY_EDGE_TYPES.MATHEMATICAL,
      reason: 'Honey contributes to quantitative Added Sugars line per 21 CFR 101.9(c)(6)(iii).',
      evaluator: 'added_sugars_calculator',
      requiredInputs: ['honey_grams_per_serving'],
      sourceRule: 'FDA 21 CFR §101.9(c)(6)(iii)',
    },
    // 5. Honey -> Nutrition Calculations
    {
      from: 'FORMULATION.HONEY',
      to: 'NUTRITION.CALORIES',
      type: DEPENDENCY_EDGE_TYPES.MATHEMATICAL,
      reason: 'Honey contributes 3.04 kcal/g (carbohydrate energy). Removal alters total energy.',
      evaluator: 'atwater_macronutrient_screen',
      requiredInputs: ['honey_grams', 'batch_yield', 'moisture_loss'],
      sourceRule: 'FDA 21 CFR §101.9(c)(1)(i)',
    },
    {
      from: 'FORMULATION.HONEY',
      to: 'NUTRITION.TOTAL_SUGARS',
      type: DEPENDENCY_EDGE_TYPES.MATHEMATICAL,
      reason: 'Honey is ~82% sugars by weight (fructose and glucose).',
      evaluator: 'macronutrient_recalculation',
      requiredInputs: ['honey_grams_per_serving'],
      sourceRule: 'FDA 21 CFR §101.9(c)(6)(ii)',
    },
    {
      from: 'FORMULATION.HONEY',
      to: 'NUTRITION.ADDED_SUGARS',
      type: DEPENDENCY_EDGE_TYPES.MATHEMATICAL,
      reason: 'Honey is 100% added sugars under the 2016 Nutrition Facts definition.',
      evaluator: 'macronutrient_recalculation',
      requiredInputs: ['honey_grams_per_serving'],
      sourceRule: 'FDA 21 CFR §101.9(c)(6)(iii)',
    },
    {
      from: 'FORMULATION.HONEY',
      to: 'NUTRITION.CARBOHYDRATES',
      type: DEPENDENCY_EDGE_TYPES.MATHEMATICAL,
      reason: 'Honey carbohydrates contribute directly to total carbohydrate grams.',
      evaluator: 'macronutrient_recalculation',
      requiredInputs: ['honey_carbohydrate_grams'],
      sourceRule: 'FDA 21 CFR §101.9(c)(6)',
    },
    // 6. Other Sugars -> No Added Sugar Claim
    {
      from: 'FORMULATION.COCONUT_SUGAR',
      to: 'ARTWORK.NO_ADDED_SUGAR_CLAIM',
      type: DEPENDENCY_EDGE_TYPES.SUBSTANTIATION,
      reason: 'Coconut Sugar is an independent added caloric sweetener barring the "No Added Sugar" claim.',
      evaluator: 'sugar_claim_screener',
      requiredInputs: ['coconut_sugar_presence'],
      sourceRule: 'FDA 21 CFR §101.60(c)(2)',
    },
    {
      from: 'FORMULATION.CANE_SUGAR',
      to: 'ARTWORK.NO_ADDED_SUGAR_CLAIM',
      type: DEPENDENCY_EDGE_TYPES.SUBSTANTIATION,
      reason: 'Cane Sugar in crystallized ginger is an independent added sweetener barring the claim.',
      evaluator: 'sugar_claim_screener',
      requiredInputs: ['cane_sugar_presence'],
      sourceRule: 'FDA 21 CFR §101.60(c)(2)',
    },
    // 7. Honey -> Certification
    {
      from: 'FORMULATION.HONEY',
      to: 'CERTIFICATION.VEGAN',
      type: DEPENDENCY_EDGE_TYPES.SUBSTANTIATION,
      reason: 'Third-party vegan certifiers reject formulations containing apicultural products.',
      evaluator: 'certification_standards_evaluator',
      requiredInputs: ['ingredient_origin_declarations'],
      sourceRule: 'Vegan.org / Vegan Action Standards',
    },
    // 8. Workflows
    {
      from: 'FORMULATION.HONEY',
      to: 'REVIEW.RND',
      type: DEPENDENCY_EDGE_TYPES.REGULATORY_REVIEW,
      reason: 'Reformulation or quantity confirmation requires R&D sign-off.',
      evaluator: 'governance_workflow',
      requiredInputs: ['formulation_specification'],
      sourceRule: 'DF-QA-LBL-003 Section 1.2',
    },
    {
      from: 'ARTWORK.VEGAN_CLAIM',
      to: 'REVIEW.LEGAL',
      type: DEPENDENCY_EDGE_TYPES.REGULATORY_REVIEW,
      reason: 'Claim retention or removal requires Legal substantiation under consumer protection laws.',
      evaluator: 'governance_workflow',
      requiredInputs: ['claim_copy', 'recipe_evidence'],
      sourceRule: 'FTC Act Section 5',
    },
    {
      from: 'ARTWORK.VEGAN_CLAIM',
      to: 'REVIEW.BRAND',
      type: DEPENDENCY_EDGE_TYPES.REGULATORY_REVIEW,
      reason: 'Brand marketing strategy governs voluntary dietary and lifestyle claims on packaging.',
      evaluator: 'brand_governance',
      requiredInputs: ['marketing_guidelines'],
      sourceRule: 'Brand Identity Standards',
    },
    {
      from: 'ARTWORK.VEGAN_CLAIM',
      to: 'REVIEW.PREPRESS',
      type: DEPENDENCY_EDGE_TYPES.PRODUCTION_TASK,
      reason: 'Removal of claim text requires artwork layer edit and plate update.',
      evaluator: 'preflight_task',
      requiredInputs: ['approved_artwork_revision'],
      sourceRule: 'Prepress SOP 4.1',
    },
    {
      from: 'ARTWORK.INGREDIENTS',
      to: 'REVIEW.PREPRESS',
      type: DEPENDENCY_EDGE_TYPES.PRODUCTION_TASK,
      reason: 'Revision of ingredient list text requires new artwork proof.',
      evaluator: 'preflight_task',
      requiredInputs: ['approved_ingredient_copy'],
      sourceRule: 'Prepress SOP 4.1',
    },
  ];

  return { nodes, edges };
}

/**
 * Checks for invalid circular loops in the dependency graph.
 */
export function validateNoInvalidCycles(rawGraph = buildCanonicalDependencyGraph()) {
  const graph = rawGraph && rawGraph.nodes instanceof Map ? rawGraph : buildCanonicalDependencyGraph();
  const visited = new Set();
  const recStack = new Set();
  const cycles = [];

  const adj = new Map();
  for (const nodeKey of graph.nodes.keys()) {
    adj.set(nodeKey, []);
  }
  for (const edge of graph.edges) {
    if (adj.has(edge.from)) {
      adj.get(edge.from).push(edge.to);
    }
  }

  function dfs(node, path) {
    visited.add(node);
    recStack.add(node);

    for (const neighbor of (adj.get(node) || [])) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path, neighbor]);
      } else if (recStack.has(neighbor)) {
        cycles.push([...path, neighbor]);
      }
    }

    recStack.delete(node);
  }

  for (const nodeKey of graph.nodes.keys()) {
    if (!visited.has(nodeKey)) {
      dfs(nodeKey, [nodeKey]);
    }
  }

  const hasCycles = cycles.length > 0;
  return {
    valid: !hasCycles,
    hasCycles,
    cycles,
    cycle: cycles[0] || null,
  };
}

/**
 * Finds all direct and downstream dependent nodes from a starting set of nodes.
 * Supports both findDownstreamImpacts(graph, startNodes) and findDownstreamImpacts(nodeId)
 */
export function findDownstreamImpacts(graphOrNode, maybeStartNodes = []) {
  let graph;
  let startNodes;

  if (typeof graphOrNode === 'string') {
    graph = buildCanonicalDependencyGraph();
    startNodes = [graphOrNode];
  } else if (Array.isArray(graphOrNode)) {
    graph = buildCanonicalDependencyGraph();
    startNodes = graphOrNode;
  } else {
    graph = graphOrNode || buildCanonicalDependencyGraph();
    startNodes = Array.isArray(maybeStartNodes) ? maybeStartNodes : [maybeStartNodes];
  }

  const impacted = new Set();
  const edgesTraversed = [];
  const queue = [...startNodes];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const edge of graph.edges) {
      if (edge.from === current && !impacted.has(edge.to)) {
        impacted.add(edge.to);
        edgesTraversed.push(edge);
        queue.push(edge.to);
      }
    }
  }

  const nodeIds = Array.from(impacted);
  // Support both array methods (like .includes) and object properties
  Object.defineProperties(nodeIds, {
    impactedNodeIds: { value: nodeIds, enumerable: true },
    edgesTraversed: { value: edgesTraversed, enumerable: true }
  });

  return nodeIds;
}

export function getAffectedDepartments(nodeIds = []) {
  const depts = new Set();
  for (const id of nodeIds) {
    if (id.includes('BRAND') || id.includes('ARTWORK')) depts.add('Brand & Marketing');
    if (id.includes('LEGAL') || id.includes('CLAIM') || id.includes('CERTIFICATION')) depts.add('Legal & Regulatory');
    if (id.includes('RND') || id.includes('FORMULATION') || id.includes('NUTRITION')) depts.add('R&D & Food Science');
    if (id.includes('PREPRESS')) depts.add('Prepress & Production');
  }
  return Array.from(depts);
}

export function isCheckAffectedByNode(checkId = '', nodeId = '') {
  const impacts = findDownstreamImpacts(nodeId);
  const checkMap = {
    'DF-02': 'ARTWORK.INGREDIENTS',
    'DF-04': 'ARTWORK.NO_ADDED_SUGAR_CLAIM',
    'DF-05': 'ARTWORK.VEGAN_CLAIM',
    'DF-06': 'ALLERGENS.TREE_NUTS',
    'DF-09': 'NUTRITION.ADDED_SUGARS',
    'DF-11': 'NUTRITION.CHOLESTEROL',
  };
  const targetNode = checkMap[checkId];
  return targetNode ? impacts.includes(targetNode) : false;
}

const canonicalGraph = buildCanonicalDependencyGraph();
export const DECISION_DEPENDENCY_GRAPH = Object.fromEntries(
  Array.from(canonicalGraph.nodes.entries()).map(([k, v]) => {
    const deps = canonicalGraph.edges.filter(e => e.to === k).map(e => e.from);
    const dependents = canonicalGraph.edges.filter(e => e.from === k).map(e => e.to);
    return [k, { ...v, dependencies: deps, dependents }];
  })
);
