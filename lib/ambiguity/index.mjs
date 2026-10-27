/**
 * PackSignal Ambiguity Resolution Engine — Master Entrypoint
 * (lib/ambiguity/index.mjs)
 */

export { detectAmbiguities } from './detector.mjs';
export { validateAnswer } from './answer-validator.mjs';
export { buildDependencyPlan, getDependentChecks, EVALUATOR_REGISTRY } from './dependency-graph.mjs';
export { resolveAndReevaluate, executionTracker, EVALUATOR_RUNNERS } from './incremental-runner.mjs';
export { QUESTION_TYPES, QUESTION_STATUS, QUESTION_PRIORITY, ANSWER_TYPES, QUESTION_TYPE_METADATA } from './question-types.mjs';
export { deduplicateQuestions, buildCanonicalQuestionId } from './deduplication.mjs';
export { calculateQuestionPriority } from './priority.mjs';
export { buildQuestion } from './question-builder.mjs';
