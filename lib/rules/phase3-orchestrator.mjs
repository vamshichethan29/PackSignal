/**
 * PackSignal Phase 3 Orchestrator (lib/rules/phase3-orchestrator.mjs)
 * 
 * Coordinates:
 * - Date-aware market pack loading (markets/us/)
 * - Rule applicability and deterministic evaluation
 * - Prioritized smart question queue (HARD MAX 10)
 * - Brand design asset extraction & keep/change/add/remove decisions
 * - Creative brief decision projection
 */

import { loadMarketPack } from './market-pack-loader.mjs';
import { evaluateRule } from './rule-evaluator.mjs';
import { buildCandidateQuestions } from '../questions/question-builder.mjs';
import { rankQuestions } from '../questions/question-priority.mjs';
import { deduplicateAndCapQuestions } from '../questions/question-deduplication.mjs';
import { extractArtworkDesignAssets, projectDesignDecisionsToBrief } from '../brief/design-decisions.mjs';
import { RuleDependencyGraph } from './rule-dependencies.mjs';

export function runPhase3Evaluation(params) {
  const {
    market = 'us',
    launchDate = '2026-10-16',
    facts = [],
    conflicts = [],
    visionMarks = [],
    productCategory = 'granola',
    userAnswers = {},
    userDesignDecisions = {}
  } = params;

  // 1. Load date-aware market pack
  const loadedPack = loadMarketPack(market, { launchDate });
  const { effectiveRules, referenceData } = loadedPack;

  const rulesById = new Map(loadedPack.allRules.map(r => [r.ruleId, r]));

  // Evaluation context
  const context = {
    market: market.toUpperCase(),
    launchDate,
    product: {
      category: productCategory
    },
    label: {
      population: 'adults_and_children_4_plus'
    },
    barcode: {
      value: '120000000036',
      symbology: 'UPC-A'
    },
    ...userAnswers
  };

  // 2. Evaluate all active rules
  const evaluations = [];
  const statusCounts = {
    PASS: 0,
    ISSUE: 0,
    NEEDS_REVIEW: 0,
    UNABLE_TO_VERIFY: 0,
    NOT_APPLICABLE: 0
  };

  for (const rule of effectiveRules) {
    const res = evaluateRule(rule, facts, referenceData, context);
    evaluations.push(res);
    statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;
  }

  // 3. Extract verified design assets
  const rawDesignAssets = extractArtworkDesignAssets(facts, visionMarks);
  const designAssetsWithDecisions = rawDesignAssets.map(asset => {
    const userChoice = userDesignDecisions[asset.assetId];
    if (userChoice) {
      return {
        ...asset,
        decision: userChoice.decision || userChoice,
        reviewerReason: userChoice.reason || '',
        approvalState: 'DECIDED'
      };
    }
    return asset;
  });

  const briefDecisions = projectDesignDecisionsToBrief(designAssetsWithDecisions);

  // 4. Generate & rank smart questions
  const candidateQuestions = buildCandidateQuestions({
    facts,
    conflicts,
    evaluations,
    marketPack: loadedPack,
    designAssets: designAssetsWithDecisions
  });

  const ranked = rankQuestions(candidateQuestions, rulesById);
  const { prioritizedQuestions, backlogQuestions } = deduplicateAndCapQuestions(ranked, 10);

  // 5. Dependency graph
  const dependencyGraph = new RuleDependencyGraph();
  for (const q of prioritizedQuestions) {
    dependencyGraph.registerQuestion(q.questionId, q.affectedRules || []);
    if (userAnswers[q.questionId]) {
      dependencyGraph.resolveQuestion(q.questionId, userAnswers[q.questionId]);
    }
  }

  return {
    status: 'SUCCESS',
    phase: 'Phase 3 — Rules, Requirements and Smart Questions',
    market: loadedPack.market,
    launchDate,
    regulator: loadedPack.pack.regulator,
    rulePackVersion: loadedPack.pack.version,
    evaluations,
    statusCounts,
    summary: {
      totalRulesEvaluated: evaluations.length,
      passed: statusCounts.PASS,
      issues: statusCounts.ISSUE,
      needsReview: statusCounts.NEEDS_REVIEW,
      unableToVerify: statusCounts.UNABLE_TO_VERIFY,
      notApplicable: statusCounts.NOT_APPLICABLE,
      activeQuestionsCount: prioritizedQuestions.length,
      backlogQuestionsCount: backlogQuestions.length,
      designAssetsCount: designAssetsWithDecisions.length
    },
    prioritizedQuestions,
    backlogQuestions,
    designAssets: designAssetsWithDecisions,
    brief: briefDecisions,
    referenceData
  };
}
