/**
 * PackSignal Question Resolution & Re-Evaluation Engine (lib/questions/resolution.mjs)
 * Implements Phase 22: Records answers, unblocks dependent checks,
 * updates affected facts, and re-evaluates dependent findings.
 */

import { resolveFactConflict } from '../regulatory/facts.mjs';

export function resolveGuidedQuestion(review, questionId, answerData, actor = null) {
  review.questionAnswers ||= {};
  review.options ||= {};

  const record = {
    questionId,
    answer: answerData.answer,
    supportingSourceId: answerData.supportingSourceId || null,
    explanation: answerData.explanation || '',
    answeredBy: actor?.displayName || actor?.id || 'reviewer',
    answeredAt: new Date().toISOString(),
  };

  review.questionAnswers[questionId] = record;

  // Apply side-effects based on question type
  const affectedFields = [];

  // 1. Source Authority Resolution
  if (questionId.includes('source_authority')) {
    if (String(answerData.answer).toLowerCase().includes('approved')) {
      review.options.sourceConfirmed = true;
      affectedFields.push('source_status');
    }
  }

  // 2. Nutrition Basis Resolution
  if (questionId.includes('nutrition_basis')) {
    const basisVal = String(answerData.answer).toLowerCase().includes('100') ? 'per_100g' : 'per_serving';
    let basisFact = (review.facts || []).find(f => f.field === 'nutrition.basis');
    if (!basisFact) {
      basisFact = { field: 'nutrition.basis', label: 'Nutrition basis' };
      review.facts ||= [];
      review.facts.push(basisFact);
    }
    basisFact.value = basisVal;
    basisFact.verified = true;
    affectedFields.push('nutrition.basis', 'nutrition_dv', 'atwater_screen');
  }

  // 3. Conflict Resolution
  if (questionId.includes('conflict:')) {
    const parts = questionId.split(':');
    const field = parts[2];
    if (field && answerData.selectedFactId) {
      resolveFactConflict(review, field, answerData.selectedFactId, actor, answerData.explanation);
      affectedFields.push(field);
    }
  }

  // 4. Serving Size Resolution
  if (questionId.includes('serving_size')) {
    let servingFact = (review.facts || []).find(f => f.field === 'serving_size');
    if (!servingFact) {
      servingFact = { field: 'serving_size', label: 'Serving size' };
      review.facts ||= [];
      review.facts.push(servingFact);
    }
    servingFact.value = String(answerData.answer).trim();
    servingFact.verified = true;
    affectedFields.push('serving_size', 'servings_per_container');
  }

  // 5. Allergen Scope Resolution
  if (questionId.includes('allergen_formulation')) {
    let allergenFact = (review.facts || []).find(f => f.field === 'allergens');
    if (!allergenFact) {
      allergenFact = { field: 'allergens', label: 'Allergens' };
      review.facts ||= [];
      review.facts.push(allergenFact);
    }
    allergenFact.value = String(answerData.answer).trim();
    allergenFact.verified = true;
    affectedFields.push('allergens');
  }

  if (Array.isArray(review.guidedQuestions)) {
    const q = review.guidedQuestions.find(i => i.questionId === questionId);
    if (q) {
      q.status = 'RESOLVED';
      q.answer = record;
    }
  }

  return {
    success: true,
    questionId,
    record,
    affectedFields,
    review,
  };
}

export function resolveQuestion(review, questionId, answerData, actor = null) {
  resolveGuidedQuestion(review, questionId, answerData, actor);
  return review;
}

