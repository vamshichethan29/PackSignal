/**
 * PackSignal Guided Follow-Up Questions Generator (lib/questions/generator.mjs)
 * Implements Phase 21: Converts uncertainty, missing facts, and source conflicts
 * into prioritized reviewer action items that unblock deterministic checks.
 */

import { createHash } from 'node:crypto';

const hashId = s => createHash('sha256').update(s).digest('hex').slice(0, 14);

export function generateFollowUpQuestions(review) {
  const docs = review.documents || [];
  const facts = review.facts || review.structuredFacts || [];
  const storedQuestions = review.guidedQuestions || [];
  const storedAnswers = review.questionAnswers || {};
  const conflicts = review.conflicts || review.factConflicts || [];
  const findings = review.findings || [];

  const generated = [];

  // 1. Source Authority Question
  const draftDocs = docs.filter(d => ['spec', 'brief', 'formulation'].includes(d.role) && /draft|review|unconfirmed/i.test(d.data?.status || d.text || ''));
  if (draftDocs.length > 0 && !review.options?.sourceConfirmed) {
    const qId = hashId(`q:source_authority:${review.id}`);
    generated.push({
      questionId: qId,
      reviewId: review.id,
      title: 'Confirm Source Specification Authority',
      question: `Document "${draftDocs[0].name}" is marked "${draftDocs[0].data?.status || 'Draft / In Review'}". Is this document authorized as the approved specification for packaging release?`,
      reason: 'Unconfirmed source status blocks definitive production error verdicts.',
      requiredInformation: 'Confirmation of approved source document authority.',
      linkedFactIds: [],
      linkedFindingIds: findings.filter(f => f.key === 'source-status').map(f => f.id),
      linkedRuleIds: ['DF-01'],
      sourceEvidence: { documentId: draftDocs[0].id, name: draftDocs[0].name },
      answerType: 'SINGLE_SELECT',
      options: ['Confirm as Approved Reference', 'Keep as Draft / Advisory Only', 'Upload New Master Specification'],
      priority: 'HIGH',
      status: storedAnswers[qId] ? 'RESOLVED' : 'OPEN',
      answer: storedAnswers[qId] || null,
      createdAt: review.createdAt || new Date().toISOString(),
    });
  }

  // 2. Nutrition Serving Basis Question
  const hasNutrition = facts.some(f => f.field?.startsWith('nutrition.') || f.field === 'calories' || f.group === 'nutrition');
  const basisFact = facts.find(f => f.field === 'nutrition.basis' || f.field === 'serving_basis');
  if (hasNutrition && (!basisFact || /unconfirmed|not identified/i.test(basisFact.value))) {
    const qId = hashId(`q:nutrition_basis:${review.id}`);
    generated.push({
      questionId: qId,
      reviewId: review.id,
      title: 'Specify Nutrition Calculation Basis',
      question: 'Are the source nutrition values declared per serving or per 100 g / 100 mL?',
      reason: 'Nutrition % Daily Value and Atwater 4-4-9 checks require a verified serving basis.',
      requiredInformation: 'Nutrition reference basis (per serving vs per 100 g).',
      linkedFactIds: facts.filter(f => f.field.startsWith('nutrition.')).map(f => f.id),
      linkedFindingIds: findings.filter(f => f.key.includes('nutrition')).map(f => f.id),
      linkedRuleIds: ['DF-07', '21 CFR 101.9'],
      sourceEvidence: null,
      answerType: 'SINGLE_SELECT',
      options: ['Per Serving', 'Per 100 g', 'Per 100 mL'],
      priority: 'HIGH',
      status: storedAnswers[qId] ? 'RESOLVED' : 'OPEN',
      answer: storedAnswers[qId] || null,
      createdAt: review.createdAt || new Date().toISOString(),
    });
  }

  // 3. Source Conflict Questions
  for (const c of conflicts) {
    const qId = hashId(`q:conflict:${c.field}:${review.id}`);
    const competingStr = c.facts.map(f => `"${f.value}" (from ${f.documentName || 'source'})`).join(' vs ');
    generated.push({
      questionId: qId,
      reviewId: review.id,
      title: `Resolve Conflicting Values: ${c.label}`,
      question: `Conflicting specifications detected for ${c.label}: ${competingStr}. Which value is authoritative for this packaging revision?`,
      reason: `Resolving this conflict unblocks deterministic copy comparison for ${c.label}.`,
      requiredInformation: `Authoritative value selection for ${c.label}.`,
      linkedFactIds: c.facts.map(f => f.id),
      linkedFindingIds: findings.filter(f => f.key === `conflict:${c.field}`).map(f => f.id),
      linkedRuleIds: [],
      sourceEvidence: c.facts.map(f => f.evidence),
      answerType: 'SINGLE_SELECT',
      options: c.facts.map(f => `${f.value} (${f.documentName || 'Source'})`),
      priority: 'HIGH',
      status: storedAnswers[qId] ? 'RESOLVED' : 'OPEN',
      answer: storedAnswers[qId] || null,
      createdAt: review.createdAt || new Date().toISOString(),
    });
  }

  // 4. Missing Serving Size Question
  const servingSizeFact = facts.find(f => f.field === 'serving_size');
  if (hasNutrition && !servingSizeFact) {
    const qId = hashId(`q:serving_size:${review.id}`);
    generated.push({
      questionId: qId,
      reviewId: review.id,
      title: 'Specify Approved Serving Size',
      question: 'What is the approved serving size in metric grams (g) or fluid milliliters (mL)?',
      reason: 'Serving size is required to calculate servings per container and % Daily Values.',
      requiredInformation: 'Numerical serving size with unit (e.g. 55 g).',
      linkedFactIds: [],
      linkedFindingIds: [],
      linkedRuleIds: ['21 CFR 101.9(b)'],
      sourceEvidence: null,
      answerType: 'TEXT',
      options: [],
      priority: 'MEDIUM',
      status: storedAnswers[qId] ? 'RESOLVED' : 'OPEN',
      answer: storedAnswers[qId] || null,
      createdAt: review.createdAt || new Date().toISOString(),
    });
  }

  // 5. Sesame / Allergen Clarification Question
  const allergenFact = facts.find(f => f.field === 'allergens');
  if (!allergenFact) {
    const qId = hashId(`q:allergen_formulation:${review.id}`);
    generated.push({
      questionId: qId,
      reviewId: review.id,
      title: 'Confirm Major Allergen Disclosure Scope',
      question: 'Does this product formulation contain any of the 9 US Major Food Allergens (Milk, Egg, Fish, Shellfish, Tree nuts, Peanuts, Wheat, Soy, Sesame)?',
      reason: 'FALCPA and FASTER Act require verification against approved formulation.',
      requiredInformation: 'Major food allergen presence list.',
      linkedFactIds: [],
      linkedFindingIds: findings.filter(f => f.key.includes('allergen')).map(f => f.id),
      linkedRuleIds: ['21 U.S.C. 343(w)'],
      sourceEvidence: null,
      answerType: 'TEXT',
      options: [],
      priority: 'HIGH',
      status: storedAnswers[qId] ? 'RESOLVED' : 'OPEN',
      answer: storedAnswers[qId] || null,
      createdAt: review.createdAt || new Date().toISOString(),
    });
  }

  // Preserve existing manually added questions
  const existingCustom = storedQuestions.filter(q => !generated.some(g => g.questionId === q.questionId));
  return [...generated, ...existingCustom].sort((a, b) => (a.priority === 'HIGH' ? -1 : 1));
}

export const generateGuidedQuestions = generateFollowUpQuestions;

