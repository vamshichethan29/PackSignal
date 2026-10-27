/**
 * @file requirements-map.mjs
 * 
 * PackSignal Phase 7 — Requirements Map & Evidence Board Graph
 * Renders an interactive DAG/evidence board of rules, facts, findings, questions, and deliverables.
 * Answering a question live turns dependent nodes green!
 */

import { getDeskSession } from './evidence-desk.mjs';

/**
 * Base graph definition connecting rules, facts, findings, questions, and packaging elements.
 */
export function getRequirementsMapGraph({ market = 'US', answeredQuestionIds = [] } = {}) {
  const desk = getDeskSession('default');
  const marketCode = String(market).toLowerCase();

  // Resolved questions set
  const resolvedSet = new Set(answeredQuestionIds);

  const nodes = [
    // 1. Regulatory Rule Nodes
    {
      id: 'node-rule-sugar-claim',
      type: 'RULE',
      label: marketCode === 'in' ? 'FSSAI Reg. 4(3) Sugar Claim' : 'FDA 21 CFR 101.60 Sugar Claim',
      category: 'REGULATION',
      status: resolvedSet.has('Q-CLAIM-SUGAR') ? 'GREEN' : 'RED',
      x: 120,
      y: 80
    },
    {
      id: 'node-rule-allergen-falcpa',
      type: 'RULE',
      label: marketCode === 'in' ? 'FSSAI Reg. 5(4) Tree Nuts' : 'FALCPA 21 U.S.C. 343(w) Tree Nuts',
      category: 'REGULATION',
      status: resolvedSet.has('Q-ALLERGEN-SPECIES') ? 'GREEN' : 'RED',
      x: 120,
      y: 180
    },
    {
      id: 'node-rule-net-quantity',
      type: 'RULE',
      label: marketCode === 'in' ? 'Legal Metrology Metric Rule 12' : '21 CFR 101.7 Net Quantity',
      category: 'REGULATION',
      status: 'GREEN', // 480g passed
      x: 120,
      y: 280
    },
    {
      id: 'node-rule-nutrition-math',
      type: 'RULE',
      label: 'Nutrition Serving Size Math (21 CFR 101.9)',
      category: 'REGULATION',
      status: resolvedSet.has('Q-SERVING-SIZE-MATH') ? 'GREEN' : 'RED',
      x: 120,
      y: 380
    },

    // 2. Fact Sheet Fact Nodes
    {
      id: 'node-fact-honey',
      type: 'FACT',
      label: 'Fact: Honey Ratio (9% Clover Honey)',
      category: 'FACT',
      status: 'GREEN',
      x: 360,
      y: 80
    },
    {
      id: 'node-fact-walnuts',
      type: 'FACT',
      label: 'Fact: Unapproved Walnuts Added',
      category: 'FACT',
      status: resolvedSet.has('Q-ALLERGEN-SPECIES') ? 'GREEN' : 'RED',
      x: 360,
      y: 180
    },
    {
      id: 'node-fact-serving-size',
      type: 'FACT',
      label: 'Fact: Servings Mismatch (8x85g=680g)',
      category: 'FACT',
      status: resolvedSet.has('Q-SERVING-SIZE-MATH') ? 'GREEN' : 'RED',
      x: 360,
      y: 380
    },

    // 3. Question Nodes
    {
      id: 'node-q-sugar-claim',
      type: 'QUESTION',
      label: 'Q: Remove "NO ADDED SUGAR" Claim?',
      category: 'QUESTION',
      questionId: 'Q-CLAIM-SUGAR',
      status: resolvedSet.has('Q-CLAIM-SUGAR') ? 'GREEN' : 'AMBER',
      x: 600,
      y: 80
    },
    {
      id: 'node-q-allergen-species',
      type: 'QUESTION',
      label: 'Q: Specify Botanical Nut Species?',
      category: 'QUESTION',
      questionId: 'Q-ALLERGEN-SPECIES',
      status: resolvedSet.has('Q-ALLERGEN-SPECIES') ? 'GREEN' : 'AMBER',
      x: 600,
      y: 180
    },
    {
      id: 'node-q-serving-math',
      type: 'QUESTION',
      label: 'Q: Correct Serving Size to 55g (9 Servings)?',
      category: 'QUESTION',
      questionId: 'Q-SERVING-SIZE-MATH',
      status: resolvedSet.has('Q-SERVING-SIZE-MATH') ? 'GREEN' : 'AMBER',
      x: 600,
      y: 380
    },

    // 4. Packaging Deliverable Nodes
    {
      id: 'node-deliv-pdp-art',
      type: 'DELIVERABLE',
      label: 'Front PDP Art: Remediated Copy',
      category: 'OUTPUT',
      status: resolvedSet.has('Q-CLAIM-SUGAR') ? 'GREEN' : 'AMBER',
      x: 840,
      y: 80
    },
    {
      id: 'node-deliv-back-art',
      type: 'DELIVERABLE',
      label: 'Back Panel: Compliant Allergen Statement',
      category: 'OUTPUT',
      status: resolvedSet.has('Q-ALLERGEN-SPECIES') ? 'GREEN' : 'AMBER',
      x: 840,
      y: 180
    },
    {
      id: 'node-deliv-nutrition-art',
      type: 'DELIVERABLE',
      label: 'Nutrition Facts: Verified Atwater & Servings',
      category: 'OUTPUT',
      status: resolvedSet.has('Q-SERVING-SIZE-MATH') ? 'GREEN' : 'AMBER',
      x: 840,
      y: 380
    }
  ];

  // If India market is selected, add India-specific nodes
  if (marketCode === 'in') {
    nodes.push({
      id: 'node-rule-in-veg-mark',
      type: 'RULE',
      label: 'FSSAI Green Veg Dot (Reg 2.2.2.4)',
      category: 'REGULATION',
      status: resolvedSet.has('Q-IN-VEG-MARK') ? 'GREEN' : 'RED',
      x: 120,
      y: 480
    });
    nodes.push({
      id: 'node-q-in-veg-mark',
      type: 'QUESTION',
      label: 'Q: Add 6mm Green Veg Dot to PDP?',
      category: 'QUESTION',
      questionId: 'Q-IN-VEG-MARK',
      status: resolvedSet.has('Q-IN-VEG-MARK') ? 'GREEN' : 'AMBER',
      x: 600,
      y: 480
    });
    nodes.push({
      id: 'node-deliv-in-veg-mark',
      type: 'DELIVERABLE',
      label: 'PDP Art: FSSAI Green Dot Emblem',
      category: 'OUTPUT',
      status: resolvedSet.has('Q-IN-VEG-MARK') ? 'GREEN' : 'AMBER',
      x: 840,
      y: 480
    });
  }

  const edges = [
    { from: 'node-rule-sugar-claim', to: 'node-fact-honey' },
    { from: 'node-fact-honey', to: 'node-q-sugar-claim' },
    { from: 'node-q-sugar-claim', to: 'node-deliv-pdp-art' },

    { from: 'node-rule-allergen-falcpa', to: 'node-fact-walnuts' },
    { from: 'node-fact-walnuts', to: 'node-q-allergen-species' },
    { from: 'node-q-allergen-species', to: 'node-deliv-back-art' },

    { from: 'node-rule-nutrition-math', to: 'node-fact-serving-size' },
    { from: 'node-fact-serving-size', to: 'node-q-serving-math' },
    { from: 'node-q-serving-math', to: 'node-deliv-nutrition-art' }
  ];

  if (marketCode === 'in') {
    edges.push({ from: 'node-rule-in-veg-mark', to: 'node-q-in-veg-mark' });
    edges.push({ from: 'node-q-in-veg-mark', to: 'node-deliv-in-veg-mark' });
  }

  const totalNodes = nodes.length;
  const greenNodes = nodes.filter(n => n.status === 'GREEN').length;
  const redNodes = nodes.filter(n => n.status === 'RED').length;
  const amberNodes = nodes.filter(n => n.status === 'AMBER').length;

  return {
    market: market.toUpperCase(),
    nodes,
    edges,
    stats: {
      totalNodes,
      greenNodes,
      redNodes,
      amberNodes,
      completionPercent: Math.round((greenNodes / totalNodes) * 100)
    }
  };
}

/**
 * Answering a question turns dependent nodes green!
 */
export function answerRequirementsQuestion(questionId, answeredQuestions = []) {
  const current = new Set(answeredQuestions);
  current.add(questionId);
  return Array.from(current);
}
